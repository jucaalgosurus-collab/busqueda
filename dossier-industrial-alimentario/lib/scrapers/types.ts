// lib/scrapers/types.ts
// Common types for the newsroom + sectorial scrapers.
// Pure types + tiny constants. No runtime state, no side effects.

export type Sector = 'Alimentacion' | 'Bebidas';

export type Language = 'es';

export type OutletType =
  | 'corporate_newsroom'
  | 'sector'
  | 'nacional'
  | 'regional'
  | 'local'
  | 'bofficial'
  | 'bofficial_borme'
  | 'syndicate'
  | 'linkedin'
  | 'auction'
  | 'regulatorio_aesan'
  | 'credito_aseguradora'
  | 'ayuda_publica';

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
  /** Apply UA rotation + realistic headers (default true). */
  stealth?: boolean;
  /** Override UA per call (test helper). */
  userAgent?: string;
  /** Rate limit in RPS for the HTTP fetch loop (default 0 = no limit). */
  rate?: number;
  /** Proxy URL or undefined to use proxy-rotator. */
  proxy?: string | null;
  /** Label for the rate-limiter instance (test helper). */
  limiterKey?: string;
  /**
   * QW-8: si se especifica, se descartan artículos con publishedAt < (now - daysBack días).
   * Items sin publishedAt (null) se INCLUYEN siempre (no se pueden datar).
   * Default: undefined (sin filtro de fecha).
   */
  daysBack?: number;
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

// ============================================================================
// B.1 BORME (Boletín Oficial del Registro Mercantil)
// ============================================================================

/** Fuerza de la señal de desimplantación. B.1 en adelante. */
export type SignalStrength = 'weak' | 'medium' | 'strong';

/** Tipo de acto BORME detectado (mapeo parcial — extensible). */
export type BormeActKind =
  | 'cambio_domicilio'
  | 'ampliacion_capital'
  | 'reduccion_capital'
  | 'disolucion'
  | 'constitucion'
  | 'reeleccion'
  | 'nombramiento'
  | 'cese'
  | 'transformacion'
  | 'fusion_absorcion'
  | 'escision'
  | 'modificacion_estatutos'
  | 'declaracion_concurso'
  | 'extincion'
  | 'other';

/** Item crudo scrapeado de BORME (un acto individual). */
export interface RawBormeItem {
  /** ID único natural: `<provincia>-<numero>-<indice>`. */
  id: string;
  /** Nombre de la empresa tal como aparece en BORME (sin CIF). */
  companyName: string;
  /** CIF extraído si está presente (no siempre). */
  cif: string | null;
  /** Provincia de la sección del BORME (ej. "ALBACETE", "MADRID"). */
  provincia: string;
  /** Identificador BOE (ej. "BORME-A-2026-102-02"). */
  bormeId: string;
  /** URL canónica del item (HTML o XML). */
  url: string;
  /** Texto completo del acto (incluye nombre + CIF + descripción del acto). */
  text: string;
  /** Tipo de acto detectado. */
  actKind: BormeActKind;
  /** Fecha de publicación del BORME (YYYY-MM-DD). */
  publishedAt: string;
  /** Domicilio social si se pudo extraer (cambio o actual). */
  domicilio: string | null;
  /** Capital social si aparece. */
  capital: string | null;
}

/** Opciones del scraper BORME. */
export interface BormeScrapeOptions {
  /** Días atrás a incluir en la corrida (default 1, ej. 15 para backfill). */
  daysBack?: number;
  /** Solo procesar estas provincias (default todas las 17 CCAA + Ceuta/Melilla). */
  onlyProvincias?: string[];
  /** Tope de items a procesar (default 1000). */
  maxItems?: number;
  /** Use Flaresolverr si BOE responde con Cloudflare (default false, BOE no lo usa). */
  useFlaresolverr?: boolean;
  /** Custom user-agent (test helper). */
  userAgent?: string;
  /** Logging callback. */
  onLog?: (msg: string) => void;
}

// ============================================================================
// B.2 AESAN (Agencia Española de Seguridad Alimentaria y Nutrición)
// ============================================================================

/** Item crudo scrapeado del listado de alertas AESAN. */
export interface RawAesanAlert {
  /** ID natural: `AESAN-<YYYY>-<NN>` o `AESAN-<YYYY>-Ampliacion-<NN>`. */
  id: string;
  /** Título completo de la alerta. */
  title: string;
  /** URL canónica de la alerta individual en AESAN. */
  url: string;
  /** Fecha de la alerta (formato parseable por Date). */
  date: string;
  /** Referencia AESAN (ej. "ES2026/327") si aparece en el título. */
  reference: string | null;
  /** Producto afectado (extraído del detalle). */
  product: string | null;
  /** Hazard / peligro (Listeria, Salmonella, alérgeno no declarado, etc.). */
  hazard: string | null;
  /** Empresa/marca mencionada (si aparece en el detalle). */
  brand: string | null;
  /** Texto completo del detalle de la alerta. */
  content: string;
}

/** Opciones del scraper AESAN. */
export interface AesanScrapeOptions {
  /** Días atrás a incluir (default 7, ej. 30 para backfill). */
  daysBack?: number;
  /** Tope de alertas a procesar (default 50). */
  maxAlerts?: number;
  /** Throttle entre fetch de detalles (ms, default 3000). */
  detailDelayMs?: number;
  /** Custom user-agent (test helper). */
  userAgent?: string;
  /** Logging callback. */
  onLog?: (msg: string) => void;
}

// ============================================================================
// B.6 Ayudas públicas (CDTI / IDAE / ICEX) — Base de Datos Nacional de Subvenciones
// ============================================================================

/** Item crudo del dataset estático de ayudas públicas. */
export interface RawAyudaPublica {
  /** ID natural: `ayuda-{organoSlug}-{NNN}`. */
  id: string;
  /** ID de la convocatoria (ej. "CDTI-2024-ID-001"). */
  convocatoriaId: string;
  /** Órgano concedente (CDTI, IDAE, ICEX). */
  organo: 'CDTI' | 'IDAE' | 'ICEX' | string;
  /** Razón social del beneficiario. */
  beneficiario: string;
  /** CIF del beneficiario (normalizado: sin guiones, mayúsculas). */
  cif: string;
  /** Importe concedido en euros. */
  importe: number;
  /** Fecha de concesión (YYYY-MM-DD). */
  fechaConcesion: string;
  /** Slug del proyecto financiado (sirve para matchHash). */
  proyecto: string;
  /** CCAA de la planta beneficiaria. */
  plantaCcaa: string;
  /** Descripción corta del proyecto. */
  descripcion: string;
  /** URL canónica en el portal del órgano concedente. */
  sourceUrl: string;
}

/** Opciones del scraper de ayudas públicas. */
export interface AyudasScrapeOptions {
  /** Días atrás a incluir (default 30). */
  daysBack?: number;
  /** Tope de ayudas a procesar (default 100). */
  maxItems?: number;
  /** Logging callback. */
  onLog?: (msg: string) => void;
}
