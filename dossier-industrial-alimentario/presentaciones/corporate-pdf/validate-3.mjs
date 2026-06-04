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
await page.waitForTimeout(2500);

// 1) Logo present
const logo = await page.evaluate(() => {
  const img = document.querySelector('.topbar .brand img');
  if (!img) return { found: false };
  return {
    found: true,
    src: img.src,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    complete: img.complete,
    visible: img.getBoundingClientRect().width > 0
  };
});

// 2) Click zones present
const zones = await page.evaluate(() => ({
  prev: !!document.getElementById('zonePrev'),
  next: !!document.getElementById('zoneNext'),
  prevRect: document.getElementById('zonePrev')?.getBoundingClientRect(),
  nextRect: document.getElementById('zoneNext')?.getBoundingClientRect(),
}));

// 3) Test click navigation: start at slide 1, click right zone, verify slide 2
await page.evaluate(() => document.querySelector('[data-slide="1"]').scrollIntoView());
await page.waitForTimeout(700);
const slideBefore = await page.evaluate(() => {
  const t = document.querySelector('#ct')?.textContent;
  return t;
});

// Click on right zone (center of the zone at x=1376, y=450)
await page.mouse.click(1376, 450);
await page.waitForTimeout(1200);
const slideAfter = await page.evaluate(() => {
  const t = document.querySelector('#ct')?.textContent;
  const idx = Array.from(document.querySelectorAll('.slide')).findIndex(s => {
    const r = s.getBoundingClientRect();
    return r.top >= -100 && r.top < window.innerHeight/2;
  });
  return { counter: t, currentIndex: idx + 1 };
});

// Click left zone (back to slide 1)
await page.mouse.click(64, 450);
await page.waitForTimeout(1200);
const slideBack = await page.evaluate(() => {
  const t = document.querySelector('#ct')?.textContent;
  const idx = Array.from(document.querySelectorAll('.slide')).findIndex(s => {
    const r = s.getBoundingClientRect();
    return r.top >= -100 && r.top < window.innerHeight/2;
  });
  return { counter: t, currentIndex: idx + 1 };
});

console.log('LOGO:', JSON.stringify(logo, null, 2));
console.log('ZONES:', JSON.stringify(zones, null, 2));
console.log('BEFORE click:', slideBefore);
console.log('AFTER click→:', slideAfter);
console.log('AFTER click←:', slideBack);
console.log('ERRORS:', JSON.stringify(errs, null, 2));

// Screenshot the topbar area
await page.screenshot({ path: './_validate-desktop/topbar-logo.png', clip: { x: 0, y: 0, width: 1440, height: 80 } });

await browser.close();
