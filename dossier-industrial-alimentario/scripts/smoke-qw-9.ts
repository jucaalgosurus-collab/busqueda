// scripts/smoke-qw-9.ts — QW-9: smoke test del panel outreach oculto.
//
// Verifica los 10 entregables del sprint sin necesidad de DB:
//  1. lib/email/personalize.ts exporta funciones puras
//  2. seedForContact es determinista (mismo input → mismo seed)
//  3. seedForChannel produce seeds distintos por canal
//  4. seedForChannel(seed, 'email') === seed
//  5. FORBIDDEN_PHRASES detecta "estimado/a" + "quedo a su disposici[oó]n"
//  6. passesToneCheck rechaza frases IA prohibidas
//  7. passesToneCheck acepta texto limpio
//  8. MAX_WORDS respeta los límites por canal
//  9. lib/ia/email-generator.ts tiene generateAllVariants exportado
// 10. Navbar NO contiene enlaces a /admin/outreach (panel oculto)

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  seedForContact,
  seedForChannel,
  passesToneCheck,
  FORBIDDEN_PHRASES,
  buildPrompt,
  MAX_WORDS,
  type PromptVars,
  type PainPoint,
} from '../lib/email/personalize';
import { listTemplates, type EmailTemplate } from '../lib/email/render';
import { generateAllVariants, type EmailGeneratorInput } from '../lib/ia/email-generator';

const ROOT = resolve(import.meta.dirname, '..');
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Assert 1: personalize.ts exporta las funciones esperadas ───────────────
console.log('\n[1] Exportaciones personalize.ts');
assert('seedForContact exportado', typeof seedForContact === 'function');
assert('seedForChannel exportado', typeof seedForChannel === 'function');
assert('passesToneCheck exportado', typeof passesToneCheck === 'function');
assert('buildPrompt exportado', typeof buildPrompt === 'function');
assert('FORBIDDEN_PHRASES es array', Array.isArray(FORBIDDEN_PHRASES) && FORBIDDEN_PHRASES.length > 0);
assert('MAX_WORDS cubre 3 canales', MAX_WORDS.email > 0 && MAX_WORDS.linkedin_dm_short > 0 && MAX_WORDS.linkedin_dm_long > 0);

// ── Assert 2-3: determinismo + variación por canal ─────────────────────────
console.log('\n[2-3] Seed determinista');
const seedA = seedForContact('co1', 'ct1', 'Alimentos y Bebidas', 'Director de Planta');
const seedB = seedForContact('co1', 'ct1', 'Alimentos y Bebidas', 'Director de Planta');
assert('mismo input → mismo seed', seedA === seedB, `A=${seedA} B=${seedB}`);

const seedC = seedForContact('co1', 'ct2', 'Alimentos y Bebidas', 'Director de Planta');
assert('distinto decisor → distinto seed', seedA !== seedC, `A=${seedA} C=${seedC}`);

// ── Assert 4: seedForChannel(email) no desplaza ────────────────────────────
console.log('\n[4] seedForChannel email = base');
assert('seedForChannel(seed, email) === seed', seedForChannel(seedA, 'email') === seedA);

// ── Assert 5-7: tone check contra frases prohibidas ────────────────────────
console.log('\n[5-7] Tone check');
assert(
  'rechaza "estimado/a"',
  !passesToneCheck('Estimado/a señor García, me pongo en contacto'),
);
assert(
  'rechaza "quedo a su disposición"',
  !passesToneCheck('Le escribo desde Surus y quedo a su disposición para lo que necesite'),
);
assert(
  'rechaza "no dude en"',
  !passesToneCheck('No dude en contactarme si tiene alguna pregunta'),
);
assert(
  'acepta texto limpio',
  passesToneCheck('Vi la nota sobre Tres Cantos y me parece relevante. ¿Hablamos esta semana?'),
);
assert(
  'acepta texto con superlativos controlados',
  passesToneCheck('Somos una empresa con experiencia en desimplantación técnica.'),
);

// ── Assert 8: MAX_WORDS consistente ────────────────────────────────────────
console.log('\n[8] MAX_WORDS límites por canal');
assert('email ≤ 130 palabras', MAX_WORDS.email === 130);
assert('linkedin_dm_short ≤ 50 palabras', MAX_WORDS.linkedin_dm_short === 50);
assert('linkedin_dm_long ≤ 90 palabras', MAX_WORDS.linkedin_dm_long === 90);

// ── Assert 9: generateAllVariants disponible y genera 3 borradores ─────────
console.log('\n[9] generateAllVariants (MOCK mode, no API call)');
const tpls = listTemplates();
assert('hay 8+ plantillas cargadas', tpls.length >= 8, `count=${tpls.length}`);

