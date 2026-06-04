// lib/agents/ejecuciones-runner.ts — Sprint B.4
//
// Agente que detecta tensión financiera pre-concursal en empresas A&B.
// Señal amarilla fuerte: (1+ ejecución hipotecaria + 1+ embargo) o (≥2 embargos) en 90d.
// Filtro duro anti-concursos: si el BORME/BOE contiene "concurso de acreedores",
// "liquidación concursal", "quita y espera" → outOfScopeReason='concurso', no match.
//
// Reutiliza Source rows de BORME (B.1) y BOE/BOP scrapeados.
//
// Schema v6: Source.companyId FK directo. NO tabla ArticleCompany.
// Source.outletType es String union (no enum).
// Source NO tiene columna signalStrength (sólo deimplantationSignal/outOfScopeReason/isStale).
// ScanConfig usa isActive (NO enabled).
// SearchRun usa itemsFound/itemsInScope/itemsOutOfScope/errorsCount.

import { PrismaClient } from '@prisma/client';
import {
  detectTensionForAll,
  matchHash,
  type TensionMatch,
} from '@/lib/filters/ejecuciones-singulares';

const prisma = new PrismaClient();

export interface EjecucionesAgentResult {
  agentName: string;
  mode: 'backfill_90d' | 'incremental_1d';
  companiesScanned: number;
  matches: number;
  inScope: number;
  outOfScope: number;
  topMatches: Array<{
    companyId: string;
    companyName: string;
    ejecuciones: number;
    embargos: number;
    reason: string;
  }>;
  errors: number;
  errorsList: string[];
  durationMs: number;
}

export const EJECUCIONES_AGENT_NAME = 'surus-agente-ejecuciones';
export const EJECUCIONES_CADENCE_DAYS = 1;
const DAYS_BACK = 90;

async function ensureScanConfig(): Promise<void> {
  await prisma.scanConfig.upsert({
    where: { agentName: EJECUCIONES_AGENT_NAME },
    create: {
      agentName: EJECUCIONES_AGENT_NAME,
      cadenceDays: EJECUCIONES_CADENCE_DAYS,
      isActive: true,
      lastRunAt: null,
    },
    update: { isActive: true, cadenceDays: EJECUCIONES_CADENCE_DAYS },
  });
}

async function isFirstRun(): Promise<boolean> {
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: EJECUCIONES_AGENT_NAME } });
  return !cfg?.lastRunAt;
}

async function persistMatch(match: TensionMatch): Promise<{ upserted: boolean }> {
  const title = `[B.4] Tensión financiera pre-concursal — ${match.companyName} (${match.countEjecuciones} ejec + ${match.countEmbargos} emb en ${DAYS_BACK}d)`;
  const ejecList = match.ejecuciones
    .slice(0, 8)
    .map((e) => `- ${e.raw}${e.expediente ? ` (Exp. ${e.expediente})` : ''}`)
    .join('\n');
  const embList = match.embargos
    .slice(0, 8)
    .map((e) => `- ${e.raw}${e.expediente ? ` (Exp. ${e.expediente})` : ''}`)
    .join('\n');
  const subList = match.subastas
    .slice(0, 5)
    .map((e) => `- ${e.raw}`)
    .join('\n');
  const demList = match.demandas
    .slice(0, 5)
    .map((e) => `- ${e.raw}`)
    .join('\n');

  const contentText = `Tensión financiera pre-concursal detectada en ventana ${match.periodStart.toISOString().slice(0, 10)} - ${match.periodEnd.toISOString().slice(0, 10)}.

Umbral activado: ${match.reason}.

${match.countEjecuciones > 0 ? `EJECUCIONES HIPOTECARIAS (${match.countEjecuciones}):\n${ejecList}\n` : ''}${match.countEmbargos > 0 ? `EMBARGOS (${match.countEmbargos}):\n${embList}\n` : ''}${match.subastas.length > 0 ? `SUBASTAS JUDICIALES (${match.subastas.length}):\n${subList}\n` : ''}${match.demandas.length > 0 ? `DEMANDAS CIVILES (${match.demandas.length}):\n${demList}\n` : ''}

Patrón: ${match.countEjecuciones} ejecuciones hipotecarias + ${match.countEmbargos} embargos en ${DAYS_BACK} días, sin declaración concursal. Señal amarilla fuerte — la empresa sanea pero no ha cruzado el Rubicón concursal. Margen para desimplantación ordenada.`;

  const url = matchHash(match);
  await prisma.source.upsert({
    where: { url },
    create: {
      url,
      title: title.slice(0, 500),
      outlet: 'BORME/BOE (B.4 análisis)',
      outletType: 'bofficial_borme',
      publishedAt: match.periodEnd,
      language: 'es',
      companyId: match.companyId,
      contentText: contentText.slice(0, 50_000),
      deimplantationSignal: true,
      outOfScopeReason: null,
      isStale: false,
    },
    update: {
      title: title.slice(0, 500),
      contentText: contentText.slice(0, 50_000),
      deimplantationSignal: true,
      isStale: false,
      scrapedAt: new Date(),
    },
  });
  return { upserted: true };
}

export async function runEjecucionesAgent(opts: { dryRun?: boolean } = {}): Promise<EjecucionesAgentResult> {
  const start = Date.now();
  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_90d' | 'incremental_1d' = firstRun ? 'backfill_90d' : 'incremental_1d';

  const group = await detectTensionForAll({ daysBack: DAYS_BACK });

  const topMatches: EjecucionesAgentResult['topMatches'] = [];
  let matches = 0;
  let inScope = 0;
  let outOfScope = 0;
  const errorsList: string[] = [];

  for (const m of group.matches) {
    matches++;
    inScope++;
    try {
      if (!opts.dryRun) {
        await persistMatch(m);
      }
      if (topMatches.length < 10) {
        topMatches.push({
          companyId: m.companyId,
          companyName: m.companyName,
          ejecuciones: m.countEjecuciones,
          embargos: m.countEmbargos,
          reason: m.reason,
        });
      }
    } catch (e) {
      errorsList.push(`${m.companyId} (${m.companyName}): ${(e as Error).message}`);
    }
  }

  if (!opts.dryRun) {
    await prisma.searchRun.create({
      data: {
        agentName: EJECUCIONES_AGENT_NAME,
        mode,
        itemsFound: group.sourcesScanned,
        itemsNew: matches,
        itemsInScope: inScope,
        itemsOutOfScope: outOfScope,
        errorsCount: errorsList.length,
        startedAt: new Date(start),
        finishedAt: new Date(),
      },
    });
    await prisma.scanConfig.update({
      where: { agentName: EJECUCIONES_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  }

  return {
    agentName: EJECUCIONES_AGENT_NAME,
    mode,
    companiesScanned: group.sourcesScanned,
    matches,
    inScope,
    outOfScope,
    topMatches,
    errors: errorsList.length,
    errorsList,
    durationMs: Date.now() - start,
  };
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('ejecuciones-runner.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  runEjecucionesAgent({ dryRun })
    .then((r) => {
      console.log('[ejecuciones-runner] result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[ejecuciones-runner] error:', e);
      process.exit(1);
    });
}
