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
await page.screenshot({ path: './_validate-desktop/EV-slide5-full.png', fullPage: true });

await page.evaluate(() => document.querySelector('[data-slide="16"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/EV-slide16-full.png', fullPage: true });

console.log('done');
await browser.close();
