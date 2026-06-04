// lib/scrapers/linkedin-search.ts — Multi-engine LinkedIn OSINT search.
// Sprint E.1 — Estrategia v2 (Gemini grounding + cascade fallback).
//
// Por qué este orden:
//   1. Gemini 2.5 Flash con Google Search grounding — indexa Google directamente,
//      parsea el snippet, devuelve {url,title,snippet} en JSON estricto.
//      Sin rate limits visibles, sin CAPTCHA. Es la fuente de verdad.
//   2. Brave HTML — fallback si Gemini devuelve 0 o falla. Sensible a 429 desde
//      VPS datacenter, por eso NO es primario.
//   3. Startpage HTML — proxy Google. Bajo yield histórico.
//   4. DDG HTML — FALLA en VPS datacenter. Kept for local dev.

import * as cheerio from 'cheerio';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HTTP_TIMEOUT_MS } from './types';
import { buildRealisticHeaders } from './anti-detect';

export type LinkedInEngine = 'gemini_grounding' | 'brave_html' | 'startpage_html' | 'ddg_html';

export interface LinkedInSearchOptions {
  /** Engines a probar en orden. Default: Gemini → Brave → Startpage → DDG. */
  engines?: LinkedInEngine[];
  /** Throttle entre requests al MISMO engine (ms, default 4000). */
  throttleMs?: number;
  /** Si un engine devuelve 0 resultados, ¿probar el siguiente? (default true) */
  fallbackOnEmpty?: boolean;
  /** Logging callback. */
  onLog?: (msg: string) => void;
}

export interface LinkedInProfileHit {
  url: string;
  slug: string;
  title: string;
  snippet: string;
  engine: LinkedInEngine;
}

interface EngineResult {
  engine: LinkedInEngine;
  hits: LinkedInProfileHit[];
  ok: boolean;
  error?: string;
}

const PROFILE_RE = /linkedin\.com\/in\/([a-zA-Z0-9_-]{3,100})/g;
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';

function canonicalLinkedInUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith('linkedin.com')) return null;
    const m = u.pathname.match(/^\/in\/([a-zA-Z0-9_-]+)\/?$/);
    if (!m) return null;
    return `https://www.linkedin.com/in/${m[1]}`;
  } catch {
    return null;
  }
}

function extractLinkedInSlugs(html: string): Array<{ slug: string; rawHref: string }> {
  const out: Array<{ slug: string; rawHref: string }> = [];
  const re = new RegExp(PROFILE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ slug: m[1], rawHref: m[0] });
  }
  return out;
}

// ─── Engine 1: Gemini 2.5 Flash con Google Search grounding ─────────────────
// Usa `tools: [{ googleSearch: {} }]` para que Gemini consulte Google indexado.
// Las URLs de los resultados vienen en `groundingMetadata.groundingChunks[*].web.uri`
// (no en el texto generado). Extraemos de ahí directamente.
// Docs: https://ai.google.dev/gemini-api/docs/grounding
async function searchGeminiGrounding(q: string): Promise<EngineResult> {
  if (!GEMINI_KEY) {
    return { engine: 'gemini_grounding', hits: [], ok: false, error: 'GEMINI_API_KEY no configurado' };
  }
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} } as object],
  });
  const prompt = `Busca perfiles de LinkedIn para: ${q}.
Para cada perfil que aparezca en los resultados de búsqueda, devuelve en una línea separada:
SLUG=<slug> | TITULO=<nombre + cargo> | SNIPPET=<texto breve que lo acompañe>

Si no hay resultados relevantes, responde: SIN_RESULTADOS.
No añadas explicaciones, solo la lista.`;

  const resp = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  });

  // Estrategia: las URLs reales están en groundingChunks, no en el texto.
  // Extraemos TODOS los chunks cuyo uri sea linkedin.com/in/<slug>.
  const hits: LinkedInProfileHit[] = [];
  const seen = new Set<string>();
  const candidates = resp.response.candidates ?? [];
  for (const c of candidates) {
    const gm = (c as unknown as { groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>; groundingSupports?: Array<{ segment?: { text?: string } }> } }).groundingMetadata;
    if (!gm) continue;
    for (const chunk of gm.groundingChunks ?? []) {
      const uri = chunk.web?.uri ?? '';
      const canonical = canonicalLinkedInUrl(uri);
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      // Snippet: el segmento de texto que cita este chunk (si lo hay)
      const support = (gm.groundingSupports ?? []).find((s) => true);
      const snippet = support?.segment?.text?.slice(0, 500) ?? chunk.web?.title ?? '';
      hits.push({
        url: canonical,
        slug: canonical.split('/in/')[1] ?? '',
        title: (chunk.web?.title ?? '').slice(0, 200),
        snippet: snippet.slice(0, 500),
        engine: 'gemini_grounding',
      });
    }
  }
  return { engine: 'gemini_grounding', hits, ok: hits.length > 0 };
}

