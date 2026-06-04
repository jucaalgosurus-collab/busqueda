// lib/agents/renuncias-runner.ts — Sprint B.3
//
// Agente que detecta renuncias masivas de consejeros (≥3 ceses en 90d)
// en empresas A&B. Reutiliza Source rows de BORME scrapeados por B.1.
// Señal amarilla media — el consejo se vacía, governance en transición.
//
// Schema v6: Source.companyId FK directo. NO tabla ArticleCompany.
// Source.outletType es String union (no enum).
// Source NO tiene columna signalStrength (sólo deimplantationSignal/outOfScopeReason/isStale).
// ScanConfig usa isActive (NO enabled).
// SearchRun usa itemsFound/itemsInScope/itemsOutOfScope/errorsCount (NO scanned/inScope/durationMs).
//
// Reutiliza:
//   - lib/filters/renuncias-consejeros.ts (extractCeses, isConsejeroCargo, detectMasiveRenuncias)

import { PrismaClient } from '@prisma/client';
import {
  extractCeses,
  isConsejeroCargo,
  detectMasiveRenuncias,
  findCompanyInBormeText,
  matchHash,
  type CesEntry,
  type RenunciasMatch,
} from '@/lib/filters/renuncias-consejeros';

const prisma = new PrismaClient();

export interface RenunciasAgentResult {
  agentName: string;
  mode: 'backfill_90d' | 'incremental_1d';
  companiesScanned: number;
  matches: number;
  inScope: number;
  outOfScope: number;
  topMatches: Array<{
    companyId: string;
    companyName: string;
    cesesCount: number;
    cesesSummary: string;
  }>;
  errors: number;
  errorsList: string[];
  durationMs: number;
}

export const RENUNCIAS_AGENT_NAME = 'surus-agente-renuncias';
export const RENUNCIAS_CADENCE_DAYS = 1;
const DAYS_BACK = 90;
const MIN_CESES = 3;

async function ensureScanConfig(): Promise<void> {
  await prisma.scanConfig.upsert({
    where: { agentName: RENUNCIAS_AGENT_NAME },
    create: {
      agentName: RENUNCIAS_AGENT_NAME,
      cadenceDays: RENUNCIAS_CADENCE_DAYS,
      isActive: true,
      lastRunAt: null,
    },
    update: { isActive: true, cadenceDays: RENUNCIAS_CADENCE_DAYS },
  });
}

async function isFirstRun(): Promise<boolean> {
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: RENUNCIAS_AGENT_NAME } });
  return !cfg?.lastRunAt;
}

