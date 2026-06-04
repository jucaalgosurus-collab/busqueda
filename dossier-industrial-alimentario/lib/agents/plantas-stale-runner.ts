// lib/agents/plantas-stale-runner.ts — Sprint B.8
//
// Detecta plantas A&B sin novedad en 21d. Idempotente.
// Sin coste API (es un SQL).
//
// Cadencia: 1 vez al día, 04:30 UTC (tras hermes-scan.timer).
// Modo: backfill_30d la primera vez, incremental_1d después.

import { PrismaClient } from '@prisma/client';
import {
  applyPlantasStaleFilter,
  matchHash,
  persistStaleFlag,
  type PlantasStaleFilterResult,
} from '@/lib/filters/plantas-stale';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const PLANTAS_STALE_AGENT_NAME = 'surus-agente-plantas-stale';
export const PLANTAS_STALE_CADENCE_DAYS = 1;
export const PLANTAS_STALE_BACKFILL_DAYS = 30;

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface PlantasStaleAgentResult {
  agentName: string;
  mode: 'backfill_30d' | 'incremental_1d';
  plantsEvaluated: number;
  plantsMarkedStale: number;
  plantsReactivated: number;
  plantsSkipped: number;
  byReason: Record<string, number>;
  topPlants: Array<{ id: string; name: string; ccaa: string; status: string; sourceCount: number; reason: string }>;
  errors: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helper: registrar SearchRun para auditoría
// ---------------------------------------------------------------------------

async function logSearchRun(result: PlantasStaleAgentResult): Promise<void> {
  try {
    await prisma.searchRun.create({
      data: {
        agentName: result.agentName,
        startedAt: new Date(Date.now() - result.durationMs),
        finishedAt: new Date(),
        itemsFound: result.plantsEvaluated,
        itemsInScope: result.plantsMarkedStale,
        itemsOutOfScope: result.plantsSkipped,
        errorsCount: result.errors,
        mode: result.mode,
      },
    });
  } catch {
    // No crítico: si falla, no abortamos.
  }
}

// ---------------------------------------------------------------------------
// Helper: asegurar ScanConfig con cadencia 1d
// ---------------------------------------------------------------------------

async function ensureScanConfig(): Promise<void> {
  try {
    await prisma.scanConfig.upsert({
      where: { agentName: PLANTAS_STALE_AGENT_NAME },
      create: { agentName: PLANTAS_STALE_AGENT_NAME, cadenceDays: PLANTAS_STALE_CADENCE_DAYS, isActive: true },
      update: { isActive: true, cadenceDays: PLANTAS_STALE_CADENCE_DAYS },
    });
  } catch {
    // No crítico.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PlantasStaleOptions {
  dryRun?: boolean;
  now?: Date;
}

export async function runPlantasStaleAgent(opts: PlantasStaleOptions = {}): Promise<PlantasStaleAgentResult> {
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun ?? false;

  await ensureScanConfig();

  // 1. Detectar modo (backfill la 1ª vez)
  const lastRun = await prisma.searchRun.findFirst({
    where: { agentName: PLANTAS_STALE_AGENT_NAME },
    orderBy: { startedAt: 'desc' },
  });
  const mode: 'backfill_30d' | 'incremental_1d' = lastRun ? 'incremental_1d' : 'backfill_30d';

  // 2. Cargar plantas candidatas
  //    backfill_30d → todas las plantas
  //    incremental_1d → solo plantas marcadas stale en corrida anterior o creadas en últimas 24h
  let plantIds: string[];
  if (mode === 'backfill_30d') {
    const all = await prisma.plant.findMany({ select: { id: true } });
    plantIds = all.map((p) => p.id);
  } else {
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const candidates = await prisma.plant.findMany({
      where: {
        OR: [
          { isStale: true },
          { createdAt: { gte: cutoff24h } },
        ],
      },
      select: { id: true },
    });
    plantIds = candidates.map((p) => p.id);
  }

  let evaluated = 0;
  let markedStale = 0;
  let reactivated = 0;
  let skipped = 0;
  let errors = 0;
  const byReason: Record<string, number> = {};
  const topPlants: PlantasStaleAgentResult['topPlants'] = [];

  for (const pid of plantIds) {
    let r: PlantasStaleFilterResult;
    try {
      r = await applyPlantasStaleFilter(prisma, pid, now);
    } catch {
      errors++;
      continue;
    }
    evaluated++;
    byReason[r.outOfScopeReason] = (byReason[r.outOfScopeReason] ?? 0) + 1;

    if (r.inScope) {
      // Planta marcada stale
      if (!dryRun) {
        try {
          await persistStaleFlag(prisma, pid, true, 'sin_novedad_21d', now);
        } catch {
          errors++;
          continue;
        }
      }
      markedStale++;
      if (r.plant) {
        topPlants.push({
          id: r.plant.id,
          name: r.plant.name,
          ccaa: r.plant.ccaa,
          status: r.plant.status,
          sourceCount: r.sourceCount,
          reason: r.outOfScopeReason,
        });
      }
    } else {
      // Verificar si la planta estaba stale y hay que reactivarla
      const currentPlant = await prisma.plant.findUnique({ where: { id: pid }, select: { isStale: true } });
      if (currentPlant?.isStale && r.outOfScopeReason === 'planta_activa') {
        if (!dryRun) {
          try {
            await persistStaleFlag(prisma, pid, false, null, now);
          } catch {
            errors++;
            continue;
          }
        }
        reactivated++;
        if (r.plant) {
          topPlants.push({
            id: r.plant.id,
            name: r.plant.name,
            ccaa: r.plant.ccaa,
            status: r.plant.status,
            sourceCount: r.sourceCount,
            reason: 'reactivada',
          });
        }
      } else {
        skipped++;
      }
    }
  }

  // 3. Marcar staleCheckedAt también en plantas que NO se evaluaron (incremental)
  if (mode === 'incremental_1d' && !dryRun) {
    try {
      // Bulk update plantas no evaluadas con staleCheckedAt
      await prisma.plant.updateMany({
        where: {
          id: { notIn: plantIds },
          staleCheckedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        data: { staleCheckedAt: now },
      });
    } catch {
      // No crítico.
    }
  }

  const result: PlantasStaleAgentResult = {
    agentName: PLANTAS_STALE_AGENT_NAME,
    mode,
    plantsEvaluated: evaluated,
    plantsMarkedStale: markedStale,
    plantsReactivated: reactivated,
    plantsSkipped: skipped,
    byReason,
    topPlants: topPlants.slice(0, 20),
    errors,
    durationMs: Date.now() - t0,
  };

  await logSearchRun(result);

  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    const r = await runPlantasStaleAgent();
    console.log('[plantas-stale-runner] result:', JSON.stringify(r, null, 2));
    await prisma.$disconnect();
  })().catch(async (e) => {
    console.error('[plantas-stale-runner] FATAL:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
}