// ─── Engine 2: Brave HTML (con UA rotado realista) ───────────────────────────
// VPS datacenter IPs suelen ser flagged. Headers realistas rotados por el
// pool de anti-detect reducen el riesgo de CAPTCHA. Si 429 → siguiente engine.
async function searchBraveHtml(q: string): Promise<EngineResult> {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(q)}`;
  const r = await axios.get<string>(url, {
    headers: buildRealisticHeaders(),
    timeout: HTTP_TIMEOUT_MS,
    responseType: 'text',
    transformResponse: [(d) => d],
  });
  const html = r.data;
  const $ = cheerio.load(html);
  const hits: LinkedInProfileHit[] = [];
  const seen = new Set<string>();

  $('a[href*="linkedin.com/in/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const canonical = canonicalLinkedInUrl(href);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    const title = $(el).text().trim().slice(0, 200) ||
                  $(el).closest('div').text().trim().split('\n')[0]?.trim().slice(0, 200) ||
                  canonical;
    const snippet = $(el).closest('[data-type="web"]').text().trim().slice(0, 500) ||
                    $(el).parent().text().trim().slice(0, 500);
    hits.push({ url: canonical, slug: canonical.split('/in/')[1] ?? '', title, snippet, engine: 'brave_html' });
  });

  if (hits.length === 0) {
    for (const { slug, rawHref } of extractLinkedInSlugs(html)) {
      const canonical = `https://www.linkedin.com/in/${slug}`;
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      hits.push({ url: canonical, slug, title: slug.replace(/-/g, ' '), snippet: rawHref, engine: 'brave_html' });
    }
  }

  return { engine: 'brave_html', hits, ok: hits.length > 0 };
}

// ─── Engine 3: Startpage HTML ────────────────────────────────────────────────
async function searchStartpageHtml(q: string): Promise<EngineResult> {
  const url = `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}&cat=web&language=english`;
  const r = await axios.get<string>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: HTTP_TIMEOUT_MS,
    maxRedirects: 5,
  });
  const html = r.data;
  const hits: LinkedInProfileHit[] = [];
  const seen = new Set<string>();
  const $ = cheerio.load(html);
  $('a[href*="linkedin.com/in/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const canonical = canonicalLinkedInUrl(href);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    const title = $(el).text().trim().slice(0, 200) || canonical;
    const snippet = $(el).closest('div').text().trim().slice(0, 500);
    hits.push({ url: canonical, slug: canonical.split('/in/')[1] ?? '', title, snippet, engine: 'startpage_html' });
  });
  return { engine: 'startpage_html', hits, ok: hits.length > 0 };
}

