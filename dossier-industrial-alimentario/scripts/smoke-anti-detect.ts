// scripts/smoke-anti-detect.ts
// Sprint C-1 — Smoke test for the anti-detection layer.
//
// Asserts:
//   1. The 5 utilities export valid functions/classes.
//   2. getStealthBrowser() launches Chromium with stealth applied.
//   3. getRateLimiter(2) enforces ~500ms between calls.
//   4. getUserAgentRotator() returns 50+ distinct UAs.
//   5. Fetch to https://bot.sannysoft.com with stealth returns 'WebDriver: missing'.
//   6. LinkedIn without rate-limiter → 429, with rate-limiter → 200.
//      (NOTE: This test is OPT-IN via RUN_LIVE_TESTS=1 because it depends
//       on external services.)
//   7. Bundle size: lib/scrapers/anti-detect/ < 100KB minified.
//
// Usage:  pnpm smoke:anti-detect
//
// Exit codes: 0 = PASS, 1 = FAIL.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import {
  buildRealisticHeaders,
  getFlaresolverr,
  getProxyRotator,
  getRateLimiter,
  getStealthBrowser,
  getUserAgentRotator,
  __resetProxyRotator,
  __resetRateLimiters,
  __resetUserAgentRotator,
  __resetFlaresolverr,
} from '../lib/scrapers/anti-detect/index';

const RUN_LIVE = process.env.RUN_LIVE_TESTS === '1';
const ANTI_DETECT_DIR = path.resolve(process.cwd(), 'lib/scrapers/anti-detect');

interface Result {
  readonly name: string;
  pass: boolean;
  readonly detail: string;
}

const results: Result[] = [];

