// lib/agents/patentes-runner.ts — Sprint C.3
//
// Enriquecer la cartera de patentes de las empresas A&B desde OEPM Invenes.
// (EPO OPS queda como integración futura — código desactivado si no hay credenciales).
//
// Pipeline:
//   1) Carga las Companies A&B (top priority first)
//   2) Para cada Company, llama a `scrapeOepmPatents(company.name)` con UA real
//   3) Aplica `isRelevantPatentHit` para filtrar titular ↔ empresa
//   4) Upsert cada patente por matchHash = sha256(companyId+pubNumber+title)[:32]
//   5) Persiste Source con outletType='patent' para cada patente GRANTED reciente
//   6) Crea SearchRun con métricas
//
// Idempotente: `Patent.matchHash` UNIQUE → 2 corridas mismo día no duplican.

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { scrapeOepmPatents, type OepmScrapeResult } from '@/lib/scrapers/oepm';
import { isRelevantPatentHit } from '@/lib/filters/patentes';

const prisma = new PrismaClient();

export const PATENTES_AGENT_NAME = 'surus-agente-patentes';
export const PATENTES_CADENCE_DAYS = 7;

export interface PatentesAgentResult {
  agentName: string;
  mode: 'backfill_all' | 'incremental_30d';
  companiesEvaluated: number;
  patentsFound: number;
  patentsPersisted: number;
  patentsSkippedNoMatch: number;
  patentsSkippedDuplicate: number;
  sourcesCreated: number;
  errors: number;
  durationMs: number;
  topHits: Array<{
    slug: string;
    name: string;
    patentsGranted: number;
    patentsPending: number;
  }>;
}

async function isFirstRun(): Promise<boolean> {
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: PATENTES_AGENT_NAME } });
  return !cfg?.lastRunAt;
}

async function ensureScanConfig(): Promise<void> {
  await prisma.scanConfig.upsert({
    where: { agentName: PATENTES_AGENT_NAME },
    create: {
      agentName: PATENTES_AGENT_NAME,
      cadenceDays: PATENTES_CADENCE_DAYS,
      isActive: true,
      lastRunAt: null,
    },
    update: { isActive: true, cadenceDays: PATENTES_CADENCE_DAYS },
  });
}

function buildMatchHash(companyId: string, publicationNumber: string, title: string): string {
  const norm = title.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto
    .createHash('sha256')
    .update(`${companyId}|${publicationNumber}|${norm}`)
    .digest('hex')
    .slice(0, 32);
}

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
}

async function persistPatentSource(
  hit: import('@/lib/scrapers/oepm').RawPatentHit,
  company: { id: string; slug: string; name: string },
): Promise<'created' | 'updated' | 'skipped'> {
  const title = `OEPM ${hit.publicationNumber} — ${hit.title}`.slice(0, 500);
  const contentText = [
    `Patente OEPM: ${hit.publicationNumber}`,
    `Título: ${hit.title}`,
    `Titular: ${hit.applicant}`,
    `Inventores: ${hit.inventors || 'n/d'}`,
    `Estado legal: ${hit.legalStatus}`,
    `Fecha solicitud: ${hit.filingDate?.toISOString().slice(0, 10) || 'n/d'}`,
    `Fecha publicación: ${hit.publicationDate?.toISOString().slice(0, 10) || 'n/d'}`,
    `Fecha concesión: ${hit.grantDate?.toISOString().slice(0, 10) || 'n/d'}`,
    `CIP: ${hit.cnae || 'n/d'}`,
    '',
    'Fuente: OEPM Invenes (https://invenes.oepm.es).',
  ].join('\n').slice(0, 50_000);

  // Solo crear Source para GRANTED recientes (≤5 años) — señal "positiva" de I+D
  if (hit.legalStatus !== 'granted') return 'skipped';
  if (!hit.publicationDate) return 'skipped';
  const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;
  if (hit.publicationDate.getTime() < fiveYearsAgo) return 'skipped';

  const existing = await prisma.source.findUnique({ where: { url: hit.sourceUrl } });
  if (existing) {
    await prisma.source.update({
      where: { url: hit.sourceUrl },
      data: { title, contentText, companyId: company.id, scrapedAt: new Date() },
    });
    return 'updated';
  }
  await prisma.source.create({
    data: {
      url: hit.sourceUrl,
      title,
      outlet: 'OEPM Invenes',
      outletType: 'patent',
      publishedAt: hit.publicationDate,
      language: 'es',
      companyId: company.id,
      contentText,
      deimplantationSignal: false,
      outOfScopeReason: 'oepm_patent',
      isStale: false,
    },
  });
  return 'created';
}

