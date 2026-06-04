import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(`PAGEERROR: ${e.message}`));
page.on('response', r => { if (r.status() === 404) errs.push(`404: ${r.url()}`); });

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/SURUS-Alimentacion-Bebidas-2026.html', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

await page.evaluate(() => document.querySelector('[data-slide="5"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/EV-slide5.png', fullPage: false });

await page.evaluate(() => document.querySelector('[data-slide="15"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/EV-slide15-certs.png', fullPage: false });

await page.evaluate(() => document.querySelector('[data-slide="16"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/EV-slide16-test.png', fullPage: false });

await page.evaluate(() => document.querySelector('[data-slide="1"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/EV-slide1.png', fullPage: false });

await page.evaluate(() => document.querySelector('[data-slide="17"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/EV-slide17-cta.png', fullPage: false });

const adversarial = await page.evaluate(() => {
  const icons = Array.from(document.querySelectorAll('.met-ico')).map((s, i) => {
    const r = s.getBoundingClientRect();
    const grad = s.querySelector('linearGradient');
    const filter = s.querySelector('filter');
    const fills = s.querySelectorAll('[fill^="url(#s11-grad-ico"]');
    const strokes = s.querySelectorAll('[stroke]:not([stroke="none"])');
    return {
      i: i+1, w: Math.round(r.width), h: Math.round(r.height),
      hasGrad: !!grad, hasFilter: !!filter,
      gradId: grad?.id,
      fillCount: fills.length, strokeCount: strokes.length,
      viewBox: s.getAttribute('viewBox'),
    };
  });
  const macroBand = document.querySelector('.s11-macro-band');
  const macros = macroBand ? Array.from(macroBand.querySelectorAll('.s11-macro')).map(m => m.textContent.trim()) : [];
  const certs = Array.from(document.querySelectorAll('.s11-cert-name')).map(c => c.textContent.trim());
  const testimonios = Array.from(document.querySelectorAll('.ps-cell')).map(c => ({
    q: c.querySelector('.ps-q')?.textContent.trim().slice(0, 60),
    meta: c.querySelector('.ps-meta')?.textContent.trim()
  }));
  const counter = document.getElementById('ct')?.textContent.trim();
  const counterTotal = document.querySelector('.counter')?.textContent.trim();
  return { icons, macros, certs, testimonios, counter, counterTotal };
});
console.log('=== ADVERSARIAL VERIFICATION ===');
console.log(JSON.stringify(adversarial, null, 2));

const slide5Scroll = await page.evaluate(() => {
  const s5 = document.querySelector('[data-slide="5"]');
  if (!s5) return null;
  const h = s5.getBoundingClientRect();
  return { height: h.height, viewportHeight: window.innerHeight, overflows: h.height > window.innerHeight };
});
console.log('SLIDE 5 OVERFLOW CHECK:', JSON.stringify(slide5Scroll));

await page.evaluate(() => document.querySelector('[data-slide="15"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(500);
const slide15Scroll = await page.evaluate(() => {
  const s15 = document.querySelector('[data-slide="15"]');
  if (!s15) return null;
  const h = s15.getBoundingClientRect();
  return { height: h.height, viewportHeight: window.innerHeight, overflows: h.height > window.innerHeight };
});
console.log('SLIDE 15 OVERFLOW CHECK:', JSON.stringify(slide15Scroll));

await page.evaluate(() => document.querySelector('[data-slide="16"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(500);
const slide16Scroll = await page.evaluate(() => {
  const s16 = document.querySelector('[data-slide="16"]');
  if (!s16) return null;
  const h = s16.getBoundingClientRect();
  return { height: h.height, viewportHeight: window.innerHeight, overflows: h.height > window.innerHeight };
});
console.log('SLIDE 16 OVERFLOW CHECK:', JSON.stringify(slide16Scroll));

const certGrid = await page.evaluate(() => {
  const grid = document.querySelector('.s11-cert-grid');
  if (!grid) return null;
  const cs = getComputedStyle(grid);
  const rect = grid.getBoundingClientRect();
  const cols = cs.gridTemplateColumns.split(' ').length;
  return { display: cs.display, cols, gap: cs.gap, width: rect.width };
});
console.log('CERT GRID:', JSON.stringify(certGrid));

const navDots = await page.evaluate(() => {
  return document.querySelectorAll('.nav-dot').length;
});
console.log('NAV DOTS COUNT:', navDots);

const macroBandCheck = await page.evaluate(() => {
  const mb = document.querySelector('.s11-macro-band');
  if (!mb) return null;
  const r = mb.getBoundingClientRect();
  const cs = getComputedStyle(mb);
  return { display: cs.display, height: r.height, width: r.width, gridCols: cs.gridTemplateColumns };
});
console.log('MACRO BAND:', JSON.stringify(macroBandCheck));

console.log('ERRs:', JSON.stringify(errs));

await browser.close();
