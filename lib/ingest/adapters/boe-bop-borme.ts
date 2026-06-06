// lib/ingest/adapters/boe-bop-borme.ts — Adapter para BOE/BOP/BORME oficial
// Sprint G.1 — INV-4 (boletines oficiales)
import type { Adapter, AdapterConfig, AdapterResult, RawArticle } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const boeBopBormeAdapter: Adapter = {
  name: 'boe-bop-borme',
  type: 'bofficial',

  async run(config: AdapterConfig): Promise<AdapterResult> {
    const startedAt = Date.now();
    const articles: RawArticle[] = [];
    const onlySlugs = new Set(config.onlySlugs ?? []);
    const onlyArg = onlySlugs.size > 0 ? `--onlySlugs=${[...onlySlugs].join(',')}` : '';

    let scanned = 0;
    let errors = 0;

    try {
      const { stdout } = await execAsync(
        `npx tsx dossier-industrial-alimentario/scripts/scan-boe-bop.ts --daysBack=${config.daysBack} --maxPerSource=${config.maxPerSource} ${onlyArg}`,
        { cwd: process.cwd(), timeout: 120_000 }
      );
      const parsed = JSON.parse(stdout) as { articles: RawArticle[]; scanned: number };
      scanned = parsed.scanned;
      articles.push(...parsed.articles);
    } catch (err) {
      errors = 1;
    }

    const inScope = articles.filter((a) => a.matchedSector).length;

    return {
      adapterName: 'boe-bop-borme',
      scanned,
      found: articles.length,
      inScope,
      errors,
      durationMs: Date.now() - startedAt,
      articles,
    };
  },
};
