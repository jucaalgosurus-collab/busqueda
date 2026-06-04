// lib/filters/ccaa.ts — Detector automático de CCAA/provincia/región
// Heurística mixta: (1) nombre del medio (override explícito), (2) keywords en el contenido.
// Se ejecuta ANTES de persistir para asignar region/province en Source.
import type { Prisma } from '@prisma/client';

export interface CcaaInfo {
  ccaa: string;
  region: string;
  province?: string;
  confidence: number; // 0..1
}

const MEDIO_HINTS: Array<{ pattern: RegExp; info: CcaaInfo }> = [
  // Nacionales (genéricos, baja confianza)
  { pattern: /\belpais\b|el pa[ií]s/i, info: { ccaa: 'Nacional', region: 'Nacional', confidence: 0.6 } },
  { pattern: /\bexpansi[oó]n\b/i, info: { ccaa: 'Nacional', region: 'Nacional', confidence: 0.6 } },
  { pattern: /cinco d[ií]as/i, info: { ccaa: 'Nacional', region: 'Nacional', confidence: 0.6 } },
  { pattern: /el economista/i, info: { ccaa: 'Nacional', region: 'Nacional', confidence: 0.6 } },
  { pattern: /\bel mundo\b/i, info: { ccaa: 'Nacional', region: 'Nacional', confidence: 0.5 } },
  { pattern: /\babc\b|abc\.es/i, info: { ccaa: 'Nacional', region: 'Nacional', confidence: 0.5 } },
  { pattern: /la vanguardia/i, info: { ccaa: 'Cataluña', region: 'Cataluña', confidence: 0.7 } },
  { pattern: /\b20 ?minutos\b/i, info: { ccaa: 'Nacional', region: 'Nacional', confidence: 0.5 } },

  // CCAA: Galicia
  { pattern: /voz de galicia|farodevigo|faro de vigo|correo gallego/i, info: { ccaa: 'Galicia', region: 'Galicia', confidence: 0.9 } },
  // CCAA: Andalucía
  { pattern: /diario de c[áa]diz|diariodesevilla|diario de sevilla|diario sur|ideal\.|ideal es/i, info: { ccaa: 'Andalucía', region: 'Andalucía', confidence: 0.9 } },
  // CCAA: Cataluña
  { pattern: /elperiodico|el peri[oó]dico|\bara\b|cat/iu, info: { ccaa: 'Cataluña', region: 'Cataluña', confidence: 0.85 } },
  // CCAA: Asturias
  { pattern: /la nueva espa[ñn]a|\blne\.|elcomercio|el comercio/i, info: { ccaa: 'Principado de Asturias', region: 'Asturias', confidence: 0.9 } },
  // CCAA: CyL
  { pattern: /norte de castilla|diario de burgos/i, info: { ccaa: 'Castilla y León', region: 'Castilla y León', confidence: 0.9 } },
  // CCAA: Aragón
  { pattern: /heraldo|peri[oó]dico de arag[oó]n/i, info: { ccaa: 'Aragón', region: 'Aragón', confidence: 0.9 } },
  // CCAA: C. Valenciana
  { pattern: /levante-emv|las provincias|levante\b|informaci[oó]n\b/i, info: { ccaa: 'Comunidad Valenciana', region: 'C. Valenciana', confidence: 0.85 } },
  // CCAA: Murcia
  { pattern: /la verdad\b/i, info: { ccaa: 'Región de Murcia', region: 'Murcia', confidence: 0.85 } },
  // CCAA: La Rioja
  { pattern: /larioja|la rioja\b/i, info: { ccaa: 'La Rioja', region: 'La Rioja', confidence: 0.9 } },
  // CCAA: Navarra
  { pattern: /diario de navarra/i, info: { ccaa: 'Comunidad Foral de Navarra', region: 'Navarra', confidence: 0.9 } },
  // CCAA: País Vasco
  { pattern: /elcorreo|el correo\b|\bdeia\b/i, info: { ccaa: 'País Vasco', region: 'País Vasco', confidence: 0.9 } },
  // CCAA: Baleares
  { pattern: /[úu]ltima hora|diari de mallorca|mallorca\b/i, info: { ccaa: 'Islas Baleares', region: 'Baleares', confidence: 0.9 } },
  // CCAA: Canarias
  { pattern: /canarias7|canarias 7|la provincia\b|eld[ií]a|el d[ií]a\b/i, info: { ccaa: 'Islas Canarias', region: 'Canarias', confidence: 0.9 } },
  // CCAA: Castilla-La Mancha
  { pattern: /castilla-?la mancha|clm\b|lanza\b|ciudad real/i, info: { ccaa: 'Castilla-La Mancha', region: 'Castilla-La Mancha', confidence: 0.85 } },
  // CCAA: Extremadura
  { pattern: /extremadura/i, info: { ccaa: 'Extremadura', region: 'Extremadura', confidence: 0.9 } },
  // CCAA: Cantabria
  { pattern: /cantabria/i, info: { ccaa: 'Cantabria', region: 'Cantabria', confidence: 0.9 } },
];

