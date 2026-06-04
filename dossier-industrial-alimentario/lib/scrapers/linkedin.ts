// lib/scrapers/linkedin.ts — Plant-specific LinkedIn profile discovery
// for Surus commercial team. Uses Google site:linkedin.com queries +
// rate-limited fetches (LinkedIn es el más agresivo en detección).
//
// Estrategia:
//   1. Google search `site:linkedin.com "<nombre>" "<empresa>" "<planta/ciudad>"`
//   2. Filtrar URLs a /in/<slug>
//   3. HTTP fetch a linkedin.com con UA rotado y rate limit 1 req/4s
//   4. Extraer título (<title>), summary (og:description), location
//
// Nunca intenta login — solo perfiles públicos. Cumple TOS de Google
// (search scraping) y respeta robots.txt de LinkedIn (público).

import * as cheerio from 'cheerio';
import {
  buildRealisticHeaders,
  getRateLimiter,
  getUserAgentRotator,
} from './anti-detect';
import type { ScrapedArticle } from './types';

export interface LinkedInQuery {
  /** Nombre del contacto (puede ser parcial). */
  readonly personName: string;
  /** Empresa (Pescanova, Danone, etc.). */
  readonly companyName: string;
  /** Planta concreta o ciudad/CCAA (ej: "Vigo", "Parla"). */
  readonly plantLocation: string;
  /** Cargo esperado (opcional, ayuda a desambiguar). */
  readonly jobTitle?: string;
  /** Slug empresa (lowercase, sin espacios). */
  readonly companySlug: string;
}

export interface LinkedInProfile {
  readonly url: string;
  readonly slug: string;
  readonly title: string; // ej: "Juan Pérez - Director de Planta - Pescanova | LinkedIn"
  readonly summary: string;
  readonly location: string | null;
  readonly matchScore: number; // 0..1, heurístico
  readonly query: LinkedInQuery;
}

export interface LinkedInScrapeOptions {
  /** Rate limit en RPS. Default 0.25 (1 req/4s, seguro para LinkedIn). */
  readonly rate?: number;
  /** Max URLs a inspeccionar por query. Default 5. */
  readonly maxProfilesPerQuery?: number;
  /** Override del UA (test helper). */
  readonly userAgent?: string;
  /** Override del limiter (test helper). */
  readonly limiterKey?: string;
}

const DEFAULT_RATE = 0.25;
const DEFAULT_MAX_PROFILES = 5;
const GOOGLE_SITE = 'site:linkedin.com/in/';
const LINKEDIN_HOST = 'www.linkedin.com';

/** Construye el query string para Google site:linkedin.com */
export function buildGoogleQuery(q: LinkedInQuery): string {
  const parts = [
    GOOGLE_SITE,
    `"${q.personName}"`,
    `"${q.companyName}"`,
  ];
  if (q.plantLocation) parts.push(`"${q.plantLocation}"`);
  if (q.jobTitle) parts.push(`"${q.jobTitle}"`);
  return parts.join(' ');
}

/** Heurística de match: ¿el título del perfil menciona la empresa/planta? */
function scoreMatch(profile: { title: string; summary: string }, q: LinkedInQuery): number {
  const haystack = `${profile.title} ${profile.summary}`.toLowerCase();
  let score = 0;
  if (haystack.includes(q.companyName.toLowerCase())) score += 0.4;
  if (q.plantLocation && haystack.includes(q.plantLocation.toLowerCase())) score += 0.3;
  if (q.jobTitle) {
    const jobWords = q.jobTitle.toLowerCase().split(/\s+/);
    const hits = jobWords.filter((w) => haystack.includes(w));
    score += (hits.length / Math.max(1, jobWords.length)) * 0.2;
  }
  const name = q.personName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const nameHits = name.filter((n) => haystack.includes(n));
  score += (nameHits.length / Math.max(1, name.length)) * 0.1;
  return Math.min(1, score);
}

