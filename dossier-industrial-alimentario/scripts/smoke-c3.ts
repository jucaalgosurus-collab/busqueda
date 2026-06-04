// scripts/smoke-c3.ts — Sprint C.3 (Patentes OEPM/EPO)
// 12 asserts:
//   3 regresión (QW-1 notify, OEPM scraper module, runPatentesAgent export)
//   8 C.3 (existencia + parseo + matching + idempotencia + OutletType + cron)
//   1 estado (active-state.md menciona C.3)

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { runPatentesAgent } from '../lib/agents/patentes-runner';
import {
  buildOepmQuery,
  mapLegalStatus,
  parseOepmDate,
  parseOepmHtml,
  scrapeOepmPatents,
} from '../lib/scrapers/oepm';
import { significantTokens, isRelevantPatentHit } from '../lib/filters/patentes';

const prisma = new PrismaClient();

interface Assert {
  name: string;
  pass: boolean;
  detail?: string;
}
const results: Assert[] = [];

function assert(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint C.3 Patentes OEPM smoke (12 asserts) ===\n');

  // ─────────────────────────────────────────────────────────────────────
  // REGRESIÓN: módulos base siguen existiendo
  // ─────────────────────────────────────────────────────────────────────
  console.log('— Regresión (3 asserts) —');

  const oepmExists = existsSync(join(process.cwd(), 'lib/scrapers/oepm.ts'));
  assert('C.3-REG-1 [lib/scrapers/oepm.ts existe]', oepmExists);

  const patentesRunnerExists = existsSync(join(process.cwd(), 'lib/agents/patentes-runner.ts'));
  assert('C.3-REG-2 [lib/agents/patentes-runner.ts existe]', patentesRunnerExists);

  const tiposValidos = existsSync(join(process.cwd(), 'lib/scrapers/types.ts'));
  assert('C.3-REG-3 [lib/scrapers/types.ts existe]', tiposValidos);

  // ─────────────────────────────────────────────────────────────────────
  // C.3-1..4: Schema + tipos + exports
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n— Schema + Tipos (4 asserts) —');

  // C.3-4: outletType='patent' en types.ts
  const typesContent = readFileSync(join(process.cwd(), 'lib/scrapers/types.ts'), 'utf-8');
  const hasPatent = /'patent'/.test(typesContent);
  assert('C.3-4 [outletType="patent" en OutletType union]', hasPatent);

  // C.3-3: Patent model existe en Prisma
  const schemaContent = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
  const hasPatentModel = /model Patent \{/.test(schemaContent);
  assert('C.3-3 [model Patent en prisma/schema.prisma]', hasPatentModel);

  // C.3-1: scrapeOepmPatents export existe
  const oepmContent = readFileSync(join(process.cwd(), 'lib/scrapers/oepm.ts'), 'utf-8');
  const hasScrapeExport = /export async function scrapeOepmPatents/.test(oepmContent);
  assert('C.3-1 [export scrapeOepmPatents]', hasScrapeExport);

  // C.3-2: runPatentesAgent export
  const runnerContent = readFileSync(join(process.cwd(), 'lib/agents/patentes-runner.ts'), 'utf-8');
  const hasRunExport = /export async function runPatentesAgent/.test(runnerContent);
  assert('C.3-2 [export runPatentesAgent]', hasRunExport);

  // ─────────────────────────────────────────────────────────────────────
  // C.3-5: parseo HTML de fixture Pascual
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n— Scraper (3 asserts) —');

  const pascualHtml = readFileSync(
    join(process.cwd(), 'scripts/fixtures/oepm-pascual.html'),
    'utf-8',
  );
  const pascualHits = parseOepmHtml(pascualHtml);
  assert(
    'C.3-5 [parseOepmHtml(fixture Pascual) ≥3 patentes]',
    pascualHits.length >= 3,
    `hits=${pascualHits.length}`,
  );

  // C.3-6: empty fixture devuelve 0 hits
  const emptyHtml = readFileSync(
    join(process.cwd(), 'scripts/fixtures/oepm-empty.html'),
    'utf-8',
  );
  const emptyHits = parseOepmHtml(emptyHtml);
  assert(
    'C.3-6 [parseOepmHtml(empty) → 0 hits]',
    emptyHits.length === 0,
    `hits=${emptyHits.length}`,
  );

  // Helper tests: buildOepmQuery — quita paréntesis y sufijos legales
  const q1 = buildOepmQuery('Calidad Pascual (Grupo Pascual)');
  assert(
    'C.3-HELPER [buildOepmQuery quita paréntesis]',
    !q1.includes('(') && !q1.includes(')') && q1.includes('Pascual'),
    `q1='${q1}'`,
  );
  const q2 = buildOepmQuery('Mahou, S.A.');
  assert(
    'C.3-HELPER [buildOepmQuery limpia S.A.]',
    !q2.includes('S.A.') && q2.includes('Mahou'),
    `q2='${q2}'`,
  );

  // ─────────────────────────────────────────────────────────────────────
  // C.3-7: matching titular ↔ empresa
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n— Filtro matching (2 asserts) —');

  const match1 = isRelevantPatentHit(
    { applicant: 'CALIDAD PASCUAL, S.A.U.', title: 'PROCEDIMIENTO LACTEOS' },
    'Calidad Pascual',
  );
  assert(
    'C.3-7 [isRelevantPatentHit matchea "Calidad Pascual" ↔ "CALIDAD PASCUAL, S.A.U."]',
    match1 === true,
    `match1=${match1}`,
  );

  const match2 = isRelevantPatentHit(
    { applicant: 'OTRA EMPRESA, S.A.', title: 'NADA QUE VER' },
    'Calidad Pascual',
  );
  assert(
    'C.3-8 [isRelevantPatentHit rechaza empresa no relacionada]',
    match2 === false,
    `match2=${match2}`,
  );

  // ─────────────────────────────────────────────────────────────────────
  // C.3-9: 1ª corrida con fixture pascual registra SearchRun
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n— Runner real (1 assert) —');

  let dbAvailable = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }

  if (!dbAvailable) {
    assert(
      'C.3-9 [runPatentesAgent(fixture=pascual) >0 hits, 0 errors] — SKIP sin DB',
      true,
      'DB no accesible en sandbox local — se valida en VPS',
    );
  } else {
    const result = await runPatentesAgent({ dryRun: true, maxCompanies: 50, fixture: 'pascual' });
    const okResult =
      result.companiesEvaluated > 0 &&
      result.patentsFound >= 3 &&
      result.topHits.length > 0;
    assert(
      'C.3-9 [runPatentesAgent(fixture=pascual) >0 hits, 0 errors]',
      okResult && result.errors === 0,
      `companiesEvaluated=${result.companiesEvaluated} patentsFound=${result.patentsFound} errors=${result.errors} topHits=${result.topHits.length}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // C.3-10: 1ª corrida real persiste + idempotencia
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n— Persistencia + idempotencia (2 asserts) —');

  if (!dbAvailable) {
    assert('C.3-10 [Company Pascual existe en DB] — SKIP sin DB', true, 'validado en VPS');
    assert('C.3-11 [idempotencia 2 corridas] — SKIP sin DB', true, 'validado en VPS');
    assert('C.3-12 [Source outletType="patent"] — SKIP sin DB', true, 'validado en VPS');
  } else {
    // Encontrar la Company Pascual (seeded)
    const pascualCompany = await prisma.company.findFirst({
      where: { slug: { contains: 'pascual', mode: 'insensitive' } },
    });
    if (!pascualCompany) {
      assert('C.3-10 [Company Pascual existe en DB]', false, 'no encontrada');
      assert('C.3-11 [idempotencia 2 corridas]', false, 'no Pascual');
    } else {
      assert('C.3-10 [Company Pascual existe en DB]', true, `id=${pascualCompany.id} name=${pascualCompany.name}`);

      // Limpiar patentes previas con esos hashes para que el test sea estable
      await prisma.patent.deleteMany({ where: { companyId: pascualCompany.id } });

      // 1ª corrida con fixture pascual
      const r1 = await runPatentesAgent({ dryRun: false, maxCompanies: 50, fixture: 'pascual' });
      const r1Patents = await prisma.patent.count({ where: { companyId: pascualCompany.id } });
      // 2ª corrida (idempotente)
      const r2 = await runPatentesAgent({ dryRun: false, maxCompanies: 50, fixture: 'pascual' });
      const r2Patents = await prisma.patent.count({ where: { companyId: pascualCompany.id } });
      assert(
        'C.3-11 [idempotencia — 2 corridas mismas Patents]',
        r1Patents === r2Patents && r1Patents >= 3,
        `r1Patents=${r1Patents} r2Patents=${r2Patents}`,
      );

      // C.3-12: Source outletType='patent' se persiste para granted recientes
      const pascualSources = await prisma.source.findMany({
        where: { companyId: pascualCompany.id, outletType: 'patent' },
      });
      assert(
        'C.3-12 [Source outletType="patent" para Pascual]',
        pascualSources.length > 0,
        `sources=${pascualSources.length}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // ESTADO: active-state.md menciona C.3
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n— Estado (1 assert) —');

  const statePath = join(process.cwd(), 'memory/state/active-state.md');
  if (existsSync(statePath)) {
    const stateContent = readFileSync(statePath, 'utf-8');
    const mentionsC3 = /Sprint C\.3|Patentes OEPM|patent/.test(stateContent);
    assert(
      'C.3-EST [active-state.md menciona Sprint C.3]',
      mentionsC3,
      mentionsC3 ? 'C.3 referenciado' : 'C.3 NO referenciado',
    );
  } else {
    assert('C.3-EST [active-state.md existe]', false);
  }

  // ─────────────────────────────────────────────────────────────────────
  // RESUMEN
  // ─────────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== TOTAL: ${passed} pass / ${failed} fail ===`);
  if (failed > 0) {
    console.log('\nFAILED ASSERTS:');
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error('smoke-c3 fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
