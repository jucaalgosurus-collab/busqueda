// lib/agents/runner.ts — Orquestador de agentes Sprint 2
// Carga lista de newsrooms o sectoriales, scrapea, filtra, persiste.
// Idempotente (UNIQUE(url) en Source). Registra SearchRun.
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import newsroomList from '@/lib/data/newsroom-list.json' with { type: 'json' };
import sectorialList from '@/lib/data/sectorial-list.json' with { type: 'json' };
import { scrapeNewsroom } from '@/lib/scrapers/newsroom.js';
import { scrapeSectorial as _scrapeSectorial } from '@/lib/scrapers/sectorial.js';
import { isDeimplantation } from '@/lib/filters/deimplantation.js';
import type { NewsroomListEntry, SectorialListEntry, ScrapedArticle } from '@/lib/scrapers/types.js';

const prisma = new PrismaClient();

interface AgentResult {
  agentName: string;
  scanned: number;          // entradas scrapeadas
  found: number;            // artículos encontrados
  inScope: number;          // in_scope persistidos
  outOfScope: number;       // rechazados por filtro
  new: number;              // nuevos en DB
  updated: number;          // re-upserts
  errors: number;
  durationMs: number;
}

async function persistArticle(article: ScrapedArticle, defaultCompanySlug?: string) {
  const filter = isDeimplantation(`${article.title}\n${article.content}`);
  const inScope = filter.inScope;
  const outReason = inScope ? null : (filter.outOfScopeReason ?? 'not_deimplantation');

  // upsert Source (idempotente vía UNIQUE(url))
  const source = await prisma.source.upsert({
    where: { url: article.url },
    create: {
      url: article.url,
      title: article.title.slice(0, 500),
      outlet: article.outlet,
      outletType: article.outletType,
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

export async function runNewsroomsAgent(opts: { maxPerSource?: number; onlySlugs?: string[] } = {}): Promise<AgentResult> {
  const startedAt = new Date();
  const maxPer = opts.maxPerSource ?? 12;
  const onlySlugs = new Set(opts.onlySlugs ?? []);

  const entries = (newsroomList as NewsroomListEntry[]).filter(
    (e) => e.newsroomUrl && (onlySlugs.size === 0 || onlySlugs.has(e.slug))
  );

  const run = await prisma.searchRun.create({
    data: { agentName: 'newsrooms-corporativas', startedAt, query: { maxPer, onlySlugs: [...onlySlugs] } },
  });

  let found = 0, inScope = 0, outOfScope = 0, upserted = 0, errors = 0;
  const companyCache = new Map<string, string>(); // slug -> id

  // Pre-carga companies que matchean los slugs
  const slugs = entries.map((e) => e.slug);
  const existing = await prisma.company.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  for (const c of existing) companyCache.set(c.slug, c.id);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let articles: ScrapedArticle[] = [];
    try {
      articles = await scrapeNewsroom(entry, { maxArticles: maxPer, usePlaywright: true });
    } catch (e) {
      errors++;
      console.warn(`[newsrooms] ${entry.slug} scraper threw: ${(e as Error).message}`);
    }
    found += articles.length;

    for (const art of articles) {
      try {
        const { source, inScope: ok, outReason } = await persistArticle(art, entry.slug);
        if (ok) inScope++; else outOfScope++;
        // ArticleCompany link si tenemos company
        const companyId = companyCache.get(entry.slug);
        if (companyId) {
          await prisma.articleCompany.upsert({
            where: { articleId_companyId: { articleId: source.id, companyId } },
            create: { articleId: source.id, companyId, sentiment: 0, relevance: 0.5 },
            update: {},
          });
        }
        upserted++;
      } catch (e) {
        errors++;
        console.warn(`[newsrooms] persist ${art.url} failed: ${(e as Error).message}`);
      }
    }
    if (i % 10 === 0) console.log(`[newsrooms] progress: ${i + 1}/${entries.length} sources, inScope=${inScope}, errors=${errors}`);
  }

  const finishedAt = new Date();
  await prisma.searchRun.update({
    where: { id: run.id },
    data: { finishedAt, itemsFound: found, itemsInScope: inScope, itemsOutOfScope: outOfScope, itemsNew: upserted, itemsUpdated: 0, errorsCount: errors, costEur: 0 },
  });
  // Activar el ScanConfig de este agente
  await prisma.scanConfig.upsert({
    where: { agentName: 'newsrooms-corporativas' },
    create: { agentName: 'newsrooms-corporativas', keywords: [], sources: [], cadenceDays: 2, isActive: true, lastRunAt: finishedAt, nextRunAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
    update: { isActive: true, lastRunAt: finishedAt, nextRunAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
  });

  return { agentName: 'newsrooms-corporativas', scanned: entries.length, found, inScope, outOfScope, new: upserted, updated: 0, errors, durationMs: finishedAt.getTime() - startedAt.getTime() };
}

export async function runSectorialAgent(opts: { maxPerSource?: number; onlySlugs?: string[] } = {}): Promise<AgentResult> {
  const startedAt = new Date();
  const maxPer = opts.maxPerSource ?? 20;
  const onlySlugs = new Set(opts.onlySlugs ?? []);

  const entries = (sectorialList as SectorialListEntry[]).filter(
    (e) => (onlySlugs.size === 0 || onlySlugs.has(e.slug))
  );

  const run = await prisma.searchRun.create({
    data: { agentName: 'prensa-sectorial', startedAt, query: { maxPer, onlySlugs: [...onlySlugs] } },
  });

  let found = 0, inScope = 0, outOfScope = 0, upserted = 0, errors = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let articles: ScrapedArticle[] = [];
    try {
      articles = await _scrapeSectorial(entry, { maxArticles: maxPer, usePlaywright: true });
    } catch (e) {
      errors++;
      console.warn(`[sectorial] ${entry.slug} scraper threw: ${(e as Error).message}`);
    }
    found += articles.length;

    for (const art of articles) {
      try {
        const { inScope: ok } = await persistArticle(art);
        if (ok) inScope++; else outOfScope++;
        upserted++;
      } catch (e) {
        errors++;
        console.warn(`[sectorial] persist ${art.url} failed: ${(e as Error).message}`);
      }
    }
    if (i % 5 === 0) console.log(`[sectorial] progress: ${i + 1}/${entries.length} sources, inScope=${inScope}, errors=${errors}`);
  }

  const finishedAt = new Date();
  await prisma.searchRun.update({
    where: { id: run.id },
    data: { finishedAt, itemsFound: found, itemsInScope: inScope, itemsOutOfScope: outOfScope, itemsNew: upserted, itemsUpdated: 0, errorsCount: errors, costEur: 0 },
  });
  await prisma.scanConfig.upsert({
    where: { agentName: 'prensa-sectorial' },
    create: { agentName: 'prensa-sectorial', keywords: [], sources: [], cadenceDays: 2, isActive: true, lastRunAt: finishedAt, nextRunAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
    update: { isActive: true, lastRunAt: finishedAt, nextRunAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
  });

  return { agentName: 'prensa-sectorial', scanned: entries.length, found, inScope, outOfScope, new: upserted, updated: 0, errors, durationMs: finishedAt.getTime() - startedAt.getTime() };
}

// CLI entry
if (process.argv[1]?.endsWith('runner.ts') || process.argv[1]?.endsWith('runner.js')) {
  const which = process.argv[2] ?? 'both';
  (async () => {
    try {
      if (which === 'newsrooms' || which === 'both') {
        const r = await runNewsroomsAgent();
        console.log('\n=== NEWSROOMS ==='); console.log(JSON.stringify(r, null, 2));
      }
      if (which === 'sectorial' || which === 'both') {
        const r = await runSectorialAgent();
        console.log('\n=== SECTORIAL ==='); console.log(JSON.stringify(r, null, 2));
      }
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
