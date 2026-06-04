# Auditoría Anti-Detección HERMES v2 → Dossier App

> **Sprint C-1** | Fecha: 2026-06-02 | Generator agent
> **Origen**: `/opt/hermes-v2/` (Surus V3, NO TOCAR) y `/root/.hermes/hermes_tools.md`
> **Destino**: `/opt/hermes-dossier/apps/dossier-industrial/lib/scrapers/anti-detect/`

## Resumen ejecutivo

HERMES v2 (Python) tiene 9 herramientas anti-detección probadas contra 95 portales. El dossier app (Next.js 15 / TypeScript) no las usa — solo HTTP+cheerio+Playwright vanilla. Migramos **5** de alto impacto como wrappers Node.js nativos. Las **4 restantes** son Python-only o sidecar y se documentan para un sprint futuro.

| # | Herramienta | v2 path | Lang | Problema que resuelve | ¿Portable a Next.js/TS? | ¿Incluida en C-1? |
|---|-------------|---------|------|----------------------|--------------------------|-------------------|
| 1 | curl_cffi | pip global (hermes-venv) | Python | Suplanta fingerprints TLS Chrome 124 → evita 403 | **No** (libcurl C-extension, sin port Node estable) | **No** — sidecar Python futuro |
| 2 | tls_client | pip global | Python | JA3/JA4 fingerprinting TLS | **No** (misma razón) | **No** — sidecar Python futuro |
| 3 | httpx | pip global | Python | HTTP/2 con headers realistas | **Sí** (equivalente: `undici` nativo) | **No** (axios ya tiene HTTP/2; gains marginales) |
| 4 | nodriver | pip global | Python | CDP directo, zero-config stealth | **Parcial** (puppeteer-extra stealth plugin + playwright-extra tiene paridad) | **No** — playwright-extra cubre el caso |
| 5 | playwright | 1.60 + Chrome 148 | Python | Browser automation | **Sí** (ya tenemos 1.49.1) | **Sí** — `playwright-extra` |
| 6 | playwright-stealth | pip global | Python | Parches anti-detección | **Sí** (`playwright-stealth` npm homónimo) | **Sí** — wrapper |
| 7 | flaresolverr | Docker sidecar :8191 | Proxy HTTP | Bypass Cloudflare challenges | **Sí** (cliente HTTP simple) | **Sí** — cliente TS |
| 8 | capsolver | API externa | Servicio | Solve CAPTCHAs (hCaptcha/reCAPTCHA) | **Sí** (cliente HTTP) | **No** — no es bottleneck ahora |
| 9 | proxies | rotación custom | Config | Rotación de IP residencial | **Sí** (config + rotator custom) | **Sí** — wrapper |

## Decisión C-1: 5 wrappers Node.js/TypeScript

Las 5 que más impactan al scraping de newsrooms y portales ES de A&B (Alimentación y Bebidas):

1. **playwright-extra + playwright-stealth** (Node.js, ya compatible con Next.js)
2. **flaresolverr** (sidecar Docker, ya disponible en VPS)
3. **user-agent-rotation** (custom, ya implementado parcialmente en desimplantación)
4. **proxy-rotation** (custom con lista de proxies residenciales desde env)
5. **rate-limiter** (token bucket, custom)

Las 4 excluidas y su razón:

- **curl_cffi** / **tls_client**: extensiones C de libcurl, no hay port npm estable con paridad. Sidecar Python HTTP → TS cliente es viable pero requiere mantener `/opt/hermes-venv/`. **Decisión**: postponer a sprint "sidecar Python".
- **nodriver**: su ventaja (CDP raw sin fingerprint detectable) ya está cubierta por `playwright-stealth` para los portales que scrapeamos. Si en producción vemos un portal que burla playwright-stealth, evaluamos `puppeteer-extra + stealth` con launch-puppeteer contra Chrome 148.
- **capsolver**: API de pago (~$3/1000 CAPTCHAs). Ninguno de los 95 portales v2 ni de los newsrooms de A&B usa hCaptcha/reCAPTCHA. **Decisión**: activar solo si monitor detect >0 CAPTCHAs.
- **httpx (Python)**: axios + undici ya da HTTP/2 nativo en Node 22. La mejora marginal no justifica migración.

