// lib/scrapers/seguros-credito.ts — Sprint B.5
//
// Detecta cambios de assessment sectorial publicados por las 4 aseguradoras
// de crédito que operan en España: CESCE, Crédito y Caución (Atradius),
// Coface, Allianz Trade (Euler Hermes).
//
// Estructura de las páginas (estimada, validación real pendiente en 1ª corrida):
//   - CESCE sala de prensa: lista de <article>/<a> con fecha + título.
//   - CyC sala-prensa: idem.
//   - Coface newsroom: idem en EN.
//   - Allianz Trade sector-risks: tarjetas con sector + país + assessment.
//
// El scraper:
//   1. Fetch la página pública del barómetro/press room
//   2. Regex sobre el HTML: extraer bloques de texto con "downgrade|rebaja"
//      que mencionen sector + país (España)
//   3. Devolver RawSeguroChange[] para que el filtro los cruce con CNAE de Companies
//
// Reutiliza USER_AGENT de types.ts. Respeta rateLimitMs por aseguradora.

import * as cheerio from 'cheerio';
import { USER_AGENT } from './types';

export type AseguradoraSlug = 'cesce' | 'cyc' | 'coface' | 'allianz-trade';

export interface AseguradoraEntry {
  id: string;
  aseguradora: string;
  fullName: string;
  country: 'ES' | 'MULTI';
  barometerUrl: string;
  sectorIndexUrl: string;
  cadence: 'weekly' | 'monthly' | 'quarterly';
  type: 'html_static';
  rateLimitMs: number;
  requiresStealth: boolean;
  notes: string;
  language: 'es' | 'en';
}

export interface RawSeguroChange {
  aseguradora: AseguradoraSlug;
  sourceUrl: string;
  title: string;
  date: string;
  direction: 'downgrade' | 'upgrade' | 'neutral';
  sector: string | null;
  country: string | null;
  content: string;
}

export interface SegurosScrapeOptions {
  daysBack?: number;
  maxItems?: number;
  userAgent?: string;
  onLog?: (msg: string) => void;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_DAYS_BACK = 30;
const DEFAULT_MAX_ITEMS = 20;
const MAX_HTTP_RETRIES = 1;

const DOWNGRADE_RE =
  /\b(?:downgrade|rebaja(?:r)?|baj[aá]da|revisi[oó]n\s+a\s+la\s+baja|perspectiva\s+negativa|riesgo\s+creciente|empeoramiento|negative\s+outlook|negative\s+revision)\b/i;
const UPGRADE_RE =
  /\b(?:upgrade|subida|mejora(?:ndo|r)?|revisi[oó]n\s+al\s+alza|perspectiva\s+positiva|riesgo\s+decreciente|positive\s+outlook|positive\s+revision)\b/i;

const SECTOR_RE =
  /\b(metales|metals|alimentaci[oó]n|food|bebidas|beverages?|cerveza|brewery|qu[ií]mica|chemicals?|farmac[eé]utico|pharma(?:ceuticals?)?|construcci[oó]n|construction|automoci[oó]n|automotive|textil|textile|energ[ií]a|energy|retail|distribuci[oó]n|agr[ií]cola|agriculture|pescado|seafood|c[aá]rnico|meat|l[aá]cteos|dairy|panader[ií]a|bakery|conservero|aceite|oil|agrifood|ICT|metallurgy)\b/i;

const SPAIN_RE = /\b(?:espa[ñn]a|spain|ES|España)\b/i;

function pickDirection(text: string): 'downgrade' | 'upgrade' | 'neutral' {
  if (DOWNGRADE_RE.test(text)) return 'downgrade';
  if (UPGRADE_RE.test(text)) return 'upgrade';
  return 'neutral';
}

function pickSector(text: string): string | null {
  const m = text.match(SECTOR_RE);
  return m ? m[1].toLowerCase() : null;
}

function pickCountry(text: string): string | null {
  if (SPAIN_RE.test(text)) return 'ES';
  return null;
}

async function fetchHtml(
  url: string,
  ua: string,
  timeoutMs: number,
): Promise<{ ok: boolean; text: string; status: number; error?: string }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(tid);
    if (!res.ok) return { ok: false, text: '', status: res.status, error: `HTTP ${res.status}` };
    return { ok: true, text: await res.text(), status: res.status };
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, text: '', status: 0, error: (e as Error).message };
  }
}

async function fetchAseguradoraPage(
  entry: AseguradoraEntry,
  options: Required<Pick<SegurosScrapeOptions, 'daysBack' | 'maxItems'>> & Pick<SegurosScrapeOptions, 'userAgent' | 'onLog'>,
): Promise<RawSeguroChange[]> {
  const ua = options.userAgent ?? USER_AGENT;
  const log = options.onLog ?? (() => {});
  log(`[${entry.aseguradora}] fetch ${entry.barometerUrl}`);

  let lastErr: string | null = null;
  for (let attempt = 0; attempt <= MAX_HTTP_RETRIES; attempt++) {
    const r = await fetchHtml(entry.barometerUrl, ua, DEFAULT_TIMEOUT_MS);
    if (r.ok) {
      return parseHtml(r.text, entry, options.maxItems, options.daysBack);
    }
    lastErr = r.error ?? 'unknown';
    log(`[${entry.aseguradora}] attempt ${attempt + 1} failed: ${lastErr}`);
    if (attempt < MAX_HTTP_RETRIES) {
      await new Promise((res) => setTimeout(res, 2_000));
    }
  }
  log(`[${entry.aseguradora}] giving up after retries: ${lastErr}`);
  return [];
}

function parseHtml(
  html: string,
  entry: AseguradoraEntry,
  maxItems: number,
  daysBack: number,
): RawSeguroChange[] {
  const $ = cheerio.load(html);
  const out: RawSeguroChange[] = [];

  // Estrategia: extraer párrafos con texto >= 80 chars y buscar keywords.
  $('p, article, li, h2, h3, h4, div').each((_, el) => {
    if (out.length >= maxItems) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length < 60 || text.length > 1500) return;
    const dir = pickDirection(text);
    if (dir === 'neutral') return;
    const sector = pickSector(text);
    const country = pickCountry(text);
    if (!sector && !country) return;
    out.push({
      aseguradora: entry.aseguradora.toLowerCase().replace(/[^a-z-]/g, '') as AseguradoraSlug,
      sourceUrl: entry.barometerUrl,
      title: text.slice(0, 200),
      date: new Date().toISOString().slice(0, 10),
      direction: dir,
      sector,
      country: country ?? 'ES',
      content: text.slice(0, 50_000),
    });
  });
  return out;
}

export async function scrapeAllAseguradoras(
  entries: AseguradoraEntry[],
  options: SegurosScrapeOptions = {},
): Promise<{ changes: RawSeguroChange[]; perAseguradora: Record<string, { scanned: number; kept: number; error?: string }> }> {
  const daysBack = options.daysBack ?? DEFAULT_DAYS_BACK;
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const perAseguradora: Record<string, { scanned: number; kept: number; error?: string }> = {};

  const all: RawSeguroChange[] = [];
  for (const e of entries) {
    const r = await fetchAseguradoraPage(e, {
      daysBack,
      maxItems,
      userAgent: options.userAgent,
      onLog: options.onLog,
    });
    perAseguradora[e.aseguradora] = { scanned: 1, kept: r.length };
    all.push(...r);
    // rate limit
    await new Promise((res) => setTimeout(res, e.rateLimitMs ?? 3_000));
  }

  return { changes: all, perAseguradora };
}
