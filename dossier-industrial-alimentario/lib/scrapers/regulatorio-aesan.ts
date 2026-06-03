// lib/scrapers/regulatorio-aesan.ts — Sprint B.2: Scraper de AESAN alertas alimentarias.
//
// Fuente: AECOSAN listado HTML estático de alertas alimentarias (SCIRI).
//   URL: http://www.aesan.gob.es/AECOSAN/web/seguridad_alimentaria/alertas_alimentarias/listado/aecosan_listado_alertas_alimentarias.htm
//
// Estructura del listado (verificado 2026-06-04):
//   - Lista de <a href=".../2026_45.htm"> + fecha (texto plano al lado)
//   - Sin paginación, sin AJAX. Renderizado server-side completo.
//   - En cada detalle:
//     * Título: "Alerta por presencia de ..."
//     * Referencia: ES2026/327 (en el título o cuerpo)
//     * Fecha: dd Month YYYY (en el cuerpo)
//     * Producto, hazard, empresa/marca: en el cuerpo del texto
//
// El scraper:
//   1. Fetch listado → [{title, url, date}]
//   2. Para cada alerta con `date >= now - daysBack`, fetch detalle → parsea campos
//   3. Devuelve RawAesanAlert[] listo para filtro deimplantation
//
// Sin dependencias nuevas. Respeto throttle 3s entre fetches de detalle.

import * as cheerio from 'cheerio';
import type { AesanScrapeOptions, RawAesanAlert } from './types';
import { USER_AGENT } from './types';

// Re-exportar tipos para que el runner los pueda importar.
export type { AesanScrapeOptions, RawAesanAlert };

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const AESAN_LIST_URL =
  'http://www.aesan.gob.es/AECOSAN/web/seguridad_alimentaria/alertas_alimentarias/listado/aecosan_listado_alertas_alimentarias.htm';
const AESAN_BASE_URL = 'http://www.aesan.gob.es';

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_ALERTS = 50;
const DEFAULT_DAYS_BACK = 7;
const DEFAULT_DETAIL_DELAY_MS = 3_000;
const MAX_HTTP_RETRIES = 1;

// Meses en español (largo) para parsear "3 Junio 2026".
const SPANISH_MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

// Patrones para extraer campos del detalle.
const RE_REFERENCE = /\bES\d{4}\/\d{2,4}(?:-\d{1,3})?\b/;
const RE_DATE_DDMMMYYYY = /\b(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})\b/i;

// Hazard patterns (palabras clave que identifican el tipo de peligro).
const HAZARD_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /listeria monocytogenes/i, label: 'Listeria monocytogenes' },
  { pattern: /salmonella/i, label: 'Salmonella' },
  { pattern: /\be\. coli\b|escherichia coli/i, label: 'E. coli' },
  { pattern: /norovirus/i, label: 'Norovirus' },
  { pattern: /histamina/i, label: 'Histamina' },
  { pattern: /metales pesados/i, label: 'Metales pesados' },
  { pattern: /plomo/i, label: 'Plomo' },
  { pattern: /cadmio/i, label: 'Cadmio' },
  { pattern: /mercurio/i, label: 'Mercurio' },
  { pattern: /ars[eé]nico/i, label: 'Arsénico' },
  { pattern: /pesticidas?|plaguicidas?/i, label: 'Pesticidas' },
  { pattern: /micotoxinas?|aflatoxinas?|ocratoxina/i, label: 'Micotoxinas' },
  { pattern: /al[eé]rgeno no declarado/i, label: 'Alérgeno no declarado' },
  { pattern: /fragmentos de (?:pl[aá]stico|metal|vidrio|hueso)/i, label: 'Cuerpo extraño' },
  { pattern: /cuerpo extra[ñn]o/i, label: 'Cuerpo extraño' },
  { pattern: /biocida/i, label: 'Biocida' },
  { pattern: /tolerable (?:semanal|diaria)/i, label: 'Exceso ingesta' },
  { pattern: /dioxinas?|pcb/i, label: 'Dioxinas/PCB' },
];

