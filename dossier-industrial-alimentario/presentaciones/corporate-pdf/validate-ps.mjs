import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/SURUS-Alimentacion-Bebidas-2026.html', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const grid = await page.evaluate(() => {
  const g = document.querySelector('.ps-grid');
  if (!g) return null;
  const cs = getComputedStyle(g);
  const r = g.getBoundingClientRect();
  return { display: cs.display, cols: cs.gridTemplateColumns, height: r.height, width: r.width };
});
console.log('PS GRID:', JSON.stringify(grid));

const slide16 = await page.evaluate(() => {
  const s = document.querySelector('[data-slide="16"]');
  const h = s.getBoundingClientRect();
  const cs = getComputedStyle(s);
  return { height: h.height, top: s.offsetTop, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom };
});
console.log('SLIDE 16 details:', JSON.stringify(slide16));

await browser.close();
