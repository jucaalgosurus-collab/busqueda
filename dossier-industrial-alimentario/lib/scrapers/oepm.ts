// lib/scrapers/oepm.ts — Sprint C.3
//
// Scraper de la base de datos pública OEPM Invenes
// (https://invenes.oepm.es) para extraer la cartera de patentes de
// una empresa por titular.
//
// Patrón:
//   1) Construye query por nombre empresa → URL de búsqueda
//   2) Hace GET con UA realista + AbortController + timeout
//   3) Parsea HTML con cheerio (selectores tolerantes a cambios)
//   4) Devuelve array de RawPatentHit
//
// Idempotente: cada Patent tiene matchHash; el runner hace upsert.

import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const INVENES_BASE = 'https://invenes.oepm.es';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_HITS_PER_QUERY = 50;

export type LegalStatus = 'granted' | 'pending' | 'expired' | 'withdrawn' | 'unknown';

export interface RawPatentHit {
  publicationNumber: string;
  title: string;
  applicant: string;
  inventors: string | null;
  filingDate: Date | null;
  publicationDate: Date | null;
  grantDate: Date | null;
  legalStatus: LegalStatus;
  cnae: string | null;
  sourceUrl: string;
}

export interface OepmScrapeResult {
  found: boolean;
  hits: RawPatentHit[];
  triedUrls: string[];
  fetchMs: number;
  error?: string;
}

export interface OepmScrapeOptions {
  /** Inject HTML directly (used by smoke tests against fixtures) */
  fixtureHtml?: string;
  /** Force this URL (skip query construction) */
  baseUrl?: string;
  /** AbortSignal */
  signal?: AbortSignal;
}

/**
 * Normaliza el nombre de empresa a un query apto para Invenes.
 * - Quita paréntesis y sufijos legales (S.A., S.L., S.A.U., etc.)
 * - Quita comas
 * - Si el nombre es muy largo (> 50 chars), usa solo las 3 primeras palabras
 */
