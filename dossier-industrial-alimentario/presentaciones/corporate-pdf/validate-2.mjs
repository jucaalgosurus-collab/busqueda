import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const req404 = [];
page.on('response', r => { if (r.status() === 404) req404.push(r.url()); });
page.on('requestfailed', r => req404.push(`FAIL: ${r.url()} :: ${r.failure()?.errorText}`));
await page.goto('https://alimentos-ten.vercel.app/SURUS-Alimentacion-Bebidas-2026', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Donut: get all circles
const donut = await page.evaluate(() => {
  const g = document.getElementById('donut-segments');
  if (!g) return null;
  const circles = Array.from(g.querySelectorAll('circle'));
  return circles.map(c => ({
    stroke: c.getAttribute('stroke'),
    dasharray: c.getAttribute('stroke-dasharray') || c.style.strokeDasharray,
    computedDasharray: getComputedStyle(c).strokeDasharray,
  }));
});
console.log('DONUT segments:', JSON.stringify(donut, null, 2));

// Caso images: count img inside .caso-img-wrap
const casoImgs = await page.evaluate(() => {
  const wraps = document.querySelectorAll('.caso-img-wrap');
  return Array.from(wraps).map(w => {
    const img = w.querySelector('img');
    return { hasImg: !!img, src: img?.src?.split('/').pop(), complete: img?.complete, naturalWidth: img?.naturalWidth };
  });
});
console.log('CASO IMGS:', JSON.stringify(casoImgs, null, 2));

console.log('404 / FAILED:', JSON.stringify(req404, null, 2));
await browser.close();
