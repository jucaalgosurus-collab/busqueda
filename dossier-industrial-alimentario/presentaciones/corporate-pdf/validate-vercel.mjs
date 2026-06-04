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

await page.goto('https://alimentos-ten.vercel.app/SURUS-Alimentacion-Bebidas-2026', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('.slide'));
  return all.map(s => ({ ds: s.dataset.slide, h: Math.round(s.getBoundingClientRect().height), overflows: s.getBoundingClientRect().height > window.innerHeight }));
});
console.log('VERCEL slides:', JSON.stringify(r, null, 2));
console.log('errs:', errs);

await page.evaluate(() => document.querySelector('[data-slide="5"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/EV-vercel-slide5.png', fullPage: false });

await browser.close();
