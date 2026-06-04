import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/_backup-test.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const s5 = await page.evaluate(() => {
  const s = document.querySelector('[data-slide="5"]');
  return {
    h: Math.round(s.getBoundingClientRect().height),
    overflows: s.getBoundingClientRect().height > 900,
    metStepCount: s.querySelectorAll('.met-step').length,
    bonusIco: s.querySelectorAll('.metodo-flow.bonus .met-step').length,
    titleTop: s.querySelector('.metodo-title')?.getBoundingClientRect().top
  };
});
console.log('BACKUP slide 5:', JSON.stringify(s5, null, 2));

await browser.close();
