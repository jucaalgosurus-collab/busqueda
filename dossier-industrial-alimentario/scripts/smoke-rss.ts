// scripts/smoke-rss.ts
// Verifica que TODAS las fuentes RSS en prensa-list, sectorial-list y newsroom-list responden 200 OK y devuelven XML válido.
// Sprint A — cobertura 80+ feeds. Ejecutar antes de hacer el seed.

import { readFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';
// xml2js no trae @types por defecto; cargamos con createRequire para que funcione en ESM.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const xml2js: any = require('xml2js');
const parseStringPromise = xml2js.parseStringPromise;

type PrensaItem = { slug: string; name: string; rss?: string | null; url: string };
type SectorialItem = { name: string; slug: string; rssUrl?: string | null; baseUrl: string };
type NewsroomItem = { name: string; slug: string; rssUrl?: string | null; newsroomUrl?: string | null };

const PRESS = (JSON.parse(readFileSync(join(process.cwd(), 'lib/data/prensa-list.json'), 'utf-8')) as PrensaItem[]);
const SECTORIAL = (JSON.parse(readFileSync(join(process.cwd(), 'lib/data/sectorial-list.json'), 'utf-8')) as SectorialItem[]);
const NEWSROOMS = (JSON.parse(readFileSync(join(process.cwd(), 'lib/data/newsroom-list.json'), 'utf-8')) as NewsroomItem[]);

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
};

interface Check {
  kind: 'prensa' | 'sectorial' | 'newsroom';
  slug: string;
  name: string;
  url: string;
  status: number | 'timeout' | 'parse_error' | 'no_rss';
  isValidXml: boolean;
  durationMs: number;
}

async function checkUrl(url: string, timeoutMs = 8000): Promise<{ status: number | 'timeout' | 'parse_error'; isValidXml: boolean; durationMs: number }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...HEADERS, signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) return { status: res.status, isValidXml: false, durationMs: Date.now() - start };
    const text = await res.text();
    let isValid = false;
    try {
      await parseStringPromise(text);
      isValid = true;
    } catch {
      isValid = false;
    }
    return { status: res.status, isValidXml: isValid, durationMs: Date.now() - start };
  } catch (e: unknown) {
    clearTimeout(timeout);
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    return { status: isTimeout ? 'timeout' : 'parse_error', isValidXml: false, durationMs: Date.now() - start };
  }
}

async function main() {
  const checks: Check[] = [];

  // 1) Prensa
  console.log(`\n[1/3] Prensa (${PRESS.length})...`);
  for (const p of PRESS) {
    if (!p.rss) {
      checks.push({ kind: 'prensa', slug: p.slug, name: p.name, url: p.url, status: 'no_rss', isValidXml: false, durationMs: 0 });
      continue;
    }
    const c = await checkUrl(p.rss);
    checks.push({ kind: 'prensa', slug: p.slug, name: p.name, url: p.rss, ...c });
    process.stdout.write(c.status === 200 ? '.' : 'F');
  }
  console.log();

  // 2) Sectorial
  console.log(`[2/3] Sectorial (${SECTORIAL.length})...`);
  for (const s of SECTORIAL) {
    if (!s.rssUrl) {
      checks.push({ kind: 'sectorial', slug: s.slug, name: s.name, url: s.baseUrl, status: 'no_rss', isValidXml: false, durationMs: 0 });
      continue;
    }
    const c = await checkUrl(s.rssUrl);
    checks.push({ kind: 'sectorial', slug: s.slug, name: s.name, url: s.rssUrl, ...c });
    process.stdout.write(c.status === 200 ? '.' : 'F');
  }
  console.log();

  // 3) Newsrooms
  console.log(`[3/3] Newsrooms (${NEWSROOMS.length})...`);
  for (const n of NEWSROOMS) {
    if (!n.rssUrl) {
      checks.push({ kind: 'newsroom', slug: n.slug, name: n.name, url: n.newsroomUrl ?? '(no newsroomUrl)', status: 'no_rss', isValidXml: false, durationMs: 0 });
      continue;
    }
    const c = await checkUrl(n.rssUrl);
    checks.push({ kind: 'newsroom', slug: n.slug, name: n.name, url: n.rssUrl, ...c });
    process.stdout.write(c.status === 200 ? '.' : 'F');
  }
  console.log();

  // Resumen
  const total = checks.length;
  const ok200 = checks.filter((c) => c.status === 200 && c.isValidXml).length;
  const ok200NoXml = checks.filter((c) => c.status === 200 && !c.isValidXml).length;
  const non200 = checks.filter((c) => typeof c.status === 'number' && c.status !== 200).length;
  const timeouts = checks.filter((c) => c.status === 'timeout').length;
  const parseErrors = checks.filter((c) => c.status === 'parse_error').length;
  const noRss = checks.filter((c) => c.status === 'no_rss').length;

  console.log('\n=== RESUMEN ===');
  console.log(`Total URLs:           ${total}`);
  console.log(`  200 OK + XML válido: ${ok200}`);
  console.log(`  200 OK sin XML:      ${ok200NoXml}`);
  console.log(`  No-2xx:              ${non200}`);
  console.log(`  Timeout:             ${timeouts}`);
  console.log(`  Error de red:        ${parseErrors}`);
  console.log(`  Sin RSS declarado:   ${noRss}`);

  if (ok200 < total - noRss) {
    console.log('\n=== ROTOS (status != 200) ===');
    for (const c of checks.filter((x) => x.status !== 200 && x.status !== 'no_rss')) {
      console.log(`  [${c.kind}] ${c.slug} — ${c.status} — ${c.url}`);
    }
  }

  process.exit(ok200 === total - noRss ? 0 : 1);
}

main().catch((e) => {
  console.error('smoke-rss failed:', e);
  process.exit(2);
});
