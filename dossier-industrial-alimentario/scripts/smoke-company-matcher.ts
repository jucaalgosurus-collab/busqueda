// scripts/smoke-company-matcher.ts — Sprint E.14
//
// Smoke test puro del módulo company-matcher (sin DB). Cubre:
//   1. normalizeName: acentos, sufijos legales, case
//   2. slugify: URL-safe, sin acentos
//   3. qualifyAsLarge: cada rama del calificador
//   4. extractNameCandidates: MAYÚSCULAS + Title Case, sin starts de frase
//   5. matchExistingCompany: match exacto normalizado
//   6. classifyMention: link_existing / create_new / skip_pyme / pending_review
//   7. Constants: LARGE_MIN_FACTURACION_M=50, LARGE_MIN_EMPLEADOS=250, LARGE_TIERS=['A','B']
//   8. processAgentMention: con mock Prisma (sin tocar DB real)
//
// Uso: npx tsx scripts/smoke-company-matcher.ts

import {
  normalizeName,
  slugify,
  qualifyAsLarge,
  extractNameCandidates,
  matchExistingCompany,
  classifyMention,
  processAgentMention,
  LARGE_MIN_FACTURACION_M,
  LARGE_MIN_EMPLEADOS,
  LARGE_TIERS,
} from '../lib/scrapers/company-matcher';

