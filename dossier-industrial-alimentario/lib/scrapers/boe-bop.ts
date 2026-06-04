// lib/scrapers/boe-bop.ts — Scraper para BOE, BOPs autonómicos, sindicatos.
// Reutiliza el newsroom scraper (HTTP+cheerio+RSS). El filtro negativo de
// concursos se aplica en el runner (específico de este agente).
import { __internal as newsroomInternal, scrapeNewsroom } from './newsroom';
import type { ScrapedArticle } from './types';

export interface BoeBopEntry {
  slug: string;
  name: string;
  outlet: string;
  url: string;
  rss: string | null;
  kind: 'bofficial' | 'syndicate';
}

/** Scrapea un BOE/BOP/sindicato. Devuelve artículos sin tocar el filtro deimplantation. */
export async function scrapeBoeBop(
  entry: BoeBopEntry,
  opts: { maxArticles?: number; usePlaywright?: boolean; stealth?: boolean; rate?: number; userAgent?: string; proxy?: string | null; limiterKey?: string } = {},
): Promise<ScrapedArticle[]> {
  const articles = await scrapeNewsroom(
    { slug: entry.slug, name: entry.name, newsroomUrl: entry.url, rssUrl: entry.rss },
    opts,
  );
  return articles.map((a) => ({ ...a, outletType: 'bofficial' as const }));
}

export const __internal = {
  ...newsroomInternal,
};
