// lib/scrapers/borme.ts — Sprint B.1: Scraper de BORME (Boletín Oficial del Registro Mercantil).
//
// Endpoint público (sin auth) de "datos abiertos" del BOE:
//   JSON: https://www.boe.es/datosabiertos/api/borme/sumario/YYYYMMDD
//   XML por provincia: https://www.boe.es/diario_borme/xml.php?id=BORME-A-YYYY-NNN-KK
//
// Estructura de cada item XML (sec. A — Actos inscritos):
//   <documento fecha_actualizacion="...">
//     <metadatos><identificador>...</identificador><titulo>PROVINCIA</titulo>...</metadatos>
//     <texto>
//       <p class="articulo">258980 - DROMO GESTION 2026 SOCIEDAD LIMITADA.</p>
//       <p class="parrafo">Constitución. Comienzo de operaciones: ... Domicilio: ...</p>
//       <p class="articulo">258981 - LOGISTICA ALBARESA SOCIEDAD ANONIMA.</p>
//       <p class="parrafo">Reelecciones. ...</p>
//       ...
//     </texto>
//   </documento>
//
// El scraper:
//   1. Recorre los últimos N días (backfill) — por defecto 1 día
//   2. Para cada día, llama al JSON de sumario → lista de items por provincia (sec. A)
//   3. Para cada item, fetch XML → parsea <p class="articulo"> + <p class="parrafo">
//   4. Clasifica cada acto (cambio domicilio, constitución, concurso, M&A...)
//   5. Extrae CIF, domicilio, capital
//   6. Devuelve RawBormeItem[] listo para que el runner aplique el filtro deimplantation
//
// Sin dependencias nuevas (usa xml2js ya disponible en cheerio/xml2js via Node 22).

import type { BormeActKind, BormeScrapeOptions, RawBormeItem } from './types';
import { USER_AGENT } from './types';

// Re-exportar tipos para que el runner los pueda importar desde este módulo.
export type { BormeActKind, BormeScrapeOptions, RawBormeItem };

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BOE_BORME_API = 'https://www.boe.es/datosabiertos/api/borme/sumario/';
const BOE_BORME_XML = 'https://www.boe.es/diario_borme/xml.php';

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_BACKOFF_MS = 1500;
const MAX_HTTP_RETRIES = 1;
const INTER_PROVINCE_DELAY_MS = 250; // throttle gentil entre provincias (0.25s)

// Mapeo de actos frecuentes → BormeActKind. Si no matchea, queda como 'other'.
const ACT_PATTERNS: ReadonlyArray<{ pattern: RegExp; kind: BormeActKind }> = [
  { pattern: /cambio de domicilio social/i, kind: 'cambio_domicilio' },
  { pattern: /traslado de domicilio/i, kind: 'cambio_domicilio' },
  { pattern: /domicilio:/i, kind: 'cambio_domicilio' },
  { pattern: /ampliacion de capital/i, kind: 'ampliacion_capital' },
  { pattern: /ampli[ae]r capital/i, kind: 'ampliacion_capital' },
  { pattern: /reduccion de capital/i, kind: 'reduccion_capital' },
  { pattern: /disoluci[oó]n/i, kind: 'disolucion' },
  { pattern: /cese de la sociedad/i, kind: 'disolucion' },
  { pattern: /constituci[oó]n\b/i, kind: 'constitucion' },
  { pattern: /reeleccion/i, kind: 'reeleccion' },
  { pattern: /nombramiento/i, kind: 'nombramiento' },
  { pattern: /cese\b/i, kind: 'cese' },
  { pattern: /transformaci[oó]n/i, kind: 'transformacion' },
  { pattern: /fusi[oó]n(?: por absorci[oó]n)?/i, kind: 'fusion_absorcion' },
  { pattern: /absorci[oó]n/i, kind: 'fusion_absorcion' },
  { pattern: /escisi[oó]n/i, kind: 'escision' },
  { pattern: /modificacion de estatutos/i, kind: 'modificacion_estatutos' },
  { pattern: /concurso de acreedores/i, kind: 'declaracion_concurso' },
  { pattern: /declarar en estado de concurso/i, kind: 'declaracion_concurso' },
  { pattern: /situaci[oó]n concursal/i, kind: 'declaracion_concurso' },
  { pattern: /extinci[oó]n/i, kind: 'extincion' },
];

// ---------------------------------------------------------------------------
// Tipos del JSON del sumario (subset)
// ---------------------------------------------------------------------------

interface BoeSumarioItem {
  identificador: string;
  titulo: string;
  url_xml?: string;
  url_html?: string;
  url_pdf?: { texto: string };
}

