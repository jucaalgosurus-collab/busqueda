// lib/scrapers/auctions.ts — Sprint B.9: Scraper polimórfico de portales de subastas.
//
// 13 portales: Escrapalia, Surplex, Troostwijk, HGP, Apex, GUTINVEST, CFT,
// Industrial Auctions, Machineryline, Machinerypark, BPI Auctions, EquipNet, RB Global.
//
// Diseño:
//  - 1ª capa: `fetch` HTTP con UA rotado + headers stealth (suficiente para portales
//    sin Cloudflare: HGP, Apex, GUTINVEST, CFT, BPI, Machineryline, Machinerypark).
//  - 2ª capa (futuro): Playwright + Flaresolverr para portales Cloudflare (Escrapalia,
//    Surplex, Troostwijk, Industrial Auctions, EquipNet, RB Global). En esta versión
//    esos se loggean como "blocked_by_cf" y se skipean (sin generar falsos negativos,
//    porque la 2ª pasada con Playwright ocurrirá en el siguiente sprint).
//  - Idempotente: el scraper devuelve `RawAuctionHit[]` sin filtrar — el runner aplica
//    `isRelevantAuctionHit` y persiste.
//  - Best-effort: si un portal falla, se loggea y se continúa. El smoke test valida
//    ≥1 hit real (Pascual-GUTINVEST) o, si no se puede, que al menos el runner se
//    ejecutó sin errores.

import { readFileSync } from 'fs';
import { join } from 'path';
import { getUserAgentRotator } from './anti-detect/index';
import { getRateLimiter } from './anti-detect/index';
import type { RawAuctionHit } from '../filters/auction';

interface AuctionPlatform {
  platform: string;
  country: string;
  baseUrl: string;
  searchUrlTemplate: string;
  sitemapUrl?: string;
  type: string;
  rateLimitMs: number;
  requiresStealth: 'basic' | 'flaresolverr' | 'playwright';
  notes: string;
  active: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

function loadPlatforms(): AuctionPlatform[] {
  const path = join(process.cwd(), 'lib', 'data', 'auctions-list.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as AuctionPlatform[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Fetch con UA rotado + headers stealth + timeout + 1 retry. */
async function fetchStealth(url: string, opts: { rateLimitMs?: number; platform: string }): Promise<{ status: number; text: string }> {
  const ua = getUserAgentRotator().pick();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5',
          'Cache-Control': 'no-cache',
        },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok && (res.status >= 500 || res.status === 429)) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return { status: res.status, text: await res.text() };
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (attempt + 1));
    }
  }
  clearTimeout(t);
  throw new Error(`fetch ${url} failed: ${String(lastErr)}`);
}

/** Parser HTML laxo — extrae <a> con texto de título. */
function extractLotsFromHtml(html: string, baseUrl: string): Array<{ title: string; description: string; location: string; url: string; lotId: string }> {
  const results: Array<{ title: string; description: string; location: string; url: string; lotId: string }> = [];
  // Regex laxo: captura <a href="...">title</a> con location adyacente.
  const linkRe = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (title.length < 10) continue;
    if (!/\b(lot|subasta|maquina|equipo|planta|machine|equipment|auction)\b/i.test(title)) continue;
    // Abs URL.
    let absUrl: string;
    try {
      absUrl = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    // Location guess: busca un fragmento cercano con ciudad/CCAA (best-effort).
    const nearIdx = linkRe.lastIndex;
    const slice = html.slice(Math.max(0, nearIdx - 500), Math.min(html.length, nearIdx + 200));
    const locationMatch = slice.match(/\b(Madrid|Barcelona|Valencia|Sevilla|Zaragoza|M[áa]laga|Murcia|Bilbao|Alicante|Valladolid|Vigo|Gij[óo]n|Vitoria|Granada|Tarragona|Lleida|C[áa]diz|Salamanca|Almer[íi]a|Burgos|C[óo]rdoba|Huelva|Toledo|Pontevedra|Ourense|Cuenca|Zamora|Guadalajara)\b/i);
    const location = locationMatch ? locationMatch[0] : 'Unknown';
    const lotId = absUrl.split('/').pop() ?? absUrl;
    results.push({ title, description: '', location, url: absUrl, lotId });
  }
  return results;
}

/** Sub-handler genérico: search por nombre de empresa, parsea HTML. */
async function searchByCompany(
  platform: AuctionPlatform,
  companyName: string,
  log: (m: string) => void,
): Promise<RawAuctionHit[]> {
  const limiter = getRateLimiter(`auctions:${platform.platform}`, { requestsPerSecond: 1, label: `auctions:${platform.platform}` });
  await limiter.acquire();

  if (platform.requiresStealth !== 'basic') {
    // Para B.9.0, los portales Cloudflare (Escrapalia, Surplex, Troostwijk, etc.)
    // se loggean como skipped. Próxima capa (Playwright + Flaresolverr) en B.9.1.
    log(`[auctions] ${platform.platform} requires ${platform.requiresStealth} — skipped (best-effort)`);
    return [];
  }

  const url = platform.searchUrlTemplate.replace('{query}', encodeURIComponent(companyName));
  log(`[auctions] ${platform.platform} → GET ${url}`);
  let res: { status: number; text: string };
  try {
    res = await fetchStealth(url, { rateLimitMs: platform.rateLimitMs, platform: platform.platform });
  } catch (e) {
    log(`[auctions] ${platform.platform} fetch error: ${(e as Error).message}`);
    return [];
  }
  if (res.status !== 200) {
    log(`[auctions] ${platform.platform} HTTP ${res.status}`);
    return [];
  }
  const lots = extractLotsFromHtml(res.text, platform.baseUrl);
  return lots.map((l) => ({
    platform: platform.platform,
    lotTitle: l.title.slice(0, 200),
    lotDescription: l.description.slice(0, 1000),
    lotLocation: l.location,
    lotUrl: l.url,
    lotId: l.lotId,
    closingDate: null,
    publishedAt: isoDate(new Date()),
  }));
}

/**
 * Scrapea todas las plataformas configuradas para una empresa.
 * Devuelve array plano de hits sin filtrar — el runner aplica isRelevantAuctionHit.
 */
export async function scrapeAuctionsForCompany(companyName: string, opts: {
  onlyPlatforms?: string[];
  onLog?: (m: string) => void;
} = {}): Promise<RawAuctionHit[]> {
  const log = opts.onLog ?? (() => {});
  const platforms = loadPlatforms().filter((p) => p.active);
  const targets = opts.onlyPlatforms ? platforms.filter((p) => opts.onlyPlatforms!.includes(p.platform)) : platforms;

  const all: RawAuctionHit[] = [];
  for (const platform of targets) {
    try {
      const hits = await searchByCompany(platform, companyName, log);
      all.push(...hits);
    } catch (e) {
      log(`[auctions] ${platform.platform} unexpected error: ${(e as Error).message}`);
    }
  }
  return all;
}

/** Versión para smoke tests: scrapea 1 plataforma por nombre (test determinista). */
export async function scrapeOnePlatform(platformName: string, companyName: string, opts: { onLog?: (m: string) => void } = {}): Promise<RawAuctionHit[]> {
  const log = opts.onLog ?? (() => {});
  const platform = loadPlatforms().find((p) => p.platform === platformName);
  if (!platform) {
    log(`[auctions] platform ${platformName} not found in auctions-list.json`);
    return [];
  }
  return searchByCompany(platform, companyName, log);
}

/** Helper: lista de plataformas configuradas (para smoke). */
export function listPlatforms(): AuctionPlatform[] {
  return loadPlatforms();
}
