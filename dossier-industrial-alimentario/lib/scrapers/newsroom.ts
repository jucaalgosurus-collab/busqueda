// lib/scrapers/newsroom.ts
// Corporate newsroom scraper for ElPozo, Foodiverse, Nueva Pescanova, etc.
//
// Strategy cascade (per source):
//   1. RSS-first  — when entry.rssUrl is set, use rss-parser to pull items fast.
//   2. HTTP       — axios + cheerio on entry.newsroomUrl, extract article links
//                   from <article>/<div class="post">/<li class="entry">, then
//                   GET each article and extract { title, content, publishedAt }.
//   3. Playwright — fallback when cheerio content is < 200 chars OR fewer than
//                   5 article links were found on the home page.
//
// All side effects are wrapped in try/catch; a failing source returns [] and
// logs a structured warning. The function never throws.
//
// The `__internal` namespace at the bottom is consumed by `./sectorial.ts`,
// which shares the same cascade with `outletType: 'sector'`.

import axios, { type AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import Parser from 'rss-parser';

import {
  DEFAULT_MAX_ARTICLES,
  HTTP_RETRIES,
  HTTP_TIMEOUT_MS,
  MIN_ARTICLE_LINKS,
  MIN_USEFUL_CHARS,
  NOISE_HREF_PATTERNS,
  PLAYWRIGHT_TIMEOUT_MS,
  PLAYWRIGHT_WAIT_MS,
  RETRY_BACKOFF_MS,
  USER_AGENT,
  type NewsroomListEntry,
  type ScrapedArticle,
  type ScrapeOptions,
} from './types.js';

// --- shared types (consumed by sectorial.ts) ---

export interface SharedEntry {
  slug: string;
  name: string;
  newsroomUrl: string | null;
  rssUrl: string | null;
}

export interface ExtractedLink {
  href: string;
  text: string;
}

export interface ArticleContent {
  title: string;
  publishedAt: Date | null;
  content: string;
}

// --- HTTP ---

function makeHttp(): AxiosInstance {
  return axios.create({
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7',
    },
    // Do not throw on non-2xx — we want to inspect body anyway.
    validateStatus: () => true,
    // Keep raw text instead of axios auto-parsing to JSON.
    responseType: 'text',
    transformResponse: [(data) => data],
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function httpGetText(http: AxiosInstance, url: string): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= HTTP_RETRIES; attempt += 1) {
    try {
      const res = await http.get<string>(url);
      if (typeof res.data === 'string' && res.data.length > 0) return res.data;
      lastErr = new Error(`empty body (status=${res.status})`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < HTTP_RETRIES) {
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('http failed');
}

// --- URL helpers ---

function isNoiseHref(href: string): boolean {
  if (!href) return true;
  for (const pattern of NOISE_HREF_PATTERNS) {
    if (pattern.test(href)) return true;
  }
  return false;
}

function toAbsoluteUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    url.hash = '';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function stripQueryAndFragment(href: string): string {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}`;
  } catch {
    return href.split('#')[0]?.split('?')[0] ?? href;
  }
}

function isHomePath(pathname: string, baseUrl: string): boolean {
  try {
    const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');
    const candidate = pathname.replace(/\/$/, '');
    if (candidate === '' || candidate === '/') return true;
    if (basePath && candidate === basePath) return true;
    return false;
  } catch {
    return false;
  }
}

// --- content extraction ---

function extractArticleLinks(html: string, baseUrl: string): ExtractedLink[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: ExtractedLink[] = [];

  const containers = $('article, .post, .entry, li.post, li.entry, div.hentry');
  containers.each((_, el) => {
    const $el = $(el);
    const $a = $el.find('a[href]').first();
    const rawHref = $a.attr('href');
    if (!rawHref) return;
    if (isNoiseHref(rawHref)) return;
    const abs = toAbsoluteUrl(rawHref, baseUrl);
    if (!abs) return;
    let parsed: URL;
    try {
      parsed = new URL(abs);
    } catch {
      return;
    }
    if (isHomePath(parsed.pathname, baseUrl)) return;
    const dedupeKey = stripQueryAndFragment(abs);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const text = ($a.text() || $el.find('h1, h2, h3, h4').first().text() || '').trim();
    out.push({ href: abs, text });
  });

  if (out.length > 0) return out;

  // Fallback: any <a> inside <main> with substantive text.
  const $main = $('main').length > 0 ? $('main') : $('body');
  $main.find('a[href]').each((_, el) => {
    const $a = $(el);
    const rawHref = $a.attr('href');
    if (!rawHref || isNoiseHref(rawHref)) return;
    const text = ($a.text() || '').trim();
    if (text.length <= 10) return;
    const abs = toAbsoluteUrl(rawHref, baseUrl);
    if (!abs) return;
    let parsed: URL;
    try {
      parsed = new URL(abs);
    } catch {
      return;
    }
    if (isHomePath(parsed.pathname, baseUrl)) return;
    const dedupeKey = stripQueryAndFragment(abs);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push({ href: abs, text });
  });

  return out;
}

const CONTENT_SELECTORS: readonly string[] = [
  'article',
  'main',
  '.content',
  '.post-content',
  '.entry-content',
  '#content',
  '.single-content',
  '.noticia',
  '.news-content',
];

const NOISE_SELECTORS: readonly string[] = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'noscript',
  'iframe',
  '.share',
  '.social',
  '.related',
  '.newsletter',
  '.comments',
  '#comments',
];

function findContainer($: cheerio.CheerioAPI): cheerio.AnyNode | null {
  for (const sel of CONTENT_SELECTORS) {
    const found = $(sel).first();
    if (found.length > 0) {
      return found.get(0) ?? null;
    }
  }
  return $('body').get(0) ?? null;
}

function parseDateLoose(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(trimmed);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function extractFromContainer($: cheerio.CheerioAPI): ArticleContent {
  const container = findContainer($);
  if (!container) {
    return { title: '', publishedAt: null, content: '' };
  }
  const $c = $(container);
  $c.find(NOISE_SELECTORS.join(',')).remove();

  const title =
    $c.find('h1').first().text().trim() ||
    $('head title').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    '';

  const timeAttr =
    $c.find('time[datetime]').first().attr('datetime') ||
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[property="og:published_time"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('meta[name="DC.date.issued"]').attr('content') ||
    $('meta[name="pubdate"]').attr('content') ||
    null;
  const publishedAt = parseDateLoose(timeAttr);

  const textParts: string[] = [];
  $c.find('h1, h2, h3, h4, p, li, blockquote').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) textParts.push(t);
  });
  if (textParts.length === 0) {
    const raw = $c.text().replace(/\s+/g, ' ').trim();
    if (raw) textParts.push(raw);
  }
  const content = textParts.join('\n').trim();

  return { title, publishedAt, content };
}

// --- Playwright ---

async function maybeRenderWithPlaywright(url: string): Promise<string | null> {
  let browser: import('playwright').Browser | null = null;
  try {
    // Lazy import — Playwright is heavy and only loaded when actually needed.
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'es-ES',
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PLAYWRIGHT_TIMEOUT_MS });
    // Give JS-rendered content a moment to hydrate.
    await page.waitForTimeout(PLAYWRIGHT_WAIT_MS);
    const html = await page.content();
    await context.close();
    return html;
  } catch (e) {
    console.warn({
      source: 'playwright',
      url,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close errors.
      }
    }
  }
}

async function extractArticleContent(
  http: AxiosInstance,
  url: string,
): Promise<ArticleContent & { usedPlaywright: boolean }> {
  const html = await httpGetText(http, url);
  const $ = cheerio.load(html);
  let extracted = extractFromContainer($);
  let usedPlaywright = false;

  if (extracted.content.length < MIN_USEFUL_CHARS) {
    const rendered = await maybeRenderWithPlaywright(url);
    if (rendered) {
      const $$ = cheerio.load(rendered);
      extracted = extractFromContainer($$);
      usedPlaywright = true;
    }
  }
  return { ...extracted, usedPlaywright };
}

// --- RSS ---

interface RssItemLike {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
}

const rssParser = new Parser({
  timeout: HTTP_TIMEOUT_MS,
  headers: { 'User-Agent': USER_AGENT },
});

function pickPublished(item: RssItemLike): Date | null {
  return parseDateLoose(item.isoDate) ?? parseDateLoose(item.pubDate);
}

function pickBody(item: RssItemLike): string {
  if (item.content && item.content.length > 0) {
    const $ = cheerio.load(item.content);
    return $.root().text().replace(/\s+/g, ' ').trim();
  }
  if (item.contentSnippet) return item.contentSnippet.trim();
  return '';
}

// --- hashing ---

function hashContent(title: string, content: string): string {
  const normalized = `${title}\n${content}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// --- shared pipeline (RSS + HTTP) ---

function toSharedEntry(entry: { slug: string; name: string; newsroomUrl: string | null; rssUrl: string | null }): SharedEntry {
  return {
    slug: entry.slug,
    name: entry.name,
    newsroomUrl: entry.newsroomUrl,
    rssUrl: entry.rssUrl,
  };
}

async function scrapeViaRss(
  entry: SharedEntry,
  maxArticles: number,
  fetchMsStart: number,
  outletType: ScrapedArticle['outletType'],
): Promise<ScrapedArticle[]> {
  if (!entry.rssUrl) return [];
  try {
    const feed = await rssParser.parseURL(entry.rssUrl);
    const items = (feed.items ?? []).slice(0, maxArticles);
    const articles: ScrapedArticle[] = [];
    for (const item of items) {
      if (!item.link) continue;
      const title = (item.title ?? '').trim();
      const content = pickBody(item);
      if (!title) continue;
      const publishedAt = pickPublished(item);
      articles.push({
        url: item.link,
        title,
        publishedAt,
        content,
        contentHash: hashContent(title, content),
        outlet: entry.name,
        outletType,
        language: 'es',
        raw: { rss: true, fetchMs: Date.now() - fetchMsStart },
      });
    }
    return articles;
  } catch (e) {
    console.warn({
      source: entry.slug,
      url: entry.rssUrl,
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

async function scrapeViaHttp(
  entry: SharedEntry,
  http: AxiosInstance,
  maxArticles: number,
  fetchMsStart: number,
  usePlaywright: boolean,
  outletType: ScrapedArticle['outletType'],
): Promise<ScrapedArticle[]> {
  if (!entry.newsroomUrl) return [];
  let html: string;
  try {
    html = await httpGetText(http, entry.newsroomUrl);
  } catch (e) {
    console.warn({
      source: entry.slug,
      url: entry.newsroomUrl,
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }

  let links = extractArticleLinks(html, entry.newsroomUrl);

  // Playwright fallback on the HOME when cheerio is useless.
  if (usePlaywright && (links.length < MIN_ARTICLE_LINKS || html.length < 500)) {
    const rendered = await maybeRenderWithPlaywright(entry.newsroomUrl);
    if (rendered) {
      links = extractArticleLinks(rendered, entry.newsroomUrl);
    }
  }

  if (links.length === 0) return [];

  const limited = links.slice(0, maxArticles);
  const articles: ScrapedArticle[] = [];
  for (const link of limited) {
    try {
      const result = await extractArticleContent(http, link.href);
      const title = (result.title || link.text || '').trim();
      if (!title) continue;
      const content = result.content;
      articles.push({
        url: link.href,
        title,
        publishedAt: result.publishedAt,
        content,
        contentHash: hashContent(title, content),
        outlet: entry.name,
        outletType,
        language: 'es',
        raw: {
          rss: false,
          playwright: result.usedPlaywright || undefined,
          fetchMs: Date.now() - fetchMsStart,
        },
      });
    } catch (e) {
      console.warn({
        source: entry.slug,
        url: link.href,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return articles;
}

// --- Public entry point ---

/**
 * Scrape a corporate newsroom.
 *
 * Returns up to `maxArticles` (default 20) articles. Never throws — a failing
 * source returns an empty array. Strategy: RSS-first, then HTTP+cheerio, then
 * Playwright fallback for the home page and/or any individual article whose
 * extracted body is < 200 chars.
 */
export type NewsroomScrapeEntry = Pick<NewsroomListEntry, 'slug' | 'name' | 'newsroomUrl' | 'rssUrl'>;

export async function scrapeNewsroom(
  entry: NewsroomScrapeEntry,
  opts?: ScrapeOptions,
): Promise<ScrapedArticle[]> {
  const maxArticles = opts?.maxArticles ?? DEFAULT_MAX_ARTICLES;
  const usePlaywright = opts?.usePlaywright ?? true;
  const fetchMsStart = Date.now();
  const http = makeHttp();
  const shared = toSharedEntry(entry);

  if (entry.rssUrl) {
    const rssArticles = await scrapeViaRss(shared, maxArticles, fetchMsStart, 'corporate_newsroom');
    if (rssArticles.length > 0) return rssArticles;
  }

  return scrapeViaHttp(shared, http, maxArticles, fetchMsStart, usePlaywright, 'corporate_newsroom');
}

// --- Internal exports (consumed by sectorial.ts) ---
// These are intentionally not part of the public API; sectorial.ts reuses the
// same RSS + HTTP + Playwright cascade with `outletType: 'sector'`.

export const __internal = {
  makeHttp,
  extractArticleLinks,
  extractFromContainer,
  extractArticleContent,
  maybeRenderWithPlaywright,
  httpGetText,
  hashContent,
  pickBody,
  pickPublished,
  scrapeViaRss,
  scrapeViaHttp,
  toSharedEntry,
};

// SMOKE:
//   import { scrapeNewsroom } from '@/lib/scrapers/newsroom';
//   import newsroomList from '@/lib/data/newsroom-list.json';
//   const articles = await scrapeNewsroom(newsroomList[0]);
//   console.log(articles.length, articles[0]?.title);
