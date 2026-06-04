// lib/borme/parser.ts — Sprint C.1
// Enriquece RawBormeItem con campos extraídos: cnae (si aparece), fecha exacta.
// Reutiliza la estructura del scraper B.1 (RawBormeItem) sin duplicar lógica.

import type { RawBormeItem } from '../scrapers/types';

// CNAE español: 2 dígitos + . + 1-2 dígitos (ej. 10.2, 11.02, 35.1)
const CNAE_REGEX = /\b(\d{2}\.\d{1,2})\b/g;

const TIPO_TO_BORME_EVENT: Record<string, string> = {
  constitucion: 'constitucion',
  cambio_domicilio: 'cambio_domicilio',
  ampliacion_capital: 'ampliacion_capital',
  reduccion_capital: 'reduccion_capital',
  escision: 'escision',
  declaracion_concurso: 'declaracion_concurso',
  disolucion: 'disolucion',
  cese: 'cese',
  nombramiento: 'nombramiento',
  reeleccion: 'reeleccion',
  transformacion: 'transformacion',
  fusion_absorcion: 'fusion_absorcion',
  modificacion_estatutos: 'modificacion_estatutos',
  extincion: 'extincion',
};

export interface ParsedBormeEvent {
  /** CIF normalizado (sin guiones/espacios). null si BORME no lo incluye. */
  cif: string | null;
  /** Nombre tal como aparece en BORME. */
  companyName: string;
  /** Fecha publicación (Date). */
  fecha: Date;
  /** Tipo de acto normalizado para BormeEvent.tipo. */
  tipo: string;
  /** ID BOE (ej. 'BORME-A-2026-45-12'). */
  bormeId: string;
  /** Provincia del sumario BORME. */
  provincia: string;
  /** Domicilio social si aparece. */
  domicilio: string | null;
  /** Capital social si aparece. */
  capital: string | null;
  /** CNAE extraído del texto si aparece (ej. '10.2'). */
  cnae: string | null;
  /** Texto completo del acto. */
  rawText: string;
  /** URL al BORME original. */
  fuente: string;
}

/**
 * Normaliza un CIF español: quita guiones, espacios, puntos, prefijo ES.
 * Si el input queda vacío, devuelve null. Si tiene menos de 8 caracteres
 * (CIF siempre es 1 letra + 7-8 dígitos), devuelve el cleaned pero no lanza.
 */
export function normalizeCif(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().toUpperCase();
  s = s.replace(/^ES[- ]?/i, '');
  s = s.replace(/[-.\s]/g, '');
  if (s.length === 0) return null;
  return s;
}

/**
 * Normaliza un nombre de empresa para matching: quita sufijos corporativos,
 * acentos, dobles espacios. Lowercase.
 */
export function normalizeCompanyName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(s\.?a\.?|s\.?l\.?|sociedad anonima|sociedad limitada|soc\.? limitada|sa|slu|s\.a\.u\.?)\b/g, '')
    .replace(/[.,;:'"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsea un RawBormeItem en ParsedBormeEvent (CNAE extra + tipado fuerte).
 */
export function parseBormeEvent(item: RawBormeItem): ParsedBormeEvent {
  const tipo = TIPO_TO_BORME_EVENT[item.actKind] ?? 'other';

  // Extrae primer CNAE del texto (puede haber varios, ej. CNAE principal + secundarios)
  const cnaeMatches = item.text.match(CNAE_REGEX);
  const cnae = cnaeMatches && cnaeMatches.length > 0 ? cnaeMatches[0] : null;

  return {
    cif: normalizeCif(item.cif),
    companyName: item.companyName,
    fecha: new Date(item.publishedAt),
    tipo,
    bormeId: item.bormeId,
    provincia: item.provincia,
    domicilio: item.domicilio,
    capital: item.capital,
    cnae,
    rawText: item.text,
    fuente: item.url,
  };
}

/**
 * Jaro-Winkler similarity entre dos strings (sin dependencias).
 * Score en [0,1]. ≥0.92 se considera match positivo.
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return s1.length === 0 ? 0 : 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches: boolean[] = new Array(len1).fill(false);
  const s2Matches: boolean[] = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions = Math.floor(transpositions / 2);

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
  // Winkler boost: hasta 0.25 si los 4 primeros chars coinciden
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}
