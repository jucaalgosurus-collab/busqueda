// lib/ingest/adapters/prensa-sectorial.ts — Adapter para prensa sectorial
// Sprint G.1 — INV-2 (prensa sectorial española: Alimarket, IPA, etc.)
import type { Adapter, AdapterConfig, AdapterResult, RawArticle } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SECTORIAL_OUTLETS = [
  { slug: 'alimarket', name: 'Alimarket' },
  { slug: 'distribucionactualidad', name: 'Distribución Actualidad' },
  { slug: 'revistainforetail', name: 'Revista InfoRetail' },
  { slug: 'foodretail', name: 'Food Retail' },
  { slug: 'thefoodtech', name: 'The Food Tech' },
];

export const prensaSectorialAdapter: Adapter = {
  name: 'prensa-sectorial',
  type: 'prensa_sectorial',

  async run(config: AdapterConfig): Promise<AdapterResult> {
    const startedAt = Date.now();
    const articles: RawArticle[] = [];
    const onlySlugs = new Set(config.onlySlugs ?? []);
    const outlets = SECTORIAL_OUTLETS.filter((o) => onlySlugs.size === 0 || onlySlugs.has(o.slug));

    let scanned = 0;
    let errors = 0;

    for (const outlet of outlets) {
      try {
        const { stdout } = await execAsync(
          `npx tsx dossier-industrial-alimentario/scripts/scan-sectorial.ts --slug=${outlet.slug} --daysBack=${config.daysBack} --maxPerSource=${config.maxPerSource}`,
          { cwd: process.cwd(), timeout: 60_000 }
        );
        const parsed = JSON.parse(stdout) as { articles: RawArticle[]; scanned: number };
        scanned += parsed.scanned;
        articles.push(...parsed.articles);
      } catch (err) {
        errors += 1;
      }
    }

    const inScope = articles.filter((a) => a.matchedSector).length;

    return {
      adapterName: 'prensa-sectorial',
      scanned,
      found: articles.length,
      inScope,
      errors,
      durationMs: Date.now() - startedAt,
      articles,
    };
  },
};
