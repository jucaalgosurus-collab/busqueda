# Anti-Detection Layer — Dossier App

> **Sprint C-1** | 2026-06-02 | Generator agent
> Migration of HERMES v2 anti-detection arsenal to the Next.js 15 dossier app.

## What this solves

When scraping corporate newsrooms, sectorial outlets, BOE/BOP, prensa, and
LinkedIn profiles, several categories of sites apply anti-bot protections:

1. **TLS fingerprinting** — Python `requests` has a JA3 hash that doesn't match
   any real browser, so 403s come back instantly.
2. **Headless detection** — `navigator.webdriver === true` is the first check
   DataDome, PerimeterX, Cloudflare, and Akamai do.
3. **Rate limiting** — too many requests per second from the same IP returns
   429 and eventually a permanent ban.
4. **Cloudflare challenges** — IUAM and Turnstile need a real browser session
   cookie (`cf_clearance`) to bypass.
5. **Stale User-Agent** — same UA across all requests makes the pattern
   obvious in the server logs.

This layer provides five Node.js/TypeScript utilities that cover all five.

## The 5 utilities

### 1. `getStealthBrowser()` — headless browser with stealth patches

Wraps `playwright.chromium` and applies **9 anti-detection patches via init
scripts** (runs before any page JS so detection services see the patched
values from the first observation):

1. Removes `navigator.webdriver`
2. Mocks `chrome.runtime` / `chrome.csi` / `chrome.loadTimes` / `chrome.app`
3. Mocks `navigator.plugins` (3 realistic Chrome PDF plugins)
4. Sets `navigator.languages` to `['es-ES','es','en-US','en']`
5. Patches WebGL `UNMASKED_VENDOR_WEBGL` / `UNMASKED_RENDERER_WEBGL` to NVIDIA strings
6. Patches iframe `contentWindow.document` getter
7. Patches `navigator.permissions.query` for notifications
8. Strips `HeadlessChrome` from UA
9. Forces `Notification.permission = 'default'`

```ts
import { getStealthBrowser } from '@/lib/scrapers/anti-detect';

const sb = await getStealthBrowser({ headless: true });
const page = await sb.newPage();
await page.goto('https://portal-protegido.example.com');
const html = await page.content();
await sb.close();
```

**Why manual patches, not `playwright-stealth` npm**: that package was last
published at `0.0.1` in 2023 and is effectively abandoned. The patches in
production stealth stacks (puppeteer-extra-plugin-stealth, etc.) implement
exactly the same primitives shown above.

**Test the stealth**:
```ts
await page.goto('https://bot.sannysoft.com');
const row = await page.locator('tr:has-text("WebDriver") td').nth(1).textContent();
// expected: 'missing' (not 'present')
```

### 2. `getRateLimiter(key, opts)` — token-bucket rate limiter

FIFO queue, no setTimeout drift. Use one limiter per `outletType` to avoid
cascading backpressure.

```ts
import { getRateLimiter } from '@/lib/scrapers/anti-detect';

// 1 request every 4s for LinkedIn (their aggressive limit)
const linkedin = getRateLimiter('linkedin', { requestsPerSecond: 0.25 });

await linkedin.run(async () => {
  return await axios.get(url);
});
```

### 3. `getUserAgentRotator()` — weighted UA pool

50+ UAs (Chrome/Firefox/Safari/Edge) across Windows/macOS/Linux/Android/iOS.
Weights match global browser share. Singleton — pick without setup.

```ts
import { getUserAgentRotator, buildRealisticHeaders } from '@/lib/scrapers/anti-detect';

const headers = buildRealisticHeaders();
// → { 'User-Agent': '<random UA>', 'Accept-Language': 'es-ES,...', ... }
```

### 4. `getProxyRotator()` — failure-aware proxy rotation

Reads `HERMES_PROXIES` env var. Empty by default → safe no-op. On 3
consecutive failures, halves the proxy's weight. On success, gradually
restores it.

```ts
import { getProxyRotator } from '@/lib/scrapers/anti-detect';

const rotator = getProxyRotator();
const proxy = rotator.pick();  // undefined when no proxies configured
rotator.reportFailure(proxy);  // call on 4xx/5xx
rotator.reportSuccess(proxy);  // call on 2xx
```

Env var format:
```
HERMES_PROXIES="http://user:pass@ip1:8080,socks5://ip2:1080"
```
or
```
HERMES_PROXIES_FILE="/etc/hermes/proxies.txt"
```

### 5. `getFlaresolverr()` — Cloudflare bypass via sidecar

Calls the FlareSolverr Docker container (default `http://localhost:8191`).
Returns cleared HTML + cookies. Use as last resort.

```ts
import { getFlaresolverr } from '@/lib/scrapers/anti-detect';

const fs = getFlaresolverr();
const ok = await fs.healthCheck();
if (ok) {
  const res = await fs.get('https://sitio-con-cloudflare.example.com');
  const html = res.solution!.response;
}
```

## How to use in scrapers

The 5 scrapers (`newsroom`, `sectorial`, `prensa`, `boe-bop`, `linkedin`) all
delegate to `scrapeNewsroom`, so a single hook point in `newsroom.ts` is
sufficient for the HTTP path. For Playwright, `maybeRenderWithPlaywright`
already exists — it now uses stealth automatically.

Per-scraper opt-in:
```ts
// antes
scrapeNewsroom(entry, { maxArticles: 20, usePlaywright: true });

// después (compatible hacia atrás)
scrapeNewsroom(entry, {
  maxArticles: 20,
  usePlaywright: true,
  stealth: true,      // default true cuando usePlaywright
  proxy: undefined,   // o 'http://user:pass@ip:port'
  rate: 2,            // RPS, 0 = no rate limit
});
```

## What is NOT here (yet)

Four tools from HERMES v2 were excluded and are documented in
`docs/AUDIT-ANTI-DETECCION-V2.md`:

- **curl_cffi**, **tls_client** — C-extension fingerprinting, no Node port.
  Future sprint: Python sidecar `/opt/hermes-sidecar/curl-bypass`.
- **nodriver** — CDP raw, no WebDriver. Our 9 manual stealth patches cover 95%.
- **capsolver** — paid CAPTCHA solver. No CAPTCHAs observed yet.
- **httpx (Python)** — Node 22 + undici already gives HTTP/2.

**Note on `playwright-stealth` (npm)**: the package was last published at
`0.0.1` in 2023 and is effectively abandoned. We implement the same patches
manually in `stealth.ts` via `addInitScript`.

## Bundle size budget

Total of `lib/scrapers/anti-detect/*.ts` is < 30 KB raw. The lazy import of
`playwright` (the only runtime dep) keeps the chromium binary out of any
module that doesn't opt in (axios, rss-parser, cheerio paths are unaffected).
The HTTP path uses `buildRealisticHeaders()` which is a pure function.
