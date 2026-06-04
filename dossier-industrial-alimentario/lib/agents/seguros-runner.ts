// lib/agents/seguros-runner.ts — Sprint B.5
//
// Detecta cambios de assessment sectorial publicados por las 4 aseguradoras
// de crédito que operan en España (CESCE, CyC/Atradius, Coface, Allianz Trade).
// Una bajada de rating de un sector (ej "Metals in Spain") en el que operan
// empresas A&B de nuestra base es SEÑAL AMARILLA fuerte de tensión financiera
// pre-concursal a escala sectorial.
//
// Schema v6:
//   - Source.companyId FK directo (NO ArticleCompany).
//   - Source.outletType String union → 'credito_aseguradora' (Sprint B.5).
//   - Source NO tiene columna signalStrength (solo deimplantationSignal/outOfScopeReason/isStale).
//   - ScanConfig usa isActive (NO enabled).
//   - SearchRun usa itemsFound/itemsInScope/itemsOutOfScope/errorsCount.
//
// Idempotencia: matchHash = b5-{aseguradoraSlug}-{YYYY-Q}-{sector}-{dirección}.
//   Garantiza 1 row por (aseguradora, trimestre, sector, dirección).
//
// Reutiliza:
//   - lib/scrapers/seguros-credito.ts: scrapeAllAseguradoras (4 aseguradoras)
//   - lib/filters/seguros.ts:applySegurosFilter (cruce CNAE → A&B)

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { scrapeAllAseguradoras, type AseguradoraEntry, type RawSeguroChange } from '@/lib/scrapers/seguros-credito';
import { applySegurosFilter } from '@/lib/filters/seguros';

const prisma = new PrismaClient();

export interface SegurosAgentResult {
  agentName: string;
  mode: 'backfill_30d' | 'incremental_7d';
  aseguradoras: number;
  changes: number;
  inScope: number;
  outOfScope: number;
  byReason: Record<string, number>;
  topChanges: Array<{
    aseguradora: string;
    sector: string | null;
    direction: string;
    matchedCompanies: string[];
    cnaeMatched: string[];
    outOfScopeReason: string | null;
  }>;
  errors: number;
  durationMs: number;
}

export const SEGUROS_AGENT_NAME = 'surus-agente-seguros';
export const SEGUROS_CADENCE_DAYS = 7;

function quarterOf(d: Date): string {
  const m = d.getUTCMonth() + 1;
  const q = Math.ceil(m / 3);
  return `${d.getUTCFullYear()}-Q${q}`;
}

function matchHash(change: RawSeguroChange, aseguradoraSlug: string, sector: string | null): string {
  const q = quarterOf(new Date(change.date));
  const safeSector = (sector ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `b5-${aseguradoraSlug}-${q}-${safeSector}-${change.direction}`;
}

function loadAseguradorasList(): AseguradoraEntry[] {
  const p = path.join(process.cwd(), 'lib', 'data', 'seguros-list.json');
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as AseguradoraEntry[];
}

async function ensureScanConfig(): Promise<void> {
  await prisma.scanConfig.upsert({
    where: { agentName: SEGUROS_AGENT_NAME },
    create: {
      agentName: SEGUROS_AGENT_NAME,
      cadenceDays: SEGUROS_CADENCE_DAYS,
      isActive: true,
      lastRunAt: null,
    },
    update: { isActive: true, cadenceDays: SEGUROS_CADENCE_DAYS },
  });
}

async function isFirstRun(): Promise<boolean> {
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: SEGUROS_AGENT_NAME } });
  return !cfg?.lastRunAt;
}

