// lib/scrapers/company-matcher.ts — Sprint E.14
//
// Auto-ampliación de la lista de empresas desde señales externas.
// Regla de negocio 2026-06-04: SOLO GRANDES EMPRESAS (≥50M€ facturación
// O ≥250 empleados O tier A/B existente). PYMES se descartan.
//
// Estrategia:
//   1) normalizeName: minúsculas, sin acentos, sin sufijos legales.
//   2) matchExisting: busca en Company por nombre normalizado.
//   3) qualifyAsLarge: si match, verifica criterios de gran cuenta.
//   4) extractNameCandidates: extrae nombres de empresa candidatos desde
//      el contenido de una noticia (heurística, sin NLP).
//   5) classifyMention: dada una mención, decide si crear Company nueva
//      (gran cuenta, datos verificados) o dejarla pendiente (sin datos).
//
// Es un módulo PURO: no toca Prisma. La capa de persistencia la hace
// quien llame a estas funciones (agentes, runPrensaAgent, etc.).
// Esto permite testear con smoke sin DB.

import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Umbral mínimo de facturación para considerar gran cuenta (M€). */
export const LARGE_MIN_FACTURACION_M = 50;

/** Umbral mínimo de empleados para considerar gran cuenta. */
export const LARGE_MIN_EMPLEADOS = 250;

/** Tiers que cualifican como gran cuenta sin necesidad de otros datos. */
export const LARGE_TIERS: readonly string[] = ['A', 'B'];

/** Sufijos legales a eliminar en normalización. */
const LEGAL_SUFFIXES_RE =
  /\b(s\.?\s?a\.?\s?u?\.?|s\.?\s?l\.?\s?u?\.?|sociedad\s+anonima|sociedad\s+limitada|grupo|holdings?|compañia|compania)\b/gi;

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/** Normaliza un nombre de empresa: minúsculas, sin acentos, sin sufijos legales. */
export function normalizeName(rawName: string): string {
  return rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(LEGAL_SUFFIXES_RE, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Genera un slug URL-safe a partir del nombre. */
export function slugify(rawName: string): string {
  return normalizeName(rawName).replace(/\s+/g, '-').slice(0, 100);
}

// ---------------------------------------------------------------------------
// Calificadores
// ---------------------------------------------------------------------------

export interface SizeHints {
  facturacionM?: number | null;
  empleadosTotal?: number | null;
  tier?: string | null;
  sector?: string | null;
}

export type LargeReason =
  | 'facturacion_ge_50M'
  | 'empleados_ge_250'
  | 'tier_a_o_b'
  | 'unknown_needs_review';

export type SmallReason =
  | 'facturacion_lt_50M'
  | 'empleados_lt_250'
  | 'tier_c_o_d'
  | 'unknown_pending_review';

export interface LargeClassification {
  isLarge: boolean;
  reason: LargeReason | SmallReason;
  needsReview: boolean;
}

/**
 * Determina si una empresa es gran cuenta.
 * Cualifica si cumple AL MENOS UNO de:
 *  - facturacionM >= 50
 *  - empleadosTotal >= 250
 *  - tier ∈ {A, B}
 *
 * Si no hay datos verificables, devuelve needsReview=true (la decisión se delega
 * al operador, no se auto-crea el Company).
 */
export function qualifyAsLarge(hints: SizeHints): LargeClassification {
  if (typeof hints.facturacionM === 'number' && hints.facturacionM >= LARGE_MIN_FACTURACION_M) {
    return { isLarge: true, reason: 'facturacion_ge_50M', needsReview: false };
  }
  if (typeof hints.empleadosTotal === 'number' && hints.empleadosTotal >= LARGE_MIN_EMPLEADOS) {
    return { isLarge: true, reason: 'empleados_ge_250', needsReview: false };
  }
  if (hints.tier && LARGE_TIERS.includes(hints.tier)) {
    return { isLarge: true, reason: 'tier_a_o_b', needsReview: false };
  }
  if (hints.tier && (hints.tier === 'C' || hints.tier === 'D')) {
    return { isLarge: false, reason: 'tier_c_o_d', needsReview: false };
  }
  if (typeof hints.facturacionM === 'number' && hints.facturacionM < LARGE_MIN_FACTURACION_M) {
    return { isLarge: false, reason: 'facturacion_lt_50M', needsReview: false };
  }
  if (typeof hints.empleadosTotal === 'number' && hints.empleadosTotal < LARGE_MIN_EMPLEADOS) {
    return { isLarge: false, reason: 'empleados_lt_250', needsReview: false };
  }
  // Sin datos verificables. NO auto-clasificar como pyme; dejar pendiente.
  return { isLarge: false, reason: 'unknown_pending_review', needsReview: true };
}

// ---------------------------------------------------------------------------
// Extracción de candidatos (heurística, sin NLP)
// ---------------------------------------------------------------------------

/**
 * Candidatos a nombre de empresa extraídos del texto. Heurística: secuencias
 * de 2-6 palabras en MAYÚSCULAS o Title Case, que NO sean al inicio de frase
 * comunes ("El", "La", "Los", "Las") y que no estén seguidas de puntuación
 * no-comercial.
 */
export function extractNameCandidates(text: string): string[] {
  if (!text || text.length < 3) return [];
  // 1) Frases en MAYÚSCULAS sostenidas (mín 2 palabras, cada una ≥2 letras).
  const upperRe = /([A-Z][A-Z0-9]{1,}(?:\s+[A-Z][A-Z0-9&]{1,}){1,5})/g;
  // 2) Frases en Title Case (mín 2 palabras), pero descartar starts de frase comunes.
  const titleRe = /([A-Z][a-z0-9]{1,}(?:\s+[A-Z][a-z0-9&]{1,}){1,4})/g;
  const stopStarters = new Set(['El', 'La', 'Los', 'Las', 'Un', 'Una', 'Unos', 'Unas', 'De', 'Del', 'En', 'Por', 'Para', 'Con', 'Sin', 'Sobre', 'Tras', 'Entre']);

  const candidates = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = upperRe.exec(text)) !== null) candidates.add(m[1].trim());
  while ((m = titleRe.exec(text)) !== null) {
    const first = m[1].split(/\s+/)[0];
    if (stopStarters.has(first)) continue;
    candidates.add(m[1].trim());
  }

  return [...candidates]
    .filter((c) => c.length >= 4)
    .filter((c) => !/^\d+$/.test(c)); // descartar puros números
}

