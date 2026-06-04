import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/SURUS-Alimentacion-Bebidas-2026.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(5000);

const r = await page.evaluate(() => {
  return {
    nodeCount: document.querySelectorAll('*').length,
    slides: document.querySelectorAll('.slide').length,
  };
});
console.log('current r:', JSON.stringify(r));

await browser.close();