/** Extrae un perfil desde el HTML de una página pública de LinkedIn /in/<slug> */
function parseProfileFromHtml(html: string, url: string, q: LinkedInQuery): LinkedInProfile | null {
  const $ = cheerio.load(html);
  const title =
    $('head title').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    '';
  const summary =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    '';
  if (!title) return null;
  const slugMatch = /linkedin\.com\/in\/([a-z0-9-]+)/i.exec(url);
  const slug = slugMatch?.[1] ?? '';
  // Location is in <span class="text-body-small"> typically near the top
  const location = $('span.text-body-small.inline').first().text().trim() || null;
  const matchScore = scoreMatch({ title, summary }, q);
  return { url, slug, title, summary, location, matchScore, query: q };
}

/** Ejecuta un Google search y devuelve los hrefs de LinkedIn /in/ encontrados */
async function findLinkedInUrls(googleQuery: string, headers: Record<string, string>): Promise<string[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&num=20&hl=es`;
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    // Google wraps real URLs in /url?q=<URL>&...
    const m = /\/url\?q=(https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9-]+(?:\/|\?[^/]*)?)/i.exec(href);
    if (m && m[1]) {
      // Strip trailing punctuation
      const clean = m[1].replace(/[.,;:)]+$/, '');
      out.add(clean);
    }
  });
  return Array.from(out);
}

/** Fetch LinkedIn /in/<slug> con rate limit + UA rotado. */
async function fetchProfile(
  url: string,
  q: LinkedInQuery,
  opts: LinkedInScrapeOptions,
  limiter: ReturnType<typeof getRateLimiter>,
): Promise<LinkedInProfile | null> {
  await limiter.acquire();
  const ua = opts.userAgent ?? getUserAgentRotator().pick();
  const headers: Record<string, string> = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7',
    Host: LINKEDIN_HOST,
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    if (typeof timer.unref === 'function') timer.unref();
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 200) return null; // Likely a login wall or 999 challenge
    return parseProfileFromHtml(html, url, q);
  } catch {
    return null;
  }
}

/** Ejecuta una query LinkedIn y devuelve los perfiles candidatos. */
export async function scrapeLinkedIn(
  query: LinkedInQuery,
  opts: LinkedInScrapeOptions = {},
): Promise<LinkedInProfile[]> {
  const rate = opts.rate ?? DEFAULT_RATE;
  const maxProfiles = opts.maxProfilesPerQuery ?? DEFAULT_MAX_PROFILES;
  const limiterKey = opts.limiterKey ?? `linkedin-${query.companySlug}`;
  const limiter = getRateLimiter(limiterKey, { requestsPerSecond: rate, burst: 1, label: limiterKey });

  // 1) Google site: search (cuenta como 1 req al limiter)
  await limiter.acquire();
  const googleQuery = buildGoogleQuery(query);
  const googleHeaders = buildRealisticHeaders();
  const urls = await findLinkedInUrls(googleQuery, googleHeaders);
  if (urls.length === 0) return [];
  const limited = urls.slice(0, maxProfiles);

  // 2) Fetch cada perfil en serie (el limiter ya hace el rate limit)
  const profiles: LinkedInProfile[] = [];
  for (const url of limited) {
    const profile = await fetchProfile(url, query, opts, limiter);
    if (profile) profiles.push(profile);
  }
  // Sort by matchScore desc
  profiles.sort((a, b) => b.matchScore - a.matchScore);
  return profiles;
}

/** Ejecuta varias queries en lote. Devuelve mapa companySlug → perfiles. */
export async function scrapeLinkedInBatch(
  queries: readonly LinkedInQuery[],
  opts: LinkedInScrapeOptions = {},
): Promise<Map<string, LinkedInProfile[]>> {
  const out = new Map<string, LinkedInProfile[]>();
  for (const q of queries) {
    const profiles = await scrapeLinkedIn(q, opts);
    out.set(q.companySlug, profiles);
  }
  return out;
}

/** Adaptador al shape ScrapedArticle (para integrar con el resto del pipeline). */
export function profileToScrapedArticle(
  p: LinkedInProfile,
): ScrapedArticle {
  return {
    url: p.url,
    title: p.title,
    publishedAt: null,
    content: [p.summary, p.location ? `Location: ${p.location}` : ''].filter(Boolean).join('\n'),
    contentHash: '', // computed in pipeline
    outlet: 'linkedin.com',
    outletType: 'linkedin',
    language: 'es',
    raw: { fetchMs: 0, rss: false, playwright: false },
  };
}
