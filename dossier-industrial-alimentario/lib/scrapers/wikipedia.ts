// lib/scrapers/wikipedia.ts — Sprint C.2
// Scraper de la Wikipedia en español para extraer datos financieros de empresas.
// 1) Construye URL `https://es.wikipedia.org/wiki/{slug}`.
// 2) Parsea la infobox de la tabla de la empresa.
// 3) Extrae: facturación (€M), empleados, año, EBITDA, beneficio neto si aparecen.
//
// Patrón: dado un Company.name (ej. "Calidad Pascual (Grupo Pascual)"),
// genera 2-3 candidatos de slug ("Calidad_Pascual", "Pascual", "Grupo_Pascual")
// y prueba cada uno. El primero que devuelva 200 OK con infobox gana.
//
// Idempotente: si Wikipedia no tiene infobox, devuelve { found: false }.

import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; HERMES-Dossier/1.0; +https://surus.es)';
const WIKI_BASE = 'https://es.wikipedia.org/wiki/';

export interface WikiFinancial {
  facturacionM: number | null;
  facturacionYear: number | null;
  empleados: number | null;
  ebitdaM: number | null;
  beneficioNetoM: number | null;
  fuente: string; // URL de Wikipedia
  rawFields: Record<string, string>; // para debug
}

export type WikiScrapeResult =
  | { found: true; data: WikiFinancial }
  | { found: false; reason: string; triedUrls: string[] };

/**
 * Normaliza un nombre de empresa a posibles slugs de Wikipedia.
 * "Calidad Pascual (Grupo Pascual)" → ["Calidad_Pascual", "Grupo_Pascual", "Pascual"]
 * "Nueva Pescanova" → ["Nueva_Pescanova", "Pescanova"]
 */
export function candidateSlugs(name: string): string[] {
  const cleaned = name
    .replace(/\(.*?\)/g, '') // quita "(...)"
    .replace(/, S\.?A\.?| S\.?L\.?|S\.?A\.?U\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 0) return [];

  // Genera combinaciones decrecientes
  const slugs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const slice = parts.slice(i).join('_');
    if (slice.length >= 4) slugs.push(slice);
  }
  return Array.from(new Set(slugs)).slice(0, 5);
}

/**
 * Parsea cifras tipo "1.933,5 millones €" → 1933.5
 *      tipo "9.035 empleados" → 9035
 *      tipo "28000" → 28000
 */
/**
 * Parsea cifras tipo "1.933,5 millones €" → 1933.5
 *      tipo "9.035 empleados" → 9035
 *      tipo "28000" → 28000
 */
