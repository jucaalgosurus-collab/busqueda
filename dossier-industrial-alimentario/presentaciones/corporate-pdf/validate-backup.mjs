import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/_backup-test.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('.slide'));
  return {
    slides: all.length,
    detail: all.map(s => ({ ds: s.dataset.slide, h: Math.round(s.getBoundingClientRect().height) })),
    psGridCols: document.querySelector('.ps-grid') ? getComputedStyle(document.querySelector('.ps-grid')).gridTemplateColumns : 'no grid',
    psGridH: document.querySelector('.ps-grid') ? Math.round(document.querySelector('.ps-grid').getBoundingClientRect().height) : null,
    psCells: document.querySelectorAll('.ps-cell').length
  };
});
console.log('BACKUP r:', JSON.stringify(r, null, 2));

await browser.close();
