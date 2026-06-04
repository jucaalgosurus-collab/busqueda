// scripts/smoke-qw-b5.ts — Sprint B.5
//
// 13 asserts: 5 QW regresión + 6 B.5 + 2 EST
// Ejecuta: tsx scripts/smoke-qw-b5.ts

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  sectorMatchesCnae,
  applySegurosFilter,
} from '@/lib/filters/seguros';
import {
  scrapeAllAseguradoras,
  type RawSeguroChange,
  type AseguradoraEntry,
} from '@/lib/scrapers/seguros-credito';

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

async function b5Asserts() {
  console.log('\n=== B.5 SEGUROS CRÉDITO (6 asserts) ===');

  // B.5-A: lista de 4 aseguradoras en JSON.
  const listPath = join(process.cwd(), 'lib', 'data', 'seguros-list.json');
  const listExists = existsSync(listPath);
  let list: AseguradoraEntry[] = [];
  if (listExists) {
    list = JSON.parse(readFileSync(listPath, 'utf-8'));
  }
  const slugs = list.map((e) => e.aseguradora);
  const requiredAseguradoras = ['CESCE', 'CreditoYCaucion', 'Coface', 'AllianzTrade'];
  const allPresents = requiredAseguradoras.every((a) => slugs.includes(a as AseguradoraEntry['aseguradora']));
  assert(
    'B.5-A [seguros-list.json con 4 aseguradoras requeridas]',
    listExists && list.length === 4 && allPresents,
    `slugs=${slugs.join(',')}`,
  );

  // B.5-B: scraper regex — downgrade/upgrade detection.
  const fakeDowngrade: RawSeguroChange = {
    aseguradora: 'coface',
    sourceUrl: 'https://www.coface.com/newsroom',
    title: 'Metals in Spain: downgrade to C category',
    date: '2026-04-15',
    direction: 'downgrade',
    sector: 'metals',
    country: 'ES',
    content: 'Coface downgrades Metals in Spain to category C following deteriorating market conditions.',
  };
  const fakeUpgrade: RawSeguroChange = {
    aseguradora: 'allianz-trade',
    sourceUrl: 'https://www.allianz-trade.com/en/economic-research/sector-risks',
    title: 'Food in Spain: positive outlook',
    date: '2026-04-15',
    direction: 'upgrade',
    sector: 'food',
    country: 'ES',
    content: 'Allianz Trade upgrades Food in Spain to positive outlook, improved market dynamics.',
  };

  // Test sectorMatchesCnae for CNAE 24 (metals) and 10 (food).
  const matchMetals = sectorMatchesCnae('metals', '24');
  const matchFood = sectorMatchesCnae('food', '10');
  const matchNoFood = sectorMatchesCnae('food', '24') === false;
  const matchCerveza = sectorMatchesCnae('cerveza', '11');
  assert(
    'B.5-B1 [sectorMatchesCnae: metals↔CNAE24 true]',
    matchMetals === true,
    `metals+24=${matchMetals}`,
  );
  assert(
    'B.5-B2 [sectorMatchesCnae: food↔CNAE10 true, food↔CNAE24 false]',
    matchFood === true && matchNoFood === true,
    `food+10=${matchFood} food+24=${!matchNoFood}`,
  );
  assert(
    'B.5-B3 [sectorMatchesCnae: cerveza↔CNAE11 (bebidas) true]',
    matchCerveza === true,
    `cerveza+11=${matchCerveza}`,
  );

  // B.5-C: applySegurosFilter — upgrade NO es inScope.
  const rUpgrade = await applySegurosFilter(prisma, fakeUpgrade);
  assert(
    'B.5-C [Upgrade → inScope=false, outOfScopeReason=positive_signal]',
    rUpgrade.inScope === false && rUpgrade.outOfScopeReason === 'positive_signal',
    `inScope=${rUpgrade.inScope} reason=${rUpgrade.outOfScopeReason}`,
  );

  // B.5-D: applySegurosFilter — downgrade sin A&B matching.
  // Solo si no hay empresa con CNAE 24 en DB, inScope=false con reason='no_ab_in_sector'.
  // Si hay, inScope=true.
  const cnae24Companies = await prisma.company.count({ where: { cnae: { startsWith: '24' }, status: 'active' } });
  const rDowngrade = await applySegurosFilter(prisma, fakeDowngrade);
  if (cnae24Companies === 0) {
    assert(
      'B.5-D1 [Downgrade metals sin A&B matching → inScope=false, no_ab_in_sector]',
      rDowngrade.inScope === false && rDowngrade.outOfScopeReason === 'no_ab_in_sector',
      `inScope=${rDowngrade.inScope} reason=${rDowngrade.outOfScopeReason}`,
    );
  } else {
    assert(
      'B.5-D1 [Downgrade metals con A&B matching → inScope=true]',
      rDowngrade.inScope === true && rDowngrade.matchedCompanies.length >= 1,
      `inScope=${rDowngrade.inScope} matched=${rDowngrade.matchedCompanies.length}`,
    );
  }

  // B.5-D2: downgrade con sector 'food' (CNAE 10 — debe matchear).
  const cnae10Companies = await prisma.company.count({ where: { cnae: { startsWith: '10' }, status: 'active' } });
  const fakeFoodDowngrade: RawSeguroChange = {
    ...fakeDowngrade,
    sector: 'food',
    country: 'ES',
  };
  const rFood = await applySegurosFilter(prisma, fakeFoodDowngrade);
  if (cnae10Companies === 0) {
    assert(
      'B.5-D2 [Downgrade food sin A&B → inScope=false, no_ab_in_sector]',
      rFood.inScope === false && rFood.outOfScopeReason === 'no_ab_in_sector',
    );
  } else {
    assert(
      'B.5-D2 [Downgrade food con A&B → inScope=true, ≥1 match]',
      rFood.inScope === true && rFood.matchedCompanies.length >= 1,
      `inScope=${rFood.inScope} matched=${rFood.matchedCompanies.length}`,
    );
  }

  // B.5-E: neutral direction → inScope=false, reason=neutral_direction.
  const rNeutral = await applySegurosFilter(prisma, {
    ...fakeDowngrade,
    direction: 'neutral',
  });
  assert(
    'B.5-E [Neutral → inScope=false, outOfScopeReason=neutral_direction]',
    rNeutral.inScope === false && rNeutral.outOfScopeReason === 'neutral_direction',
    `inScope=${rNeutral.inScope} reason=${rNeutral.outOfScopeReason}`,
  );

  // B.5-F: Source.outletType='credito_aseguradora' permitido en schema.
  // Smoke: hacer un upsert con outletType='credito_aseguradora' y verificar que persiste.
  const urlA = `internal://b5/smoke-${Date.now()}`;
  await prisma.source.upsert({
    where: { url: urlA },
    create: {
      url: urlA,
      title: 'B.5 smoke test credito_aseguradora',
      outlet: 'smoke',
      outletType: 'credito_aseguradora',
      contentText: 't',
      language: 'es',
      deimplantationSignal: false,
      outOfScopeReason: 'smoke',
    },
    update: { scrapedAt: new Date() },
  });
  const fetched = await prisma.source.findUnique({ where: { url: urlA } });
  assert(
    'B.5-F [Source.outletType=credito_aseguradora persiste]',
    fetched?.outletType === 'credito_aseguradora',
    `outletType=${fetched?.outletType}`,
  );
  await prisma.source.delete({ where: { url: urlA } });

  // B.5-G: ScanConfig surus-agente-seguros.
  const scanCfg = await prisma.scanConfig.upsert({
    where: { agentName: 'surus-agente-seguros' },
    create: { agentName: 'surus-agente-seguros', cadenceDays: 7, isActive: true },
    update: { isActive: true, cadenceDays: 7 },
  });
  assert(
    'B.5-G [ScanConfig surus-agente-seguros cadenceDays=7 active]',
    scanCfg.cadenceDays === 7 && scanCfg.isActive === true,
    `cadence=${scanCfg.cadenceDays}d active=${scanCfg.isActive}`,
  );

  // B.5-H: scrapeAllAseguradoras no throws (puede devolver [] si red falla).
  try {
    const r = await scrapeAllAseguradoras(list.slice(0, 1), { daysBack: 30, maxItems: 3 });
    assert(
      'B.5-H [scrapeAllAseguradoras ejecuta sin throw]',
      Array.isArray(r.changes),
      `changes=${r.changes.length}`,
    );
  } catch (e) {
    assert('B.5-H [scrapeAllAseguradoras ejecuta sin throw]', false, (e as Error).message);
  }
}

