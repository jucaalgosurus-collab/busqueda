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
  const bonusIcos = s5.querySelectorAll('.metodo-flow.bonus .met-ico');
  const bonusIcoPositions = Array.from(bonusIcos).map((ico, i) => {
    const r = ico.getBoundingClientRect();
    return { i, top: Math.round(r.top - s5Top), bottom: Math.round(r.bottom - s5Top), visible: r.top < 900 && r.bottom > 0 };
  });
  const macBand = s5.querySelector('.s11-macro-band');
  const macTop = macBand ? Math.round(macBand.getBoundingClientRect().top - s5Top) : null;
  const macBottom = macBand ? Math.round(macBand.getBoundingClientRect().bottom - s5Top) : null;
  const title = s5.querySelector('.metodo-title:not(.bonus)');
  const titleTop = title ? Math.round(title.getBoundingClientRect().top - s5Top) : null;
  return {
    slideHeight: Math.round(s5.getBoundingClientRect().height),
    slideBottom: Math.round(s5.getBoundingClientRect().bottom - s5Top),
    mainTitleTop: titleTop,
    macBand: { top: macTop, bottom: macBottom, visible: macTop < 900 && macBottom > 0 },
    bonusIcons: bonusIcoPositions
  };
});
console.log('BONUS ico positions:', JSON.stringify(r, null, 2));

await browser.close();
