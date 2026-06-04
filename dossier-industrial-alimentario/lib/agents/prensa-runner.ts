// lib/agents/prensa-runner.ts — Agente 2+3: prensa general + regional/local
// Carga lib/data/prensa-list.json, scrapea cada medio, filtra por desimplantación,
// persiste Source con region/province detectados, crea SearchRun, actualiza ScanConfig.
import { PrismaClient } from '@prisma/client';
import prensaList from '@/lib/data/prensa-list.json' with { type: 'json' };
import { scrapePrensa } from '@/lib/scrapers/prensa';
import { isDeimplantation } from '@/lib/filters/deimplantation';
import type { PrensaListEntry, ScrapedArticle } from '@/lib/scrapers/types';

const prisma = new PrismaClient();

export interface PrensaAgentResult {
  agentName: string;
  scanned: number;
  found: number;
  inScope: number;
  outOfScope: number;
  new: number;
  updated: number;
  errors: number;
  durationMs: number;
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
      contentText: article.content.slice(0, 50000),
      contentHash: article.contentHash,
      deimplantationSignal: inScope,
      outOfScopeReason: outReason,
      isStale: false,
    },
    update: {
      title: article.title.slice(0, 500),
      contentText: article.content.slice(0, 50000),
      contentHash: article.contentHash,
      deimplantationSignal: inScope,
      outOfScopeReason: outReason,
      isStale: false,
      scrapedAt: new Date(),
    },
  });

  return { source, inScope, outReason };
}

export async function runPrensaAgent(opts: {
  maxPerSource?: number;
  onlySlugs?: string[];
  /**
   * QW-8: filtro de fecha incremental. Default 2 (últimos 2 días, alineado con
   * cadenceDays=2 del ScanConfig). Pasar 15 explícitamente para backfill inicial.
   * Items sin publishedAt se incluyen siempre.
   */
  daysBack?: number;
} = {}): Promise<PrensaAgentResult> {
  const startedAt = new Date();
  const maxPer = opts.maxPerSource ?? 12;
  const daysBack = opts.daysBack ?? 2;
  const onlySlugs = new Set(opts.onlySlugs ?? []);

  const entries = (prensaList as PrensaListEntry[]).filter(
    (e) => (onlySlugs.size === 0 || onlySlugs.has(e.slug))
  );

  const run = await prisma.searchRun.create({
    data: {
      agentName: 'prensa-general-regional',
      startedAt,
      mode: daysBack > 2 ? 'backfill_15d' : 'incremental_2d',
      query: { maxPer, daysBack, onlySlugs: [...onlySlugs], total: entries.length },
    },
  });

  let found = 0, inScope = 0, outOfScope = 0, upserted = 0, errors = 0;
  const byCcaa: Record<string, number> = {};

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let articles: ScrapedArticle[] = [];
    try {
      articles = await scrapePrensa(entry, { maxArticles: maxPer, usePlaywright: true, daysBack });
    } catch (e) {
      errors++;
      console.warn(`[prensa] ${entry.slug} scraper threw: ${(e as Error).message}`);
    }
    found += articles.length;

    for (const art of articles) {
      try {
        const { inScope: ok } = await persistArticle(art);
        if (ok) inScope++; else outOfScope++;
        byCcaa[art.region ?? 'Nacional'] = (byCcaa[art.region ?? 'Nacional'] ?? 0) + 1;
        upserted++;
      } catch (e) {
        errors++;
        console.warn(`[prensa] persist ${art.url} failed: ${(e as Error).message}`);
      }
    }
    if (i % 5 === 0 || i === entries.length - 1) {
      console.log(`[prensa] progress: ${i + 1}/${entries.length} sources, inScope=${inScope}, errors=${errors}`);
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
    where: { agentName: 'prensa-general-regional' },
    create: {
      agentName: 'prensa-general-regional',
      queryConfig: { keywords: [], sources: entries.map((e) => e.slug) } as object,
      cadenceDays: 2,
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
    agentName: 'prensa-general-regional',
    scanned: entries.length,
    found,
    inScope,
    outOfScope,
    new: upserted,
    updated: 0,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    byCcaa,
  };
}

// CLI entry
if (process.argv[1]?.endsWith('prensa-runner.ts') || process.argv[1]?.endsWith('prensa-runner.js')) {
  (async () => {
    try {
      const r = await runPrensaAgent();
      console.log('\n=== PRENSA ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
