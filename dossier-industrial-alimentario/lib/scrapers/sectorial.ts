// lib/scrapers/sectorial.ts
// Sector press scraper for Alimarket, Revista Aral, IPMARK, etc.
//
// Same cascade as the newsroom scraper (RSS → HTTP+cheerio → Playwright) but
// every emitted article is tagged `outletType: 'sector'` so downstream
// consumers can distinguish corporate press from trade press.
//
// Internals are reused from `./newsroom.js` via the `__internal` export to
// keep the cascade in one place. This file is intentionally a thin
// orchestrator that maps a `SectorialListEntry` to the shared `SharedEntry`
// shape and picks the right outlet type.

import { __internal } from './newsroom.js';
import {
  DEFAULT_MAX_ARTICLES,
  type ScrapedArticle,
  type ScrapeOptions,
  type SectorialListEntry,
} from './types.js';

/**
 * Scrape a sector press outlet (Alimarket, Aral, etc.).
 *
 * Same strategy as `scrapeNewsroom`: RSS-first, then HTTP+cheerio, then
 * Playwright fallback when cheerio content is < 200 chars OR fewer than 5
 * article links were found on the home page. Returns up to `maxArticles`
 * (default 20). Never throws — a failing source returns an empty array.
 */
export async function scrapeSectorial(
  entry: SectorialListEntry,
  opts?: ScrapeOptions,
): Promise<ScrapedArticle[]> {
  const maxArticles = opts?.maxArticles ?? DEFAULT_MAX_ARTICLES;
  const usePlaywright = opts?.usePlaywright ?? true;
  const fetchMsStart = Date.now();
  const http = __internal.makeHttp();
  const shared = __internal.toSharedEntry({
    slug: entry.slug,
    name: entry.name,
    newsroomUrl: entry.newsroomUrl,
    rssUrl: entry.rssUrl,
  });

  if (entry.rssUrl) {
    const rssArticles = await __internal.scrapeViaRss(
      shared,
      maxArticles,
      fetchMsStart,
      'sector',
    );
    if (rssArticles.length > 0) return rssArticles;
  }

  return __internal.scrapeViaHttp(
    shared,
    http,
    maxArticles,
    fetchMsStart,
    usePlaywright,
    'sector',
  );
}

// SMOKE:
//   import { scrapeSectorial } from '@/lib/scrapers/sectorial';
//   import sectorialList from '@/lib/data/sectorial-list.json';
//   const articles = await scrapeSectorial(sectorialList[0]);
//   console.log(articles.length, articles[0]?.title);