// ---------------------------------------------------------------------------
// Match con Company existente
// ---------------------------------------------------------------------------

export interface CompanyLite {
  id: string;
  slug: string;
  name: string;
  facturacionM: number | null;
  empleadosTotal: number | null;
  tier: string | null;
  sector: string | null;
}

/**
 * Busca una Company por nombre normalizado.
 * Devuelve la primera coincidencia exacta (post-normalización) o null.
 */
export function matchExistingCompany(
  name: string,
  all: readonly CompanyLite[],
): CompanyLite | null {
  const target = normalizeName(name);
  if (!target) return null;
  for (const c of all) {
    if (normalizeName(c.name) === target) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Decisión final: ¿qué hago con esta mención?
// ---------------------------------------------------------------------------

export type MentionAction =
  | { kind: 'link_to_existing'; companyId: string; isLarge: boolean; reason: LargeReason | SmallReason }
  | { kind: 'create_new'; suggestedSlug: string; suggestedName: string; suggestedSector: string; reason: LargeReason }
  | { kind: 'skip_pyme'; reason: SmallReason }
  | { kind: 'pending_review'; suggestedSlug: string; suggestedName: string; reason: 'unknown_pending_review' };

/**
 * Decide qué hacer con una mención de nombre de empresa detectada.
 * - Si la Company existe y es gran cuenta → link_to_existing
 * - Si la Company existe y es pyme → skip_pyme (no enrich, no notificar)
 * - Si la Company no existe y hay SizeHints verificados como gran cuenta → create_new
 * - Si la Company no existe y SizeHints es pyme → skip_pyme
 * - Si la Company no existe y no hay SizeHints → pending_review (buzón manual)
 */
export function classifyMention(args: {
  rawName: string;
  sizeHints?: SizeHints;
  existing?: readonly CompanyLite[];
  defaultSector?: string; // 'Alimentos y Bebidas' por defecto si agente es A&B
}): MentionAction {
  const cleaned = args.rawName.replace(/\s+/g, ' ').trim();
  if (!cleaned) return { kind: 'skip_pyme', reason: 'facturacion_lt_50M' };

  const existing = args.existing ? matchExistingCompany(cleaned, args.existing) : null;
  const hints: SizeHints = existing
    ? {
        facturacionM: existing.facturacionM,
        empleadosTotal: existing.empleadosTotal,
        tier: existing.tier,
        sector: existing.sector,
      }
    : (args.sizeHints ?? {});

  const cls = qualifyAsLarge(hints);

  if (existing) {
    if (cls.isLarge) {
      return { kind: 'link_to_existing', companyId: existing.id, isLarge: true, reason: cls.reason as LargeReason };
    }
    return { kind: 'skip_pyme', reason: cls.reason as SmallReason };
  }

  // No existe
  if (cls.isLarge) {
    return {
      kind: 'create_new',
      suggestedSlug: slugify(cleaned),
      suggestedName: cleaned,
      suggestedSector: hints.sector ?? args.defaultSector ?? 'Alimentos y Bebidas',
      reason: cls.reason as LargeReason,
    };
  }
  if (cls.needsReview) {
    return {
      kind: 'pending_review',
      suggestedSlug: slugify(cleaned),
      suggestedName: cleaned,
      reason: 'unknown_pending_review',
    };
  }
  return { kind: 'skip_pyme', reason: cls.reason as SmallReason };
}

// ---------------------------------------------------------------------------
// Helper de persistencia (quien lo llama provee el prisma)
// ---------------------------------------------------------------------------

export interface PersistResult {
  action: 'linked' | 'created' | 'skipped_pyme' | 'pending';
  companyId: string | null;
  suggestedSlug: string | null;
}

/**
 * Persiste el resultado de classifyMention usando el PrismaClient provisto.
 * Idempotente: si el slug ya existe, lo enlaza sin duplicar.
 */
export async function persistMention(
  prisma: PrismaClient,
  decision: MentionAction,
  agentName: string,
): Promise<PersistResult> {
  switch (decision.kind) {
    case 'link_to_existing':
      return { action: 'linked', companyId: decision.companyId, suggestedSlug: null };

    case 'create_new': {
      const existingBySlug = await prisma.company.findUnique({
        where: { slug: decision.suggestedSlug },
        select: { id: true, slug: true },
      });
      if (existingBySlug) {
        return { action: 'linked', companyId: existingBySlug.id, suggestedSlug: existingBySlug.slug };
      }
      const created = await prisma.company.create({
        data: {
          slug: decision.suggestedSlug,
          name: decision.suggestedName,
          sector: decision.suggestedSector,
          subsector: 'Por clasificar',
          tier: 'B',
          priority: 0,
          status: 'active',
        },
        select: { id: true, slug: true },
      });
      console.log(`[company-matcher] nuevo Company creado por ${agentName}: ${created.slug} (${created.id})`);
      return { action: 'created', companyId: created.id, suggestedSlug: created.slug };
    }

    case 'skip_pyme':
      return { action: 'skipped_pyme', companyId: null, suggestedSlug: null };

    case 'pending_review':
      return { action: 'pending', companyId: null, suggestedSlug: decision.suggestedSlug };
  }
}

// ---------------------------------------------------------------------------
// Auto-ampliación desde agentes (Sprint E.14.1)
// ---------------------------------------------------------------------------

export interface AmplifyResult {
  action: 'linked' | 'created' | 'skipped_pyme' | 'already_known' | 'invalid_name';
  companyId: string | null;
  suggestedSlug: string | null;
}

/**
 * Procesa una mención detectada por un agente en un artículo scrapeado.
 * Reglas (mandato 2026-06-04):
 *   - Si la Company existe (match normalizado): la enlaza.
 *   - Si NO existe: la crea como tier='B', sector=defaultSector, status='active',
 *     subsector='Por clasificar'. La nueva empresa NO entra al pipeline de
 *     contactos hasta que el usuario pulse "Buscar responsables" (Regla 1).
 *
 * NO clasifica por tamaño: el mandato dice "tier='B'" directo, sin gate
 * de facturación/empleados. El gate de tamaño es para auto-ampliación desde
 * contactos, no desde señal.
 */
export async function processAgentMention(
  prisma: PrismaClient,
  rawName: string,
  agentName: string,
  defaultSector = 'Alimentos y Bebidas',
): Promise<AmplifyResult> {
  const cleaned = rawName.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 3) {
    return { action: 'invalid_name', companyId: null, suggestedSlug: null };
  }

  // 1) Match exacto normalizado con Company existente
  const all = await prisma.company.findMany({
    where: { status: 'active' },
    select: { id: true, slug: true, name: true },
    take: 5000,
  });
  const existing = matchExistingCompany(cleaned, all);
  if (existing) {
    return { action: 'linked', companyId: existing.id, suggestedSlug: existing.slug };
  }

  // 2) Auto-crear como tier='B'
  const slug = slugify(cleaned);
  if (!slug) {
    return { action: 'invalid_name', companyId: null, suggestedSlug: null };
  }
  const existingBySlug = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (existingBySlug) {
    return { action: 'already_known', companyId: existingBySlug.id, suggestedSlug: existingBySlug.slug };
  }
  const created = await prisma.company.create({
    data: {
      slug,
      name: cleaned,
      sector: defaultSector,
      subsector: 'Por clasificar',
      tier: 'B',
      priority: 0,
      status: 'active',
    },
    select: { id: true, slug: true },
  });
  console.log(`[company-matcher:auto-amplify] nuevo Company por ${agentName}: ${created.slug} (${created.id})`);
  return { action: 'created', companyId: created.id, suggestedSlug: created.slug };
}
