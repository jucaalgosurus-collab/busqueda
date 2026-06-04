// lib/agents/despidos-cto-runner.ts — Sprint B.7
//
// Runner del agente `surus-agente-despidos-cto`. Detecta despidos de
// decisores técnicos senior (CTO, Director Técnico, Director I+D, COO,
// Director Industrial, Director de Planta, Director Producción,
// VP Engineering) en empresas A&B.
//
// Modo:
//   - 1ª corrida: backfill_90d.
//   - Siguientes: incremental_7d.
//
// Costo: 0€ (Google CSE free tier 100/día, suficiente para 7 empresas × 8 queries).

import { PrismaClient } from '@prisma/client';
import { applyDespidosCtoFilter, matchHash } from '@/lib/filters/despidos-cto';
import { scrapeDespidosCto, type RawDespidoCto } from '@/lib/scrapers/despidos-cto';

const prisma = new PrismaClient();

export const DESPIDOS_CTO_AGENT_NAME = 'surus-agente-despidos-cto';
export const DESPIDOS_CTO_CADENCE_DAYS = 7;
export const DESPIDOS_CTO_BACKFILL_DAYS = 90;

// ---------------------------------------------------------------------------
// ScanConfig helpers
// ---------------------------------------------------------------------------

async function ensureScanConfig() {
  return prisma.scanConfig.upsert({
    where: { agentName: DESPIDOS_CTO_AGENT_NAME },
    create: { agentName: DESPIDOS_CTO_AGENT_NAME, cadenceDays: DESPIDOS_CTO_CADENCE_DAYS, isActive: true },
    update: { isActive: true, cadenceDays: DESPIDOS_CTO_CADENCE_DAYS },
  });
}

async function isFirstRun(): Promise<boolean> {
  const count = await prisma.searchRun.count({ where: { agentName: DESPIDOS_CTO_AGENT_NAME } });
  return count === 0;
}

// ---------------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------------

interface PersistResult {
  scraped: number;
  inserted: number;
  inScope: number;
  outOfScope: number;
  byReason: Record<string, number>;
}

async function persistDespido(despido: RawDespidoCto): Promise<{ created: boolean; sourceId: string }> {
  const hash = matchHash(despido);
  const existing = await prisma.source.findUnique({ where: { url: despido.sourceUrl } });
  if (existing) {
    return { created: false, sourceId: existing.id };
  }
  // Buscar company por nombre normalizado.
  const allCompanies = await prisma.company.findMany({ select: { id: true, name: true } });
  const cleanedName = despido.companyName.toLowerCase().trim();
  const matched = allCompanies.find((c) => c.name.toLowerCase() === cleanedName) ?? null;

  const src = await prisma.source.create({
    data: {
      url: despido.sourceUrl,
      title: `${despido.cargo} | ${despido.linkedinSlug} | ${despido.companyName} (${hash})`,
      outlet: 'linkedin',
      outletType: 'despido_cto',
      language: 'es',
      companyId: matched?.id ?? null,
      scrapedAt: new Date(),
      publishedAt: new Date(despido.fechaDetectada),
      contentText: `${despido.cargo} ha ${despido.senialDetectada} ${despido.companyName}. LinkedIn: ${despido.linkedinUrl}. Detectado por query: ${despido.queryId}.`,
      deimplantationSignal: true,
      outOfScopeReason: 'pending_b7_filter',
    },
    select: { id: true },
  });
  return { created: true, sourceId: src.id };
}

// ---------------------------------------------------------------------------
// runDespidosCtoAgent
// ---------------------------------------------------------------------------

export interface RunDespidosCtoOptions {
  dryRun?: boolean;
  daysBack?: number;
  onLog?: (msg: string) => void;
}

export interface RunDespidosCtoResult {
  agentName: string;
  mode: 'backfill_90d' | 'incremental_7d' | 'manual';
  despidos: number;
  inScope: number;
  outOfScope: number;
  byReason: Record<string, number>;
  topHits: Array<{ companyName: string; cargo: string; signalStrength: string; sourceId: string }>;
  errors: number;
  durationMs: number;
}