const CCAA_KEYWORDS: Array<{ kw: string; info: CcaaInfo }> = [
  { kw: 'andaluc[íi]a', info: { ccaa: 'Andalucía', region: 'Andalucía', confidence: 0.7 } },
  { kw: 'arag[oó]n', info: { ccaa: 'Aragón', region: 'Aragón', confidence: 0.7 } },
  { kw: 'asturias', info: { ccaa: 'Principado de Asturias', region: 'Asturias', confidence: 0.7 } },
  { kw: 'balears|baleares|mallorca|menorca|ibiza', info: { ccaa: 'Islas Baleares', region: 'Baleares', confidence: 0.7 } },
  { kw: 'canarias|tenerife|gran canaria|las palmas', info: { ccaa: 'Islas Canarias', region: 'Canarias', confidence: 0.7 } },
  { kw: 'cantabria', info: { ccaa: 'Cantabria', region: 'Cantabria', confidence: 0.7 } },
  { kw: 'castilla la mancha|castilla-?la mancha', info: { ccaa: 'Castilla-La Mancha', region: 'Castilla-La Mancha', confidence: 0.7 } },
  { kw: 'castilla y le[oó]n|castilla-?y-?le[oó]n', info: { ccaa: 'Castilla y León', region: 'Castilla y León', confidence: 0.7 } },
  { kw: 'catalu[ñn]a', info: { ccaa: 'Cataluña', region: 'Cataluña', confidence: 0.7 } },
  { kw: 'comunidad valenciana|valenciana|c\.?\s?valenciana', info: { ccaa: 'Comunidad Valenciana', region: 'C. Valenciana', confidence: 0.7 } },
  { kw: 'extremadura', info: { ccaa: 'Extremadura', region: 'Extremadura', confidence: 0.7 } },
  { kw: 'galicia|gallega|gallego', info: { ccaa: 'Galicia', region: 'Galicia', confidence: 0.7 } },
  { kw: 'la rioja|rioja\b', info: { ccaa: 'La Rioja', region: 'La Rioja', confidence: 0.7 } },
  { kw: 'madrid\b|comunidad de madrid', info: { ccaa: 'Comunidad de Madrid', region: 'Madrid', confidence: 0.65 } },
  { kw: 'murcia|region de murcia', info: { ccaa: 'Región de Murcia', region: 'Murcia', confidence: 0.7 } },
  { kw: 'navarra|navarro', info: { ccaa: 'Comunidad Foral de Navarra', region: 'Navarra', confidence: 0.7 } },
  { kw: 'pa[íi]s vasco|euskadi|vizcaya|[gü]ip[uú]zcoa|[áa]lava', info: { ccaa: 'País Vasco', region: 'País Vasco', confidence: 0.7 } },
];