async function persistChange(
  change: RawSeguroChange,
  aseguradoraSlug: string,
): Promise<{ inScope: boolean; outReason: string | null; matchedCompanySlugs: string[]; cnaeMatched: string[] }> {
  const filter = await applySegurosFilter(prisma, change);

  // Si hay A&B matched, persistir un row por cada match con companyId FK.
  // Si NO hay match, persistir 1 row aggregate (companyId=null) con outOfScopeReason.
  // Idempotencia: matchHash por (aseguradora, quarter, sector, dirección).
  const baseTitle = `[${aseguradoraSlug.toUpperCase()}] ${change.direction.toUpperCase()} — ${change.sector ?? 'sector n/d'}`;
  const contentText = `Cambio de assessment sectorial detectado en barómetro de ${aseguradoraSlug}.

Dirección: ${change.direction}
Sector: ${change.sector ?? 'n/d'}
País: ${change.country ?? 'ES'}
Fecha: ${change.date}
URL fuente: ${change.sourceUrl}

${change.content.slice(0, 1500)}

${filter.inScope
  ? `A&B matching CNAE (${filter.matchedCompanies.length}):
${filter.matchedCompanies.map((c) => `  - ${c.name} (CNAE ${c.cnae ?? 'n/d'})`).join('\n')}

Patrón: downgrade sectorial de ${change.sector} en España — ${filter.matchedCompanies.length} empresa(s) A&B potencialmente afectadas. Señal amarilla fuerte a escala sectorial.`
  : filter.outOfScopeReason === 'positive_signal'
    ? 'Señal positiva (upgrade) — no es señal de desimplantación, se persiste como histórico.'
    : 'Sin empresas A&B con CNAE compatible en este sector. Persistido como histórico para cobertura.'}`;

  const url = matchHash(change, aseguradoraSlug, change.sector);

  // Aggregate row (companyId=null) — siempre persistir para mantener histórico del barómetro.
  await prisma.source.upsert({
    where: { url },
    create: {
      url,
      title: baseTitle.slice(0, 500),
      outlet: `${aseguradoraSlug} (barómetro sectorial)`,
      outletType: 'credito_aseguradora',
      publishedAt: new Date(change.date),
      language: change.aseguradora === 'cesce' || change.aseguradora === 'cyc' ? 'es' : 'es',
      companyId: null,
      contentText: contentText.slice(0, 50_000),
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
    },
    update: {
      title: baseTitle.slice(0, 500),
      contentText: contentText.slice(0, 50_000),
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
      scrapedAt: new Date(),
    },
  });

  // Si inScope, persistir 1 row adicional por cada A&B con companyId FK.
  // Estos rows permiten mostrar la señal en /empresas/[slug] y en /hallazgos con FK directa.
  if (filter.inScope) {
    for (const c of filter.matchedCompanies) {
      const cUrl = `b5-detail-${aseguradoraSlug}-${c.id}-${quarterOf(new Date(change.date))}-${(change.sector ?? 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      await prisma.source.upsert({
        where: { url: cUrl },
        create: {
          url: cUrl,
          title: `[${aseguradoraSlug.toUpperCase()}] Downgrade sectorial afecta a ${c.name} (${change.sector})`,
          outlet: `${aseguradoraSlug} (matching A&B)`,
          outletType: 'credito_aseguradora',
          publishedAt: new Date(change.date),
          language: 'es',
          companyId: c.id,
          contentText: `Downgrade sectorial publicado por ${aseguradoraSlug} en ${change.date} afecta al sector ${change.sector} en España. Empresa A&B con CNAE ${c.cnae ?? 'n/d'} potencialmente impactada.\n\n${change.content.slice(0, 2000)}`.slice(0, 50_000),
          deimplantationSignal: true,
          outOfScopeReason: null,
          isStale: false,
        },
        update: {
          title: `[${aseguradoraSlug.toUpperCase()}] Downgrade sectorial afecta a ${c.name} (${change.sector})`.slice(0, 500),
          contentText: `Downgrade sectorial publicado por ${aseguradoraSlug} en ${change.date} afecta al sector ${change.sector} en España. Empresa A&B con CNAE ${c.cnae ?? 'n/d'} potencialmente impactada.\n\n${change.content.slice(0, 2000)}`.slice(0, 50_000),
          deimplantationSignal: true,
          isStale: false,
          scrapedAt: new Date(),
        },
      });
    }
  }

  return {
    inScope: filter.inScope,
    outReason: filter.outOfScopeReason,
    matchedCompanySlugs: filter.matchedCompanies.map((c) => c.slug),
    cnaeMatched: filter.cnaeMatched,
  };
}

export async function runSegurosAgent(opts: { dryRun?: boolean; daysBack?: number } = {}): Promise<SegurosAgentResult> {
  const start = Date.now();
  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_30d' | 'incremental_7d' = firstRun ? 'backfill_30d' : 'incremental_7d';
  const daysBack = opts.daysBack ?? (firstRun ? 30 : SEGUROS_CADENCE_DAYS);

  const entries = loadAseguradorasList();
  if (entries.length === 0) {
    return {
      agentName: SEGUROS_AGENT_NAME,
      mode,
      aseguradoras: 0,
      changes: 0,
      inScope: 0,
      outOfScope: 0,
      byReason: {},
      topChanges: [],
      errors: 1,
      durationMs: Date.now() - start,
    };
  }

  const scrapeResult = await scrapeAllAseguradoras(entries, { daysBack, maxItems: 20 });

  const byReason: Record<string, number> = {};
  let inScope = 0;
  let outOfScope = 0;
  const topChanges: SegurosAgentResult['topChanges'] = [];

  for (const change of scrapeResult.changes) {
    try {
      const r = await persistChange(change, change.aseguradora);
      if (r.inScope) {
        inScope++;
        if (topChanges.length < 10) {
          topChanges.push({
            aseguradora: change.aseguradora,
            sector: change.sector,
            direction: change.direction,
            matchedCompanies: r.matchedCompanySlugs,
            cnaeMatched: r.cnaeMatched,
            outOfScopeReason: null,
          });
        }
      } else {
        outOfScope++;
        const key = r.outReason ?? 'unknown';
        byReason[key] = (byReason[key] ?? 0) + 1;
      }
    } catch (e) {
      const key = 'persist_error';
      byReason[key] = (byReason[key] ?? 0) + 1;
      outOfScope++;
    }
  }

  if (!opts.dryRun) {
    const totalErrors = Object.values(scrapeResult.perAseguradora).filter((p) => p.error).length;
    await prisma.searchRun.create({
      data: {
        agentName: SEGUROS_AGENT_NAME,
        mode,
        itemsFound: scrapeResult.changes.length,
        itemsNew: inScope,
        itemsInScope: inScope,
        itemsOutOfScope: outOfScope,
        errorsCount: totalErrors,
        startedAt: new Date(start),
        finishedAt: new Date(),
      },
    });
    await prisma.scanConfig.update({
      where: { agentName: SEGUROS_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  }

  return {
    agentName: SEGUROS_AGENT_NAME,
    mode,
    aseguradoras: entries.length,
    changes: scrapeResult.changes.length,
    inScope,
    outOfScope,
    byReason,
    topChanges,
    errors: Object.values(scrapeResult.perAseguradora).filter((p) => p.error).length,
    durationMs: Date.now() - start,
  };
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('seguros-runner.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  runSegurosAgent({ dryRun })
    .then((r) => {
      console.log('[seguros-runner] result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[seguros-runner] error:', e);
      process.exit(1);
    });
}