interface BoeSumarioResponse {
  status: { code: string; text: string };
  data: {
    sumario: {
      metadados: { publicacion: string; fecha_publicacion: string };
      diario: Array<{
        numero: string;
        sumario_diario: { identificador: string };
        seccion: Array<{
          codigo: string;
          item: BoeSumarioItem[];
        }>;
      }>;
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Fetch con timeout + 1 retry exponencial. */
async function fetchWithRetry(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ status: number; text: string }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_HTTP_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json, application/xml;q=0.9, */*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5',
          ...(opts.headers ?? {}),
        },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        // Retry solo para 5xx y 429.
        if (res.status >= 500 || res.status === 429) {
          await sleep(DEFAULT_BACKOFF_MS * (attempt + 1));
          continue;
        }
        return { status: res.status, text: '' };
      }
      return { status: res.status, text: await res.text() };
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      await sleep(DEFAULT_BACKOFF_MS * (attempt + 1));
    }
  }
  throw new Error(`fetch ${url} failed after ${MAX_HTTP_RETRIES + 1} attempts: ${String(lastErr)}`);
}

/** Parse XML BORME con regex (sin librerías — los items son consistentes). */
function parseBormeXml(xml: string, bormeId: string, provincia: string, publishedAt: string): RawBormeItem[] {
  // El XML viene UTF-8 con HTML entities ya escapadas (&amp;, &quot;...). Decodificamos entidades básicas.
  const decoded = xml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  // Extrae cada bloque <texto>...</texto>.
  const textoMatch = decoded.match(/<texto>([\s\S]*?)<\/texto>/);
  if (!textoMatch) return [];
  const textoBody = textoMatch[1];

  // Captura pares: articulo (id + nombre empresa) + parrafo (descripción acto).
  // El articulo: <p class="articulo">NUMERO - NOMBRE EMPRESA (CIF).</p>
  // El parrafo: <p class="parrafo">...</p>
  // Pueden venir varios pares en el mismo texto.

  const items: RawBormeItem[] = [];
  // Captura cada <p class="articulo">...</p> y <p class="parrafo">...</p> en orden.
  const blockRe = /<p\s+class="(articulo|parrafo)"\s*>([\s\S]*?)<\/p>/g;
  const blocks: Array<{ kind: 'articulo' | 'parrafo'; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(textoBody)) !== null) {
    blocks.push({ kind: m[1] as 'articulo' | 'parrafo', text: m[2].trim() });
  }

  // Itera pares (articulo, parrafo) — si no hay parrafo, el item queda con texto solo.
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].kind !== 'articulo') continue;
    const articulo = blocks[i].text;
    const next = blocks[i + 1];
    const parrafo = next && next.kind === 'parrafo' ? next.text : '';

    // Parsea "NUMERO - NOMBRE EMPRESA (CIF)." o "NUMERO - NOMBRE EMPRESA." o variantes.
    // Formatos reales:
    //   "258980 - DROMO GESTION 2026 SOCIEDAD LIMITADA."
    //   "258981 - LOGISTICA ALBARESA SOCIEDAD ANONIMA."
    //   "N - NOMBRE EMPRESA.(CIF)."
    const headMatch = articulo.match(/^(\d+)\s*-\s*(.+?)\.?\s*$/);
    if (!headMatch) continue;
    const numRegistro = headMatch[1];
    let companyName = headMatch[2].trim();
    // Detecta CIF inline al final "NOMBRE (A12345678)" — no siempre está.
    const cifInline = companyName.match(/^(.*?)\s*\(?([ABCDEFGHJNPQRSUVW]\d{7,8})\)?$/);
    let cif: string | null = null;
    if (cifInline) {
      companyName = cifInline[1].trim();
      cif = cifInline[2].toUpperCase();
    }

    const text = parrafo || articulo;
    if (text.length < 20) continue;

    // Detecta el tipo de acto.
    let actKind: BormeActKind = 'other';
    for (const r of ACT_PATTERNS) {
      if (r.pattern.test(text)) {
        actKind = r.kind;
        break;
      }
    }

    // Extrae domicilio: "Domicilio: C/ MAYOR 32 02001 (ALBACETE)."
    const domicilioMatch = text.match(/Domicilio:\s*([^\.]+?)(?:\.\s|Capital|$)/i);
    const domicilio = domicilioMatch ? domicilioMatch[1].trim() : null;

    // Extrae capital: "Capital: 2.209.330,00 Euros."
    const capitalMatch = text.match(/Capital:\s*([\d\.,]+)\s*(?:Euros|EUR|€)/i);
    const capital = capitalMatch ? capitalMatch[0].trim() : null;

    const id = `${provincia}-${numRegistro}-${i}`;

