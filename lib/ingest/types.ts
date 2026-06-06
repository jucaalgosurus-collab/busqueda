// lib/ingest/types.ts — Tipos compartidos para adapters de ingest
// Sprint G.1 — Scrapling sidecar + 6 adapters

import type { SectorCodigo } from '../curation/cnae-catalog';

export interface RawArticle {
  url: string;
  title: string;
  outlet: string;
  outletType: 'prensa_local' | 'prensa_sectorial' | 'prensa_economica' | 'bofficial' | 'osint_corp' | 'subastas_verify';
  publishedAt: Date;
  content: string;
  contentHash: string;
  language: 'es' | 'en';
  matchedCnae?: string;
  matchedSector?: SectorCodigo;
  matchedCompanyName?: string;
}

export interface AdapterConfig {
  daysBack: number;
  maxPerSource: number;
  sectorFilter?: SectorCodigo;
  onlySlugs?: string[];
}

export interface AdapterResult {
  adapterName: string;
  scanned: number;
  found: number;
  inScope: number;
  errors: number;
  durationMs: number;
  articles: RawArticle[];
}

export interface Adapter {
  readonly name: string;
  readonly type: RawArticle['outletType'];
  run(config: AdapterConfig): Promise<AdapterResult>;
}