export function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  // Si el texto contiene un año de 4 dígitos (2012-2030), quítalo primero.
  // Esto evita que "10.000 (2025)" → "100002025" tras la limpieza.
  // Caso real observado en Pescanova, Danone, Damm.
  const withoutYear = raw.replace(/\b20[12]\d\b/g, '').trim();
  // Quita todo lo que no sea dígito, punto, coma, signo
  const s = withoutYear.replace(/[^\d.,-]/g, '').trim();
  if (!s) return null;
  // Detecta formato: "1.933,5" (eu) vs "1,933.5" (us) vs "9.035" (eu sin decimal) vs "1933" (sin sep)
  // Heurísticas:
  // 1) Si hay ambos (. y ,), gana el que aparece ÚLTIMO → ese es el separador decimal.
  // 2) Si solo hay un tipo y el grupo tras el separador es exactamente 3 dígitos Y el número
  //    entero tiene sentido como millares EU ("9.035" = nueve mil treinta y cinco), trátalo
  //    como EU thousands-separator. "9.035,5" sigue funcionando por la regla 1.
  // 3) "9.035" sin coma → EU. "9.5" (1 dígito tras dot) → decimal.
  // 4) "9,035" sin punto → US thousands.
  // 5) "1.933" (4 dígitos en parte entera con 1 dot) → EU thousands.
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = s;
  } else if (lastComma > lastDot) {
    // EU: separador decimal = ",", millares = "."
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // dot es el último separador. ¿Es decimal o millares?
    const afterDot = s.length - lastDot - 1;
    if (afterDot === 3 && lastDot > 0) {
      // grupo de 3 dígitos tras el dot Y hay parte entera → millares EU
      // ej. "9.035" → 9035 ; "1.933" → 1933
      normalized = s.replace(/\./g, '');
    } else {
      // decimal US: "1.5" o "0.5" o "9.50"
      normalized = s.replace(/,/g, '');
    }
  } else {
    // igual índice imposible, fallback conservador
    normalized = s;
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

/**
 * Detecta "millones" o "mil millones" en el contexto y ajusta unidades.
 */
export function adjustToMillions(value: number, contextRaw: string | undefined): number {
  if (!contextRaw) return value;
  const lower = contextRaw.toLowerCase();
  if (lower.includes('mil millones') || lower.includes('billón')) {
    return value * 1000; // 1.5 mil millones = 1500M
  }
  if (lower.includes('millones')) {
    return value;
  }
  // Sin sufijo: si el valor es muy grande (>10.000), probablemente está en euros
  // sin "millones" y la infobox dice "facturación" → divide por 1M
  if (value > 10000) {
    return value / 1_000_000;
  }
  return value;
}

/**
 * Busca y extrae KPIs de la Wikipedia de la empresa.
 */
export async function scrapeWikipediaFinancials(companyName: string): Promise<WikiScrapeResult> {
  const slugs = candidateSlugs(companyName);
  if (slugs.length === 0) {
    return { found: false, reason: 'no_slug_candidates', triedUrls: [] };
  }

  const triedUrls: string[] = [];
  for (const slug of slugs) {
    const url = WIKI_BASE + slug;
    triedUrls.push(url);
    try {
      const resp = await axios.get<string>(url, {
        timeout: 8000,
        headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' },
        responseType: 'text',
        validateStatus: (s) => s >= 200 && s < 400,
      });
      if (resp.status === 200 && resp.data && resp.data.length > 500) {
        const data = parseInfobox(resp.data, url);
        if (data) {
          return { found: true, data };
        }
      }
    } catch (e) {
      // 404 o timeout → prueba siguiente slug
      continue;
    }
  }
  return { found: false, reason: 'no_infobox_found', triedUrls };
}

function parseInfobox(html: string, url: string): WikiFinancial | null {
  const $ = cheerio.load(html);
  const rawFields: Record<string, string> = {};

  // La infobox de empresa en Wikipedia es una tabla con clase "infobox" o "wikitable"
  // y filas <tr> con <th> (label) + <td> (value).
  const tables = $('table.infobox, table.wikitable').toArray();
  if (tables.length === 0) return null;

  for (const table of tables) {
    const $table = $(table);
    $table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      const th = $tr.find('th').first().text().trim().toLowerCase();
      const td = $tr.find('td').first().text().trim();
      if (th && td) {
        rawFields[th] = td;
      }
    });
  }

  if (Object.keys(rawFields).length === 0) return null;

  // Mapea campos típicos
  let facturacionM: number | null = null;
  let facturacionYear: number | null = null;
  let empleados: number | null = null;
  let ebitdaM: number | null = null;
  let beneficioNetoM: number | null = null;

  // Facturación / Ingresos
  for (const key of Object.keys(rawFields)) {
    const v = rawFields[key];
    if (!facturacionM && /facturaci[óo]n|ingresos|ventas|revenue/i.test(key)) {
      const n = parseNumber(v);
      if (n) facturacionM = adjustToMillions(n, v);
      // Año (4 dígitos cerca de "2024", "2025")
      const yearMatch = v.match(/\b(20[12]\d)\b/);
      if (yearMatch) facturacionYear = parseInt(yearMatch[1], 10);
    }
    if (!empleados && /empleados|trabajadores|workers|empleo/i.test(key)) {
      const n = parseNumber(v);
      if (n) empleados = n;
    }
    if (!ebitdaM && /^ebitda$/i.test(key.trim())) {
      const n = parseNumber(v);
      if (n) ebitdaM = adjustToMillions(n, v);
    }
    if (!beneficioNetoM && /beneficio\s*neto|net\s*income|utilidad/i.test(key)) {
      const n = parseNumber(v);
      if (n) beneficioNetoM = adjustToMillions(n, v);
    }
  }

  if (facturacionM === null && empleados === null) {
    return null; // infobox sin info financiera útil
  }

  return {
    facturacionM,
    facturacionYear,
    empleados,
    ebitdaM,
    beneficioNetoM,
    fuente: url,
    rawFields,
  };
}
