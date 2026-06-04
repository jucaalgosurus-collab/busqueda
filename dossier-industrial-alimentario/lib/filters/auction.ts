// lib/filters/auction.ts — Sprint B.9: Filtro de relevancia para hits de subastas.
//
// Reglas duras (B.9 contract):
//  1. NO concursos de acreedores — rechaza si lotTitle/lotDescription contiene
//     "concurso", "liquidacion concursal", "concurso de acreedores".
//  2. Empresa debe matchear: lotTitle debe mencionar el nombre de la empresa
//     (o un alias) Y lotLocation debe estar en la provincia de un Plant.
//  3. Solo lotes en España (CCAA 17/17) — si lotLocation no contiene un
//     identificador geográfico ES, se rechaza.
//  4. Confianza: 0.0-1.0 según coincidencia de nombre + provincia + fecha.

import type { Plant } from '@prisma/client';

export interface RawAuctionHit {
  platform: string;
  lotTitle: string;
  lotDescription: string;
  lotLocation: string;
  lotUrl: string;
  lotId: string;
  closingDate: string | null;
  publishedAt: string | null;
}

export interface AuctionRelevance {
  /** ¿El hit es de la empresa objetivo? */
  relevant: boolean;
  /** Confianza 0..1 */
  confidence: number;
  /** Resultado categórico que se persiste en AuctionCheck.result */
  result: 'sin_activos' | 'activos_detectados' | 'historial' | 'no_verificado';
  /** Por qué se rechazó/aceptó (trazabilidad) */
  reason: string;
}

const ES_GEO_HINTS: ReadonlyArray<RegExp> = [
  // 17 CCAA + Ceuta/Melilla + top 50 ciudades
  /Andaluc[ií]a|Arag[oó]n|Asturias|Balears|Canarias|Cantabria|Castilla[- ]La Mancha|Castilla y Le[oó]n|Catalu[ñn]a|Comunidad Valenciana|Extremadura|Galicia|Madrid|Murcia|Navarra|Pa[ií]s Vasco|Rioja|Ceuta|Melilla/i,
  /Madrid|Barcelona|Valencia|Sevilla|Zaragoza|M[áa]laga|Murcia|Palmas|Bilbao|Alicante|C[óo]rdoba|Valladolid|Vigo|Gij[óo]n|Hospitalet|Vitoria|La Coru[ñn]a|Granada|Elche|Tarragona|Lleida|C[áa]diz|Salamanca|Santander|Almer[íi]a|Burgos|Castell[óo]n|Le[óo]n|Huelva|Toledo|Pontevedra|Ourense|Cuenca|Zamora|Guadalajara|Ja[ée]n|Lugo|[ÁA]vila|Palencia|Segovia|Soria|Teruel|Ciudad Real|Albacete|C[áa]ceres/i,
  // Códigos postales ES (01-52).
  /\b(?:0[1-9]|[1-4][0-9]|5[0-2])\d{3}\b/,
];

// Lista de palabras que indican concurso/liquidación concursal.
const CONCURSO_HINTS: ReadonlyArray<RegExp> = [
  /\bconcurso de acreedores\b/i,
  /\bconcurso\b/i,
  /liquidaci[oó]n concursal/i,
];

/** Quita acentos y pone en minúsculas para matching robusto. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae tokens del nombre de empresa (>2 chars) para matching laxo. */
function nameTokens(name: string): string[] {
  return norm(name)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !/^(sa|slu|sl|sll|sc|scp|sae)$/i.test(t));
}

/** ¿La location parece estar en España? */
function isInSpain(location: string): boolean {
  return ES_GEO_HINTS.some((re) => re.test(location));
}

/** ¿El hit menciona concurso de acreedores? */
function isConcursoHit(hit: RawAuctionHit): boolean {
  const text = `${hit.lotTitle} ${hit.lotDescription} ${hit.lotLocation}`;
  return CONCURSO_HINTS.some((re) => re.test(text));
}

/**
 * Evalúa la relevancia de un hit de subasta para una empresa objetivo.
 *
 * @param hit el raw hit del scraper
 * @param companyName nombre canónico de la empresa (e.g. "PASCUAL")
 * @param companyAliases nombres alternativos de la empresa (e.g. ["Pascual", "Grupo Pascual"])
 * @param plants plantas de la empresa (para matching geográfico)
 */
export function isRelevantAuctionHit(
  hit: RawAuctionHit,
  companyName: string,
  companyAliases: string[],
  plants: Pick<Plant, 'city' | 'province' | 'ccaa'>[],
): AuctionRelevance {
  // 1) Filtro anti-concurso (B.9 regla dura #1).
  if (isConcursoHit(hit)) {
    return {
      relevant: false,
      confidence: 0,
      result: 'sin_activos',
      reason: 'concurso_or_liquidacion_concursal',
    };
  }

  // 2) Filtro geográfico (B.9 regla dura #3).
  if (!isInSpain(hit.lotLocation)) {
    return {
      relevant: false,
      confidence: 0,
      result: 'sin_activos',
      reason: 'not_in_spain',
    };
  }

  // 3) Matching de nombre de empresa (≥1 token del nombre en lotTitle).
  const tokens = nameTokens(companyName);
  const aliasesTokens = companyAliases.flatMap(nameTokens);
  const allTokens = Array.from(new Set([...tokens, ...aliasesTokens]));

  const titleNorm = norm(hit.lotTitle);
  const descNorm = norm(hit.lotDescription);
  const haystack = `${titleNorm} ${descNorm}`;

  const nameHits = allTokens.filter((tok) => haystack.includes(tok));
  if (nameHits.length === 0) {
    return {
      relevant: false,
      confidence: 0,
      result: 'sin_activos',
      reason: 'company_name_not_in_lot',
    };
  }

  // 4) Matching geográfico con plantas (B.9 regla dura #2).
  const locationNorm = norm(hit.lotLocation);
  const plantMatches = plants.filter((p) => {
    const cityN = norm(p.city ?? '');
    const provN = norm(p.province ?? '');
    const ccaaN = norm(p.ccaa ?? '');
    if (cityN && locationNorm.includes(cityN)) return true;
    if (provN && locationNorm.includes(provN)) return true;
    if (ccaaN && locationNorm.includes(ccaaN)) return true;
    return false;
  });
  if (plantMatches.length === 0) {
    return {
      relevant: false,
      confidence: 0.3, // nombre sí, geo no
      result: 'sin_activos',
      reason: 'name_match_but_no_plant_geo',
    };
  }

  // 5) Determinar "activos_detectados" vs "historial".
  //  - activos_detectados: closingDate futura o null (subasta abierta)
  //  - historial: closingDate ya pasada (lote vendido/retirado)
  let result: 'activos_detectados' | 'historial';
  if (hit.closingDate) {
    const closing = new Date(hit.closingDate);
    result = closing > new Date() ? 'activos_detectados' : 'historial';
  } else {
    result = 'activos_detectados';
  }

  // 6) Confidence: 0.5 base + 0.2 por nameHits extra (cap 1.0) + 0.2 por plant match.
  const confidence = Math.min(1, 0.5 + 0.1 * Math.min(nameHits.length, 3) + 0.2 * Math.min(plantMatches.length, 2));

  return {
    relevant: true,
    confidence,
    result,
    reason: `name_hits=${nameHits.length} plant_matches=${plantMatches.length}`,
  };
}

/** Test helper: ¿el texto es claramente un concurso? (exportado para smoke tests). */
export function looksLikeConcurso(text: string): boolean {
  return CONCURSO_HINTS.some((re) => re.test(text));
}
