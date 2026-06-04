import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('file:///C:/Users/JUAN%20CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/presentaciones/corporate-pdf/SURUS-Alimentacion-Bebidas-2026.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

await page.evaluate(() => document.querySelector('[data-slide="5"]')?.scrollIntoView({behavior: 'instant'}));
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const s5 = document.querySelector('[data-slide="5"]');
  const s5Top = s5.getBoundingClientRect().top;
  const title = s5.querySelector('.metodo-title.bonus');
  const bonus = s5.querySelectorAll('.metodo-flow.bonus .met-step .met-t');
  const bonusTexts = Array.from(bonus).map(b => {
    const r = b.getBoundingClientRect();
    return { text: b.textContent, top: Math.round(r.top - s5Top), bottom: Math.round(r.bottom - s5Top) };
  });
  return {
    slideHeight: Math.round(s5.getBoundingClientRect().height),
    s5Top: Math.round(s5Top),
    bonusTitleTop: title ? Math.round(title.getBoundingClientRect().top - s5Top) : null,
    bonusTexts
  };
});
console.log('BONUS positions:', JSON.stringify(r, null, 2));

await browser.close();