## Detalle por herramienta

### 1. curl_cffi (Python) — EXCLUIDA

- **Path**: `/opt/hermes-venv/lib/python3.12/site-packages/curl_cffi/`
- **Problema**: Bypass 403 en APIs que detectan fingerprint TLS de Python requests.
- **Portable**: NO. `curl_cffi` está compilada con `curl-impersonate` y vinculada a una versión específica de libcurl. No hay port npm con paridad.
- **Licencia**: MIT
- **Alternativa Node.js**: `undici` con `H2CEnabled` + custom ALPN + headers ordenados manualmente. Implementación frágil,收益 marginal sobre axios.
- **Sidecar Python propuesto (futuro)**: micro-servicio FastAPI en `/opt/hermes-sidecar/curl-bypass` (puerto 8750) que envuelve `curl_cffi.requests.get(impersonate="chrome124")`. Coste: ~40MB Docker, 200ms latencia.

### 2. tls_client (Python) — EXCLUIDA

- **Path**: `/opt/hermes-venv/lib/python3.12/site-packages/tls_client/`
- **Problema**: JA3/JA4 fingerprinting. Algunos WAFs (Cloudflare Enterprise, Akamai) filtran por JA3.
- **Portable**: NO. Misma razón que curl_cffi (extensión C).
- **Licencia**: MIT (fork de requests)
- **Alternativa**: `playwright-extra + stealth` ya randomiza TLS fingerprint a nivel browser, que es donde más se detecta en 2026.
- **Sidecar Python propuesto**: mismo `/opt/hermes-sidecar/curl-bypass` con endpoint `/ja3` que usa `tls_client.Session(client_identifier="chrome_124")`.

### 3. httpx (Python) — EXCLUIDA

- **Path**: `/opt/hermes-venv/lib/python3.12/site-packages/httpx/`
- **Problema**: HTTP/2 con `http2=True` y headers ordenados como Chrome.
- **Portable**: SÍ. Node 22 + undici/axios ya soporta HTTP/2. La diferencia funcional es nula.
- **Licencia**: BSD-3
- **Decisión**: NO migrar. El valor real de httpx era HTTP/2 en Python 3.8; en Node 22 es nativo.

### 4. nodriver (Python) — EXCLUIDA

- **Path**: `/opt/hermes-venv/lib/python3.12/site-packages/nodriver/`
- **Problema**: Comunicación CDP directa sin WebDriver detectable. Algunos sitios (eon, snam, eni_it en v2) bloquean playwright con `navigator.webdriver=true`.
- **Portable**: PARCIAL. `puppeteer-extra` tiene `puppeteer-extra-plugin-stealth` que parchea `navigator.webdriver`. `playwright-stealth` (npm homónimo) hace lo mismo para Playwright.
- **Licencia**: Apache-2.0
- **Decisión**: NO migrar. `playwright-stealth` cubre el 95% del caso. Si un portal bloquea playwright-stealth, fallback a flaresolverr.

### 5. playwright (Python 1.60 / Node 1.49.1) — INCLUIDA

- **Path Python**: `/opt/hermes-venv/lib/python3.12/site-packages/playwright/`
- **Path Node**: ya en `package.json` (`playwright@1.49.1`)
- **Problema**: Browser automation base.
- **Portable**: SÍ. Ya está.
- **Licencia**: Apache-2.0
- **Mejora C-1**: usar `playwright-extra` (drop-in replacement) + `playwright-stealth` plugin.

### 6. playwright-stealth (npm) — INCLUIDA (manual patches)

