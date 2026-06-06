// lib/ingest/adapters/osint-corp.ts — Adapter para LinkedIn + redes sociales
// Sprint G.1 — INV-8 (redes sociales, alerta temprana)
import type { Adapter, AdapterConfig, AdapterResult, RawArticle } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const osintCorpAdapter: Adapter = {
  name: 'osint-corp',
  type: 'osint_corp',

  async run(config: AdapterConfig): Promise<AdapterResult> {
    const startedAt = Date.now();
    const articles: RawArticle[] = [];
    let scanned = 0;
    let errors = 0;

    try {
      const { stdout } = await execAsync(
        `npx tsx dossier-industrial-alimentario/scripts/scan-linkedin.ts --daysBack=${config.daysBack} --maxPerSource=${config.maxPerSource}`,
        { cwd: process.cwd(), timeout: 180_000 }
      );
      const parsed = JSON.parse(stdout) as { articles: RawArticle[]; scanned: number };
      scanned = parsed.scanned;
      articles.push(...parsed.articles);
    } catch (err) {
      errors = 1;
    }

    const inScope = articles.filter((a) => a.matchedSector).length;

    return {
      adapterName: 'osint-corp',
      scanned,
      found: articles.length,
      inScope,
      errors,
      durationMs: Date.now() - startedAt,
      articles,
    };
  },
};
