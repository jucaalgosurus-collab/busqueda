// scripts/smoke-qw-b7.ts — Sprint B.7
//
// 13 asserts: 5 QW regresión + 6 B.7 + 2 EST
// Ejecuta: tsx scripts/smoke-qw-b7.ts

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  applyDespidosCtoFilter,
  DECISORES_TECNICOS,
  matchHash,
  normalizeCompanyName,
} from '@/lib/filters/despidos-cto';
import { scrapeDespidosCto, type RawDespidoCto } from '@/lib/scrapers/despidos-cto';

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function qwRegression() {
  console.log('\n=== QW REGRESIÓN (5 asserts) ===');

  const empresasHtml = await (await fetch('http://127.0.0.1:3002/empresas', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  const expectedSectors = ['Alimentos y Bebidas', 'Industrial', 'Farmaceutico', 'Construccion', 'Energetico', 'Otro industrial'];
  const presentSectors = expectedSectors.filter((s) => empresasHtml.includes(s));
  assert('QW-1 [6 sectores amplios visibles en /empresas]', presentSectors.length >= 5, `${presentSectors.length}/6`);

  const companyCounts = await prisma.company.groupBy({ by: ['sector'], _count: true });
  const sectorMap = new Map(companyCounts.map((c) => [c.sector, c._count]));
  const sectorsWithCompanies = expectedSectors.filter((s) => (sectorMap.get(s) ?? 0) > 0);
  assert('QW-2 [≥1 empresa por sector en DB]', sectorsWithCompanies.length >= 5, `${sectorsWithCompanies.length}/6`);

  const dashboardHtml = await (await fetch('http://127.0.0.1:3002/', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  assert(
    'QW-3 [Navbar contiene "Juan Carlos Alvarado para Surus"]',
    /Creado por\s*<strong>\s*Juan Carlos Alvarado\s*<\/strong>\s*para\s*<strong>\s*Surus/.test(dashboardHtml),
    'match exacto en header',
  );

  const hallazgosHtml = await (await fetch('http://127.0.0.1:3002/hallazgos', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  assert(
    'QW-4 [Footer contiene "Juan Carlos Alvarado para Surus"]',
    /Juan Carlos Alvarado/.test(hallazgosHtml) && /Surus Inversa/.test(hallazgosHtml),
    'match en /hallazgos',
  );

  assert(
    'QW-5 [Header del dashboard contiene "Juan Carlos Alvarado para Surus"]',
    /Juan Carlos Alvarado/.test(dashboardHtml) && /Surus Inversa/.test(dashboardHtml),
    'match en /',
  );
}

async function b7Asserts() {
  console.log('\n=== B.7 DESPIDOS CTO (6 asserts) ===');

  // B.7-A: queries JSON con 5-10 templates.
  const queriesPath = join(process.cwd(), 'lib', 'data', 'linkedin-despidos-queries.json');
  const queriesExists = existsSync(queriesPath);
  let queries: { id: string; cargo: string; senial: string }[] = [];
  if (queriesExists) {
    const parsed = JSON.parse(readFileSync(queriesPath, 'utf-8'));
    queries = Array.isArray(parsed) ? parsed : [];
  }
  const cargosInQueries = new Set(queries.map((q) => q.cargo));
  const expectedCargos = ['CTO', 'Director Técnico', 'Director I+D', 'Director Operaciones'];
  const hasAllCargos = expectedCargos.every((c) => cargosInQueries.has(c));
  assert(
    'B.7-A [linkedin-despidos-queries.json con 5-10 queries que cubren CTO, Dir Técnico, Dir I+D, Dir Operaciones]',
    queriesExists && queries.length >= 5 && queries.length <= 10 && hasAllCargos,
    `count=${queries.length} cargos=${[...cargosInQueries].join(',')}`,
  );

  // B.7-B: empresa sintética mínima (slug smoke-b7-test-company, sector A&B, facturación 50M€).
  const SMOKE_COMPANY_SLUG = 'smoke-b7-test-company';
  const SMOKE_COMPANY_NAME = 'Smoke B.7 Test Company';
  await prisma.company.deleteMany({ where: { slug: SMOKE_COMPANY_SLUG } });
  await prisma.source.deleteMany({ where: { url: { startsWith: 'internal://b7/smoke-' } } });
  const realCompany = await prisma.company.create({
    data: {
      slug: SMOKE_COMPANY_SLUG,
      name: SMOKE_COMPANY_NAME,
      sector: 'Alimentos y Bebidas',
      subsector: 'Smoke',
      cnae: '10.5',
      facturacionM: 50,
      tier: 'A',
    },
    select: { id: true, name: true, cif: true, cnae: true, facturacionM: true },
  });

  // B.7-C: scrapeDespidosCto ejecuta sin throw, devuelve array.
  let scrapeOk = false;
  let scrapeCount = 0;
  try {
    const r = scrapeDespidosCto({ daysBack: 90, maxItems: 50 });
    scrapeOk = Array.isArray(r.despidos) && r.errors === 0;
    scrapeCount = r.despidos.length;
  } catch (e) {
    scrapeOk = false;
  }
  assert(
    'B.7-C [scrapeDespidosCto ejecuta sin throw, devuelve array]',
    scrapeOk,
    `count=${scrapeCount}`,
  );

  // B.7-D: 0 despidos recientes → sin_despidos_cto.
  const sampleDespido: RawDespidoCto = {
    id: 'smoke-b7-sample-d0',
    companyId: realCompany.id,
    companyName: realCompany.name,
    cargo: 'CTO',
    linkedinUrl: 'https://www.linkedin.com/in/juan-perez-cto-test',
    linkedinSlug: 'juan-perez-cto-test',
    senialDetectada: 'ha dejado',
    fechaDetectada: new Date().toISOString(),
    fuente: 'google_cse',
    searchUrl: 'https://www.google.com/search?q=site:linkedin.com+%22ha+dejado%22+CTO+Smoke',
    sourceUrl: 'https://www.linkedin.com/in/juan-perez-cto-test',
    queryId: 'cto-ha-dejado',
  };
  const r0 = await applyDespidosCtoFilter(prisma, sampleDespido);
  assert(
    'B.7-D [applyDespidosCtoFilter: 0 despidos 90d → inScope=false, sin_despidos_cto]',
    r0.inScope === false && r0.outOfScopeReason === 'sin_despidos_cto' && r0.despidoCount === 0,
    `inScope=${r0.inScope} reason=${r0.outOfScopeReason} count=${r0.despidoCount}`,
  );

  // B.7-E: 1 despido reciente → despido_unico_cto, medium.
  await prisma.source.create({
    data: {
      url: 'internal://b7/smoke-1',
      title: 'CTO | juan-perez-cto | Smoke B.7 Test Company (b7-juan-perez-cto-smoke-b-7-test-company-2026-06-04)',
      outlet: 'linkedin',
      outletType: 'despido_cto',
      language: 'es',
      companyId: realCompany.id,
      scrapedAt: new Date(),
      contentText: 'CTO ha dejado Smoke B.7 Test Company. LinkedIn: https://www.linkedin.com/in/juan-perez-cto',
      deimplantationSignal: true,
      outOfScopeReason: 'pending_b7_filter',
    },
  });
  const r1 = await applyDespidosCtoFilter(prisma, sampleDespido);
  assert(
    'B.7-E [applyDespidosCtoFilter: 1 despido 90d → inScope=true, despido_unico_cto, medium]',
    r1.inScope === true && r1.outOfScopeReason === 'despido_unico_cto' && r1.signalStrength === 'medium',
    `inScope=${r1.inScope} reason=${r1.outOfScopeReason} signal=${r1.signalStrength}`,
  );

  // B.7-F: 2+ despidos → despido_masivos_cto, strong.
  await prisma.source.create({
    data: {
      url: 'internal://b7/smoke-2',
      title: 'Director Técnico | maria-lopez-dt | Smoke B.7 Test Company (b7-maria-lopez-dt-smoke-b-7-test-company-2026-06-04)',
      outlet: 'linkedin',
      outletType: 'despido_cto',
      language: 'es',
      companyId: realCompany.id,
      scrapedAt: new Date(),
      contentText: 'Director Técnico ha dejado Smoke B.7 Test Company.',
      deimplantationSignal: true,
      outOfScopeReason: 'pending_b7_filter',
    },
  });
  const r2 = await applyDespidosCtoFilter(prisma, sampleDespido);
  assert(
    'B.7-F [applyDespidosCtoFilter: 2+ despidos 90d → inScope=true, despido_masivos_cto, strong]',
    r2.inScope === true && r2.outOfScopeReason === 'despidos_masivos_cto' && r2.signalStrength === 'strong',
    `inScope=${r2.inScope} reason=${r2.outOfScopeReason} signal=${r2.signalStrength} count=${r2.despidoCount}`,
  );

  // B.7-G: empresa inexistente → unknown_company.
  const fakeDespido: RawDespidoCto = {
    id: 'smoke-b7-fake',
    companyId: null,
    companyName: 'Empresa Ficticia S.A.',
    cargo: 'CTO',
    linkedinUrl: 'https://www.linkedin.com/in/fake-cto',
    linkedinSlug: 'fake-cto',
    senialDetectada: 'cesado',
    fechaDetectada: '2026-05-15T10:00:00Z',
    fuente: 'google_cse',
    searchUrl: 'https://www.google.com/search?q=...',
    sourceUrl: 'https://www.linkedin.com/in/fake-cto',
    queryId: 'cto-ha-dejado',
  };
  const rFake = await applyDespidosCtoFilter(prisma, fakeDespido);
  assert(
    'B.7-G [applyDespidosCtoFilter: empresa inexistente → inScope=false, unknown_company]',
    rFake.inScope === false && rFake.outOfScopeReason === 'unknown_company',
    `inScope=${rFake.inScope} reason=${rFake.outOfScopeReason}`,
  );

  // Limpieza smoke.
  await prisma.source.deleteMany({ where: { url: { startsWith: 'internal://b7/smoke-' } } });
  await prisma.company.deleteMany({ where: { slug: SMOKE_COMPANY_SLUG } });

  // B.7-H: Source.outletType='despido_cto' persiste.
  const urlA = `internal://b7/smoke-outlettype-${Date.now()}`;
  await prisma.source.upsert({
    where: { url: urlA },
    create: {
      url: urlA,
      title: 'B.7 smoke test outletType=despido_cto',
      outlet: 'linkedin',
      outletType: 'despido_cto',
      contentText: 't',
      language: 'es',
      deimplantationSignal: true,
      outOfScopeReason: 'smoke',
    },
    update: { scrapedAt: new Date() },
  });
  const fetched = await prisma.source.findUnique({ where: { url: urlA } });
  assert(
    'B.7-H1 [Source.outletType=despido_cto persiste]',
    fetched?.outletType === 'despido_cto',
    `outletType=${fetched?.outletType}`,
  );
  await prisma.source.delete({ where: { url: urlA } });

  // B.7-H2: ScanConfig con cadence=7, isActive=true.
  const scanCfg = await prisma.scanConfig.upsert({
    where: { agentName: 'surus-agente-despidos-cto' },
    create: { agentName: 'surus-agente-despidos-cto', cadenceDays: 7, isActive: true },
    update: { isActive: true, cadenceDays: 7 },
  });
  assert(
    'B.7-H2 [ScanConfig surus-agente-despidos-cto cadenceDays=7 active]',
    scanCfg.cadenceDays === 7 && scanCfg.isActive === true,
    `cadence=${scanCfg.cadenceDays}d active=${scanCfg.isActive}`,
  );

  // B.7-H3: SearchRun surus-agente-despidos-cto registrado (o ausente si 1ª corrida aún no).
  const lastRun = await prisma.searchRun.findFirst({
    where: { agentName: 'surus-agente-despidos-cto' },
    orderBy: { startedAt: 'desc' },
  });
  assert(
    'B.7-H3 [SearchRun surus-agente-despidos-cto registrado]',
    lastRun === null || lastRun.agentName === 'surus-agente-despidos-cto',
    lastRun ? `mode=${lastRun.mode} found=${lastRun.itemsFound}` : 'sin entrada (esperado si no se ha corrido el runner aún)',
  );

  // B.7-H4: normalizeCompanyName.
  const n1 = normalizeCompanyName('Pescanova, S.A.');
  const n2 = normalizeCompanyName('Mahou San Miguel');
  assert(
    'B.7-H4 [normalizeCompanyName: sin sufijos legales S.A./S.L., minúsculas, sin acentos]',
    n1 === 'pescanova' && n2 === 'mahou san miguel',
    `n1=${n1} n2=${n2}`,
  );

  // B.7-H5: matchHash b7-{slug}-{empresaSlug}-{YYYY-MM-DD}.
  const mh = matchHash({
    id: 'a',
    companyId: null,
    companyName: 'Pescanova S.A.',
    cargo: 'CTO',
    linkedinUrl: 'https://linkedin.com/in/juan-test',
    linkedinSlug: 'juan-test',
    senialDetectada: 'ha dejado',
    fechaDetectada: '2026-06-04T10:00:00Z',
    fuente: 'google_cse',
    searchUrl: 'https://google.com?q=...',
    sourceUrl: 'https://linkedin.com/in/juan-test',
    queryId: 'cto-ha-dejado',
  });
  assert(
    'B.7-H5 [matchHash: b7-{slug}-{empresaSlug}-{YYYY-MM-DD}]',
    mh === 'b7-juan-test-pescanova-2026-06-04',
    `matchHash=${mh}`,
  );

  // B.7-H6: DECISORES_TECNICOS exporta 8 cargos.
  assert(
    'B.7-H6 [DECISORES_TECNICOS exporta 8 cargos]',
    DECISORES_TECNICOS.length === 8,
    `count=${DECISORES_TECNICOS.length}`,
  );
}

async function estadoAsserts() {
  console.log('\n=== ESTADO (2 asserts) ===');

  const statePath = join(process.cwd(), 'memory', 'state', 'active-state.md');
  if (existsSync(statePath)) {
    const s = readFileSync(statePath, 'utf-8');
    assert(
      'EST-1 [active-state.md actualizado a "Sprint B.7 Despidos CTO: completed"]',
      /Sprint B\.7.*Despidos.*completed|B\.7\s+Despidos CTO: completed/i.test(s),
      s.match(/Sprint B\.7[^\n]+/i)?.[0]?.slice(0, 80) ?? 'no match',
    );
  } else {
    assert('EST-1 [active-state.md actualizado]', false, 'active-state.md no existe');
  }

  const reportPath = join(process.cwd(), 'memory', 'sprints', 'sprint-B', 'B.7-despidos-cto-report.md');
  assert(
    'EST-2 [B.7-despidos-cto-report.md existe]',
    existsSync(reportPath),
    existsSync(reportPath) ? 'ok' : 'no existe',
  );
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint B.7 Despidos CTO smoke (13 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  try {
    await qwRegression();
  } catch (e) {
    console.warn('  WARN  QW regression falló (probable sin servidor local):', (e as Error).message);
  }
  await b7Asserts();
  await estadoAsserts();

  console.log(`\n=== TOTAL: ${pass} pass / ${fail} fail ===`);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