export function buildOepmQuery(companyName: string): string {
  const cleaned = companyName
    .replace(/\(.*?\)/g, '') // quita "(...)"
    .replace(/,?\s*S\.?A\.?U\.?|,?\s*S\.?A\.?|,?\s*S\.?L\.?|,?\s*S\.?L\.?U\.?|,?\s*S\.?R\.?L\.?/gi, '')
    .replace(/,?\s*SOCIEDAD\s+ANÓNIMA/gi, '')
    .replace(/,?\s*SOCIEDAD\s+LIMITADA/gi, '')
    .replace(/["']/g, '')
    .trim();
  // Truncar a 50 chars (límite razonable para Invenes)
  if (cleaned.length > 50) {
    return cleaned.split(/\s+/).slice(0, 3).join(' ');
  }
  return cleaned;
}

/**
 * Mapea el estado legal textual de Invenes a una taxonomía normalizada.
 */
export function mapLegalStatus(text: string): LegalStatus {
  const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (t.includes('concedida')) return 'granted';
  if (t.includes('caducad') || t.includes('vencid')) return 'expired';
  if (t.includes('retirad') || t.includes('denegada') || t.includes('abandon')) return 'withdrawn';
  if (t.includes('pendiente') || t.includes('examen') || t.includes('tramite') || t.includes('tramit')) return 'pending';
  return 'unknown';
}

/**
 * Convierte fecha en formato YYYY-MM-DD a Date. Devuelve null si inválida.
 */
export function parseOepmDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Parsea HTML de la página de resultados de Invenes y extrae la lista de patentes.
 * Selectores tolerantes: usa .resultado como contenedor y busca en su árbol.
 */
export function parseOepmHtml(html: string): RawPatentHit[] {
  const $ = cheerio.load(html);
  const hits: RawPatentHit[] = [];

  $('.resultado, .resultado-busqueda, li.patent, [data-publication-number]').each((_, el) => {
    const $el = $(el);

    // Número publicación: usa el bloque .numero-publicacion o el primer match
    let publicationNumber =
      $el.find('.numero-publicacion').first().text().trim() ||
      $el.find('[data-publication-number]').attr('data-publication-number') ||
      $el.find('a[href*="/patente/"]').first().attr('href')?.match(/ES[0-9]{6,7}[A-Z][0-9]?/)?.[0] ||
      '';
    publicationNumber = publicationNumber.trim();
    if (!publicationNumber) return;

    // Título
    const title =
      $el.find('h2.titulo, h3.titulo, .titulo').first().text().trim() ||
      $el.find('a[href*="/patente/"]').first().text().trim();
    if (!title) return;

    // Applicant
    const applicant =
      $el.find('.applicant, [data-field="applicant"]').first().text().trim() || '';

    // Inventors
    const inventors =
      $el.find('.inventors, [data-field="inventors"]').first().text().trim() || null;

    // Fechas
    const filingDate = parseOepmDate($el.find('.filing-date, [data-field="filingDate"]').first().text().trim());
    const publicationDate = parseOepmDate($el.find('.publication-date, [data-field="publicationDate"]').first().text().trim());
    const grantDate = parseOepmDate($el.find('.grant-date, [data-field="grantDate"]').first().text().trim());

    // Estado legal
    const statusText = $el.find('.legal-status, [data-field="legalStatus"]').first().text().trim();
    const legalStatus = mapLegalStatus(statusText);

    // CIP / clasificación
    const cnae = $el.find('.cnae, [data-field="cip"]').first().text().trim() || null;

    // URL al detalle
    const detalleHref = $el.find('a.detalle, a[href*="/patente/"]').first().attr('href');
    const sourceUrl = detalleHref
      ? detalleHref.startsWith('http')
        ? detalleHref
        : `${INVENES_BASE}${detalleHref.startsWith('/') ? '' : '/'}${detalleHref}`
      : `${INVENES_BASE}/patente/ES/${publicationNumber}`;

    hits.push({
      publicationNumber,
      title: title.slice(0, 500),
      applicant: applicant.slice(0, 300),
      inventors: inventors ? inventors.slice(0, 500) : null,
      filingDate,
      publicationDate,
      grantDate,
      legalStatus,
      cnae,
      sourceUrl,
    });
  });

  return hits.slice(0, MAX_HITS_PER_QUERY);
}

/**
 * Función principal: dado el nombre de una empresa, hace scraping de OEPM Invenes
 * y devuelve la lista de patentes encontradas.
 */
export async function scrapeOepmPatents(
  companyName: string,
  opts: OepmScrapeOptions = {},
): Promise<OepmScrapeResult> {
  const query = buildOepmQuery(companyName);
  if (!query || query.length < 3) {
    return { found: false, hits: [], triedUrls: [], fetchMs: 0, error: 'query-too-short' };
  }
  const url = opts.baseUrl || `${INVENES_BASE}/buscador/resultados?q=${encodeURIComponent(query)}`;
  const triedUrls = [url];
  const start = Date.now();

  // Modo fixture (smoke tests)
  if (opts.fixtureHtml !== undefined) {
    const hits = parseOepmHtml(opts.fixtureHtml);
    return {
      found: hits.length > 0,
      hits,
      triedUrls,
      fetchMs: Date.now() - start,
    };
  }

  try {
    const response = await axios.get<string>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      signal: opts.signal as unknown as AbortSignal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: 'https://invenes.oepm.es/buscador/',
      },
      responseType: 'text',
      // No seguir redirecciones infinitas
      maxRedirects: 3,
      // HTTPS estricto
      httpsAgent: undefined,
    });
    const fetchMs = Date.now() - start;
    if (response.status !== 200) {
      return { found: false, hits: [], triedUrls, fetchMs, error: `http-${response.status}` };
    }
    const hits = parseOepmHtml(response.data);
    return {
      found: hits.length > 0,
      hits,
      triedUrls,
      fetchMs,
    };
  } catch (e) {
    const fetchMs = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e).slice(0, 200);
    return { found: false, hits: [], triedUrls, fetchMs, error };
  }
}
