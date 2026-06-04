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

// Jump to slide 5
await page.evaluate(() => {
  const slide = document.querySelector('[data-slide="5"]');
  if (slide) slide.scrollIntoView({ behavior: 'instant' });
});
await page.waitForTimeout(1500);

// Inspect iconography
const icons = await page.evaluate(() => {
  const ico = document.querySelectorAll('.met-ico');
  return Array.from(ico).map((s, i) => {
    const r = s.getBoundingClientRect();
    return {
      idx: i + 1,
      width: Math.round(r.width),
      height: Math.round(r.height),
      visible: r.width > 0 && r.height > 0,
      color: getComputedStyle(s).color,
      strokes: s.querySelectorAll('line, path, rect, circle, ellipse, polyline, polygon').length
    };
  });
});

const title = await page.evaluate(() => {
  const h2 = document.querySelector('[data-slide="5"] h2');
  return h2 ? h2.textContent.trim() : null;
});

// Count visible text labels per phase
const steps = await page.evaluate(() => {
  const items = document.querySelectorAll('.metodo-flow .met-step');
  return Array.from(items).map(s => {
    const n = s.querySelector('.met-n')?.textContent;
    const t = s.querySelector('.met-t')?.textContent;
    const ico = s.querySelector('.met-ico');
    return { n, t, hasIcon: !!ico };
  });
});

console.log('SLIDE 5 TITLE:', title);
console.log('\nICONS (10 esperados):');
console.log(JSON.stringify(icons, null, 2));
console.log('\nSTEPS:');
console.log(JSON.stringify(steps, null, 2));
console.log('\nERRORS:', JSON.stringify(errs, null, 2));

// Screenshot slide 5
await page.screenshot({ path: './_validate-desktop/slide-5-iconos.png', fullPage: false });

// Screenshot just the methodology block
const metodoBox = await page.evaluate(() => {
  const el = document.querySelector('.metodo-wrap');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x - 20), y: Math.round(r.y - 20), w: Math.round(r.width + 40), h: Math.round(r.height + 40) };
});
if (metodoBox) {
  await page.screenshot({
    path: './_validate-desktop/metodo-zoom.png',
    clip: { x: Math.max(0, metodoBox.x), y: Math.max(0, metodoBox.y), width: Math.min(1440, metodoBox.w), height: Math.min(900, metodoBox.h) }
  });
  console.log('\nMetodo screenshot:', metodoBox);
}

await browser.close();
