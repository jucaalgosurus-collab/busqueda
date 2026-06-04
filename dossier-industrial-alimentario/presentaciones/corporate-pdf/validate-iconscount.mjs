import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/SURUS-Alimentacion-Bebidas-2026.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(() => {
  const s = document.querySelector('[data-slide="5"]');
  const core = s.querySelectorAll('.metodo-flow:not(.bonus) .met-step');
  const bonus = s.querySelectorAll('.metodo-flow.bonus .met-step');
  const allIcons = s.querySelectorAll('.met-ico');
  return {
    coreCount: core.length,
    bonusCount: bonus.length,
    totalIcons: allIcons.length,
    coreLabels: Array.from(core).map(s => s.querySelector('.met-t')?.textContent),
    bonusLabels: Array.from(bonus).map(s => s.querySelector('.met-t')?.textContent),
  };
});
console.log('CURRENT slide 5 icons:', JSON.stringify(r, null, 2));

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/_backup-test.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const r2 = await page.evaluate(() => {
  const s = document.querySelector('[data-slide="5"]');
  const core = s.querySelectorAll('.metodo-flow:not(.bonus) .met-step');
  const bonus = s.querySelectorAll('.metodo-flow.bonus .met-step');
  return {
    coreCount: core.length,
    bonusCount: bonus.length,
    coreLabels: Array.from(core).map(s => s.querySelector('.met-t')?.textContent),
    bonusLabels: Array.from(bonus).map(s => s.querySelector('.met-t')?.textContent),
  };
});
console.log('BACKUP slide 5 icons:', JSON.stringify(r2, null, 2));

await browser.close();