let passed = 0;
let failed = 0;
const fails: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function eq<T>(actual: T, expected: T, label: string): void {
  check(label, actual === expected, `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

console.log('\n=== SMOKE E.14: COMPANY MATCHER ===\n');

// 1. Constantes
eq(LARGE_MIN_FACTURACION_M, 50, 'LARGE_MIN_FACTURACION_M=50');
eq(LARGE_MIN_EMPLEADOS, 250, 'LARGE_MIN_EMPLEADOS=250');
eq(JSON.stringify([...LARGE_TIERS]), JSON.stringify(['A', 'B']), 'LARGE_TIERS=[A,B]');

// 2. normalizeName
eq(normalizeName('PASCUAL, S.A.U.'), 'pascual', 'normalize: Pascual S.A.U. → pascual');
eq(normalizeName('Mahou-San Miguel'), 'mahou san miguel', 'normalize: Mahou-San Miguel');
eq(normalizeName('Grupo Damm'), 'damm', 'normalize: Grupo Damm → damm (sufijo "grupo" eliminado)');
eq(normalizeName('Lactalis Iberia, S.L.'), 'lactalis iberia', 'normalize: Lactalis Iberia, S.L.');
eq(normalizeName('  Bimbo  '), 'bimbo', 'normalize: trim + collapse');

// 3. slugify
eq(slugify('PASCUAL, S.A.U.'), 'pascual', 'slugify: Pascual S.A.U. → pascual');
eq(slugify('Nueva Pescanova'), 'nueva-pescanova', 'slugify: Nueva Pescanova → nueva-pescanova');
eq(slugify('Mahou-San Miguel, S.A.'), 'mahou-san-miguel', 'slugify: Mahou-San Miguel, S.A.');

// 4. qualifyAsLarge
{
  const c1 = qualifyAsLarge({ facturacionM: 50 });
  eq(c1.isLarge, true, 'qualify: 50M€ → gran cuenta');
  eq(c1.reason, 'facturacion_ge_50M', 'qualify: 50M€ → facturacion_ge_50M');
}
{
  const c2 = qualifyAsLarge({ facturacionM: 49, empleadosTotal: 300 });
  eq(c2.isLarge, true, 'qualify: 49M€+300empl → gran cuenta (empleados)');
  eq(c2.reason, 'empleados_ge_250', 'qualify: → empleados_ge_250');
}
{
  const c3 = qualifyAsLarge({ tier: 'A' });
  eq(c3.isLarge, true, 'qualify: tier A → gran cuenta');
  eq(c3.reason, 'tier_a_o_b', 'qualify: → tier_a_o_b');
}
{
  const c4 = qualifyAsLarge({ tier: 'B', facturacionM: 5 });
  eq(c4.isLarge, true, 'qualify: tier B gana sobre facturación baja');
}
{
  const c5 = qualifyAsLarge({ tier: 'C' });
  eq(c5.isLarge, false, 'qualify: tier C → pyme');
  eq(c5.reason, 'tier_c_o_d', 'qualify: → tier_c_o_d');
}
{
  const c6 = qualifyAsLarge({ facturacionM: 10, empleadosTotal: 50 });
  eq(c6.isLarge, false, 'qualify: 10M€+50empl → pyme');
  eq(c6.reason, 'facturacion_lt_50M', 'qualify: → facturacion_lt_50M');
}
{
  const c7 = qualifyAsLarge({});
  eq(c7.isLarge, false, 'qualify: sin datos → no gran cuenta');
  eq(c7.needsReview, true, 'qualify: sin datos → needsReview');
  eq(c7.reason, 'unknown_pending_review', 'qualify: → unknown_pending_review');
}

// 5. extractNameCandidates
{
  // El regex exige ≥2 palabras (1 palabra puede ser ERE, ERTE, etc.).
  const text = 'CALIDAD PASCUAL cierra su planta de Aranda. La empresa Grupo Damm confirma ERE temporal. Nueva Pescanova abre mercado.';
  const cands = extractNameCandidates(text);
  check('extract: detecta "CALIDAD PASCUAL"', cands.includes('CALIDAD PASCUAL'), `cands=${cands.join(' | ')}`);
  check('extract: detecta "Grupo Damm"', cands.includes('Grupo Damm'), `cands=${cands.join(' | ')}`);
  check('extract: detecta "Nueva Pescanova"', cands.includes('Nueva Pescanova'), `cands=${cands.join(' | ')}`);
  check('extract: NO detecta "La empresa"', !cands.includes('La empresa'), `cands=${cands.join(' | ')}`);
}

// 6. matchExistingCompany — match EXACTO normalizado (no fuzzy). Si la Company se llama
// "Calidad Pascual, S.A.U." y la mención es "PASCUAL, S.A.U.", NO hay match (es substring).
// Eso es intencional: fuzzy matching introduce falsos positivos y necesita reglas más finas.
{
  const all = [
    { id: 'c1', slug: 'pascual', name: 'Calidad Pascual, S.A.U.', facturacionM: 800, empleadosTotal: 3000, tier: 'A', sector: 'Alimentos y Bebidas' },
    { id: 'c2', slug: 'damm', name: 'Grupo Damm', facturacionM: 1500, empleadosTotal: 4000, tier: 'A', sector: 'Alimentos y Bebidas' },
  ];
  const m1 = matchExistingCompany('Calidad Pascual, S.A.U.', all);
  eq(m1?.id, 'c1', 'match: Calidad Pascual, S.A.U. → c1 (exacto)');
  const m2 = matchExistingCompany('Grupo Damm', all);
  eq(m2?.id, 'c2', 'match: Grupo Damm → c2');
  const m3 = matchExistingCompany('Lactalis', all);
  eq(m3, null, 'match: Lactalis no existe → null');
  // Substring NO matchea (regla dura)
  const m4 = matchExistingCompany('PASCUAL', all);
  eq(m4, null, 'match: PASCUAL solo (substring) → null (intencional)');
}

// 7. classifyMention — link a existente gran cuenta
{
  const all = [
    { id: 'c1', slug: 'pascual', name: 'PASCUAL', facturacionM: 800, empleadosTotal: 3000, tier: 'A', sector: 'Alimentos y Bebidas' },
    { id: 'c2', slug: 'forjadelta', name: 'Forja Delta S.L.', facturacionM: 8, empleadosTotal: 80, tier: 'C', sector: 'Industria en General' },
  ];
  const a1 = classifyMention({ rawName: 'PASCUAL', existing: all });
  eq(a1.kind, 'link_to_existing', 'classify: PASCUAL (gran cuenta) → link_to_existing');
  if (a1.kind === 'link_to_existing') eq(a1.companyId, 'c1', 'classify: PASCUAL → c1');

  const a2 = classifyMention({ rawName: 'Forja Delta S.L.', existing: all });
  eq(a2.kind, 'skip_pyme', 'classify: Forja Delta (pyme tier C) → skip_pyme');
  if (a2.kind === 'skip_pyme') eq(a2.reason, 'tier_c_o_d', 'classify: → tier_c_o_d');

  // No existe, con SizeHints verificados gran cuenta
  const a3 = classifyMention({
    rawName: 'Nueva Empresa Grande S.A.',
    sizeHints: { facturacionM: 200, empleadosTotal: 500, sector: 'Alimentos y Bebidas' },
  });
  eq(a3.kind, 'create_new', 'classify: 200M€+500empl sin match → create_new');
  if (a3.kind === 'create_new') {
    eq(a3.suggestedSlug, 'nueva-empresa-grande', 'classify: slug sugerido');
    eq(a3.suggestedSector, 'Alimentos y Bebidas', 'classify: sector sugerido');
  }

  // No existe, sin SizeHints → pending_review
  const a4 = classifyMention({ rawName: 'Empresa Misteriosa' });
  eq(a4.kind, 'pending_review', 'classify: sin datos → pending_review');
  if (a4.kind === 'pending_review') {
    eq(a4.suggestedSlug, 'empresa-misteriosa', 'classify: slug pendiente');
  }

  // No existe, con SizeHints pyme → skip_pyme
  const a5 = classifyMention({
    rawName: 'Pequeña S.L.',
    sizeHints: { facturacionM: 2, empleadosTotal: 20 },
  });
  eq(a5.kind, 'skip_pyme', 'classify: 2M€+20empl sin match → skip_pyme');
  if (a5.kind === 'skip_pyme') eq(a5.reason, 'facturacion_lt_50M', 'classify: → facturacion_lt_50M');
}

// 8. processAgentMention — auto-amplify (con PrismaClient mockeado)
{
  // Mock Prisma: solo necesita findMany, findUnique, create
  const makeMock = (companies: { id: string; slug: string; name: string }[]) => {
    const bySlug = new Map(companies.map((c) => [c.slug, c]));
    return {
      company: {
        findMany: async () => companies,
        findUnique: async ({ where }: { where: { slug: string } }) => bySlug.get(where.slug) ?? null,
        create: async ({ data }: { data: { slug: string; name: string; sector: string } }) => {
          const id = `new-${data.slug}`;
          const c = { id, slug: data.slug, name: data.name };
          bySlug.set(data.slug, c);
          return c;
        },
      },
    } as never;
  };

  // 8a) match con existente → linked
  {
    const mock = makeMock([{ id: 'c1', slug: 'pascual', name: 'PASCUAL' }]);
    const r = await processAgentMention(mock, 'PASCUAL', 'prensa-sectorial');
    eq(r.action, 'linked', 'amplify: PASCUAL matchea existente → linked');
    eq(r.companyId, 'c1', 'amplify: → c1');
  }

  // 8b) match con existente en forma normalizada (sufijo legal)
  {
    const mock = makeMock([{ id: 'c1', slug: 'pascual', name: 'Pascual, S.A.U.' }]);
    const r = await processAgentMention(mock, 'PASCUAL, S.A.U.', 'prensa-sectorial');
    eq(r.action, 'linked', 'amplify: PASCUAL, S.A.U. matchea Pascual, S.A.U. → linked');
  }

  // 8c) NO existe → crea como tier='B'
  // slugify('Nueva Compañía Grande S.A.') = 'nueva-grande' porque el
  // LEGAL_SUFFIXES_RE incluye "compañia" y se elimina.
  {
    const mock = makeMock([]);
    const r = await processAgentMention(mock, 'Nueva Compañía Grande S.A.', 'prensa-sectorial');
    eq(r.action, 'created', 'amplify: nombre nuevo → created');
    eq(r.suggestedSlug, 'nueva-grande', 'amplify: slug sugerido (sufijo "compañía" eliminado)');
  }

  // 8d) slug ya existe (otra Company, name distinto) → already_known (no
  // match normalizado, pero slug colisiona). NO crea duplicado.
  {
    const mock = makeMock([{ id: 'c1', slug: 'foo', name: 'Otro Nombre' }]);
    const r = await processAgentMention(mock, 'Foo', 'prensa-sectorial');
    eq(r.action, 'already_known', 'amplify: match por slug → already_known (no duplicate)');
    eq(r.companyId, 'c1', 'amplify: → c1 (por slug)');
  }

  // 8e) nombre vacío → invalid_name
  {
    const mock = makeMock([]);
    const r = await processAgentMention(mock, '  ', 'prensa-sectorial');
    eq(r.action, 'invalid_name', 'amplify: nombre vacío → invalid_name');
  }

  // 8f) caracteres que no producen slug → invalid_name
  {
    const mock = makeMock([]);
    const r = await processAgentMention(mock, '###', 'prensa-sectorial');
    eq(r.action, 'invalid_name', 'amplify: solo símbolos → invalid_name');
  }

  // 8g) defaultSector custom
  {
    let captured = '';
    const mock = {
      company: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async ({ data }: { data: { sector: string } }) => {
          captured = data.sector;
          return { id: 'x', slug: 'y', name: 'Y' };
        },
      },
    } as never;
    const r = await processAgentMention(mock, 'Industrial XYZ', 'prensa-sectorial', 'Industria Auxiliar');
    eq(r.action, 'created', 'amplify: defaultSector custom → created');
    eq(captured, 'Industria Auxiliar', 'amplify: sector custom se aplica');
  }
}

console.log(`\n=== ${passed} PASS, ${failed} FAIL ===`);
if (failed > 0) {
  console.log('\nFALLAS:');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
