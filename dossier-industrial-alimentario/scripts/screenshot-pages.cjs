// Screenshot rápido de las vistas clave del dossier
const { chromium } = require('C:/Users/JUAN CARLOS/Documents/MarketingSkils/node_modules/playwright');
const fs = require('fs');

const PAGES = [
  { name: 'dashboard', path: '/' },
  { name: 'hallazgos', path: '/hallazgos' },
  { name: 'empresas', path: '/empresas' },
  { name: 'empresas-pescanova', path: '/empresas/pescanova' },
  { name: 'empresas-azucarera', path: '/empresas/azucarera' },
  { name: 'contactos', path: '/contactos' },
  { name: 'agentes', path: '/agentes' },
  { name: 'mocr', path: '/mocr' },
];

(async () => {
  const outDir = 'C:/Users/JUAN CARLOS/Documents/ECCSystem/dossier-industrial-alimentario/screenshots';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const p of PAGES) {
    const url = `https://88-198-93-52.nip.io/dossier${p.path}`;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const status = resp ? resp.status() : 'no-resp';
      await page.screenshot({ path: `${outDir}/${p.name}.png`, fullPage: true });
      console.log(`  ${status}  ${p.name}  ${url}`);
    } catch (e) {
      console.log(`  ERR  ${p.name}  ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
})();
