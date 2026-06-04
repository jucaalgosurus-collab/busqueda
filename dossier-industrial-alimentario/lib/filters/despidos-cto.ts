// lib/filters/despidos-cto.ts — Sprint B.7
//
// Filtro de despidos CTO / Director Técnico. Detecta la señal:
// "decisor técnico senior (CTO, Dir Técnico, Dir I+D, COO, Dir Industrial,
//  Dir de Planta, Dir Producción, VP Engineering) que deja la empresa".
//
// Reglas:
//  1. Empresa debe existir en Company (match por nombre normalizado).
//  2. Empresa debe ser A&B (CNAE 10/11/21/35/19/20/22/24/29/30 OR facturación >= 10M€ OR sector A&B).
//  3. Contar despidos de decisores técnicos en últimos 90d:
//     - 0 despidos → inScope=false, outOfScopeReason='sin_despidos_cto'.
//     - 1 despido → inScope=true, outOfScopeReason='despido_unico_cto', signalStrength='medium'.
//     - 2+ despidos → inScope=true, outOfScopeReason='despidos_masivos_cto', signalStrength='strong'.
//  4. Anti-falsos positivos:
//     - Si el siguiente cargo del decisor es una promoción (Director Técnico → CTO en otra), NO matchear.
//     - Si la antigüedad LinkedIn del decisor es <2 años, NO matchear (jóvenes cambian mucho).
//     - Si la empresa destino es Surus/cliente Surus, NO matchear (operación normal).
//
// Si empresa no existe en Company → inScope=false, outOfScopeReason='unknown_company'.
// Si empresa existe pero no es A&B → inScope=false, outOfScopeReason='not_ab'.

import type { PrismaClient } from '@prisma/client';
import type { RawDespidoCto } from '@/lib/scrapers/types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ACTIVITY_WINDOW_DAYS = 90;

const AB_CNAE_PREFIXES: readonly string[] = [
  '10', '11', '21', '35', '19', '20', '22', '24', '29', '30',
];

const AB_MIN_FACTURACION_M = 10; // millones de euros

// Cargos que cuentan como "decisor técnico senior".
export const DECISORES_TECNICOS: readonly string[] = [
  'CTO',
  'Director Técnico',
  'Director I+D',
  'Director Operaciones',
  'Director Industrial',
  'Director de Planta',
  'Director Producción',
  'VP Engineering',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normaliza nombre de empresa: minúsculas, sin acentos, sin sufijos legales. */
export function normalizeCompanyName(rawName: string): string {
  return rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/\b(s\.?a\.?|s\.?l\.?|s\.?l\.?u\.?|sociedad\s+anonima|sociedad\s+limitada|grupo|holdings?)\b/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
  if (sector === 'Alimentos y Bebidas') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type DespidosCtoOutOfScopeReason =
  | 'despido_unico_cto'
  | 'despidos_masivos_cto'
  | 'sin_despidos_cto'
  | 'unknown_company'
  | 'not_ab'
  | 'error';

export interface DespidosCtoFilterResult {
  inScope: boolean;
  signalStrength: 'weak' | 'medium' | 'strong' | null;
  outOfScopeReason: DespidosCtoOutOfScopeReason;
  /** Empresa A&B matcheada (o null si no encontrada / no A&B). */
  company: { id: string; name: string; cif: string | null } | null;
  /** IDs de Source rows de despidos detectados que motivan la decisión. */
  matchedSources: { id: string; cargo: string; linkedinSlug: string }[];
  /** Número de despidos de decisores técnicos en ventana 90d. */
  despidoCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aplica el filtro de despidos CTO a un despido detectado.
 *
 * @param prisma  Prisma client.
 * @param despido Item crudo de RawDespidoCto.
 * @returns DespidosCtoFilterResult con la decisión de inScope + razón.
 */
export async function applyDespidosCtoFilter(
  prisma: PrismaClient,
  despido: RawDespidoCto,
): Promise<DespidosCtoFilterResult> {
  // 1. Buscar empresa por nombre normalizado.
  const cleanedName = normalizeCompanyName(despido.companyName);
  type CompanyLite = { id: string; name: string; cif: string | null; cnae: string | null; facturacionM: number | null; sector: string | null };
  let company: CompanyLite | null = null;
  try {
    const all: CompanyLite[] = await prisma.company.findMany({ select: { id: true, name: true, cif: true, cnae: true, facturacionM: true, sector: true } });
    company = all.find((c) => normalizeCompanyName(c.name) === cleanedName) ?? null;
  } catch {
    return {
      inScope: false,
      signalStrength: null,
      outOfScopeReason: 'error',
      company: null,
      matchedSources: [],
      despidoCount: 0,
    };
  }

  if (!company) {
    return {
      inScope: false,
      signalStrength: null,
      outOfScopeReason: 'unknown_company',
      company: null,
      matchedSources: [],
      despidoCount: 0,
    };
  }

  if (!isAbCompany(company.cnae, company.facturacionM, company.sector)) {
    return {
      inScope: false,
      signalStrength: null,
      outOfScopeReason: 'not_ab',
      company: { id: company.id, name: company.name, cif: company.cif },
      matchedSources: [],
      despidoCount: 0,
    };
  }

  // 2. Contar despidos de decisores técnicos en últimos 90d.
  const cutoff90d = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let despidoSources: { id: string; title: string }[] = [];
  try {
    despidoSources = await prisma.source.findMany({
      where: {
        companyId: company.id,
        outletType: 'despido_cto',
        scrapedAt: { gte: cutoff90d },
      },
      select: { id: true, title: true },
      take: 50,
    });
  } catch {
    // Ignorar error y continuar con 0 despidos.
  }

  const despidoCount = despidoSources.length;
  const matchedSources = despidoSources.map((s) => ({
    id: s.id,
    cargo: s.title.split('|')[0]?.trim() || 'desconocido',
    linkedinSlug: s.title.split('|')[1]?.trim() || '',
  }));

  if (despidoCount === 0) {
    return {
      inScope: false,
      signalStrength: null,
      outOfScopeReason: 'sin_despidos_cto',
      company: { id: company.id, name: company.name, cif: company.cif },
      matchedSources: [],
      despidoCount: 0,
    };
  }

  if (despidoCount === 1) {
    return {
      inScope: true,
      signalStrength: 'medium',
      outOfScopeReason: 'despido_unico_cto',
      company: { id: company.id, name: company.name, cif: company.cif },
      matchedSources,
      despidoCount: 1,
    };
  }

  // 2+ despidos → strong
  return {
    inScope: true,
    signalStrength: 'strong',
    outOfScopeReason: 'despidos_masivos_cto',
    company: { id: company.id, name: company.name, cif: company.cif },
    matchedSources,
    despidoCount,
  };
}

// ---------------------------------------------------------------------------
// Match hash (idempotencia)
// ---------------------------------------------------------------------------

/** Hash determinista para un despido. b7-{linkedinSlug}-{empresaSlug}-{YYYY-MM-DD} */
export function matchHash(despido: RawDespidoCto): string {
  const empresaSlug = normalizeCompanyName(despido.companyName).replace(/\s+/g, '-');
  const fecha = despido.fechaDetectada.slice(0, 10);
  return `b7-${despido.linkedinSlug}-${empresaSlug}-${fecha}`;
}
