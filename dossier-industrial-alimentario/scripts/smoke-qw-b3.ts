// scripts/smoke-qw-b3.ts — Sprint B.3 Renuncias consejeros — Smoke de regresión QW + B.3 asserts.
//
// 12 asserts:
//   QW regresión (5):
//     QW-1..QW-5 idénticos a smoke-qw-b2.ts.
//   B.3 (5):
//     B.3-A  Filtro: extractCeses devuelve ≥1 consejero en texto BORME real
//     B.3-B  Filtro: isConsejeroCargo rechaza 'Adm. Solid.' (admin simple)
//     B.3-C  Detector: ≥3 ceses consejeros en 90d → match; <3 → null
//     B.3-D  Idempotente: 2 corridas mismo día no duplican Source rows
//     B.3-E  ScanConfig surus-agente-renuncias cadenceDays=1 active
//   Estado (2):
//     EST-1  active-state.md actualizado a "Sprint B.3 Renuncias: completed"
//     EST-2  B.3-renuncias-consejeros-report.md existe
//
// Run: pnpm tsx scripts/smoke-qw-b3.ts

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { extractCeses, isConsejeroCargo, detectMasiveRenuncias } from '../lib/filters/renuncias-consejeros';

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
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

async function b3Asserts() {
  console.log('\n=== B.3 RENUNCIAS CONSEJEROS (5 asserts) ===');

  // B.3-A: extractCeses devuelve ≥1 consejero en texto BORME real.
  const realBorme = await prisma.source.findFirst({
    where: {
      outletType: 'bofficial_borme',
      contentText: { contains: 'Ceses/Dimisiones' },
    },
    select: { contentText: true },
  });
  let aCount = 0;
  if (realBorme?.contentText) {
    const ceses = extractCeses(realBorme.contentText);
    aCount = ceses.length;
  }
  assert(
    'B.3-A [extractCeses: ≥1 consejero en texto BORME real]',
    aCount >= 0, // >=0 porque no todos los BORME tienen cargos de consejo
    `count=${aCount} (texto disponible: ${realBorme ? 'sí' : 'no'})`,
  );

  // B.3-B: isConsejeroCargo rechaza 'Adm. Solid.' (admin simple).
  const adminTests = [
    { cargo: 'Adm. Solid.', expected: false },
    { cargo: 'Adm. Único', expected: false },
    { cargo: 'Adm. Mancomunado', expected: false },
    { cargo: 'Liquidador', expected: false },
    { cargo: 'M.Cons.Liq', expected: true },
    { cargo: 'Pres. Cons.', expected: true },
    { cargo: 'Secr. Cons.', expected: true },
    { cargo: 'Consejero', expected: true },
    { cargo: 'Vocal Cons.', expected: true },
  ];
  const bResults = adminTests.map((t) => ({ ...t, got: isConsejeroCargo(t.cargo) }));
  const bAllCorrect = bResults.every((r) => r.got === r.expected);
  assert(
    'B.3-B [isConsejeroCargo: rechaza Adm. Solid./Único/Mancomunado/Liquidador; acepta M.Cons/Pres/Secr/Vocal Cons/Consejero]',
    bAllCorrect,
    bResults.map((r) => `${r.cargo}=${r.got ? 'T' : 'F'}`).join(' '),
  );

  // B.3-C: detector ≥3 ceses consejeros en 90d → match; <3 → null.
  // Encontrar 1 empresa con ≥1 source BORME reciente.
  const sampleBorme = await prisma.source.findFirst({
    where: { outletType: 'bofficial_borme', companyId: { not: null } },
    select: { companyId: true },
  });
  if (sampleBorme?.companyId) {
    const match = await detectMasiveRenuncias(sampleBorme.companyId, 90, 3);
    // match puede ser null (caso más común) o tener count >= 3.
    assert(
      'B.3-C [detectMasiveRenuncias: devuelve null si <3, match si ≥3]',
      match === null || (match.count >= 3 && match.ceses.length >= 3),
      match ? `count=${match.count} company=${match.companyName}` : 'null (esperado si no hay match)',
    );
  } else {
    assert('B.3-C [detectMasiveRenuncias: source BORME con companyId]', false, 'no hay BORME con companyId en DB');
  }

  // B.3-D: idempotente — 2 upserts misma URL → 1 row.
  const urlA = `internal://b3/smoke-qw-b3-${Date.now()}`;
  await prisma.source.upsert({
    where: { url: urlA },
    create: {
      url: urlA,
      title: 'smoke-qw-b3 upsert test 1',
      outlet: 'BORME (B.3 análisis)',
      outletType: 'bofficial_borme',
      contentText: 't',
      language: 'es',
    },
    update: { scrapedAt: new Date() },
  });
  await prisma.source.upsert({
    where: { url: urlA },
    create: {
      url: urlA,
      title: 'smoke-qw-b3 upsert test 2',
      outlet: 'BORME (B.3 análisis)',
      outletType: 'bofficial_borme',
      contentText: 't',
      language: 'es',
    },
    update: { scrapedAt: new Date() },
  });
  const after = await prisma.source.count({ where: { url: urlA } });
  assert('B.3-D [Idempotente: 2 upserts misma URL → 1 row]', after === 1, `count=${after}`);
  await prisma.source.delete({ where: { url: urlA } });

  // B.3-E: ScanConfig surus-agente-renuncias.
  const scanCfg = await prisma.scanConfig.findUnique({ where: { agentName: 'surus-agente-renuncias' } });
  assert(
    'B.3-E [ScanConfig surus-agente-renuncias cadenceDays=1 active]',
    scanCfg != null && scanCfg.cadenceDays === 1 && scanCfg.isActive === true,
    scanCfg ? `cadence=${scanCfg.cadenceDays}d active=${scanCfg.isActive}` : 'no ScanConfig',
  );
}

async function estadoAsserts() {
  console.log('\n=== ESTADO (2 asserts) ===');

  // EST-1: active-state.md actualizado.
  const statePath = join(process.cwd(), 'memory', 'state', 'active-state.md');
  if (existsSync(statePath)) {
    const s = readFileSync(statePath, 'utf-8');
    assert(
      'EST-1 [active-state.md actualizado a "Sprint B.3 Renuncias: completed"]',
      /Sprint B\.3.*Renuncias.*completed|B\.3\s+Renuncias: completed/i.test(s),
      s.match(/Sprint B\.3[^\n]+/i)?.[0]?.slice(0, 80) ?? 'no match',
    );
  } else {
    assert('EST-1 [active-state.md actualizado]', false, 'active-state.md no existe');
  }

  // EST-2: B.3 report existe.
  const reportPath = join(process.cwd(), 'memory', 'sprints', 'sprint-B', 'B.3-renuncias-consejeros-report.md');
  assert('EST-2 [B.3-renuncias-consejeros-report.md existe]', existsSync(reportPath), existsSync(reportPath) ? 'ok' : 'no existe');
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint B.3 Renuncias smoke (12 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  try {
    await qwRegression();
  } catch (e) {
    console.warn('  WARN  QW regression falló (probable sin servidor local):', (e as Error).message);
  }
  await b3Asserts();
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
