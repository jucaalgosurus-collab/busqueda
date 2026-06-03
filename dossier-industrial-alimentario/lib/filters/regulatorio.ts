// lib/filters/regulatorio.ts — Sprint B.2: Filtro deimplantation para alertas regulatorias.
//
// Determina si una alerta AESAN merece `deimplantationSignal=true`:
//   - Match por marca mencionada (cruzando contra `Company.name` y `Company.parentGroup`)
//   - Si no hay match, queda como `outOfScopeReason='not_relevant_industry'`
//
// Sin scoring numérico (a diferencia de B.1 BORME): si la marca matchea, es `medium`.

import type { PrismaClient } from '@prisma/client';
import type { RawAesanAlert } from '@/lib/scrapers/types';

export interface RegulatorioFilterResult {
  inScope: boolean;
  matchedCompany: { id: string; name: string; slug: string } | null;
  signalStrength: 'medium' | null;
  outOfScopeReason: string | null;
}

// Normalización: NFD + strip diacritics + lowercase + trim + colapsar espacios.
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:¿?¡!()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Variantes de nombre para fuzzy matching:
//   "Nestlé" -> ["nestle", "nestlé"]
//   "Mahou San Miguel" -> ["mahou san miguel", "mahou", "san miguel"]
export function companyMatchVariants(name: string, parentGroup: string | null): string[] {
  const variants = new Set<string>();
  for (const src of [name, parentGroup]) {
    if (!src) continue;
    const norm = normalizeForMatch(src);
    if (norm.length >= 3) variants.add(norm);
    // Primer término como marca (ej. "Mahou" de "Mahou San Miguel")
    const firstToken = norm.split(' ')[0];
    if (firstToken && firstToken.length >= 4) variants.add(firstToken);
  }
  return Array.from(variants);
}

// Detecta si un texto (título + body) menciona alguna de las variantes de marca.
// Devuelve la primera variante que matchee (orden: nombre completo → primer token).
export function findBrandInText(text: string, companyName: string, parentGroup: string | null): string | null {
  const normText = normalizeForMatch(text);
  const variants = companyMatchVariants(companyName, parentGroup);
  for (const v of variants) {
    if (normText.includes(v)) return v;
  }
  return null;
}

/**
 * Filtro principal. Carga la lista de Companies una vez y devuelve el resultado
 * de matching para una alerta. Si hay match, marca inScope=true, medium.
 */
export async function applyRegulatorioFilter(
  prisma: PrismaClient,
  alert: RawAesanAlert,
): Promise<RegulatorioFilterResult> {
  // Texto a buscar: título + body + brand extraído
  const haystack = [alert.title, alert.content, alert.brand ?? ''].join(' ');
  if (haystack.trim().length < 5) {
    return { inScope: false, matchedCompany: null, signalStrength: null, outOfScopeReason: 'empty_text' };
  }

  // Traer todas las companies activas (no太多了: 7 seed + algunas añadidas por QW-1 industria filter).
  // Si crece mucho, pasar a un argumento `companies` pre-cargado por el runner.
  const companies = await prisma.company.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, slug: true, parentGroup: true },
  });

  for (const c of companies) {
    const variant = findBrandInText(haystack, c.name, c.parentGroup ?? null);
    if (variant) {
      return {
        inScope: true,
        matchedCompany: { id: c.id, name: c.name, slug: c.slug },
        signalStrength: 'medium',
        outOfScopeReason: null,
      };
    }
  }

  return { inScope: false, matchedCompany: null, signalStrength: null, outOfScopeReason: 'not_relevant_industry' };
}
