import { chromium } from 'playwright';
import fs from 'fs';

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

const data = await page.evaluate(() => {
  const ico = document.querySelectorAll('.met-ico');
  const icons = Array.from(ico).map(s => {
    const r = s.getBoundingClientRect();
    const grad = s.querySelector('linearGradient');
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      visible: r.width > 0 && r.height > 0,
      hasGradient: !!grad,
      gradientId: grad ? grad.id : null,
      fillAreas: s.querySelectorAll('[fill^="url(#s11-grad-ico"]').length,
      hasShadow: !!s.querySelector('filter')
    };
  });
  const slidesCount = document.querySelectorAll('.slide').length;
  const certs = document.querySelectorAll('.s11-cert').length;
  const macros = document.querySelectorAll('.s11-macro').length;
  const macroBand = document.querySelector('.s11-macro-band') !== null;
  const testimonies = document.querySelectorAll('.ps-cell').length;
  const h1DisplayEm = document.querySelector('h1.display em')?.textContent;
  const slideData = Array.from(document.querySelectorAll('.slide')).map(s => s.dataset.slide);
  const counter = document.getElementById('ct');
  const totalText = counter ? counter.parentElement.querySelector('span')?.textContent.trim() : null;

  return { icons, slidesCount, slideData, certs, macros, macroBand, testimonies, h1DisplayEm, totalText };
});

const checks = {
  C01_iconsTotal10: data.icons.length === 10,
  C02_iconsVisible: data.icons.every(i => i.visible),
  C03_iconsHaveGradient: data.icons.every(i => i.hasGradient),
  C04_iconsFillDominant: data.icons.every(i => i.fillAreas >= 1),
  C05_iconsShadow: data.icons.every(i => i.hasShadow),
  C06_gradientIdsUnique: new Set(data.icons.map(i => i.gradientId)).size === 10,
  C07_icons38x38: data.icons.every(i => i.w === 38 && i.h === 38),
  C08_iconsAriaHidden: await page.evaluate(() =>
    Array.from(document.querySelectorAll('.met-ico')).every(s => s.getAttribute('aria-hidden') === 'true')
  ),
  C09_415KUsers: await page.evaluate(() => document.body.textContent.includes('415.000')),
  C10_240KSubastas: await page.evaluate(() => document.body.textContent.includes('240.000')),
  C11_155M: await page.evaluate(() => document.body.textContent.includes('1,55 M')),
  C12_BodegaCasalobos: await page.evaluate(() => document.body.textContent.includes('Bodega')),
  C13_SubastasVerificadas: await page.evaluate(() => document.body.textContent.includes('415K')),
  C14_Fricarne150k: await page.evaluate(() => document.body.textContent.includes('150.000')),
  C15_Cuniporc62k: await page.evaluate(() => document.body.textContent.includes('62.500')),
  C16_Pepsi3600: await page.evaluate(() => document.body.textContent.includes('3.600')),
  C17_macroBand8: data.macroBand && data.macros === 8,
  C18_macro400M: await page.evaluate(() => document.body.textContent.includes('+400 M')),
  C19_certs8: data.certs === 8,
  C20_certISO14001: await page.evaluate(() => document.body.textContent.includes('ISO 14001')),
  C21_certEcoVadis: await page.evaluate(() => document.body.textContent.includes('EcoVadis Silver')),
  C22_testimonios10: data.testimonies === 10,
  C23_AnaVilluendas: await page.evaluate(() => document.body.textContent.includes('Ana Villuendas')),
  C24_LorenzoLopez: await page.evaluate(() => document.body.textContent.includes('Lorenzo López')),
  C25_GalindoCardiel: await page.evaluate(() => document.body.textContent.includes('Galindo Cardiel')),
  C26_slidesCount13: data.slidesCount === 13,
  C27_noConsoleErrors: errs.length === 0,
  C28_counterTotal: data.totalText === '/ 13',
  C29_h1EmCorrect: await page.evaluate(() => {
    // Test the hero h1.display em (Valorización) and CTA cta-h em (Cuándo)
    const heroEm = document.querySelector('h1.display em')?.textContent;
    const ctaEm = document.querySelector('.cta-h em')?.textContent;
    return heroEm === 'Valorización' && ctaEm === 'Cuándo';
  }),
  C30_no404Images: !errs.some(e => e.startsWith('404'))
};

console.log('=== S11 LOCAL VALIDATION ===');
console.log(JSON.stringify({ data, checks, errors: errs }, null, 2));

// Screenshots
if (!fs.existsSync('./_validate-desktop')) fs.mkdirSync('./_validate-desktop');

await page.evaluate(() => {
  const slide = document.querySelector('[data-slide="6"]');
  if (slide) slide.scrollIntoView({ behavior: 'instant' });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/s11-slide5-iconos-macros.png', fullPage: false });

await page.evaluate(() => {
  const slide = document.querySelector('[data-slide="8"]');
  if (slide) slide.scrollIntoView({ behavior: 'instant' });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/s11-slide15-certs.png', fullPage: false });

await page.evaluate(() => {
  const slide = document.querySelector('[data-slide="12"]');
  if (slide) slide.scrollIntoView({ behavior: 'instant' });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: './_validate-desktop/s11-slide16-testimonios.png', fullPage: false });

// Close-up of icon 1
await page.evaluate(() => {
  const slide = document.querySelector('[data-slide="6"]');
  if (slide) slide.scrollIntoView({ behavior: 'instant' });
});
await page.waitForTimeout(1500);
const icon = await page.locator('.met-ico').first();
if (await icon.count() > 0) {
  await icon.screenshot({ path: './_validate-desktop/s11-icon-01-tasacion.png' });
}

await browser.close();

// Exit code based on PASS/FAIL
const passed = Object.values(checks).filter(v => v === true).length;
const total = Object.keys(checks).length;
console.log(`\n=== S11 SUMMARY: ${passed}/${total} checks PASSED ===`);
const failed = Object.entries(checks).filter(([k, v]) => !v);
if (failed.length) {
  console.log('FAILED:');
  failed.forEach(([k, v]) => console.log(`  - ${k}: ${v}`));
  process.exit(1);
}
process.exit(0);