export async function runPatentesAgent(opts: { dryRun?: boolean; maxCompanies?: number; fixture?: 'pascual' | 'damm' | 'mahou' | 'empty' } = {}): Promise<PatentesAgentResult> {
  const start = Date.now();
  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_all' | 'incremental_30d' = firstRun ? 'backfill_all' : 'incremental_30d';

  // 1) Cargar Companies A&B
  const baseWhere = { tier: { in: ['A', 'B'] as ('A' | 'B')[] } };
  const where = mode === 'backfill_all' ? baseWhere : baseWhere; // mismo set (backfill_all cubre todo)

  const companies: CompanyRow[] = await prisma.company.findMany({
    where,
    select: { id: true, slug: true, name: true },
    orderBy: [{ tier: 'asc' }, { priority: 'desc' }, { name: 'asc' }],
    take: opts.maxCompanies ?? 50,
  });

  const result: PatentesAgentResult = {
    agentName: PATENTES_AGENT_NAME,
    mode,
    companiesEvaluated: companies.length,
    patentsFound: 0,
    patentsPersisted: 0,
    patentsSkippedNoMatch: 0,
    patentsSkippedDuplicate: 0,
    sourcesCreated: 0,
    errors: 0,
    durationMs: 0,
    topHits: [],
  };

  for (const company of companies) {
    let scrape: OepmScrapeResult;
    try {
      const fixtureMap: Record<string, string> = {
        pascual: 'scripts/fixtures/oepm-pascual.html',
        damm: 'scripts/fixtures/oepm-damm.html',
        mahou: 'scripts/fixtures/oepm-mahou.html',
        empty: 'scripts/fixtures/oepm-empty.html',
      };
      const fixturePath = opts.fixture ? fixtureMap[opts.fixture] : undefined;
      let fixtureHtml: string | undefined;
      if (fixturePath) {
        const fs = await import('fs/promises');
        fixtureHtml = await fs.readFile(fixturePath, 'utf-8');
      }
      scrape = await scrapeOepmPatents(company.name, fixtureHtml ? { fixtureHtml } : {});
    } catch (e) {
      result.errors++;
      console.error(`[patentes-runner] scrape error for ${company.slug}:`, String(e).slice(0, 200));
      continue;
    }

    // 2026-06-05: si OEPM no está disponible (DNS NXDOMAIN), abortar todo el
    // batch — seguir iterando solo acumula errores y ruido en logs.
    if (scrape.error === 'oepm_unavailable') {
      console.error(`[patentes-runner] OEPM no disponible, abortando batch: ${scrape.triedUrls[0]}`);
      result.errors++;
      break;
    }

    if (!scrape.found || scrape.hits.length === 0) {
      continue;
    }
    result.patentsFound += scrape.hits.length;

    // Aplicar filtro de relevancia
    const relevant = scrape.hits.filter((h) => isRelevantPatentHit(h, company.name));
    const skipped = scrape.hits.length - relevant.length;
    result.patentsSkippedNoMatch += skipped;

    let grantedCount = 0;
    let pendingCount = 0;

    for (const hit of relevant) {
      if (hit.legalStatus === 'granted') grantedCount++;
      else if (hit.legalStatus === 'pending') pendingCount++;

      const matchHash = buildMatchHash(company.id, hit.publicationNumber, hit.title);
      try {
        if (opts.dryRun) {
          result.patentsPersisted++;
          continue;
        }
        // Upsert por matchHash
        const existing = await prisma.patent.findUnique({ where: { matchHash } });
        if (existing) {
          result.patentsSkippedDuplicate++;
          // Update status (puede haber cambiado: pending → granted)
          if (existing.legalStatus !== hit.legalStatus) {
            await prisma.patent.update({
              where: { id: existing.id },
              data: {
                legalStatus: hit.legalStatus,
                grantDate: hit.grantDate,
                updatedAt: new Date(),
              },
            });
          }
        } else {
          await prisma.patent.create({
            data: {
              companyId: company.id,
              matchHash,
              publicationNumber: hit.publicationNumber,
              title: hit.title.slice(0, 1000),
              applicant: hit.applicant.slice(0, 500) || null,
              inventors: hit.inventors,
              filingDate: hit.filingDate,
              publicationDate: hit.publicationDate,
              grantDate: hit.grantDate,
              legalStatus: hit.legalStatus,
              cnae: hit.cnae,
              source: 'OEPM Invenes',
              sourceUrl: hit.sourceUrl,
              language: 'es',
            },
          });
          result.patentsPersisted++;
        }

        // Persist Source solo para GRANTED recientes
        const srcAction = await persistPatentSource(hit, company);
        if (srcAction === 'created') result.sourcesCreated++;
      } catch (e) {
        result.errors++;
        console.error(`[patentes-runner] persist error for ${company.slug}/${hit.publicationNumber}:`, String(e).slice(0, 200));
      }
    }

    if (result.topHits.length < 10 && (grantedCount + pendingCount) > 0) {
      result.topHits.push({
        slug: company.slug,
        name: company.name,
        patentsGranted: grantedCount,
        patentsPending: pendingCount,
      });
    }
  }

  // SearchRun
  if (!opts.dryRun) {
    await prisma.searchRun.create({
      data: {
        agentName: PATENTES_AGENT_NAME,
        mode,
        itemsFound: result.patentsFound,
        itemsNew: result.patentsPersisted,
        itemsInScope: result.patentsPersisted,
        itemsOutOfScope: result.patentsSkippedNoMatch,
        errorsCount: result.errors,
        startedAt: new Date(start),
        finishedAt: new Date(),
      },
    });
    await prisma.scanConfig.update({
      where: { agentName: PATENTES_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  }

  result.durationMs = Date.now() - start;
  return result;
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('patentes-runner.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  const fixtureArg = process.argv.find((a) => a.startsWith('--fixture='))?.split('=')[1] as
    | 'pascual'
    | 'damm'
    | 'mahou'
    | 'empty'
    | undefined;
  const maxArg = process.argv.find((a) => a.startsWith('--max='))?.split('=')[1];
  const maxCompanies = maxArg ? parseInt(maxArg, 10) : undefined;
  runPatentesAgent({ dryRun, fixture: fixtureArg, maxCompanies })
    .then((r) => {
      console.log('[patentes-runner] result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[patentes-runner] error:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
