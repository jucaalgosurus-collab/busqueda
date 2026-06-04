// lib/agents/prensa-local-runner.ts — Sprint E.5
//
// Réplica de prensa-runner.ts enfocada a medios locales/provinciales.
// Carga lib/data/prensa-local-list.json, scrapea cada medio, filtra por
// desimplantación, persiste Source con outletType='local' + region/province.
//
// A diferencia del general (lista de 30+ medios nacionales+regionales), este
// agente cubre 10 cabeceras locales con RSS público y conocida cobertura de
// desimplantaciones industriales (cierre planta, ERE, deslocalización).
//
// Idempotente: Source.url UNIQUE. daysBack=2 incremental, 15 backfill.

import { PrismaClient } from '@prisma/client';
import prensaLocalList from '@/lib/data/prensa-local-list.json' with { type: 'json' };
import { scrapePrensa } from '@/lib/scrapers/prensa';
import { isDeimplantation } from '@/lib/filters/deimplantation';
import type { PrensaListEntry, ScrapedArticle } from '@/lib/scrapers/types';

const prisma = new PrismaClient();

export const PRENSA_LOCAL_AGENT_NAME = 'surus-agente-prensa-local';
export const PRENSA_LOCAL_CADENCE_DAYS = 3;

export interface PrensaLocalAgentResult {
  agentName: string;
  scanned: number;
  found: number;
  inScope: number;
  outOfScope: number;
  new: number;
  updated: number;
  errors: number;
  durationMs: number;
  byProvincia: Record<string, number>;
  byCcaa: Record<string, number>;
}

async function persistArticle(article: ScrapedArticle) {
  const filter = isDeimplantation(`${article.title}\n${article.content}`);
  const inScope = filter.inScope;
  const outReason = inScope ? null : (filter.outOfScopeReason ?? 'not_deimplantation');

  const source = await prisma.source.upsert({
    where: { url: article.url },
    create: {
      url: article.url,
      title: article.title.slice(0, 500),
      outlet: article.outlet,
      outletType: article.outletType,
      publishedAt: article.publishedAt,
      language: 'es',
      contentText: article.content.slice(0, 50_000),
      contentHash: article.contentHash,
      deimplantationSignal: inScope,
      outOfScopeReason: outReason,
      isStale: false,
    },
    update: {
      title: article.title.slice(0, 500),
      contentText: article.content.slice(0, 50_000),
      contentHash: article.contentHash,
      deimplantationSignal: inScope,
      outOfScopeReason: outReason,
      isStale: false,
      scrapedAt: new Date(),
    },
  });

  return { source, inScope, outReason };
}

export async function runPrensaLocalAgent(opts: {
  maxPerSource?: number;
  onlySlugs?: string[];
  /** Default 3 (cadencia). 15 para backfill inicial. */
  daysBack?: number;
} = {}): Promise<PrensaLocalAgentResult> {
  const startedAt = new Date();
  const maxPer = opts.maxPerSource ?? 8;
  const daysBack = opts.daysBack ?? 3;
  const onlySlugs = new Set(opts.onlySlugs ?? []);

  const entries = (prensaLocalList as PrensaListEntry[]).filter(
    (e) => (onlySlugs.size === 0 || onlySlugs.has(e.slug))
  );

  const run = await prisma.searchRun.create({
    data: {
      agentName: PRENSA_LOCAL_AGENT_NAME,
      startedAt,
      mode: daysBack > 3 ? 'backfill_15d' : 'incremental_3d',
      query: { maxPer, daysBack, onlySlugs: [...onlySlugs], total: entries.length },
    },
  });

  let found = 0, inScope = 0, outOfScope = 0, upserted = 0, errors = 0;
  const byProvincia: Record<string, number> = {};
  const byCcaa: Record<string, number> = {};

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let articles: ScrapedArticle[] = [];
    try {
      articles = await scrapePrensa(entry, { maxArticles: maxPer, usePlaywright: false, daysBack });
    } catch (e) {
      errors++;
      console.warn(`[prensa-local] ${entry.slug} scraper threw: ${(e as Error).message}`);
    }
    found += articles.length;

    for (const art of articles) {
      try {
        const { inScope: ok } = await persistArticle(art);
        if (ok) inScope++; else outOfScope++;
        const prov = art.province ?? entry.provincia ?? entry.region ?? 'desconocida';
        const ccaa = art.region ?? entry.ccaa ?? 'desconocida';
        byProvincia[prov] = (byProvincia[prov] ?? 0) + 1;
        byCcaa[ccaa] = (byCcaa[ccaa] ?? 0) + 1;
        upserted++;
      } catch (e) {
        errors++;
        console.warn(`[prensa-local] persist ${art.url} failed: ${(e as Error).message}`);
      }
    }
    if (i % 3 === 0 || i === entries.length - 1) {
      console.log(`[prensa-local] progress: ${i + 1}/${entries.length} sources, inScope=${inScope}, errors=${errors}`);
    }
  }

  const finishedAt = new Date();
  await prisma.searchRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      itemsFound: found,
      itemsInScope: inScope,
      itemsOutOfScope: outOfScope,
      itemsNew: upserted,
      itemsUpdated: 0,
      errorsCount: errors,
      costEur: 0,
    },
  });
  await prisma.scanConfig.upsert({
    where: { agentName: PRENSA_LOCAL_AGENT_NAME },
    create: {
      agentName: PRENSA_LOCAL_AGENT_NAME,
      queryConfig: { keywords: [], sources: entries.map((e) => e.slug) } as object,
      cadenceDays: PRENSA_LOCAL_CADENCE_DAYS,
      isActive: true,
      lastRunAt: finishedAt,
    },
    update: {
      isActive: true,
      lastRunAt: finishedAt,
      queryConfig: { keywords: [], sources: entries.map((e) => e.slug) } as object,
    },
  });

  return {
    agentName: PRENSA_LOCAL_AGENT_NAME,
    scanned: entries.length,
    found,
    inScope,
    outOfScope,
    new: upserted,
    updated: 0,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    byProvincia,
    byCcaa,
  };
}

// CLI entry
if (process.argv[1]?.endsWith('prensa-local-runner.ts') || process.argv[1]?.endsWith('prensa-local-runner.js')) {
  (async () => {
    try {
      const r = await runPrensaLocalAgent();
      console.log('\n=== PRENSA LOCAL ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
