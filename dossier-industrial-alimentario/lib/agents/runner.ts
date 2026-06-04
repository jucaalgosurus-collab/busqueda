// lib/agents/runner.ts — Orquestador de agentes Sprint 2
// Carga lista de newsrooms o sectoriales, scrapea, filtra, persiste.
// Idempotente (UNIQUE(url) en Source). Registra SearchRun.
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import newsroomList from '@/lib/data/newsroom-list.json' with { type: 'json' };
import sectorialList from '@/lib/data/sectorial-list.json' with { type: 'json' };
import { scrapeNewsroom } from '@/lib/scrapers/newsroom';
import { scrapeSectorial as _scrapeSectorial } from '@/lib/scrapers/sectorial';
import { isDeimplantation } from '@/lib/filters/deimplantation';
import { extractNameCandidates, processAgentMention } from '@/lib/scrapers/company-matcher';
import type { NewsroomListEntry, SectorialListEntry, ScrapedArticle } from '@/lib/scrapers/types';

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

  return { source, inScope, outReason, signals: filter.signals };
}

/**
 * E.14.1 — Auto-amplía la lista de Company desde el contenido del artículo.
 * Si el `defaultCompanySlug` ya cubre la noticia, el matcher se salta (no
 * duplica). Si NO, intenta matchear candidatos extraídos contra Company
 * existente (link) o crea uno nuevo como tier='B' (auto-amplify).
 */
async function amplifyCompaniesFromArticle(
  article: ScrapedArticle,
  defaultCompanySlug: string | undefined,
  agentName: string,
): Promise<{ newCompanyId: string | null; amplified: boolean }> {
  try {
    const text = `${article.title}\n${article.content}`;
    const candidates = extractNameCandidates(text);
    if (candidates.length === 0) return { newCompanyId: null, amplified: false };

    let firstNew: string | null = null;
    let amplified = false;
    // Cap por artículo para evitar storms (regex puede dar muchos falsos positivos)
    for (const cand of candidates.slice(0, 3)) {
      const norm = cand.toLowerCase().trim();
      // Si el candidato ES el defaultCompanySlug, saltar
      if (defaultCompanySlug && norm === defaultCompanySlug.toLowerCase()) continue;
      const r = await processAgentMention(prisma, cand, agentName);
      if (r.action === 'created') {
        amplified = true;
        if (!firstNew) firstNew = r.companyId;
        console.log(`[${agentName}] auto-amplify: "${cand}" → ${r.suggestedSlug}`);
      } else if (r.action === 'linked') {
        // Si el Source no tiene companyId, vincular al primer match
        if (!firstNew) firstNew = r.companyId;
      }
    }
    return { newCompanyId: firstNew, amplified };
  } catch (e) {
    console.warn(`[${agentName}] amplify failed: ${(e as Error).message}`);
    return { newCompanyId: null, amplified: false };
  }
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
      articles = await scrapeNewsroom(entry, { maxArticles: maxPer, usePlaywright: true, daysBack: 2 });
    } catch (e) {
      errors++;
      console.warn(`[newsrooms] ${entry.slug} scraper threw: ${(e as Error).message}`);
    }
    found += articles.length;

    for (const art of articles) {
      try {
        const { source, inScope: ok, outReason } = await persistArticle(art, entry.slug);
        if (ok) inScope++; else outOfScope++;
        // v6: Source tiene companyId directo (FK), sin tabla ArticleCompany
        const companyId = companyCache.get(entry.slug);
        if (companyId) {
          await prisma.source.update({
            where: { id: source.id },
            data: { companyId },
          });
        }
        // E.14.1 — auto-amplify desde el contenido (en newsrooms es no-op porque
        // la empresa ya está en cache, pero dejamos la llamada por uniformidad)
        await amplifyCompaniesFromArticle(art, entry.slug, 'newsrooms-corporativas');
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
    create: { agentName: 'newsrooms-corporativas', queryConfig: { keywords: [], sources: [] } as object, cadenceDays: 2, isActive: true, lastRunAt: finishedAt },
    update: { isActive: true, lastRunAt: finishedAt },
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
      articles = await _scrapeSectorial(entry, { maxArticles: maxPer, usePlaywright: true, daysBack: 2 });
    } catch (e) {
      errors++;
      console.warn(`[sectorial] ${entry.slug} scraper threw: ${(e as Error).message}`);
    }
    found += articles.length;

    for (const art of articles) {
      try {
        const { source, inScope: ok } = await persistArticle(art);
        if (ok) inScope++; else outOfScope++;
        // E.14.1 — sectorial: este es el caso real de auto-amplify.
        // Si la noticia menciona una empresa no conocida, la creamos como tier='B'.
        const { newCompanyId } = await amplifyCompaniesFromArticle(art, undefined, 'prensa-sectorial');
        if (newCompanyId) {
          // Si el Source no tiene companyId, vincular al primer match/create
          const cur = await prisma.source.findUnique({ where: { id: source.id }, select: { companyId: true } });
          if (!cur?.companyId) {
            await prisma.source.update({ where: { id: source.id }, data: { companyId: newCompanyId } });
          }
        }
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
    create: { agentName: 'prensa-sectorial', queryConfig: { keywords: [], sources: [] } as object, cadenceDays: 2, isActive: true, lastRunAt: finishedAt },
    update: { isActive: true, lastRunAt: finishedAt },
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