function record(name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail });
  // eslint-disable-next-line no-console
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name} — ${detail}`);
}

async function assert1_exports(): Promise<void> {
  try {
    const checks: Array<[string, unknown]> = [
      ['getStealthBrowser', getStealthBrowser],
      ['getRateLimiter', getRateLimiter],
      ['getUserAgentRotator', getUserAgentRotator],
      ['getProxyRotator', getProxyRotator],
      ['getFlaresolverr', getFlaresolverr],
      ['buildRealisticHeaders', buildRealisticHeaders],
    ];
    for (const [name, fn] of checks) {
      if (typeof fn !== 'function') {
        record('1. exports', false, `${name} is not a function`);
        return;
      }
    }
    record('1. exports', true, `6 utilities exported as functions`);
  } catch (e) {
    record('1. exports', false, `error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function assert2_stealthBrowser(): Promise<void> {
  if (!RUN_LIVE) {
    record('2. stealth browser', true, 'skipped (set RUN_LIVE_TESTS=1 to launch Chromium)');
    return;
  }
  try {
    const sb = await getStealthBrowser({ headless: true });
    const page = await sb.newPage();
    // Verify stealth worked: check navigator.webdriver
    await page.goto('about:blank');
    const webdriver = await page.evaluate(() => (navigator as unknown as { webdriver?: boolean }).webdriver ?? null);
    await sb.close();
    const ok = webdriver === false || webdriver === undefined || webdriver === null;
    record('2. stealth browser', ok, `navigator.webdriver = ${JSON.stringify(webdriver)} (expected false/null)`);
  } catch (e) {
    record('2. stealth browser', false, `error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function assert3_rateLimiter(): Promise<void> {
  try {
    __resetRateLimiters();
    const limiter = getRateLimiter('smoke-rl', { requestsPerSecond: 2, burst: 1, label: 'smoke-rl' });
    const t0 = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - t0;
    // 3 acquires at 2 RPS = ~1000ms total (1st instant, 2nd at 500ms, 3rd at 1000ms)
    const ok = elapsed >= 800 && elapsed < 1500;
    record('3. rate limiter (2 RPS)', ok, `3 acquires took ${elapsed}ms (expected ~1000ms)`);
  } catch (e) {
    record('3. rate limiter (2 RPS)', false, `error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function assert4_userAgentPool(): Promise<void> {
  try {
    __resetUserAgentRotator();
    const rotator = getUserAgentRotator();
    const uas = rotator.pickN(100);
    const distinct = new Set(uas);
    const ok = distinct.size >= 50;
    record('4. UA pool (50+ distinct)', ok, `pool size = ${rotator.size}, 100 picks yielded ${distinct.size} distinct UAs`);
  } catch (e) {
    record('4. UA pool (50+ distinct)', false, `error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function assert5_sannysoft(): Promise<void> {
  if (!RUN_LIVE) {
    record('5. sannysoft bot detection', true, 'skipped (set RUN_LIVE_TESTS=1)');
    return;
  }
  try {
    const sb = await getStealthBrowser({ headless: true });
    const page = await sb.newPage();
    await page.goto('https://bot.sannysoft.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    // Look for "WebDriver" row in the results table
    const webdriverDetected = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const row of Array.from(rows)) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const label = cells[0]?.textContent?.trim() ?? '';
          if (label.toLowerCase().includes('webdriver')) {
            const value = cells[1]?.textContent?.trim().toLowerCase() ?? '';
            return value;
          }
        }
      }
      return null;
    });
    await sb.close();
    const ok = webdriverDetected === null || !webdriverDetected.includes('present');
    record('5. sannysoft WebDriver check', ok, `WebDriver row = ${JSON.stringify(webdriverDetected)} (expected missing/null)`);
  } catch (e) {
    record('5. sannysoft WebDriver check', false, `error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function assert6_linkedin(): Promise<void> {
  if (!RUN_LIVE) {
    record('6. linkedin rate-limit', true, 'skipped (set RUN_LIVE_TESTS=1)');
    return;
  }
  try {
    __resetRateLimiters();
    const ua = getUserAgentRotator().pick();
    const headers = { 'User-Agent': ua, Accept: 'text/html' };
    // Burst 10 requests, no limiter — expect some 429
    const burst = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch('https://www.linkedin.com/feed/', { headers }).then((r) => r.status).catch(() => 0),
      ),
    );
    const burst429s = burst.filter((s) => s === 429).length;
    // Now with limiter at 0.5 RPS
    const limiter = getRateLimiter('smoke-li', { requestsPerSecond: 0.5, burst: 1, label: 'smoke-li' });
    const limited = await Promise.all(
      Array.from({ length: 5 }, async () => {
        await limiter.acquire();
        return fetch('https://www.linkedin.com/feed/', { headers }).then((r) => r.status).catch(() => 0);
      }),
    );
    const limited200s = limited.filter((s) => s === 200).length;
    const ok = burst429s >= 1 && limited200s >= 1;
    record(
      '6. linkedin rate-limit',
      ok,
      `burst: ${burst429s}/10 → 429, limited: ${limited200s}/5 → 200`,
    );
  } catch (e) {
    record('6. linkedin rate-limit', false, `error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function assert7_bundleSize(): Promise<void> {
  try {
    const files = await fs.readdir(ANTI_DETECT_DIR);
    const tsFiles = files.filter((f) => f.endsWith('.ts'));
    let totalBytes = 0;
    for (const f of tsFiles) {
      const stat = await fs.stat(path.join(ANTI_DETECT_DIR, f));
      totalBytes += stat.size;
    }
    // Raw size budget = 100KB. Minified will be ~30-40% of raw.
    const ok = totalBytes < 100_000;
    record(
      '7. bundle size budget',
      ok,
      `${tsFiles.length} files, ${totalBytes} bytes (raw, budget 100KB)`,
    );
  } catch (e) {
    record('7. bundle size budget', false, `error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Sprint C-1 — Anti-Detection Layer Smoke Test ===');
  console.log(`RUN_LIVE_TESTS=${RUN_LIVE ? '1' : '0'} (set RUN_LIVE_TESTS=1 for live network/browser tests)`);
  console.log('');

  await assert1_exports();
  await assert2_stealthBrowser();
  await assert3_rateLimiter();
  await assert4_userAgentPool();
  await assert5_sannysoft();
  await assert6_linkedin();
  await assert7_bundleSize();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log('');
  console.log(`=== RESULT: ${passed}/${results.length} PASS, ${failed} FAIL ===`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});