// Productos frecuentes (para extraer "producto afectado").
const PRODUCT_HINTS: readonly string[] = [
  'queso', 'leche', 'yogur', 'mantequilla', 'nata',
  'carne', 'pollo', 'cerdo', 'ternera', 'cordero', 'hamburguesa',
  'pescado', 'at[uú]n', 'salm[oó]n', 'merluza', 'bacalao', 'anchoa', 'sardina',
  'marisco', 'gamba', 'langostino', 'mejill[oó]n',
  'fruta', 'verdura', 'hortaliza', 'espinaca', 'lechuga',
  'pan', 'galleta', 'boller[ií]a', 'pasta', 'arroz',
  'aceite de oliva', 'aceituna',
  'vino', 'cerveza', 'bebida', 'zumo',
  'chocolate', 'helado', 'postre',
  'especias', 'salsa', 'salsa de soja', 'salsa pesto',
  'complemento alimenticio', 'suplemento',
  'brotes', 'semillas', 'frutos secos', 'almendra', 'nuez', 'cacahuete', 'pistacho',
  'comida preparada', 'plato preparado',
  'esparrago', 'pimiento', 'tomate', 'pepino',
  'h[uú]evo', 'ovoproducto',
  'pienso', 'pienso para',
];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSpanishDate(text: string): Date | null {
  const m = text.match(RE_DATE_DDMMMYYYY);
  if (!m) return null;
  const day = parseInt(m[1] ?? '0', 10);
  const monthName = (m[2] ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const month = SPANISH_MONTHS[monthName] ?? NaN;
  const year = parseInt(m[3] ?? '0', 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, month, day));
}

function extractReference(text: string): string | null {
  const m = text.match(RE_REFERENCE);
  return m ? m[0] : null;
}

