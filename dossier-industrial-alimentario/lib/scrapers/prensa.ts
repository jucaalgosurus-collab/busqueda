// lib/scrapers/prensa.ts — Adaptador prensa general / regional / local
// Reutiliza el newsroom scraper (HTTP+cheerio+Playwright+RSS) y le inyecta
// metadata de CCAA/provincia detectada automáticamente.
import { detectCcaa } from '../filters/ccaa';
import { __internal as newsroomInternal, scrapeNewsroom } from './newsroom';
import type { ScrapedArticle, PrensaListEntry } from './types';

export type { PrensaListEntry };

/** Convierte PrensaListEntry al shape que espera el newsroom scraper */
function toNewsroomEntry(entry: PrensaListEntry) {
  return {
    slug: entry.slug,
    name: entry.name,
    newsroomUrl: entry.url,
    rssUrl: entry.rss,
  };
}

/** Scrapea un medio de prensa con detección de CCAA aplicada a cada artículo */
export async function scrapePrensa(
  entry: PrensaListEntry,
  opts: { maxArticles?: number; usePlaywright?: boolean } = {},
): Promise<ScrapedArticle[]> {
  const articles = await scrapeNewsroom(toNewsroomEntry(entry), opts);
  return articles.map((a) => {
    const ccaa = detectCcaa({
      outlet: entry.outlet,
      url: a.url,
      title: a.title,
      content: a.content,
    });
    return {
      ...a,
      outletType: entry.kind,
      region: ccaa.region,
      province: ccaa.province ?? undefined,
    } as ScrapedArticle & { ccaa?: string };
  });
}

export const __internal = {
  ...newsroomInternal,
  detectCcaa,
};