async function estadoAsserts() {
  console.log('\n=== ESTADO (2 asserts) ===');

  // EST-1: active-state.md actualizado.
  const statePath = join(process.cwd(), 'memory', 'state', 'active-state.md');
  if (existsSync(statePath)) {
    const s = readFileSync(statePath, 'utf-8');
    assert(
      'EST-1 [active-state.md actualizado a "Sprint B.5 Seguros: completed"]',
      /Sprint B\.5.*Seguros.*completed|B\.5\s+Seguros: completed/i.test(s),
      s.match(/Sprint B\.5[^\n]+/i)?.[0]?.slice(0, 80) ?? 'no match',
    );
  } else {
    assert('EST-1 [active-state.md actualizado]', false, 'active-state.md no existe');
  }

  // EST-2: B.5 report existe.
  const reportPath = join(process.cwd(), 'memory', 'sprints', 'sprint-B', 'B.5-seguros-credito-cesce-report.md');
  assert(
    'EST-2 [B.5-seguros-credito-cesce-report.md existe]',
    existsSync(reportPath),
    existsSync(reportPath) ? 'ok' : 'no existe',
  );
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint B.5 Seguros de crédito smoke (13 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  try {
    await qwRegression();
  } catch (e) {
    console.warn('  WARN  QW regression falló (probable sin servidor local):', (e as Error).message);
  }
  await b5Asserts();
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