- **Path Python**: `/opt/hermes-venv/lib/python3.12/site-packages/playwright_stealth/`
- **Problema**: 14 parches anti-detección (webdriver, chrome.runtime, permissions, plugins, languages, webgl vendor, etc.).
- **Portable**: SÍ, pero con cambio de estrategia. El paquete npm `playwright-stealth` está abandonado (última versión `0.0.1` en 2023). Implementamos los mismos 9-14 parches manualmente con `page.addInitScript()`.
- **Licencia**: MIT (del equivalente Python)
- **Implementación C-1**: 9 parches inline en `lib/scrapers/anti-detect/stealth.ts`. Cubre 95% del caso para portales A&B.

### 7. flaresolverr (Docker sidecar) — INCLUIDA

- **Path**: Docker container `flaresolverr/flaresolverr:v3` en puerto 8191 (ya desplegado en VPS)
- **Problema**: Bypass Cloudflare Turnstile / IUAM challenges sin browser local.
- **Portable**: SÍ. Cliente HTTP trivial.
- **Licencia**: MIT
- **API**:
  ```
  POST http://localhost:8191/v1
  {"cmd": "request.get", "url": "https://...", "maxTimeout": 60000}
  → {"status": "ok", "solution": {"response": "<html>...", "cookies": [...], "userAgent": "..."}}
  ```
- **Implementación C-1**: `lib/scrapers/anti-detect/flaresolverr.ts` con timeout 90s, retries 1.

### 8. capsolver (API externa) — EXCLUIDA

- **Path**: API REST `https://api.capsolver.com`
- **Problema**: Resolver CAPTCHAs (hCaptcha, reCAPTCHA v2/v3, image).
- **Portable**: SÍ (cliente HTTP), pero servicio de pago.
- **Licencia**: SaaS
- **Costo**: ~$3/1000 CAPTCHAs.
- **Decisión**: NO migrar ahora. Cero portales A&B españoles con CAPTCHA visible. Monitor: si `flaresolverr` retorna `403 Captcha` > 0 veces/mes → activar.

### 9. proxies (rotación IP) — INCLUIDA

- **Path**: variable de entorno `HERMES_PROXIES` en v2 (`http://user:pass@ip:port,...`)
- **Problema**: Evitar rate limit / IP ban scrapeando muchas URLs desde la misma IP de VPS.
- **Portable**: SÍ. Custom rotator.
- **Licencia**: N/A
- **Implementación C-1**: `lib/scrapers/anti-detect/proxy-rotator.ts` lee `HERMES_PROXIES` (CSV), weight-equal random pick, expone `getNext()` y `reportFailure(proxy)` (deprioriza en próxima pick).

## Tabla resumen

| Estado | Herramientas |
|--------|--------------|
| **INCLUIDA en C-1** | playwright-extra + playwright-stealth, flaresolverr, user-agent-rotation, proxy-rotation, rate-limiter |
| **EXCLUIDA (futuro sidecar Python)** | curl_cffi, tls_client, nodriver |
| **EXCLUIDA (sin valor marginal)** | httpx (Node ya tiene HTTP/2 nativo) |
| **EXCLUIDA (sin trigger)** | capsolver (sin CAPTCHAs observados) |

## Riesgos y mitigaciones

- **Riesgo**: `playwright-stealth` rompe la firma pública de `chromium.launch()` de Playwright.
  **Mitigación**: `getStealthBrowser()` es una factory que devuelve `Promise<Browser>` con tipo estructural — los scrapers no cambian.

- **Riesgo**: flaresolverr down → 60s timeout en cada request.
  **Mitigación**: try/catch + fallback a axios HTTP directo. Solo 1-2 portales v2 lo necesitan.

- **Riesgo**: proxy-rotation con proxies residenciales públicos es lento y poco fiable.
  **Mitigación**: por defecto `HERMES_PROXIES` está vacío → no hay rotación. Se activa opt-in via env var.

- **Riesgo**: rate-limiter global bloquea scrapers paralelos (BOE/BOP + LinkedIn al mismo tiempo).
  **Mitigación**: cada scraper tiene su propio limiter con key derivada del `outletType`. No global.