const PROVINCE_KEYWORDS: Array<{ kw: string; province: string; ccaa: string }> = [
  { kw: 'madrid', province: 'Madrid', ccaa: 'Comunidad de Madrid' },
  { kw: 'barcelona', province: 'Barcelona', ccaa: 'Cataluña' },
  { kw: 'valencia\b', province: 'Valencia', ccaa: 'Comunidad Valenciana' },
  { kw: 'alicante', province: 'Alicante', ccaa: 'Comunidad Valenciana' },
  { kw: 'castell[oó]n', province: 'Castellón', ccaa: 'Comunidad Valenciana' },
  { kw: 'sevilla', province: 'Sevilla', ccaa: 'Andalucía' },
  { kw: 'm[áa]laga', province: 'Málaga', ccaa: 'Andalucía' },
  { kw: 'granada\b', province: 'Granada', ccaa: 'Andalucía' },
  { kw: 'c[óo]rdoba\b', province: 'Córdoba', ccaa: 'Andalucía' },
  { kw: 'c[áa]diz', province: 'Cádiz', ccaa: 'Andalucía' },
  { kw: 'huelva', province: 'Huelva', ccaa: 'Andalucía' },
  { kw: 'almer[íi]a', province: 'Almería', ccaa: 'Andalucía' },
  { kw: 'ja[ée]n', province: 'Jaén', ccaa: 'Andalucía' },
  { kw: 'vigo|pontevedra', province: 'Pontevedra', ccaa: 'Galicia' },
  { kw: 'a coru[ñn]a|la coru[ñn]a', province: 'A Coruña', ccaa: 'Galicia' },
  { kw: 'lugo\b', province: 'Lugo', ccaa: 'Galicia' },
  { kw: 'ourense|orense', province: 'Ourense', ccaa: 'Galicia' },
  { kw: 'murcia capital', province: 'Murcia', ccaa: 'Región de Murcia' },
  { kw: 'vitoria|gasteiz|[áa]lava', province: 'Álava', ccaa: 'País Vasco' },
  { kw: 'bilbao|vizcaya', province: 'Bizkaia', ccaa: 'País Vasco' },
  { kw: 'donosti|donostia|guip[uú]zcoa|gipuzkoa', province: 'Gipuzkoa', ccaa: 'País Vasco' },
  { kw: 'zaragoza', province: 'Zaragoza', ccaa: 'Aragón' },
  { kw: 'teruel', province: 'Teruel', ccaa: 'Aragón' },
  { kw: 'huesca', province: 'Huesca', ccaa: 'Aragón' },
  { kw: 'valladolid', province: 'Valladolid', ccaa: 'Castilla y León' },
  { kw: 'burgos\b', province: 'Burgos', ccaa: 'Castilla y León' },
  { kw: 'le[oó]n\b', province: 'León', ccaa: 'Castilla y León' },
  { kw: 'palencia', province: 'Palencia', ccaa: 'Castilla y León' },
  { kw: 'salamanca', province: 'Salamanca', ccaa: 'Castilla y León' },
  { kw: 'segovia', province: 'Segovia', ccaa: 'Castilla y León' },
  { kw: 'soria', province: 'Soria', ccaa: 'Castilla y León' },
  { kw: 'zamora', province: 'Zamora', ccaa: 'Castilla y León' },
  { kw: '[áa]vila', province: 'Ávila', ccaa: 'Castilla y León' },
  { kw: 'toledo\b', province: 'Toledo', ccaa: 'Castilla-La Mancha' },
  { kw: 'albacete', province: 'Albacete', ccaa: 'Castilla-La Mancha' },
  { kw: 'ciudad real', province: 'Ciudad Real', ccaa: 'Castilla-La Mancha' },
  { kw: 'cuenca\b', province: 'Cuenca', ccaa: 'Castilla-La Mancha' },
  { kw: 'guadalajara', province: 'Guadalajara', ccaa: 'Castilla-La Mancha' },
  { kw: 'c[áa]ceres', province: 'Cáceres', ccaa: 'Extremadura' },
  { kw: 'badajoz', province: 'Badajoz', ccaa: 'Extremadura' },
  { kw: 'santander', province: 'Cantabria', ccaa: 'Cantabria' },
  { kw: 'oviedo|gij[oó]n', province: 'Asturias', ccaa: 'Principado de Asturias' },
  { kw: 'pamplona', province: 'Navarra', ccaa: 'Comunidad Foral de Navarra' },
  { kw: 'logro[ñn]o', province: 'La Rioja', ccaa: 'La Rioja' },
  { kw: 'palma\b', province: 'Mallorca', ccaa: 'Islas Baleares' },
  { kw: 'tenerife|santa cruz de tenerife', province: 'Santa Cruz de Tenerife', ccaa: 'Islas Canarias' },
  { kw: 'las palmas\b', province: 'Las Palmas', ccaa: 'Islas Canarias' },
];

/**
 * Detect CCAA/provincia desde URL+title+content. Devuelve la mejor coincidencia.
 * Orden de preferencia: medio-hint (override) > keyword de provincia > keyword de CCAA.
 */
export function detectCcaa(input: {
  outlet: string;
  url: string;
  title: string;
  content: string;
}): CcaaInfo {
  const { outlet, url, title, content } = input;
  const haystack = `${outlet}\n${url}\n${title}\n${content.slice(0, 4000)}`.toLowerCase();

  // 1) Override por nombre del medio
  for (const { pattern, info } of MEDIO_HINTS) {
    if (pattern.test(outlet) || pattern.test(url)) return info;
  }

  // 2) Provincia en el contenido
  for (const { kw, province, ccaa } of PROVINCE_KEYWORDS) {
    const r = new RegExp(`\\b${kw}\\b`, 'iu');
    if (r.test(haystack)) {
      return { ccaa, region: ccaa, province, confidence: 0.85 };
    }
  }

  // 3) CCAA en el contenido
  for (const { kw, info } of CCAA_KEYWORDS) {
    const r = new RegExp(kw, 'iu');
    if (r.test(haystack)) {
      return { ...info, province: undefined };
    }
  }

  return { ccaa: 'Nacional', region: 'Nacional', confidence: 0.3 };
}

/** Formato para Prisma (snippet útil en runner) */
export const ccaaFilterWhere = (ccaa: string): Prisma.SourceWhereInput => ({
  company: { hqRegion: { equals: ccaa, mode: 'insensitive' as Prisma.QueryMode } },
});
