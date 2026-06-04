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
  const s5Rect = s5.getBoundingClientRect();
  // Find all elements that have bottom > 900 (below fold)
  const all = s5.querySelectorAll('*');
  const below = [];
  all.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.bottom > 900 && r.height > 0 && r.width > 0) {
      below.push({
        tag: el.tagName,
        cls: el.className?.toString().slice(0, 40),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        txt: el.textContent?.slice(0, 30)
      });
    }
  });
  return { 
    slideH: Math.round(s5Rect.height),
    slideTop: Math.round(s5Rect.top),
    slideBottom: Math.round(s5Rect.bottom),
    belowCount: below.length,
    belowTop5: below.slice(0, 5)
  };
});
console.log('BELOW FOLD:', JSON.stringify(r, null, 2));

await browser.close();