async function persistMatch(match: RenunciasMatch): Promise<{ upserted: boolean }> {
  const summary = match.ceses
    .slice(0, 10)
    .map((c) => `${c.name} (${c.cargo})`)
    .join('; ');
  const title = `[B.3] Renuncia masiva consejeros — ${match.companyName} (${match.count} ceses en ${DAYS_BACK}d)`;
  const contentText = `Renuncias detectadas en ventana ${match.periodStart.toISOString().slice(0, 10)} - ${match.periodEnd.toISOString().slice(0, 10)} (${match.count} consejeros distintos dimitidos):

${summary}${match.ceses.length > 10 ? `\n... y ${match.ceses.length - 10} más` : ''}

Patrón: ≥${MIN_CESES} cargos de consejo dimitidos en ${DAYS_BACK} días. Señal amarilla media — posible transición (venta, cierre, concurso silencioso).`;
  const url = `internal://b3/${match.companyId}/${match.periodStart.toISOString().slice(0, 10)}`;

  await prisma.source.upsert({
    where: { url },
    create: {
      url,
      title: title.slice(0, 500),
      outlet: 'BORME (B.3 análisis)',
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

export async function runRenunciasAgent(opts: { dryRun?: boolean } = {}): Promise<RenunciasAgentResult> {
  const start = Date.now();
  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_90d' | 'incremental_1d' = firstRun ? 'backfill_90d' : 'incremental_1d';

  // Cargar todos los Source BORME con "Ceses/Dimisiones" en los últimos 90d
  // B.1 (borme-runner) NO asigna Source.companyId; B.3 resuelve empresa in-memory
  // desde el contentText (encabezado BORME: "ID - NOMBRE EMPRESA SOCIEDAD LIMITADA.")
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - DAYS_BACK);
  const bormeSources = await prisma.source.findMany({
    where: {
      outletType: 'bofficial_borme',
      publishedAt: { gte: periodStart },
      contentText: { contains: 'Ceses/Dimisiones' },
    },
    select: { id: true, contentText: true, publishedAt: true, companyId: true },
    orderBy: { publishedAt: 'desc' },
  });

  // Agrupar ceses por empresa (resuelta in-memory)
  const cesesByCompany = new Map<
    string,
    { companyName: string; ceses: Map<string, CesEntry> }
  >();
  const companyNameCache = new Map<string, string>();
  for (const src of bormeSources) {
    if (!src.contentText || !src.publishedAt) continue;
    const extracted = extractCeses(src.contentText);
    if (extracted.length === 0) continue;
    // Resolver empresa: si B.1 asignó companyId, usarlo; si no, inferir por nombre
    let companyId = src.companyId;
    let companyName: string | null = null;
    if (companyId && companyNameCache.has(companyId)) {
      companyName = companyNameCache.get(companyId)!;
    } else if (companyId) {
      const c = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      if (c) {
        companyNameCache.set(companyId, c.name);
        companyName = c.name;
      }
    } else {
      const resolved = await findCompanyInBormeText(src.contentText);
      if (resolved) {
        companyId = resolved.id;
        companyName = resolved.name;
        companyNameCache.set(companyId, resolved.name);
      }
    }
    if (!companyId || !companyName) continue;
    if (!cesesByCompany.has(companyId)) {
      cesesByCompany.set(companyId, { companyName, ceses: new Map() });
    }
    const bucket = cesesByCompany.get(companyId)!;
    for (const e of extracted) {
      const key = e.name.toUpperCase().replace(/\s+/g, ' ').trim();
      if (!bucket.ceses.has(key)) {
        bucket.ceses.set(key, {
          name: e.name,
          cargo: e.cargo,
          sourceId: src.id,
          publishedAt: src.publishedAt,
        });
      }
    }
  }

  const topMatches: RenunciasAgentResult['topMatches'] = [];
  let matches = 0;
  let inScope = 0;
  let outOfScope = 0;
  const errorsList: string[] = [];
  const itemsFound = cesesByCompany.size;

  for (const [companyId, bucket] of cesesByCompany) {
    if (bucket.ceses.size < MIN_CESES) {
      outOfScope++;
      continue;
    }
    const periodEnd = new Date();
    const match: RenunciasMatch = {
      companyId,
      companyName: bucket.companyName,
      ceses: Array.from(bucket.ceses.values()),
      count: bucket.ceses.size,
      periodStart,
      periodEnd,
    };
    try {
      matches++;
      inScope++;
      if (!opts.dryRun) {
        await persistMatch(match);
      }
      if (topMatches.length < 10) {
        topMatches.push({
          companyId: match.companyId,
          companyName: match.companyName,
          cesesCount: match.count,
          cesesSummary: match.ceses
            .slice(0, 5)
            .map((x) => x.name)
            .join(', '),
        });
      }
    } catch (e) {
      errorsList.push(`${companyId} (${bucket.companyName}): ${(e as Error).message}`);
    }
  }

  if (!opts.dryRun) {
    await prisma.searchRun.create({
      data: {
        agentName: RENUNCIAS_AGENT_NAME,
        mode,
        itemsFound: itemsFound,
        itemsNew: matches,
        itemsInScope: inScope,
        itemsOutOfScope: outOfScope,
        errorsCount: errorsList.length,
        startedAt: new Date(start),
        finishedAt: new Date(),
      },
    });
    await prisma.scanConfig.update({
      where: { agentName: RENUNCIAS_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  }

  return {
    agentName: RENUNCIAS_AGENT_NAME,
    mode,
    companiesScanned: itemsFound,
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
if (process.argv[1] && process.argv[1].endsWith('renuncias-runner.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  runRenunciasAgent({ dryRun })
    .then((r) => {
      console.log('[renuncias-runner] result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[renuncias-runner] error:', e);
      process.exit(1);
    });
}