// ─── Engine 4: DuckDuckGo HTML ───────────────────────────────────────────────
async function searchDdgHtml(q: string): Promise<EngineResult> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const r = await axios.get<string>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    timeout: HTTP_TIMEOUT_MS,
  });
  const html = r.data;
  const hits: LinkedInProfileHit[] = [];
  const seen = new Set<string>();
  const $ = cheerio.load(html);
  $('a[href*="linkedin.com/in/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const canonical = canonicalLinkedInUrl(href);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    const title = $(el).text().trim().slice(0, 200) || canonical;
    const snippet = $(el).closest('div').text().trim().slice(0, 500);
    hits.push({ url: canonical, slug: canonical.split('/in/')[1] ?? '', title, snippet, engine: 'ddg_html' });
  });
  return { engine: 'ddg_html', hits, ok: hits.length > 0 };
}

const ENGINE_FNS: Record<LinkedInEngine, (q: string) => Promise<EngineResult>> = {
  gemini_grounding: searchGeminiGrounding,
  brave_html: searchBraveHtml,
  startpage_html: searchStartpageHtml,
  ddg_html: searchDdgHtml,
};

export async function searchLinkedInProfiles(
  q: string,
  opts: LinkedInSearchOptions = {},
): Promise<{ hits: LinkedInProfileHit[]; enginesTried: LinkedInEngine[]; allBlocked: boolean }> {
  const engines: LinkedInEngine[] = opts.engines ?? (() => {
    // Gemini primario si key configurada. Si no, cascade multi-engine.
    if (GEMINI_KEY) return ['gemini_grounding', 'brave_html', 'startpage_html', 'ddg_html'];
    return ['brave_html', 'startpage_html', 'ddg_html'];
  })();
  const throttleMs = opts.throttleMs ?? 4000;
  const fallback = opts.fallbackOnEmpty ?? true;
  const onLog = opts.onLog ?? ((m) => console.log(m));

  const enginesTried: LinkedInEngine[] = [];
  let combined: LinkedInProfileHit[] = [];
  // Cooldown state: si un engine dio 429, esperaremos 30s antes del siguiente.
  // Evita propagar el rate-limit al siguiente engine (algunos comparten infra).
  let cooldownMs = 0;

  for (let i = 0; i < engines.length; i++) {
    const engine = engines[i];
    const fn = ENGINE_FNS[engine];
    if (!fn) continue;
    enginesTried.push(engine);

    if (cooldownMs > 0) {
      onLog(`[linkedin-search] cooldown ${cooldownMs}ms before ${engine}`);
      await new Promise((res) => setTimeout(res, cooldownMs));
    }

    // Reintento con backoff para 429 dentro del MISMO engine.
    let r: EngineResult | null = null;
    const attempts = [0, 8000, 20000];
    for (let a = 0; a < attempts.length; a++) {
      try {
        r = await fn(q);
        break;
      } catch (e) {
        const msg = (e as Error).message;
        const is429 = /429|rate.?limit|too many/i.test(msg);
        onLog(`[linkedin-search] engine=${engine} attempt=${a + 1} ERROR: ${msg}`);
        if (is429 && a < attempts.length - 1) {
          await new Promise((res) => setTimeout(res, attempts[a + 1] - attempts[a]));
          continue;
        }
        r = { engine, hits: [], ok: false, error: msg };
        break;
      }
    }
    if (!r) continue;

    onLog(`[linkedin-search] engine=${engine} hits=${r.hits.length} ok=${r.ok}${r.error ? ` error=${r.error}` : ''}`);
    if (r.hits.length > 0) {
      combined = combined.concat(r.hits);
      if (!fallback) break;
    }
    // Si fue 429 explícito, marcar cooldown para el siguiente engine.
    if (r.error && /429|rate.?limit|too many/i.test(r.error)) {
      cooldownMs = Math.max(cooldownMs, 30_000);
    } else if (i < engines.length - 1) {
      cooldownMs = throttleMs;
    }
  }

  const seen = new Set<string>();
  const deduped: LinkedInProfileHit[] = [];
  for (const h of combined) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    deduped.push(h);
  }

  const allBlocked = deduped.length === 0;
  if (allBlocked) onLog(`[linkedin-search] all engines blocked for q="${q.slice(0, 80)}"`);
  return { hits: deduped, enginesTried, allBlocked };
}
