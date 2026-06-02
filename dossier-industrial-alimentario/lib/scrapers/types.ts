// lib/scrapers/types.ts
// Common types for the newsroom + sectorial scrapers.
// Pure types + tiny constants. No runtime state, no side effects.

export type Sector = 'Alimentacion' | 'Bebidas';

export type Language = 'es';

export type OutletType = 'corporate_newsroom' | 'sector' | 'nacional' | 'regional' | 'local';

export interface ScrapedArticle {
  url: string;
  title: string;
  publishedAt: Date | null;
  content: string;
  contentHash: string;
  outlet: string;
  outletType: OutletType;
  language: Language;
  region?: string;
  province?: string;
  raw: {
    rss?: boolean;
    playwright?: boolean;
    fetchMs: number;
  };
}

export interface NewsroomListEntry {
  name: string;
  slug: string;
  sector: Sector;
  subsector: string;
  cnae: string;
  region: string;
  newsroomUrl: string | null;
  rssUrl: string | null;
}

export interface SectorialListEntry {
  name: string;
  slug: string;
  baseUrl: string;
  newsroomUrl: string;
  rssUrl: string | null;
  subsectors: string[];
  notes: string;
}

export interface PrensaListEntry {
  slug: string;
  name: string;
  outlet: string;
  url: string;
  rss: string | null;
  region: string;
  ccaa: string;
  kind: 'nacional' | 'regional' | 'local';
}

export interface ScrapeOptions {
  maxArticles?: number;
  usePlaywright?: boolean;
}

// Default limits — keep in sync with the spec.
export const DEFAULT_MAX_ARTICLES = 20;
export const HTTP_TIMEOUT_MS = 15_000;
export const PLAYWRIGHT_TIMEOUT_MS = 20_000;
export const PLAYWRIGHT_WAIT_MS = 1_000;
export const MIN_USEFUL_CHARS = 200;
export const MIN_ARTICLE_LINKS = 5;
export const HTTP_RETRIES = 1;
export const RETRY_BACKOFF_MS = 2_000;

export const USER_AGENT =
  'Mozilla/5.0 (compatible; HERMES-DossierBot/1.0; +https://88-198-93-52.nip.io/dossier)';

export const NOISE_HREF_PATTERNS: readonly RegExp[] = [
  /\/tag\//i,
  /\/author\//i,
  /\/page\//i,
  /\/search/i,
  /\/category\//i,
  /^#$/,
  /^javascript:/i,
  /^mailto:/i,
  /\/wp-login/i,
  /\/wp-admin/i,
  /\/feed\/?$/i,
  /\/cart\/?$/i,
  /\/checkout\/?$/i,
  /\/login\/?$/i,
  /\/politica-de-privacidad/i,
  /\/politica-de-cookies/i,
  /\/aviso-legal/i,
  /\/terminos/i,
  /\/contacto\/?$/i,
];
