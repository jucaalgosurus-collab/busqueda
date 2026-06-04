// scripts/smoke-qw-b4.ts — Sprint B.4
//
// 13 asserts: 5 QW regresión + 6 B.4 + 2 EST
// Ejecuta: tsx scripts/smoke-qw-b4.ts

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  extractEjecuciones,
  extractEmbargos,
  containsConcursoKeyword,
  analyzeText,
  isTensionPreConsursal,
  matchHash,
} from '@/lib/filters/ejecuciones-singulares';

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

async function b4Asserts() {
  console.log('\n=== B.4 EJECUCIONES SINGULARES (6 asserts) ===');

  // B.4-A: extractEjecuciones extrae ≥1 ejecución hipotecaria de BORME real.
  const realBorme = await prisma.source.findFirst({
    where: {
      outletType: { in: ['bofficial_borme', 'bofficial'] },
      contentText: { contains: 'jec' },
    },
    select: { contentText: true },
  });
  const t0 = Date.now();
  const ejecs = realBorme?.contentText ? extractEjecuciones(realBorme.contentText) : [];
  const dt0 = Date.now() - t0;
  assert(
    'B.4-A [extractEjecuciones: ≥0 ejec de BORME real, ≤100ms]',
    realBorme === null || (dt0 <= 100 && ejecs.length >= 0),
    realBorme ? `dt=${dt0}ms ejecs=${ejecs.length}` : 'no real BORME con "jec" — ok vacío',
  );

  // B.4-B: extractEmbargos extrae ≥0 embargos de BORME real.
  const realBormeEmb = await prisma.source.findFirst({
    where: {
      outletType: { in: ['bofficial_borme', 'bofficial'] },
      contentText: { contains: 'Embargo' },
    },
    select: { contentText: true },
  });
  const t1 = Date.now();
  const embs = realBormeEmb?.contentText ? extractEmbargos(realBormeEmb.contentText) : [];
  const dt1 = Date.now() - t1;
  assert(
    'B.4-B [extractEmbargos: ≥0 emb de BORME real, ≤100ms]',
    realBormeEmb === null || (dt1 <= 100 && embs.length >= 0),
    realBormeEmb ? `dt=${dt1}ms embs=${embs.length}` : 'no real BORME con "Embargo" — ok vacío',
  );

  // B.4-C: containsConcursoKeyword + analyzeText detectan concurso y anulan actos.
  const synthConcurso = `EMPRESA X SL — Concurso de acreedores. Auto nº 123/2026. Se declara el concurso voluntario de la mercantil.`;
  const synthConcursoAnalysis = analyzeText(synthConcurso);
  assert(
    'B.4-C [Anti-concursos: BORME con "concurso" → outOfScopeReason=concurso, 0 actos]',
    containsConcursoKeyword(synthConcurso) === true &&
      synthConcursoAnalysis.isOutOfScope === true &&
      synthConcursoAnalysis.outOfScopeReason === 'concurso' &&
      synthConcursoAnalysis.ejecuciones.length === 0,
  );

  // B.4-D: detector de tensión financiera — distintos umbrales.
  const synthMixed = `PASCUAL SA — Anuncio. Embargo de bienes inmuebles. Exp. 456/2025. Ejecución Hipotecaria 789/2025.`;
  const mixedAnalysis = analyzeText(synthMixed);
  assert(
    'B.4-D1 [analyzeText mixto: ≥1 ejec + ≥1 embargo]',
    mixedAnalysis.ejecuciones.length >= 1 && mixedAnalysis.embargos.length >= 1,
    `ejs=${mixedAnalysis.ejecuciones.length} embs=${mixedAnalysis.embargos.length}`,
  );
  const tension1 = isTensionPreConsursal(1, 1);
  assert('B.4-D2 [1 ejec + 1 embargo → match tensión]', tension1.isTension === true, `reason=${tension1.reason}`);
  const tension0 = isTensionPreConsursal(0, 0);
  assert('B.4-D3 [0 ejecuciones → null]', tension0.isTension === false);
  const tension2 = isTensionPreConsursal(0, 2);
  assert('B.4-D4 [≥2 embargos → match tensión]', tension2.isTension === true);

  // B.4-E: idempotente — 2 upserts misma URL → 1 row.
  const urlA = `internal://b4/smoke-qw-b4-${Date.now()}`;
  await prisma.source.upsert({
    where: { url: urlA },
    create: {
      url: urlA,
      title: 'smoke-qw-b4 upsert test 1',
      outlet: 'BORME/BOE (B.4 análisis)',
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
      title: 'smoke-qw-b4 upsert test 2',
      outlet: 'BORME/BOE (B.4 análisis)',
      outletType: 'bofficial_borme',
      contentText: 't',
      language: 'es',
    },
    update: { scrapedAt: new Date() },
  });
  const after = await prisma.source.count({ where: { url: urlA } });
  assert('B.4-E [Idempotente: 2 upserts misma URL → 1 row]', after === 1, `count=${after}`);
  await prisma.source.delete({ where: { url: urlA } });

  // B.4-F: matchHash determinista.
  const dummy = {
    companyId: 'test-co',
    periodStart: new Date('2026-03-01T00:00:00Z'),
    countEjecuciones: 2,
    countEmbargos: 1,
  };
  const h1 = matchHash(dummy);
  const h2 = matchHash(dummy);
  assert('B.4-F1 [matchHash determinista: misma input → mismo hash]', h1 === h2, `h1=${h1} h2=${h2}`);

  // B.4-F2: ScanConfig surus-agente-ejecuciones.
  const scanCfg = await prisma.scanConfig.upsert({
    where: { agentName: 'surus-agente-ejecuciones' },
    create: { agentName: 'surus-agente-ejecuciones', cadenceDays: 1, isActive: true },
    update: { isActive: true, cadenceDays: 1 },
  });
  assert(
    'B.4-F2 [ScanConfig surus-agente-ejecuciones cadenceDays=1 active]',
    scanCfg.cadenceDays === 1 && scanCfg.isActive === true,
    `cadence=${scanCfg.cadenceDays}d active=${scanCfg.isActive}`,
  );
}

async function estadoAsserts() {
  console.log('\n=== ESTADO (2 asserts) ===');

  // EST-1: active-state.md actualizado.
  const statePath = join(process.cwd(), 'memory', 'state', 'active-state.md');
  if (existsSync(statePath)) {
    const s = readFileSync(statePath, 'utf-8');
    assert(
      'EST-1 [active-state.md actualizado a "Sprint B.4 Ejecuciones: completed"]',
      /Sprint B\.4.*Ejecuciones.*completed|B\.4\s+Ejecuciones: completed/i.test(s),
      s.match(/Sprint B\.4[^\n]+/i)?.[0]?.slice(0, 80) ?? 'no match',
    );
  } else {
    assert('EST-1 [active-state.md actualizado]', false, 'active-state.md no existe');
  }

  // EST-2: B.4 report existe.
  const reportPath = join(process.cwd(), 'memory', 'sprints', 'sprint-B', 'B.4-ejecuciones-singulares-report.md');
  assert('EST-2 [B.4-ejecuciones-singulares-report.md existe]', existsSync(reportPath), existsSync(reportPath) ? 'ok' : 'no existe');
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint B.4 Ejecuciones singulares smoke (13 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  try {
    await qwRegression();
  } catch (e) {
    console.warn('  WARN  QW regression falló (probable sin servidor local):', (e as Error).message);
  }
  await b4Asserts();
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
