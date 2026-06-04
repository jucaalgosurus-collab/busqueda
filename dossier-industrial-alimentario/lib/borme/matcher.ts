// lib/borme/matcher.ts — Sprint C.1
// Match entre ParsedBormeEvent y Company[] en la DB.
// Estrategia: 1) match exacto por CIF, 2) match por nombre normalizado + misma provincia,
// 3) match difuso Jaro-Winkler ≥ 0.92.

import type { Company } from '@prisma/client';
import { jaroWinkler, normalizeCompanyName, type ParsedBormeEvent } from './parser';

export interface MatchResult {
  company: Company;
  score: number;
  strategy: 'cif_exact' | 'name_province' | 'name_fuzzy' | 'cif_prefix';
}

const FUZZY_THRESHOLD = 0.92;
const PROVINCE_MATCH_BONUS = 0.05;

/**
 * Intenta matchear un evento BORME contra la lista de Companies.
 * Devuelve el mejor match o null. Orden de prioridad:
 *   1. CIF exacto (mismo cif normalizado)
 *   2. CIF prefijo (uno contiene al otro, ej. matriz vs filial)
 *   3. Nombre normalizado exacto + misma provincia
 *   4. Nombre Jaro-Winkler ≥ 0.92 (+ bonus si misma provincia)
 */
export function matchCompany(event: ParsedBormeEvent, companies: Company[]): MatchResult | null {
  const candidates: MatchResult[] = [];

  // 1. CIF exacto
  if (event.cif) {
    for (const c of companies) {
      if (c.cif && c.cif === event.cif) {
        candidates.push({ company: c, score: 1, strategy: 'cif_exact' });
      }
    }
  }

  // 2. CIF prefijo
  if (event.cif) {
    for (const c of companies) {
      if (c.cif && c.cif !== event.cif && (c.cif.startsWith(event.cif) || event.cif.startsWith(c.cif))) {
        candidates.push({ company: c, score: 0.85, strategy: 'cif_prefix' });
      }
    }
  }

  // 3 + 4. Match por nombre
  const eventName = normalizeCompanyName(event.companyName);
  if (eventName.length >= 4) {
    for (const c of companies) {
      const cName = normalizeCompanyName(c.name);
      if (cName.length < 4) continue;

      // 3. Exact + misma provincia
      if (cName === eventName && provinceMatches(c, event.provincia)) {
        candidates.push({ company: c, score: 0.98, strategy: 'name_province' });
        continue;
      }

      // 4. Fuzzy
      const score = jaroWinkler(cName, eventName);
      if (score >= FUZZY_THRESHOLD) {
        const final = provinceMatches(c, event.provincia) ? score + PROVINCE_MATCH_BONUS : score;
        if (final >= FUZZY_THRESHOLD) {
          candidates.push({ company: c, score: final, strategy: 'name_fuzzy' });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Match many-to-many: asigna cada evento a la mejor Company o lo deja sin asignar.
 */
export function matchAll(
  events: ParsedBormeEvent[],
  companies: Company[]
): Array<{ event: ParsedBormeEvent; match: MatchResult | null }> {
  return events.map((event) => ({ event, match: matchCompany(event, companies) }));
}

function provinceMatches(company: Company, bormeProvincia: string): boolean {
  if (!company.hqRegion) return false;
  const bormeProvNorm = bormeProvincia.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const hqNorm = company.hqRegion.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  // Comparación laxa: que una contenga a la otra
  return bormeProvNorm.includes(hqNorm) || hqNorm.includes(bormeProvNorm);
}