export async function runDespidosCtoAgent(options: RunDespidosCtoOptions = {}): Promise<RunDespidosCtoResult> {
  const start = Date.now();
  const onLog = options.onLog ?? (() => {});

  onLog(`[despidos-cto-runner] start dryRun=${!!options.dryRun}`);

  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_90d' | 'incremental_7d' | 'manual' = options.daysBack
    ? 'manual'
    : firstRun
      ? 'backfill_90d'
      : 'incremental_7d';
  const daysBack = options.daysBack ?? (firstRun ? DESPIDOS_CTO_BACKFILL_DAYS : DESPIDOS_CTO_CADENCE_DAYS);
  onLog(`[despidos-cto-runner] mode=${mode} daysBack=${daysBack}`);

  const searchRun = await prisma.searchRun.create({
    data: { agentName: DESPIDOS_CTO_AGENT_NAME, mode, startedAt: new Date() },
  });

  const result: PersistResult = { scraped: 0, inserted: 0, inScope: 0, outOfScope: 0, byReason: {} };
  const topHits: RunDespidosCtoResult['topHits'] = [];

  try {
    if (options.dryRun) {
      onLog('[despidos-cto-runner] dryRun → skip scrape');
    } else {
      const { despidos, errors } = scrapeDespidosCto({ daysBack, maxItems: 50, onLog });
      result.scraped = despidos.length;
      onLog(`[despidos-cto-runner] scraped=${despidos.length} errors=${errors}`);

      for (const d of despidos) {
        try {
          const { created } = await persistDespido(d);
          if (created) result.inserted++;

          const filterResult = await applyDespidosCtoFilter(prisma, d);
          if (filterResult.inScope) {
            result.inScope++;
            if (filterResult.company) {
              topHits.push({
                companyName: filterResult.company.name,
                cargo: d.cargo,
                signalStrength: filterResult.signalStrength ?? 'unknown',
                sourceId: filterResult.matchedSources[0]?.id ?? '',
              });
            }
          } else {
            result.outOfScope++;
            result.byReason[filterResult.outOfScopeReason] =
              (result.byReason[filterResult.outOfScopeReason] ?? 0) + 1;
          }
        } catch (e) {
          onLog(`[despidos-cto-runner] WARN persist/filter failed: ${(e as Error).message}`);
        }
      }
    }

    await prisma.searchRun.update({
      where: { id: searchRun.id },
      data: {
        finishedAt: new Date(),
        itemsFound: result.scraped,
        itemsInScope: result.inScope,
        itemsOutOfScope: result.outOfScope,
        errorsCount: 0,
        costEur: 0,
      },
    });

    await prisma.scanConfig.update({
      where: { agentName: DESPIDOS_CTO_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  } catch (e) {
    onLog(`[despidos-cto-runner] ERROR: ${(e as Error).message}`);
    await prisma.searchRun.update({
      where: { id: searchRun.id },
      data: {
        finishedAt: new Date(),
        errorsCount: 1,
        itemsFound: result.scraped,
        itemsInScope: result.inScope,
        itemsOutOfScope: result.outOfScope,
        costEur: 0,
      },
    });
  }

  const finalResult: RunDespidosCtoResult = {
    agentName: DESPIDOS_CTO_AGENT_NAME,
    mode,
    despidos: result.scraped,
    inScope: result.inScope,
    outOfScope: result.outOfScope,
    byReason: result.byReason,
    topHits: topHits.slice(0, 10),
    errors: 0,
    durationMs: Date.now() - start,
  };

  onLog(`[despidos-cto-runner] result: ${JSON.stringify(finalResult)}`);
  return finalResult;
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const isMain = process.argv[1]?.endsWith('despidos-cto-runner.ts') ?? false;
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  runDespidosCtoAgent({ dryRun })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('FATAL:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
