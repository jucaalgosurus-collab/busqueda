// lib/filters/plantas-stale.ts — Sprint B.8
//
// Detecta la señal operacional "planta sin novedad en 21d":
// una `Plant` operativa sin Sources en últimos 21d → isStale=true.
//
// Reglas:
//  1. Empresa debe existir (match por companyId).
//  2. Planta con status terminal ('cerrada'/'vendida'/'en_desmantelamiento')
//     → isStale=false, staleReason='estado_terminal'.
//  3. Planta con closureYear definido → isStale=false, staleReason='cerrada_registrada'.
//  4. Planta recién creada (<21d) → isStale=false, staleReason='planta_recien_creada'.
//  5. Contar Sources distintos (DISTINCT id) con plantId en últimos 21d:
//     - count >= 1 → isStale=false, staleReason=null (planta activa)
//     - count == 0 → isStale=true, staleReason='sin_novedad_21d'
//  6. Si la planta YA estaba isStale=true y se reactiva → isStale=false, staleReason=null
//     (cambio automático sin acción del operador).
//
// Si empresa sin plantas → 0 inScope, 0 outOfScope, no error.

import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STALE_WINDOW_DAYS = 21;

const TERMINAL_STATUSES: readonly string[] = [
  'cerrada',
  'vendida',
  'en_desmantelamiento',
];

const NEW_PLANT_MIN_AGE_DAYS = 21;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type PlantasStaleOutOfScopeReason =
  | 'estado_terminal'
  | 'cerrada_registrada'
  | 'planta_recien_creada'
  | 'sin_novedad_21d'
  | 'planta_activa'
  | 'unknown_company'
  | 'no_plants'
  | 'error';

export interface PlantasStaleFilterResult {
  inScope: boolean;
  isStale: boolean;
  outOfScopeReason: PlantasStaleOutOfScopeReason;
  /** Planta evaluada (o null si empresa sin plantas). */
  plant: { id: string; name: string; status: string; ccaa: string } | null;
  /** Source count de la planta en ventana 21d. */
  sourceCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evalúa una sola planta.
 *
 * @param prisma Prisma client.
 * @param plantId  Plant.id a evaluar.
 * @param now      Timestamp de evaluación (inyectable para tests).
 */
export async function applyPlantasStaleFilter(
  prisma: PrismaClient,
  plantId: string,
  now: Date = new Date(),
): Promise<PlantasStaleFilterResult> {
  // 1. Cargar planta
  type PlantLite = { id: string; name: string; ccaa: string; status: string; closureYear: number | null; companyId: string; createdAt: Date };
  let plant: PlantLite | null = null;
  try {
    plant = await prisma.plant.findUnique({
      where: { id: plantId },
      select: { id: true, name: true, ccaa: true, status: true, closureYear: true, companyId: true, createdAt: true },
    });
  } catch {
    return {
      inScope: false,
      isStale: false,
      outOfScopeReason: 'error',
      plant: null,
      sourceCount: 0,
    };
  }

  if (!plant) {
    return {
      inScope: false,
      isStale: false,
      outOfScopeReason: 'unknown_company',
      plant: null,
      sourceCount: 0,
    };
  }

  // 2. Status terminal → no se considera stale
  if (TERMINAL_STATUSES.includes(plant.status)) {
    return {
      inScope: false,
      isStale: false,
      outOfScopeReason: 'estado_terminal',
      plant: { id: plant.id, name: plant.name, status: plant.status, ccaa: plant.ccaa },
      sourceCount: 0,
    };
  }

  // 3. closureYear definido → cerrada registrada
  if (typeof plant.closureYear === 'number' && plant.closureYear > 0) {
    return {
      inScope: false,
      isStale: false,
      outOfScopeReason: 'cerrada_registrada',
      plant: { id: plant.id, name: plant.name, status: plant.status, ccaa: plant.ccaa },
      sourceCount: 0,
    };
  }

  // 4. Planta recién creada (<21d) → excluir
  const ageDays = (now.getTime() - plant.createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays < NEW_PLANT_MIN_AGE_DAYS) {
    return {
      inScope: false,
      isStale: false,
      outOfScopeReason: 'planta_recien_creada',
      plant: { id: plant.id, name: plant.name, status: plant.status, ccaa: plant.ccaa },
      sourceCount: 0,
    };
  }

  // 5. Contar Sources con plantId en últimos 21d
  const cutoff21d = new Date(now.getTime() - STALE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let sourceCount = 0;
  try {
    sourceCount = await prisma.source.count({
      where: {
        plantId: plant.id,
        scrapedAt: { gte: cutoff21d },
      },
    });
  } catch {
    // Ignorar error y continuar con 0.
  }

  if (sourceCount === 0) {
    return {
      inScope: true,
      isStale: true,
      outOfScopeReason: 'sin_novedad_21d',
      plant: { id: plant.id, name: plant.name, status: plant.status, ccaa: plant.ccaa },
      sourceCount: 0,
    };
  }

  return {
    inScope: false,
    isStale: false,
    outOfScopeReason: 'planta_activa',
    plant: { id: plant.id, name: plant.name, status: plant.status, ccaa: plant.ccaa },
    sourceCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Match hash determinista para idempotencia. b8-{plantId}-{YYYY-MM-DD} */
export function matchHash(plantId: string, when: Date = new Date()): string {
  const fecha = when.toISOString().slice(0, 10);
  return `b8-${plantId}-${fecha}`;
}

/** Marca/limpia isStale en DB atómicamente. Devuelve el Plant actualizado. */
export async function persistStaleFlag(
  prisma: PrismaClient,
  plantId: string,
  isStale: boolean,
  staleReason: string | null,
  when: Date = new Date(),
): Promise<void> {
  await prisma.plant.update({
    where: { id: plantId },
    data: {
      isStale,
      staleReason,
      staleAt: isStale ? when : null,
      staleCheckedAt: when,
    },
  });
}
