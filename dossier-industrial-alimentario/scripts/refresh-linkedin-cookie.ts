// scripts/refresh-linkedin-cookie.ts — Login manual para extraer li_at al perfil persistente.
//
// Uso: xvfb-run -a npx tsx scripts/refresh-linkedin-cookie.ts
// (en el VPS, donde Xvfb está disponible — abre un browser visible para hacer login).
// Tras login, lee li_at del perfil persistente y lo imprime para guardarlo en .env.

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const PROFILE_DIR = process.env.LINKEDIN_PROFILE_DIR ?? '/opt/hermes-dossier/.linkedin-profile/linkedin-storage';
const ENV_PATH = process.env.HERMES_ENV_PATH ?? '/opt/hermes-dossier/.env';

async function main() {
  if (!existsSync(PROFILE_DIR)) {
    await mkdir(PROFILE_DIR, { recursive: true });
    console.log(`[refresh-cookie] creado perfil: ${PROFILE_DIR}`);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false, // mostrar para que el operador pueda hacer login
    args: ['--no-sandbox'],
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    viewport: { width: 1366, height: 768 },
  });

  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  console.log('[refresh-cookie] browser abierto. Haz login manualmente y luego cierra esta ventana o pulsa Enter aquí.');

  // Esperar a que li_at aparezca en las cookies
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(1000);
    const cookies = await context.cookies();
    const liAt = cookies.find((c) => c.name === 'li_at');
    if (liAt && liAt.value.length > 20) {
      console.log('[refresh-cookie] li_at detectada tras', i + 1, 's');
      console.log(`LINKEDIN_LI_AT="${liAt.value}"`);

      // Volcar a un fichero de sugerencia para .env (NO sobreescribe, sólo append al final)
      const suggestionPath = `${ENV_PATH}.linkedin-suggestion`;
      await writeFile(suggestionPath, `\n# Sugerido por refresh-linkedin-cookie (${new Date().toISOString()})\nLINKEDIN_LI_AT="${liAt.value}"\n`, { mode: 0o600 });
      console.log(`[refresh-cookie] valor sugerido guardado en: ${suggestionPath}`);
      console.log('[refresh-cookie] Cópialo manualmente a .env o ejecuta:');
      console.log(`  grep -v '^LINKEDIN_LI_AT=' ${ENV_PATH} > ${ENV_PATH}.tmp && cat ${suggestionPath} >> ${ENV_PATH}.tmp && mv ${ENV_PATH}.tmp ${ENV_PATH} && chmod 600 ${ENV_PATH}`);
      break;
    }
  }

  console.log('[refresh-cookie] cerrando browser en 5s...');
  await page.waitForTimeout(5000);
  await context.close();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
