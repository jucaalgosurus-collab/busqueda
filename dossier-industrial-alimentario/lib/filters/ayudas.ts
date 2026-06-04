// lib/filters/ayudas.ts — Sprint B.6
//
// Filtro de ayudas públicas CDTI/IDAE/ICEX. Detecta la señal débil:
// "ayuda pública reciente a empresa A&B sin actividad" o "ayuda previa a concurso".
//
// Reglas:
//  1. Empresa debe existir en Company (cif normalizado).
//  2. Empresa debe ser A&B (cnae sectorial O facturacionM >= 10M€).
//  3. Buscar Source de la empresa en últimos 90d con actividad normal:
//     - Si HAY actividad → inScope=false, outOfScopeReason='ayuda_con_actividad_normal'.
//  4. Buscar Source de la empresa con keyword de cierre/concurso POSTERIOR a la ayuda:
//     - Si HAY → inScope=true, outOfScopeReason='ayuda_previa_a_concurso', signalStrength='medium'.
//  5. Si NO hay actividad reciente → inScope=true, outOfScopeReason='ayuda_sin_actividad', signalStrength='medium'.
//
// Si empresa no existe en Company → inScope=false, outOfScopeReason='unknown_company'.
// Si empresa existe pero no es A&B → inScope=false, outOfScopeReason='not_ab'.

import type { PrismaClient } from '@prisma/client';
import type { RawAyudaPublica } from '@/lib/scrapers/types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ACTIVITY_WINDOW_DAYS = 90;

const AB_CNAE_PREFIXES: readonly string[] = [
  '10', '11', '21', '35', '19', '20', '22', '24', '29', '30',
];

const AB_MIN_FACTURACION_M = 10; // millones de euros

const CLOSURE_KEYWORDS_RE =
  /\b(concurso(?:\s+de\s+acreedores)?|ERE|cierre|desimplantaci[oó]n|despidos?\s+masiv[os]|liquidaci[oó]n\s+concursal|quita\s+y\s+espera|suspensi[oó]n\s+de\s+pagos)\b/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normaliza un CIF: mayúsculas, sin guiones, sin espacios, sin puntos. */
export function normalizeCif(rawCif: string): string {
  return rawCif.toUpperCase().replace(/[-\s.]/g, '');
}

