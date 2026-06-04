import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = 'https://alimentos-ten.vercel.app/SURUS-Alimentacion-Bebidas-2026';
const OUT = './_validate-desktop';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const slides = await page.locator('.slide').count();
const hero = await page.locator('h1.display').first().textContent();
const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim());
const counters = await page.locator('[data-counter]').count();
const revealIn = await page.locator('.reveal.in').count();
const revealTotal = await page.locator('.reveal').count();
const donut = await page.locator('.donut-fg').count();
const mapaPins = await page.locator('.mapa-pin').count();
const navDots = await page.locator('.nav-dot').count();
const casoImgs = await page.locator('.caso-img').count();
const casoImgsLoaded = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.caso-img')).filter(i => i.complete && i.naturalWidth > 0).length;
});

// Hero overflow check
const heroOverflow = await page.evaluate(() => {
  const h1 = document.querySelector('h1.display');
  if (!h1) return { ok: false, reason: 'no h1' };
  const r = h1.getBoundingClientRect();
  return { ok: r.width <= 1440 && r.right <= 1440, width: r.width, right: r.right, text: h1.textContent.trim() };
});

// Slide 1 (portada) fits in 1440x900?
const slide1Fits = await page.evaluate(() => {
  const s = document.querySelector('[data-slide="1"]');
  if (!s) return { ok: false };
  const r = s.getBoundingClientRect();
  return { h: r.height, viewportH: window.innerHeight, ok: r.height <= window.innerHeight + 4, scrollH: document.documentElement.scrollHeight };
});

console.log(JSON.stringify({ slides, hero, bg, counters, revealIn, revealTotal, donut, mapaPins, navDots, casoImgs, casoImgsLoaded, heroOverflow, slide1Fits, errors }, null, 2));

// Screenshot portada
await page.screenshot({ path: `${OUT}/01-portada.png`, fullPage: false });

// Navigate through each slide
for (let i = 1; i <= 16; i++) {
  await page.evaluate((n) => {
    const s = document.querySelector(`[data-slide="${n}"]`);
    if (s) s.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, i);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/slide-${String(i).padStart(2, '0')}.png`, fullPage: false });
}

// Verify counters animated
const counterValues = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('[data-counter]')).map(el => ({
    target: el.dataset.counter,
    current: el.textContent.trim()
  }));
});
console.log('COUNTERS:', JSON.stringify(counterValues, null, 2));

// Verify donut stroke-dasharray animated
const donutState = await page.evaluate(() => {
  const d = document.querySelector('.donut-fg');
  if (!d) return null;
  const cs = getComputedStyle(d);
  return { strokeDasharray: cs.strokeDasharray, strokeDashoffset: cs.strokeDashoffset };
});
console.log('DONUT:', JSON.stringify(donutState));

await browser.close();
console.log('DONE. Errors:', errors.length);
