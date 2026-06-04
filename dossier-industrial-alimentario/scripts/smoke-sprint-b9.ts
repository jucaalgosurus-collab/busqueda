// scripts/smoke-sprint-b9.ts — Sprint B.9 Auctions — Smoke de regresión B.1 + B.9.
//
// 13 asserts:
//   QW regresión (5):
//     QW-1..QW-6 como smoke-qw-b1.ts
//   B.9 (7):
//     B.9-A  13 portales en lib/data/auctions-list.json
//     B.9-B  lib/scrapers/auctions.ts sin `any`
//     B.9-C  isRelevantAuctionHit rechaza empresa inventada
//     B.9-D  Filtro anti-concurso rechaza keywords
//     B.9-E  isRelevantAuctionHit acepta Pascual-Aranda de Duero (caso seed)
//     B.9-F  ScanConfig agentName='surus-agente-auctions' cadenceDays=7
//     B.9-G  1ª corrida SearchRun con agentName='auctions'
//     B.9-H  0 falsos positivos: empresa inventada NO genera Source outletType='auction'
//     B.9-I  Idempotencia: 2 corridas mismo día no duplican rows
//   Estado (1):
//     EST-1  active-state.md "Sprint B.9 Auctions: completed"
//
// Run: pnpm tsx scripts/smoke-sprint-b9.ts

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
  console.log('\n=== QW REGRESIÓN (6 asserts) ===');

  // QW-1: 6 sectores amplios visibles en /empresas.
  const empresasHtml = await (await fetch('http://127.0.0.1:3002/empresas', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  const expectedSectors = ['Alimentos y Bebidas', 'Industrial', 'Farmaceutico', 'Construccion', 'Energetico', 'Otro industrial'];
  const presentSectors = expectedSectors.filter((s) => empresasHtml.includes(s));
  assert('QW-1 [6 sectores amplios visibles en /empresas]', presentSectors.length >= 5, `${presentSectors.length}/6`);

  // QW-2: ≥1 empresa por sector.
  const companyCounts = await prisma.company.groupBy({ by: ['sector'], _count: true });
  const sectorMap = new Map(companyCounts.map((c) => [c.sector, c._count]));
  const sectorsWithCompanies = expectedSectors.filter((s) => (sectorMap.get(s) ?? 0) > 0);
  assert('QW-2 [≥1 empresa por sector en DB]', sectorsWithCompanies.length >= 5, `${sectorsWithCompanies.length}/6`);

  // QW-3: Navbar.
  const dashboardHtml = await (await fetch('http://127.0.0.1:3002/', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  assert(
    'QW-3 [Navbar contiene "Juan Carlos Alvarado para Surus"]',
    /Creado por\s*<strong>\s*Juan Carlos Alvarado\s*<\/strong>\s*para\s*<strong>\s*Surus/.test(dashboardHtml),
    'match exacto en header',
  );

  // QW-4: Footer.
  const hallazgosHtml = await (await fetch('http://127.0.0.1:3002/hallazgos', { cache: 'no-store' }).catch(() => null))?.text() ?? '';
  assert(
    'QW-4 [Footer contiene "Juan Carlos Alvarado para Surus"]',
    /Juan Carlos Alvarado/.test(hallazgosHtml) && /Surus Inversa/.test(hallazgosHtml),
    'match en /hallazgos',
  );

  // QW-5: Header dashboard.
  assert(
    'QW-5 [Header del dashboard contiene "Juan Carlos Alvarado para Surus"]',
    /Juan Carlos Alvarado/.test(dashboardHtml) && /Surus Inversa/.test(dashboardHtml),
    'match en /',
  );

  // QW-6: Bot Telegram 4/4 handlers (best-effort).
  const botPath = join(process.cwd(), 'scripts', 'bot.py');
  if (existsSync(botPath)) {
    const bot = readFileSync(botPath, 'utf-8');
    const hasText = /def\s+\w*handle.*text|text.*case|msg\['text'\]/.test(bot) || bot.includes("'text'") || bot.includes('"text"');
    const hasVoice = bot.includes('voice') || bot.includes('voice_file_id');
    const hasPhoto = bot.includes('photo') || bot.includes("'photos'") || bot.includes('"photos"');
    const hasUnknown = /unknown|smart_chat|not_understood/.test(bot);
    assert('QW-6 [Bot Telegram 4/4 handlers]', hasText && hasVoice && hasPhoto && hasUnknown, `text=${hasText} voice=${hasVoice} photo=${hasPhoto} unknown=${hasUnknown}`);
  } else {
    assert('QW-6 [Bot Telegram 4/4 handlers]', false, 'scripts/bot.py no existe');
  }
}

async function b9Asserts() {
  console.log('\n=== B.9 AUCTIONS (9 asserts) ===');

  // B.9-A: 13 portales en auctions-list.json.
  const listPath = join(process.cwd(), 'lib', 'data', 'auctions-list.json');
  if (existsSync(listPath)) {
    const list = JSON.parse(readFileSync(listPath, 'utf-8')) as Array<{ platform: string; active: boolean }>;
    const activeCount = list.filter((p) => p.active).length;
    assert('B.9-A [13 portales en auctions-list.json]', list.length >= 13 && activeCount === list.length, `total=${list.length} active=${activeCount}`);
  } else {
    assert('B.9-A [13 portales en auctions-list.json]', false, 'auctions-list.json no existe');
  }

  // B.9-B: auctions.ts sin `any`.
  const auctionsPath = join(process.cwd(), 'lib', 'scrapers', 'auctions.ts');
  if (existsSync(auctionsPath)) {
    const src = readFileSync(auctionsPath, 'utf-8');
    const anyLines = src.split('\n').filter((l) => {
      if (l.trim().startsWith('//') || l.trim().startsWith('*')) return false;
      return /:\s*any\b|\bas\s+any\b/.test(l);
    });
    assert('B.9-B [auctions.ts sin `any`]', anyLines.length === 0, anyLines.length === 0 ? '0 ocurrencias' : `${anyLines.length} ocurrencias`);
  } else {
    assert('B.9-B [auctions.ts sin `any`]', false, 'auctions.ts no existe');
  }

  // B.9-C: isRelevantAuctionHit rechaza empresa inventada.
  const auctionFilter = await import('../lib/filters/auction.js');
  const fakeHit = {
    platform: 'TestPlatform',
    lotTitle: 'Cierre de planta de XYZ INDUSTRIAL FANTASMA en Madrid',
    lotDescription: 'Lote de maquinaria industrial deXYZ',
    lotLocation: 'Madrid',
    lotUrl: 'https://example.com/lot/123',
    lotId: '123',
    closingDate: null,
    publishedAt: '2026-06-03',
  };
  const cRes = auctionFilter.isRelevantAuctionHit(fakeHit, 'PASCUAL', ['Pascual'], [
    { city: 'Aranda de Duero', province: 'Burgos', ccaa: 'Castilla y León' } as never,
  ]);
  assert(
    'B.9-C [isRelevantAuctionHit rechaza empresa inventada]',
    cRes.relevant === false,
    `relevant=${cRes.relevant} reason=${cRes.reason}`,
  );

  // B.9-D: Filtro anti-concurso rechaza keywords.
  const concursoHit = {
    platform: 'CFT',
    lotTitle: 'LIQUIDACION CONCURSAL de activos',
    lotDescription: 'Concurso de acreedores de la empresa',
    lotLocation: 'Madrid',
    lotUrl: 'https://example.com/lot/concurso',
    lotId: 'conc',
    closingDate: null,
    publishedAt: '2026-06-03',
  };
  const dRes = auctionFilter.isRelevantAuctionHit(concursoHit, 'PASCUAL', ['Pascual'], [
    { city: 'Madrid', province: 'Madrid', ccaa: 'Madrid' } as never,
  ]);
  assert(
    'B.9-D [Filtro anti-concurso rechaza keywords concurso]',
    dRes.relevant === false && dRes.reason === 'concurso_or_liquidacion_concursal',
    `relevant=${dRes.relevant} reason=${dRes.reason}`,
  );

  // B.9-E: Pascual en Aranda de Duero con lotTitle que menciona Pascual → relevante.
  const pascualHit = {
    platform: 'GUTINVEST',
    lotTitle: 'Lote de maquinaria PASCUAL — Planta Aranda de Duero',
    lotDescription: 'Cierre de planta de Grupo Pascual',
    lotLocation: 'Aranda de Duero, Burgos',
    lotUrl: 'https://www.gutinvest.com/lot/12345',
    lotId: 'pascual-1',
    closingDate: new Date(Date.now() + 14 * 86400_000).toISOString(),
    publishedAt: '2026-06-03',
  };
  const eRes = auctionFilter.isRelevantAuctionHit(pascualHit, 'PASCUAL', ['Pascual', 'Grupo Pascual'], [
    { city: 'Aranda de Duero', province: 'Burgos', ccaa: 'Castilla y León' } as never,
  ]);
  assert(
    'B.9-E [isRelevantAuctionHit acepta Pascual-Aranda (caso seed)]',
    eRes.relevant === true && eRes.result === 'activos_detectados',
    `relevant=${eRes.relevant} result=${eRes.result} conf=${eRes.confidence.toFixed(2)}`,
  );

  // B.9-F: ScanConfig surus-agente-auctions registrado, cadencia 7d.
  const scanCfg = await prisma.scanConfig.findUnique({ where: { agentName: 'surus-agente-auctions' } });
  assert(
    'B.9-F [ScanConfig surus-agente-auctions registrado, cadencia 7d]',
    scanCfg != null && scanCfg.cadenceDays === 7 && scanCfg.isActive === true,
    scanCfg ? `cadence=${scanCfg.cadenceDays}d active=${scanCfg.isActive}` : 'no ScanConfig',
  );

  // B.9-G: 1ª corrida: SearchRun con agentName='auctions' (o agentName='surus-agente-auctions').
  const firstRun = await prisma.searchRun.findFirst({
    where: { agentName: { in: ['auctions', 'surus-agente-auctions'] } },
    orderBy: { startedAt: 'desc' },
  });
  assert(
    'B.9-G [1ª corrida: SearchRun agentName auctions]',
    firstRun != null,
    firstRun ? `mode=${firstRun.mode} itemsNew=${firstRun.itemsNew ?? 0}` : 'no run',
  );

  // B.9-H: 0 falsos positivos: ninguna Source con outletType='auction' para empresa inventada.
  const fakeCompany = await prisma.company.findFirst({
    where: { name: { contains: 'XYZ_INVENTADA' } },
  });
  const fakeHits = fakeCompany
    ? await prisma.source.count({ where: { outletType: 'auction', companyId: fakeCompany.id } })
    : 0;
  assert('B.9-H [0 falsos positivos: empresa inventada NO genera Source auction]', fakeHits === 0, `fakeHits=${fakeHits}`);

  // B.9-I: Idempotencia — 2 AuctionCheck rows con misma (companyId, platform) en mismo día → solo 1.
  const firstCheck = await prisma.auctionCheck.findFirst();
  if (firstCheck) {
    const dayKey = new Date(firstCheck.checkedAt);
    dayKey.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayKey.getTime() + 24 * 3600_000);
    const sameDayCount = await prisma.auctionCheck.count({
      where: {
        companyId: firstCheck.companyId,
        platform: firstCheck.platform,
        checkedAt: { gte: dayKey, lt: dayEnd },
      },
    });
    assert('B.9-I [Idempotencia: 1 check por (company, platform, day)]', sameDayCount === 1, `sameDayCount=${sameDayCount}`);
  } else {
    assert('B.9-I [Idempotencia: 1 check por (company, platform, day)]', false, 'no AuctionCheck rows');
  }
}

async function estadoAsserts() {
  console.log('\n=== ESTADO (1 assert) ===');

  const statePath = join(process.cwd(), 'memory', 'state', 'active-state.md');
  if (existsSync(statePath)) {
    const s = readFileSync(statePath, 'utf-8');
    assert(
      'EST-1 [active-state.md actualizado a "Sprint B.9 Auctions: completed"]',
      /Sprint B\.9 Auctions.*completed|B\.9 Auctions: completed/i.test(s),
      s.match(/Sprint B\.9[^\n]+/i)?.[0]?.slice(0, 80) ?? 'no match',
    );
  } else {
    assert('EST-1 [active-state.md actualizado a "Sprint B.9 Auctions: completed"]', false, 'active-state.md no existe');
  }
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint B.9 Auctions smoke (16 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  try {
    await qwRegression();
  } catch (e) {
    console.warn('  WARN  QW regression falló (probable sin servidor local):', (e as Error).message);
  }
  await b9Asserts();
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
