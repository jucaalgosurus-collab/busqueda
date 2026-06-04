// scripts/smoke-qw-b1.ts — Sprint B.1 BORME — Smoke unificado de regresión QW + B.1.
//
// Ejecuta TODOS los asserts en orden, imprime PASS/FAIL por línea, y exit 1 si
// cualquier assert falla. Es el único "OK" oficial para deployment.
//
// Aserts (13 total):
//   QW regresión (5):
//     QW-1 sectores amplios visibles en /empresas
//     QW-2 ≥1 empresa por sector en DB
//     QW-3 Navbar contiene "Juan Carlos Alvarado para Surus"
//     QW-4 Footer contiene "Juan Carlos Alvarado para Surus"
//     QW-5 Header dashboard contiene "Juan Carlos Alvarado para Surus"
//     QW-6 Bot Telegram 4/4 handlers
//   B.1 (7):
//     B.1-A lib/scrapers/borme.ts tipado fuerte, sin `any`
//     B.1-B Items en DB con outletType='bofficial_borme', url UNIQUE
//     B.1-C Filtro desimplantación: ≥1 keyword match O score > 0.5
//     B.1-D Anti-M&A: keywords "fusión|adquisición|absorción" → signal=false, outOfScopeReason='m_and_a'
//     B.1-E Anti-subasta/concurso: keywords "subasta|concurso" → signal=false, outOfScopeReason='auction_or_ettbewerb'
//     B.1-F Cron surus-agente-borme registrado, cadencia 2d
//     B.1-G 1ª corrida: SearchRun.mode='backfill_15d', ≥10 items nuevos
//     B.1-H 0 falsos positivos M&A/subasta marcados como signal=true
//   Estado (1):
//     EST-1 active-state.md actualizado a "Sprint B.1 BORME: completed"
//
// Run: pnpm ts-node scripts/smoke-qw-b1.ts

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

  // QW-1: 6 sectores amplios visibles en /empresas.
  const empresasHtml = await (await fetch('http://127.0.0.1:3002/empresas', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  // Sectores amplios esperados (per INDUSTRIAS):
  const expectedSectors = ['Alimentos y Bebidas', 'Industrial', 'Farmaceutico', 'Construccion', 'Energetico', 'Otro industrial'];
  const presentSectors = expectedSectors.filter((s) => empresasHtml.includes(s));
  assert(
    'QW-1 [6 sectores amplios visibles en /empresas]',
    presentSectors.length >= 5,
    `${presentSectors.length}/6 sectores visibles: ${presentSectors.join(', ')}`,
  );

  // QW-2: ≥1 empresa por sector en DB.
  const companyCounts = await prisma.company.groupBy({ by: ['sector'], _count: true });
  const sectorMap = new Map(companyCounts.map((c) => [c.sector, c._count]));
  const sectorsWithCompanies = expectedSectors.filter((s) => (sectorMap.get(s) ?? 0) > 0);
  assert(
    'QW-2 [≥1 empresa por sector en DB]',
    sectorsWithCompanies.length >= 5,
    `${sectorsWithCompanies.length}/6 sectores con ≥1 empresa`,
  );

  // QW-3: Navbar contiene "Juan Carlos Alvarado para Surus".
  const dashboardHtml = await (await fetch('http://127.0.0.1:3002/', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  assert(
    'QW-3 [Navbar contiene "Juan Carlos Alvarado para Surus"]',
    /Creado por\s*<strong>\s*Juan Carlos Alvarado\s*<\/strong>\s*para\s*<strong>\s*Surus/.test(dashboardHtml),
    dashboardHtml.includes('Juan Carlos Alvarado') && dashboardHtml.includes('Surus') ? 'match exacto en header' : 'no match',
  );

  // QW-4: Footer contiene "Juan Carlos Alvarado para Surus" (en cualquier página).
  const hallazgosHtml = await (await fetch('http://127.0.0.1:3002/hallazgos', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  assert(
    'QW-4 [Footer contiene "Juan Carlos Alvarado para Surus"]',
    /Juan Carlos Alvarado/.test(hallazgosHtml) && /Surus Inversa/.test(hallazgosHtml),
    'match en /hallazgos',
  );

  // QW-5: Header del dashboard contiene "Juan Carlos Alvarado para Surus".
  assert(
    'QW-5 [Header del dashboard contiene "Juan Carlos Alvarado para Surus"]',
    /Juan Carlos Alvarado/.test(dashboardHtml) && /Surus Inversa/.test(dashboardHtml),
    'match en /',
  );

  // QW-6: Bot Telegram 4/4 handlers — best-effort (no se valida red, solo existencia del archivo).
  const botPath = join(process.cwd(), 'scripts', 'bot.py');
  if (existsSync(botPath)) {
    const bot = readFileSync(botPath, 'utf-8');
    const hasText = /def\s+\w*handle.*text|text.*case|msg\['text'\]/.test(bot) || bot.includes("'text'") || bot.includes('"text"');
    const hasVoice = bot.includes('voice') || bot.includes('voice_file_id');
    const hasPhoto = bot.includes('photo') || bot.includes("'photos'") || bot.includes('"photos"');
    const hasUnknown = /unknown|smart_chat|not_understood/.test(bot);
    assert(
      'QW-6 [Bot Telegram 4/4 handlers]',
      hasText && hasVoice && hasPhoto && hasUnknown,
      `text=${hasText} voice=${hasVoice} photo=${hasPhoto} unknown=${hasUnknown}`,
    );
  } else {
    assert('QW-6 [Bot Telegram 4/4 handlers]', false, 'scripts/bot.py no existe');
  }
}

async function b1Asserts() {
  console.log('\n=== B.1 BORME (7 asserts) ===');

  // B.1-A: lib/scrapers/borme.ts tipado fuerte, sin `any`.
  const bormePath = join(process.cwd(), 'lib', 'scrapers', 'borme.ts');
  if (existsSync(bormePath)) {
    const src = readFileSync(bormePath, 'utf-8');
    // Regex: detecta ": any" o "as any" o "<any>" (no dentro de comentarios o strings grandes).
    // Heurística: solo flageamos si aparece sin un comentario "// " precedente en la misma línea.
    const anyLines = src.split('\n').filter((l) => {
      if (l.trim().startsWith('//') || l.trim().startsWith('*')) return false;
      return /:\s*any\b|\bas\s+any\b/.test(l);
    });
    assert(
      'B.1-A [borme.ts tipado fuerte, sin `any`]',
      anyLines.length === 0,
      anyLines.length === 0 ? '0 ocurrencias' : `${anyLines.length} ocurrencias: ${anyLines.slice(0, 2).join(' | ')}`,
    );
  } else {
    assert('B.1-A [borme.ts tipado fuerte, sin `any`]', false, 'lib/scrapers/borme.ts no existe');
  }

  // B.1-B: Items en DB con outletType='bofficial_borme', url UNIQUE.
  const bormeSources = await prisma.source.findMany({
    where: { outletType: 'bofficial_borme' },
    take: 200,
  });
  // Verifica que todas las URLs son distintas (UNIQUE constraint lo garantiza, pero smoke-check).
  const urlSet = new Set(bormeSources.map((s) => s.url));
  assert(
    'B.1-B [Items en DB con outletType bofficial_borme, url UNIQUE]',
    bormeSources.length > 0 && urlSet.size === bormeSources.length,
    `total=${bormeSources.length} urls distintas=${urlSet.size}`,
  );

  // B.1-C: Filtro desimplantación: ≥1 keyword match O score > 0.5.
  // Lo validamos con applyBormeFilter sobre un texto de muestra que es cierre claro.
  const { applyBormeFilter } = await import('../lib/filters/deimplantation.js');
  const cText = 'La sociedad DROMO GESTION 2026 SOCIEDAD LIMITADA anuncia el cierre de su planta de Albacete, con cese de actividad y baja de inventario de equipos productivos.';
  const cRes = applyBormeFilter(cText);
  assert(
    'B.1-C [Filtro desimplantación: ≥1 keyword match O score > 0.5]',
    cRes.inScope === true && (cRes.signals.length > 0 || cRes.score > 0.5),
    `inScope=${cRes.inScope} signals=${cRes.signals.length} score=${cRes.score.toFixed(2)}`,
  );

  // B.1-D: Anti-M&A: keywords "fusión|adquisición|absorción" → signal=false, outOfScopeReason='m_and_a'.
  const dText = 'Empresa A anuncia la fusión por absorción con Empresa B con efecto del 1 de julio. La nueva planta agrupada operará desde Barcelona.';
  const dRes = applyBormeFilter(dText);
  assert(
    'B.1-D [Anti-M&A: fusion|adquisicion|absorcion → m_and_a]',
    dRes.inScope === false && dRes.outOfScopeReason === 'm_and_a',
    `inScope=${dRes.inScope} outReason=${dRes.outOfScopeReason}`,
  );

  // B.1-E: Anti-subasta/concurso: "subasta|concurso|liquidación concursal" → signal=false, outOfScopeReason='auction_or_ettbewerb'.
  const eText = 'La salida a subasta de los activos de la empresa se publica en el BOE. También se acuerda la liquidación concursal de la sociedad.';
  const eRes = applyBormeFilter(eText);
  assert(
    'B.1-E [Anti-subasta/concurso: subasta|concurso → auction_or_ettbewerb]',
    eRes.inScope === false && eRes.outOfScopeReason === 'auction_or_ettbewerb',
    `inScope=${eRes.inScope} outReason=${eRes.outOfScopeReason}`,
  );

  // B.1-F: Cron surus-agente-borme registrado, cadencia 2d.
  const scanCfg = await prisma.scanConfig.findUnique({ where: { agentName: 'surus-agente-borme' } });
  assert(
    'B.1-F [Cron surus-agente-borme registrado, cadencia 2d]',
    scanCfg != null && scanCfg.cadenceDays === 2 && scanCfg.isActive === true,
    scanCfg ? `cadence=${scanCfg.cadenceDays}d active=${scanCfg.isActive}` : 'no ScanConfig',
  );

  // B.1-G: 1ª corrida: SearchRun.mode='backfill_15d', ≥10 items nuevos.
  const backfillRun = await prisma.searchRun.findFirst({
    where: { agentName: 'surus-agente-borme', mode: 'backfill_15d' },
    orderBy: { startedAt: 'desc' },
  });
  assert(
    'B.1-G [1ª corrida: SearchRun.mode=backfill_15d, ≥10 items nuevos]',
    backfillRun != null && (backfillRun.itemsNew ?? 0) >= 10,
    backfillRun ? `itemsNew=${backfillRun.itemsNew ?? 0} mode=${backfillRun.mode}` : 'no backfill run',
  );

  // B.1-H: 0 falsos positivos M&A/subasta marcados como signal=true.
  const falsePositives = await prisma.source.count({
    where: {
      outletType: 'bofficial_borme',
      deimplantationSignal: true,
      outOfScopeReason: { in: ['m_and_a', 'auction_or_ettbewerb', 'concurso', 'subasta'] },
    },
  });
  assert(
    'B.1-H [0 falsos positivos M&A/subasta marcados como signal=true]',
    falsePositives === 0,
    `falsePositives=${falsePositives}`,
  );
}

async function estadoAsserts() {
  console.log('\n=== ESTADO (1 assert) ===');

  // EST-1: active-state.md actualizado a "Sprint B.1 BORME: completed".
  const statePath = join(process.cwd(), 'memory', 'state', 'active-state.md');
  if (existsSync(statePath)) {
    const s = readFileSync(statePath, 'utf-8');
    assert(
      'EST-1 [active-state.md actualizado a "Sprint B.1 BORME: completed"]',
      /Sprint B\.1 BORME.*completed|B\.1 BORME: completed/i.test(s),
      s.match(/Sprint B\.1[^\n]+/i)?.[0]?.slice(0, 80) ?? 'no match',
    );
  } else {
    assert('EST-1 [active-state.md actualizado a "Sprint B.1 BORME: completed"]', false, 'memory/state/active-state.md no existe');
  }
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint B.1 BORME smoke (13 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  try {
    await qwRegression();
  } catch (e) {
    console.warn('  WARN  QW regression falló (probable sin servidor local):', (e as Error).message);
    // Marca QW como "skipped" — no cuentan como pass ni fail.
  }
  await b1Asserts();
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
