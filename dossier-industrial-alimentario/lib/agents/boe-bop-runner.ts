// lib/agents/boe-bop-runner.ts — Agente 5: BOE/BOP/sindicatos
// Filtra concursos explícitamente (BORME) y detecta EREs y cierres de planta.
import { PrismaClient } from '@prisma/client';
import boeBopList from '@/lib/data/boe-bop-list.json' with { type: 'json' };
import { scrapeBoeBop, type BoeBopEntry } from '@/lib/scrapers/boe-bop.js';
import { isDeimplantation } from '@/lib/filters/deimplantation.js';
import type { ScrapedArticle } from '@/lib/scrapers/types.js';

const prisma = new PrismaClient();

export interface BoeBopAgentResult {
  agentName: string;
  scanned: number;
  found: number;
  inScope: number;
  outOfScope: number;
  eres: number;
  cierres: number;
  concursos: number;
  new: number;
  errors: number;
  durationMs: number;
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
      outletType: 'bofficial',
      publishedAt: article.publishedAt,
      language: 'es',
      country: 'ES',
      content: article.content.slice(0, 50000),
      contentHash: article.contentHash,
      deimplantationSignal: inScope,
      outOfScopeReason: outReason,
      isStale: false,
    },
    update: {
      title: article.title.slice(0, 500),
      content: article.content.slice(0, 50000),
      contentHash: article.contentHash,
      deimplantationSignal: inScope,
      outOfScopeReason: outReason,
      isStale: false,
      scrapedAt: new Date(),
    },
  });
  return { source, inScope, outReason, signals: filter.signals };
}

export async function runBoeBopAgent(opts: {
  maxPerSource?: number;
  onlySlugs?: string[];
} = {}): Promise<BoeBopAgentResult> {
  const startedAt = new Date();
  const maxPer = opts.maxPerSource ?? 15;
  const onlySlugs = new Set(opts.onlySlugs ?? []);

  const entries = (boeBopList as BoeBopEntry[]).filter(
    (e) => (onlySlugs.size === 0 || onlySlugs.has(e.slug))
  );

  const run = await prisma.searchRun.create({
    data: { agentName: 'boe-bop-sindicatos', startedAt, query: { maxPer, onlySlugs: [...onlySlugs] } },
  });

  let found = 0, inScope = 0, outOfScope = 0, eres = 0, cierres = 0, concursos = 0, upserted = 0, errors = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let articles: ScrapedArticle[] = [];
    try {
      articles = await scrapeBoeBop(entry, { maxArticles: maxPer, usePlaywright: true });
    } catch (e) {
      errors++;
      console.warn(`[boe-bop] ${entry.slug} scraper threw: ${(e as Error).message}`);
    }
    found += articles.length;

    for (const art of articles) {
      try {
        const { inScope: ok, outReason, signals } = await persistArticle(art);
        if (ok) inScope++; else outOfScope++;
        if (outReason === 'concurso') concursos++;
        if (signals?.some((s) => /ere|despido|regulacion/i.test(s.label))) eres++;
        if (signals?.some((s) => /cierre|liquidacion|desmantela/i.test(s.label))) cierres++;
        upserted++;
      } catch (e) {
        errors++;
        console.warn(`[boe-bop] persist ${art.url} failed: ${(e as Error).message}`);
      }
    }
    if (i % 3 === 0) console.log(`[boe-bop] progress: ${i + 1}/${entries.length} sources, inScope=${inScope}, errors=${errors}`);
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
    where: { agentName: 'boe-bop-sindicatos' },
    create: { agentName: 'boe-bop-sindicatos', keywords: [], sources: entries.map((e) => e.slug), cadenceDays: 2, isActive: true, lastRunAt: finishedAt, nextRunAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
    update: { isActive: true, lastRunAt: finishedAt, nextRunAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
  });

  return {
    agentName: 'boe-bop-sindicatos',
    scanned: entries.length,
    found,
    inScope,
    outOfScope,
    eres,
    cierres,
    concursos,
    new: upserted,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

// CLI entry
if (process.argv[1]?.endsWith('boe-bop-runner.ts') || process.argv[1]?.endsWith('boe-bop-runner.js')) {
  (async () => {
    try {
      const r = await runBoeBopAgent();
      console.log('\n=== BOE-BOP ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
