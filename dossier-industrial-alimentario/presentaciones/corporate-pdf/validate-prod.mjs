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

const url = 'https://alimentos-ten.vercel.app/SURUS-Alimentacion-Bebidas-2026';
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Jump to slide 5
await page.evaluate(() => {
  const slide = document.querySelector('[data-slide="5"]');
  if (slide) slide.scrollIntoView({ behavior: 'instant' });
});
await page.waitForTimeout(2000);

// Verify all 10 icons present
const icons = await page.evaluate(() => {
  const ico = document.querySelectorAll('.met-ico');
  return {
    count: ico.length,
    allVisible: Array.from(ico).every(s => {
      const r = s.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }),
    colors: Array.from(ico).map(s => getComputedStyle(s).color)
  };
});

// Verify other slides intact (counts)
const slidesCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
const heroText = await page.evaluate(() => document.querySelector('h1.display em')?.textContent);
const counter = await page.evaluate(() => document.querySelector('#ct')?.textContent);

console.log('=== PRODUCTION DEPLOY VERIFICATION ===');
console.log('URL:', url);
console.log('Slides count:', slidesCount);
console.log('Hero slogan em:', heroText);
console.log('Slide counter:', counter);
console.log('Icons (slide 5):', JSON.stringify(icons, null, 2));
console.log('ERRORS:', JSON.stringify(errs, null, 2));

// Screenshot slide 5 production
const slideBox = await page.evaluate(() => {
  const el = document.querySelector('[data-slide="5"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: 0, y: Math.round(r.y), w: 1440, h: 900 };
});
if (slideBox) {
  await page.screenshot({
    path: './_validate-desktop/prod-slide-5.png',
    clip: { x: 0, y: Math.max(0, slideBox.y), width: 1440, height: 900 }
  });
}

// Full page screenshot
await page.screenshot({ path: './_validate-desktop/prod-full.png', fullPage: false });

await browser.close();
