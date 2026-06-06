// lib/ingest/adapters/prensa-local.ts — Adapter para medios locales/comarcales
// Sprint G.1 — INV-3 (prensa comarcal/provincial)
import type { Adapter, AdapterConfig, AdapterResult, RawArticle } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const LOCAL_OUTLETS = [
  { slug: 'lavanguardia', name: 'La Vanguardia', region: 'Cataluña' },
  { slug: 'elcorreogallego', name: 'El Correo Gallego', region: 'Galicia' },
  { slug: 'diariodemallorca', name: 'Diario de Mallorca', region: 'Baleares' },
  { slug: 'lavozdegalicia', name: 'La Voz de Galicia', region: 'Galicia' },
  { slug: 'elnortedecastilla', name: 'El Norte de Castilla', region: 'Castilla y León' },
  { slug: 'lavozdeasturias', name: 'La Voz de Asturias', region: 'Asturias' },
  { slug: 'diariodenavarra', name: 'Diario de Navarra', region: 'Navarra' },
  { slug: 'eldiariomontanes', name: 'El Diario Montañés', region: 'Cantabria' },
  { slug: 'eldiariovasco', name: 'El Diario Vasco', region: 'País Vasco' },
  { slug: 'ideal', name: 'Ideal', region: 'Andalucía' },
  { slug: 'laverdad', name: 'La Verdad', region: 'Murcia' },
  { slug: 'lasprovincias', name: 'Las Provincias', region: 'Valencia' },
];

export const prensaLocalAdapter: Adapter = {
  name: 'prensa-local',
  type: 'prensa_local',

  async run(config: AdapterConfig): Promise<AdapterResult> {
    const startedAt = Date.now();
    const articles: RawArticle[] = [];
    const onlySlugs = new Set(config.onlySlugs ?? []);
    const outlets = LOCAL_OUTLETS.filter((o) => onlySlugs.size === 0 || onlySlugs.has(o.slug));

    let scanned = 0;
    let errors = 0;

    for (const outlet of outlets) {
      try {
        // Llama al scraper prensa-local-runner.ts via CLI
        const { stdout } = await execAsync(
          `npx tsx dossier-industrial-alimentario/scripts/scan-prensa-local.ts --slug=${outlet.slug} --daysBack=${config.daysBack} --maxPerSource=${config.maxPerSource}`,
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
      adapterName: 'prensa-local',
      scanned,
      found: articles.length,
      inScope,
      errors,
      durationMs: Date.now() - startedAt,
      articles,
    };
  },
};
