// lib/ingest/adapters/prensa-economica.ts — Adapter para prensa económica nacional
// Sprint G.1 — El País Negocios, Cinco Días, Expansión, El Economista
import type { Adapter, AdapterConfig, AdapterResult, RawArticle } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ECONOMICA_OUTLETS = [
  { slug: 'elpais-negocios', name: 'El País Negocios' },
  { slug: 'cincodias', name: 'Cinco Días' },
  { slug: 'expansion', name: 'Expansión' },
  { slug: 'eleconomista', name: 'El Economista' },
];

export const prensaEconomicaAdapter: Adapter = {
  name: 'prensa-economica',
  type: 'prensa_economica',

  async run(config: AdapterConfig): Promise<AdapterResult> {
    const startedAt = Date.now();
    const articles: RawArticle[] = [];
    const onlySlugs = new Set(config.onlySlugs ?? []);
    const outlets = ECONOMICA_OUTLETS.filter((o) => onlySlugs.size === 0 || onlySlugs.has(o.slug));

    let scanned = 0;
    let errors = 0;

    for (const outlet of outlets) {
      try {
        const { stdout } = await execAsync(
          `npx tsx dossier-industrial-alimentario/scripts/scan-prensa.ts --slug=${outlet.slug} --daysBack=${config.daysBack} --maxPerSource=${config.maxPerSource}`,
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
      adapterName: 'prensa-economica',
      scanned,
      found: articles.length,
      inScope,
      errors,
      durationMs: Date.now() - startedAt,
      articles,
    };
  },
};