const mockInput: EmailGeneratorInput = {
  company: { id: 'co-smoke', name: 'Pescanova', slug: 'pescanova', sector: 'Alimentos y Bebidas', subsector: 'Pescado congelado' },
  contact: {
    id: 'ct-smoke',
    fullName: 'María Test',
    role: 'Director de Planta',
    roleCategory: 'plant_manager',
    email: 'maria@example.com',
    linkedinUrl: 'https://linkedin.com/in/test',
    plant: { name: 'Vigo', city: 'Vigo' },
  },
  templateId: 'auto',
  forceMock: true,
};
const drafts = await generateAllVariants(mockInput);
assert('generateAllVariants devuelve 3 borradores', drafts.length === 3, `count=${drafts.length}`);
assert('canal email presente', drafts.some((d) => d.channel === 'email'));
assert('canal linkedin_dm_short presente', drafts.some((d) => d.channel === 'linkedin_dm_short'));
assert('canal linkedin_dm_long presente', drafts.some((d) => d.channel === 'linkedin_dm_long'));
assert('usedFallback=true en mock', drafts.every((d) => d.usedFallback));
assert('hash determinista (SHA-256, 64 chars)', drafts.every((d) => d.hash.length === 64));
assert(
  'linkedin_dm_short ≤ 300 chars',
  drafts.find((d) => d.channel === 'linkedin_dm_short')!.body.length <= 300,
);
assert(
  'linkedin_dm_long ≤ 600 chars',
  drafts.find((d) => d.channel === 'linkedin_dm_long')!.body.length <= 600,
);
assert(
  'no contiene {{vars}} sin sustituir',
  drafts.every((d) => !/\{\{[a-z_]+\}\}/i.test(d.subject) && !/\{\{[a-z_]+\}\}/i.test(d.body)),
);

// ── Assert 10: Navbar NO contiene /admin/outreach (panel oculto) ────────────
console.log('\n[10] Panel oculto en Navbar');
const navbarPath = resolve(ROOT, 'components/Navbar.tsx');
if (existsSync(navbarPath)) {
  const navbarSrc = readFileSync(navbarPath, 'utf-8');
  assert(
    'Navbar.tsx NO contiene /admin/outreach',
    !navbarSrc.includes('/admin/outreach'),
  );
  assert(
    'Navbar.tsx NO contiene "Outreach" como label',
    !navbarSrc.match(/['"`]Outreach['"`]/i),
  );
} else {
  assert('Navbar.tsx existe', false, `ruta: ${navbarPath}`);
}

// ── Assert 11 (extra): buildPrompt incluye reglas duras ────────────────────
console.log('\n[11] buildPrompt incluye checklist de tono');
const samplePain: PainPoint[] = [
  { date: '2026-04-12', title: 'Anuncio ERE 80 personas', outlet: 'El País', signalStrength: 'strong', url: 'https://example.com/1' },
];
const prompt = buildPrompt({
  empresa: 'Pescanova',
  cargo: 'Director de Planta',
  sector: 'Alimentos y Bebidas',
  planta: 'Vigo',
  ciudad: 'Vigo',
  painPoints: samplePain,
  channel: 'email',
  seed: 42,
  presentacion: 'Soy Juan Carlos, de Surus.',
});
assert('prompt menciona "REGLAS DURAS"', prompt.includes('REGLAS DURAS'));
assert('prompt menciona "estimado/a" como prohibido', /estimado\/a/i.test(prompt));
assert('prompt menciona pain point', prompt.includes('Anuncio ERE 80 personas'));
assert('prompt incluye seed', prompt.includes('42'));
assert('prompt limita palabras email ≤ 120', prompt.includes('120 palabras'));

// ── Assert 12 (extra): route generate existe + copied existe ──────────────
console.log('\n[12] Endpoints API');
const generateRoute = resolve(ROOT, 'app/api/admin/outreach/generate/route.ts');
const copiedRoute = resolve(ROOT, 'app/api/admin/outreach/copied/route.ts');
const byCompanyRoute = resolve(ROOT, 'app/api/contactos/by-company/route.ts');
const logPage = resolve(ROOT, 'app/admin/outreach/log/page.tsx');
const client = resolve(ROOT, 'app/admin/outreach/OutreachClient.tsx');
assert('POST /api/admin/outreach/generate existe', existsSync(generateRoute));
assert('POST /api/admin/outreach/copied existe', existsSync(copiedRoute));
assert('GET  /api/contactos/by-company existe', existsSync(byCompanyRoute));
assert('/admin/outreach/log page existe', existsSync(logPage));
assert('OutreachClient.tsx existe', existsSync(client));

// ── Resumen ────────────────────────────────────────────────────────────────
console.log(`\n=== QW-9 SMOKE: ${passed} pass / ${failed} fail ===`);
if (failed > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('\nTODOS LOS ASSERTS VERDES — QW-9 listo para sync VPS');
  process.exit(0);
}