function extractHazard(text: string): string | null {
  for (const { pattern, label } of HAZARD_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

function extractProduct(text: string): string | null {
  const lower = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const hint of PRODUCT_HINTS) {
    const normHint = hint.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (lower.includes(normHint)) return hint;
  }
  return null;
}

function extractBrand(text: string): string | null {
  // Heurística: la marca suele aparecer como "marca comercial X" o "de la empresa X"
  // o entre comillas después de "marca".
  const patterns = [
    /marca\s+comercial\s+["']?([A-ZÁÉÍÓÚÑ][\w\s&\-.'ª]{2,40})["']?/i,
    /marca\s+["']?([A-ZÁÉÍÓÚÑ][\w\s&\-.'ª]{2,40})["']?/i,
    /de\s+la\s+empresa\s+([A-ZÁÉÍÓÚÑ][\w\s&\-.'ª]{2,60})/i,
    /producid[oa]\s+por\s+([A-ZÁÉÍÓÚÑ][\w\s&\-.'ª]{2,60})/i,
    /fabricad[oa]\s+por\s+([A-ZÁÉÍÓÚÑ][\w\s&\-.'ª]{2,60})/i,
    /comercializad[oa]\s+por\s+([A-ZÁÉÍÓÚÑ][\w\s&\-.'ª]{2,60})/i,
    /distribuid[oa]\s+por\s+([A-ZÁÉÍÓÚÑ][\w\s&\-.'ª]{2,60})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim();
      // Filtrar candidatos显然是噪声（terminan en preposición o artículo).
      if (/^(de|del|la|las|los|el|por|para|con|sin|en|y|o)$/i.test(candidate)) continue;
      return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP fetch con retry
// ---------------------------------------------------------------------------

async function fetchHTML(url: string, userAgent: string, timeoutMs: number): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_HTTP_RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5',
          'Accept-Charset': 'utf-8',
        },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        if (res.status === 404) return '';
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_HTTP_RETRIES) await sleep(1_500 * (attempt + 1));
    }
  }
  throw new Error(`fetchHTML failed for ${url} after ${MAX_HTTP_RETRIES + 1} attempts: ${String(lastErr)}`);
}

// ---------------------------------------------------------------------------
// Parser del listado
// ---------------------------------------------------------------------------

interface ListEntry {
  title: string;
  url: string;
  dateText: string;
  date: Date | null;
}

function parseListing(html: string): ListEntry[] {
  const $ = cheerio.load(html);
  const entries: ListEntry[] = [];
  const seen = new Set<string>();

  // El listado de AESAN es una serie de <a href=".../YYYY_NN.htm">Título</a> con
  // fecha al lado en texto plano. Iteramos todos los <a> con href que case el patrón.
  $('a[href*="alertas_alimentarias/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') ?? '';
    if (!/\/(20\d{2})_[\w\-]+\.htm$/.test(href)) return;

    const absHref = href.startsWith('http') ? href : new URL(href, AESAN_BASE_URL).toString();
    if (seen.has(absHref)) return;
    seen.add(absHref);

    const title = $a.text().trim();
    if (!title || title.length < 10) return;

    // La fecha suele estar en un nodo hermano (texto plano). Buscamos en un radio.
    let dateText = '';
    const $parent = $a.parent();
    if ($parent.length) {
      const parentText = $parent.text().replace(/\s+/g, ' ').trim();
      const m = parentText.match(RE_DATE_DDMMMYYYY);
      if (m) dateText = m[0];
    }
    if (!dateText) {
      // Fallback: buscar en el texto que sigue al enlace
      const nextText = $a.nextAll('text,span,p').text() || '';
      const m = nextText.match(RE_DATE_DDMMMYYYY);
      if (m) dateText = m[0];
    }
    if (!dateText) return; // sin fecha no podemos filtrar por daysBack

    const date = parseSpanishDate(dateText);
    if (!date) return;

    entries.push({ title, url: absHref, dateText, date });
  });

  // Ordenar por fecha descendente.
  entries.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return entries;
}

// ---------------------------------------------------------------------------
// Parser del detalle individual
// ---------------------------------------------------------------------------

function parseDetail(html: string, listEntry: ListEntry): RawAesanAlert {
  const $ = cheerio.load(html);
  // Texto principal: intentamos <main> o <article> o <div class="contenido">.
  let bodyText = '';
  const $main = $('main, article, .contenido, #contenido, .cuerpo, .texto').first();
  if ($main.length) {
    bodyText = $main.text();
  } else {
    bodyText = $('body').text();
  }
  bodyText = bodyText.replace(/\s+/g, ' ').trim();

  // Combinar título + body para los regex.
  const fullText = `${listEntry.title} ${bodyText}`;

  const ref = extractReference(fullText);
  const hazard = extractHazard(fullText);
  const product = extractProduct(fullText);
  const brand = extractBrand(fullText);

  return {
    id: `AESAN-${listEntry.url.match(/\/(20\d{2})_([\w\-]+)\.htm$/)?.[1] ?? 'UNK'}-${listEntry.url.match(/\/(20\d{2})_([\w\-]+)\.htm$/)?.[2] ?? listEntry.url.length}`,
    title: listEntry.title,
    url: listEntry.url,
    date: listEntry.date?.toISOString() ?? new Date().toISOString(),
    reference: ref,
    product,
    hazard,
    brand,
    content: bodyText.slice(0, 50_000),
  };
}

// ---------------------------------------------------------------------------
// API principal del scraper
// ---------------------------------------------------------------------------

export interface ScrapeAesanResult {
  alerts: RawAesanAlert[];
  /** Total de entradas parseadas del listado (antes de filtrar por daysBack). */
  totalList: number;
  /** Número de entradas descartadas por fecha. */
  filteredByDate: number;
  /** Número de entradas descartadas por maxAlerts. */
  truncated: number;
  /** Errores HTTP (no fatales). */
  errors: Array<{ url: string; message: string }>;
  /** Duración total. */
  durationMs: number;
}

export async function scrapeAesan(options: AesanScrapeOptions = {}): Promise<ScrapeAesanResult> {
  const start = Date.now();
  const userAgent = options.userAgent ?? USER_AGENT;
  const maxAlerts = options.maxAlerts ?? DEFAULT_MAX_ALERTS;
  const daysBack = options.daysBack ?? DEFAULT_DAYS_BACK;
  const detailDelayMs = options.detailDelayMs ?? DEFAULT_DETAIL_DELAY_MS;
  const onLog = options.onLog ?? (() => {});

  const cutoff = new Date(Date.now() - daysBack * 24 * 3600 * 1_000);

  onLog(`[aesan] GET listado ${AESAN_LIST_URL}`);
  const listingHtml = await fetchHTML(AESAN_LIST_URL, userAgent, DEFAULT_TIMEOUT_MS);
  const list = parseListing(listingHtml);
  onLog(`[aesan] listado parseado: ${list.length} entradas`);

  const filtered = list.filter((e) => (e.date?.getTime() ?? 0) >= cutoff.getTime());
  const truncated = Math.max(0, filtered.length - maxAlerts);
  const toProcess = filtered.slice(0, maxAlerts);
  onLog(`[aesan] en ventana ${daysBack}d: ${filtered.length} (maxAlerts=${maxAlerts})`);

  const errors: Array<{ url: string; message: string }> = [];
  const alerts: RawAesanAlert[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i]!;
    if (i > 0) await sleep(detailDelayMs);
    try {
      onLog(`[aesan] [${i + 1}/${toProcess.length}] ${entry.title.slice(0, 60)}…`);
      const detailHtml = await fetchHTML(entry.url, userAgent, DEFAULT_TIMEOUT_MS);
      if (!detailHtml) {
        errors.push({ url: entry.url, message: 'empty body (404?)' });
        continue;
      }
      const alert = parseDetail(detailHtml, entry);
      alerts.push(alert);
    } catch (e) {
      errors.push({ url: entry.url, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    alerts,
    totalList: list.length,
    filteredByDate: list.length - filtered.length,
    truncated,
    errors,
    durationMs: Date.now() - start,
  };
}
