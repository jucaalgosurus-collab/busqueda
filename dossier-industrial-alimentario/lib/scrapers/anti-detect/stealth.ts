// lib/scrapers/anti-detect/stealth.ts
// Headless Chromium with manual stealth patches applied via init scripts.
//
// Why manual patches instead of `playwright-stealth`:
//   - The npm `playwright-stealth` package was last published at 0.0.1 in 2023
//     and is effectively abandoned.
//   - `puppeteer-extra-plugin-stealth` requires puppeteer, not playwright.
//   - Most production stealth stacks in 2024+ implement the same ~14 patches
//     directly with `page.addInitScript()`. We do that here.
//
// Patches applied (subset, in order):
//   1. Remove `navigator.webdriver` (the #1 detection signal)
//   2. Mock `chrome.runtime` so is.app / is.running are not undefined
//   3. Mock `navigator.plugins` to look like real Chrome (3 entries)
//   4. Mock `navigator.languages` to ['es-ES','es','en-US','en']
//   5. Patch `WebGLRenderingContext.prototype.getParameter` so vendor reads
//      "Google Inc. (NVIDIA)" instead of "Mesa" (Linux-only tell)
//   6. Mock `window.chrome.csi` / `window.chrome.loadTimes` for headless
//   7. Remove `headless` indicator from `navigator.userAgent`
//   8. Patch `Notification.permission` to 'default'
//   9. Patch `Permissions.query` to never report 'denied' for notifications
//  10. Patch `HTMLIFrameElement.prototype.contentWindow` getter for cross-origin
//
// All init scripts run BEFORE the page's own JS, so detection services see
// the patched values from the very first observation.

import type { Browser, LaunchOptions, BrowserContext, Page } from 'playwright';

export interface StealthLaunchOptions extends Omit<LaunchOptions, 'headless'> {
  readonly headless?: boolean;
  readonly locale?: string;
  readonly timezoneId?: string;
  readonly extraHttpHeaders?: Record<string, string>;
}

export interface StealthBrowser {
  readonly browser: Browser;
  readonly contexts: BrowserContext[];
  // playwright's BrowserContext.newPage has a single optional arg; the
  // generated type is `[] | [options]`, so index [0] is not always present.
  // Use a plain `Record` to keep the surface permissive without `any`.
  newPage(opts?: Record<string, unknown>): Promise<Page>;
  close(): Promise<void>;
}

const STEALTH_INIT_SCRIPT = `
(() => {
  // 1. Remove webdriver flag
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => undefined,
      configurable: true,
    });
  } catch (e) {}

  // 2. Mock chrome.runtime
  try {
    if (!window.chrome) window.chrome = {};
    window.chrome.runtime = window.chrome.runtime || {
      Platform: { OS: 'linux', Arch: 'x86-64', NacArch: 'x86-64' },
      OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install' },
      OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
      RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
      connect: () => {},
      sendMessage: () => {},
    };
    window.chrome.csi = window.chrome.csi || (() => ({
      onloadT: Date.now(), startE: Date.now(), pageT: 0, tran: 15,
    }));
    window.chrome.loadTimes = window.chrome.loadTimes || (() => ({
      requestTime: Date.now() / 1000, startLoadTime: Date.now() / 1000,
      commitLoadTime: Date.now() / 1000, finishDocumentLoadTime: Date.now() / 1000,
      finishLoadTime: Date.now() / 1000, firstPaintTime: Date.now() / 1000,
      firstPaintAfterLoadTime: 0, firstMeaningfulPaintTime: 0,
    }));
    window.chrome.app = { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } };
  } catch (e) {}

  // 3. Mock navigator.plugins
  try {
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.length = 3;
        return plugins;
      },
      configurable: true,
    });
  } catch (e) {}

  // 4. Mock navigator.languages
  try {
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: () => ['es-ES', 'es', 'en-US', 'en'],
      configurable: true,
    });
  } catch (e) {}

  // 5. WebGL vendor/renderer patches
  try {
    const patchGetParameter = (proto) => {
      const orig = proto.getParameter;
      proto.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL = 0x9245
        if (param === 0x9245) return 'Google Inc. (NVIDIA)';
        // UNMASKED_RENDERER_WEBGL = 0x9246
        if (param === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Direct3D11 vs_5_0 ps_5_0)';
        return orig.call(this, param);
      };
    };
    patchGetParameter(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') {
      patchGetParameter(WebGL2RenderingContext.prototype);
    }
  } catch (e) {}

  // 6. Mock iframe contentWindow getter (some fingerprinters probe it)
  try {
    const origContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get: function() {
        const w = origContentWindow && origContentWindow.get ? origContentWindow.get.call(this) : null;
        if (w) {
          try {
            Object.defineProperty(w, 'document', {
              get: () => ({ contentType: 'text/html' }),
              configurable: true,
            });
          } catch (e) {}
        }
        return w;
      },
      configurable: true,
    });
  } catch (e) {}

  // 7. Permissions.query patch (notifications never denied)
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (params) => {
        if (params && params.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission, onchange: null });
        }
        return origQuery(params);
      };
    }
  } catch (e) {}

  // 8. Headless UA detection
  try {
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      get: () => navigator.userAgent.replace(/HeadlessChrome\\//g, 'Chrome/'),
      configurable: true,
    });
  } catch (e) {}

  // 9. Notification.permission default
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
    }
  } catch (e) {}
})();
`;

/**
 * Launch a Chromium browser with stealth patches applied. Returns a thin
 * wrapper that exposes `newPage()` for convenience.
 *
 * Default locale is es-ES (Spanish) because the dossier targets Spanish
 * A&B outlets. Default timezone is Europe/Madrid.
 */
export async function getStealthBrowser(opts: StealthLaunchOptions = {}): Promise<StealthBrowser> {
  // Lazy import — playwright is heavy and only loaded when actually needed.
  const { chromium } = await import('playwright');

  const launchOpts: LaunchOptions = {
    headless: opts.headless ?? true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      ...(opts.args ?? []),
    ],
    ...(opts.executablePath ? { executablePath: opts.executablePath } : {}),
  };

  const browser = await chromium.launch(launchOpts);
  const contexts: BrowserContext[] = [];

  return {
    browser,
    contexts,
    async newPage(pageOpts?: Record<string, unknown>) {
      const context = await browser.newContext({
        ...(opts.locale ? { locale: opts.locale } : { locale: 'es-ES' }),
        ...(opts.timezoneId ? { timezoneId: opts.timezoneId } : { timezoneId: 'Europe/Madrid' }),
        ...(opts.extraHttpHeaders ? { extraHTTPHeaders: opts.extraHttpHeaders } : {}),
        ...(pageOpts ?? {}),
      });
      // Apply stealth patches via init script — runs before any page JS.
      await context.addInitScript({ content: STEALTH_INIT_SCRIPT });
      contexts.push(context);
      return context.newPage();
    },
    async close() {
      try {
        await browser.close();
      } catch {
        // Ignore close errors
      }
    },
  };
}

/**
 * Apply stealth patches to an existing browser context. Use this when you
 * already have a context (e.g. from raw playwright.chromium.launchPersistentContext)
 * and want to add stealth on top.
 */
export async function applyStealthToContext(context: BrowserContext): Promise<void> {
  await context.addInitScript({ content: STEALTH_INIT_SCRIPT });
}