/** Determina si una empresa es A&B por CNAE o por tamaño de facturación. */
function isAbCompany(
  cnae: string | null,
  facturacionM: number | null,
  sector: string | null,
): boolean {
  if (typeof facturacionM === 'number' && facturacionM >= AB_MIN_FACTURACION_M) return true;
  if (typeof cnae === 'string' && cnae.length >= 2) {
    const prefix = cnae.slice(0, 2);
    if (AB_CNAE_PREFIXES.includes(prefix)) return true;
  }
  if (sector === 'Alimentos y Bebidas' || sector === 'Industrial' || sector === 'Energetico' || sector === 'Farmaceutico') {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type AyudasOutOfScopeReason =
  | 'ayuda_sin_actividad'
  | 'ayuda_previa_a_concurso'
  | 'ayuda_con_actividad_normal'
  | 'unknown_company'
  | 'not_ab'
  | 'error';

export interface AyudasFilterResult {
  inScope: boolean;
  signalStrength: 'medium' | null;
  outOfScopeReason: AyudasOutOfScopeReason;
  /** Empresa A&B matcheada (o null si no encontrada / no A&B). */
  company: { id: string; name: string; cif: string | null } | null;
  /** IDs de Source rows que motivan la decisión (actividad reciente o cierre posterior). */
  matchedSources: { id: string; kind: 'activity' | 'closure' }[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aplica el filtro de ayuda pública a una ayuda + empresa beneficiaria.
 *
 * @param prisma  Prisma client.
 * @param ayuda   Item crudo de RawAyudaPublica.
 * @returns AyudasFilterResult con la decisión de inScope + razón.
 */
export async function applyAyudasFilter(
  prisma: PrismaClient,
  ayuda: RawAyudaPublica,
): Promise<AyudasFilterResult> {
  const cleanedCif = normalizeCif(ayuda.cif);
  const fechaConcesion = new Date(ayuda.fechaConcesion);
  const fechaConcesionMs = fechaConcesion.getTime();

  // 1. Buscar empresa por CIF.
  let company: Awaited<ReturnType<PrismaClient['company']['findFirst']>> = null;
  try {
    company = await prisma.company.findFirst({
      where: {
        OR: [
          { cif: cleanedCif },
          { cif: ayuda.cif },
        ],
      },
    });
  } catch {
    return {
      inScope: false,
      signalStrength: null,
      outOfScopeReason: 'error',
      company: null,
      matchedSources: [],
    };
  }

  // 2. Si no existe, out of scope.
  if (!company) {
    return {
      inScope: false,
      signalStrength: null,
      outOfScopeReason: 'unknown_company',
      company: null,
      matchedSources: [],
    };
  }

  // 3. Si no es A&B, out of scope.
  if (!isAbCompany(company.cnae, company.facturacionM, company.sector)) {
    return {
      inScope: false,
      signalStrength: null,
      outOfScopeReason: 'not_ab',
      company: { id: company.id, name: company.name, cif: company.cif },
      matchedSources: [],
    };
  }

  const cutoff90d = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // 4. Buscar Source de actividad normal (no deimplantationSignal) en últimos 90d.
  let activityCount = 0;
  let closureCount = 0;
  const matchedSources: AyudasFilterResult['matchedSources'] = [];

  try {
    const recentActivity = await prisma.source.findMany({
      where: {
        companyId: company.id,
        scrapedAt: { gte: cutoff90d },
        deimplantationSignal: false,
      },
      select: { id: true },
      take: 5,
    });
    activityCount = recentActivity.length;
    for (const s of recentActivity) matchedSources.push({ id: s.id, kind: 'activity' });
  } catch {
    // Ignorar error y continuar con 0 actividad.
  }

  try {
    // 5. Buscar Source con keyword de cierre/concurso POSTERIOR a la ayuda.
    const closureSources = await prisma.source.findMany({
      where: {
        companyId: company.id,
        publishedAt: { gte: fechaConcesion },
        OR: [
          { outOfScopeReason: { in: ['concurso', 'liquidacion', 'desimplantacion'] } },
          { contentText: { contains: 'concurso' } },
        ],
      },
      select: { id: true, contentText: true },
      take: 5,
    });
    const closureWithKeyword = closureSources.filter((s) =>
      typeof s.contentText === 'string' && CLOSURE_KEYWORDS_RE.test(s.contentText),
    );
    closureCount = closureWithKeyword.length;
    for (const s of closureWithKeyword) matchedSources.push({ id: s.id, kind: 'closure' });
  } catch {
    // Ignorar.
  }

  // 6. Decisión.
  if (closureCount > 0) {
    return {
      inScope: true,
      signalStrength: 'medium',
      outOfScopeReason: 'ayuda_previa_a_concurso',
      company: { id: company.id, name: company.name, cif: company.cif },
      matchedSources,
    };
  }

  if (activityCount === 0) {
    return {
      inScope: true,
      signalStrength: 'medium',
      outOfScopeReason: 'ayuda_sin_actividad',
      company: { id: company.id, name: company.name, cif: company.cif },
      matchedSources,
    };
  }

  return {
    inScope: false,
    signalStrength: null,
    outOfScopeReason: 'ayuda_con_actividad_normal',
    company: { id: company.id, name: company.name, cif: company.cif },
    matchedSources,
  };
}

// ---------------------------------------------------------------------------
// Match hash (idempotencia)
// ---------------------------------------------------------------------------

/** Hash determinista para una ayuda. b6-{cif}-{convocatoriaId}-{proyectoSlug} */
export function matchHash(ayuda: RawAyudaPublica): string {
  const cleanedCif = normalizeCif(ayuda.cif);
  const safeProyecto = ayuda.proyecto.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `b6-${cleanedCif}-${ayuda.convocatoriaId}-${safeProyecto}`;
}