    items.push({
      id,
      companyName,
      cif,
      provincia,
      bormeId,
      url: `${BOE_BORME_XML}?id=${bormeId}`,
      text: `${companyName} — ${text}`,
      actKind,
      publishedAt,
      domicilio,
      capital,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Scrapea BORME para los últimos `daysBack` días.
 * Devuelve un array plano de RawBormeItem sin filtrar — el filtro
 * de desimplantación y los anti-M&A/subasta se aplican en el runner.
 *
 * Modo backfill: daysBack=15 para primera corrida (1ª ejec. del agente).
 * Modo incremental: daysBack=1 (cadencia 2d).
 */
export async function scrapeBorme(opts: BormeScrapeOptions = {}): Promise<RawBormeItem[]> {
  const daysBack = opts.daysBack ?? 1;
  const maxItems = opts.maxItems ?? 1000;
  const onlyProvincias = opts.onlyProvincias ?? null;
  const log = opts.onLog ?? (() => {});

  const items: RawBormeItem[] = [];
  const now = new Date();

  for (let d = 0; d < daysBack; d++) {
    if (items.length >= maxItems) break;
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - d);
    const ymdStr = ymd(date);
    const isoStr = isoDate(date);
    log(`[borme] sumario ${ymdStr}`);

    // 1) Sumario del día.
    let sumario: BoeSumarioResponse;
    try {
      const { status, text } = await fetchWithRetry(`${BOE_BORME_API}${ymdStr}`);
      if (status !== 200) {
        log(`[borme] sumario ${ymdStr} HTTP ${status} — skip`);
        continue;
      }
      sumario = JSON.parse(text) as BoeSumarioResponse;
    } catch (e) {
      log(`[borme] sumario ${ymdStr} error: ${(e as Error).message} — skip`);
      continue;
    }

    // 2) Recorre secciones A (Actos inscritos). Ignoramos B/C en B.1 (escisiones, anuncios, etc).
    const diarios = sumario.data?.sumario?.diario ?? [];
    let dayItems = 0;
    for (const diario of diarios) {
      for (const seccion of diario.seccion ?? []) {
        if (seccion.codigo !== 'A') continue;
        for (const itemMeta of seccion.item ?? []) {
          if (items.length >= maxItems) break;
          // Filtro opcional por provincia.
          const provinciaTitle = (itemMeta.titulo || '').toUpperCase().trim();
          if (onlyProvincias && !onlyProvincias.includes(provinciaTitle)) continue;

          await sleep(INTER_PROVINCE_DELAY_MS);

          // 3) Fetch XML del item.
          let xmlText: string;
          try {
            const { status, text } = await fetchWithRetry(itemMeta.url_xml || `${BOE_BORME_XML}?id=${itemMeta.identificador}`);
            if (status !== 200) {
              log(`[borme] ${itemMeta.identificador} HTTP ${status} — skip`);
              continue;
            }
            xmlText = text;
          } catch (e) {
            log(`[borme] ${itemMeta.identificador} error: ${(e as Error).message} — skip`);
            continue;
          }

          // 4) Parse XML → RawBormeItem[].
          const parsed = parseBormeXml(xmlText, itemMeta.identificador, provinciaTitle, isoStr);
          items.push(...parsed);
          dayItems += parsed.length;
        }
      }
    }
    log(`[borme] ${ymdStr} → ${dayItems} actos, total=${items.length}`);
  }

  return items;
}

/**
 * Versión "test" del scraper: scrapea un único item por su identificador BORME.
 * Útil para smoke tests deterministas.
 */
export async function scrapeBormeById(bormeId: string, opts: { userAgent?: string; onLog?: (m: string) => void } = {}): Promise<RawBormeItem[]> {
  const log = opts.onLog ?? (() => {});
  const url = `${BOE_BORME_XML}?id=${bormeId}`;
  log(`[borme] fetch ${url}`);
  const { status, text } = await fetchWithRetry(url);
  if (status !== 200) throw new Error(`HTTP ${status} para ${url}`);
  // Extrae provincia del metadatos: <titulo>PROVINCIA</titulo>.
  const titMatch = text.match(/<titulo>([^<]+)<\/titulo>/);
  const provincia = titMatch ? titMatch[1].toUpperCase().trim() : 'UNKNOWN';
  // Fecha: <fecha_publicacion>YYYYMMDD</fecha_publicacion>.
  const fechaMatch = text.match(/<fecha_publicacion>(\d{8})<\/fecha_publicacion>/);
  const publishedAt = fechaMatch
    ? `${fechaMatch[1].slice(0, 4)}-${fechaMatch[1].slice(4, 6)}-${fechaMatch[1].slice(6, 8)}`
    : new Date().toISOString().slice(0, 10);
  return parseBormeXml(text, bormeId, provincia, publishedAt);
}
