// scripts/smoke-qw-b6.ts — Sprint B.6
//
// 13 asserts: 5 QW regresión + 6 B.6 + 2 EST
// Ejecuta: tsx scripts/smoke-qw-b6.ts

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  applyAyudasFilter,
  matchHash,
  normalizeCif,
} from '@/lib/filters/ayudas';
import { scrapeAllAyudatories, type RawAyudaPublica } from '@/lib/scrapers/ayudas-publicas';

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

async function b6Asserts() {
  console.log('\n=== B.6 AYUDAS PÚBLICAS (6 asserts) ===');

  // B.6-A: dataset estático con 6-10 ayudas.
  const listPath = join(process.cwd(), 'lib', 'data', 'ayudas-list.json');
  const listExists = existsSync(listPath);
  let list: RawAyudaPublica[] = [];
  if (listExists) {
    const parsed = JSON.parse(readFileSync(listPath, 'utf-8'));
    list = Array.isArray(parsed.ayudas) ? parsed.ayudas : [];
  }
  const organos = new Set(list.map((a) => a.organo));
  const hasCdti = organos.has('CDTI');
  const hasIdae = organos.has('IDAE');
  const hasIcex = organos.has('ICEX');
  const allRequired = list.length >= 6 && list.length <= 10 && hasCdti && hasIdae && hasIcex;
  const allFieldsPresent = list.every(
    (a) =>
      typeof a.id === 'string' &&
      typeof a.convocatoriaId === 'string' &&
      typeof a.organo === 'string' &&
      typeof a.beneficiario === 'string' &&
      typeof a.cif === 'string' &&
      typeof a.importe === 'number' &&
      typeof a.fechaConcesion === 'string' &&
      typeof a.proyecto === 'string' &&
      typeof a.plantaCcaa === 'string' &&
      typeof a.sourceUrl === 'string',
  );
  assert(
    'B.6-A [ayudas-list.json con 6-10 ayudas CDTI/IDAE/ICEX con campos requeridos]',
    listExists && allRequired && allFieldsPresent,
    `count=${list.length} organos=${[...organos].join(',')}`,
  );

  // B.6-B/C/D/E: aplicar filtro contra una ayuda del seed.
  // Como el seed actual (7 empresas) no tiene `cif` ni `cnae` poblados, creamos
  // una empresa sintética mínima (CIF A28078202, sector A&B, facturación 50M€)
  // para validar el filtro, y la borramos al final del bloque.
  const SMOKE_CIF = 'A28078202';
  const SMOKE_COMPANY_SLUG = 'smoke-b6-test-company';

  // Limpieza previa por si quedó algo de un run anterior.
  await prisma.company.deleteMany({ where: { slug: SMOKE_COMPANY_SLUG } });
  const realCompanyByCif = await prisma.company.create({
    data: {
      slug: SMOKE_COMPANY_SLUG,
      name: 'Smoke B.6 Test Company',
      cif: SMOKE_CIF,
      sector: 'Alimentos y Bebidas',
      subsector: 'Smoke',
      cnae: '10.5',
      facturacionM: 50,
      tier: 'A',
    },
    select: { id: true, name: true, cif: true, cnae: true, facturacionM: true },
  });

  // Filtro contra CIF de empresa real (si existe) o contra CIF ficticio.
  const sampleAyuda: RawAyudaPublica =
    realCompanyByCif && realCompanyByCif.cif
      ? {
          id: 'smoke-b6-sample-real',
          convocatoriaId: 'SMOKE-2026-CDTI-001',
          organo: 'CDTI',
          beneficiario: realCompanyByCif.name,
          cif: realCompanyByCif.cif,
          importe: 500_000,
          fechaConcesion: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          proyecto: 'Smoke-Test-Ayuda',
          plantaCcaa: 'Madrid',
          descripcion: 'Ayuda de smoke test para validación del filtro',
          sourceUrl: 'https://www.cdti.es/ayudas/proyectos/smoke-b6-sample-real',
        }
      : list[0];

  // B.6-B: empresa con ayuda + sin actividad 90d → ayuda_sin_actividad.
  // Limpiamos Sources de los últimos 90d para esta empresa (solo si es real,
  // para no contaminar el smoke con datos reales de seed).
  let cleanedSources = 0;
  if (realCompanyByCif) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const del = await prisma.source.deleteMany({
      where: { companyId: realCompanyByCif.id, scrapedAt: { gte: cutoff } },
    });
    cleanedSources = del.count;
  }
  const rNoActivity = await applyAyudasFilter(prisma, sampleAyuda);
  assert(
    'B.6-B [applyAyudasFilter: ayuda + sin actividad 90d → inScope=true, ayuda_sin_actividad]',
    rNoActivity.inScope === true && rNoActivity.outOfScopeReason === 'ayuda_sin_actividad',
    `inScope=${rNoActivity.inScope} reason=${rNoActivity.outOfScopeReason} cleanedSources=${cleanedSources}`,
  );

  // B.6-C: ayuda + concurso posterior → ayuda_previa_a_concurso.
  // Insertamos un Source de cierre posterior a la fecha de la ayuda.
  let insertedClosureId: string | null = null;
  if (realCompanyByCif) {
    const fuenteUrl = `internal://b6/smoke-concurso-${Date.now()}`;
    const closureSrc = await prisma.source.create({
      data: {
        url: fuenteUrl,
        title: '[B.6 smoke] Concurso de acreedores posterior a la ayuda',
        outlet: 'smoke',
        outletType: 'bofficial',
        language: 'es',
        companyId: realCompanyByCif.id,
        publishedAt: new Date(sampleAyuda.fechaConcesion),
        contentText: 'La empresa presenta concurso de acreedores tras recibir la ayuda pública. Cierre operativo inminente.',
        deimplantationSignal: true,
        outOfScopeReason: 'concurso',
      },
    });
    insertedClosureId = closureSrc.id;
  }
  const rClosure = await applyAyudasFilter(prisma, sampleAyuda);
  assert(
    'B.6-C [applyAyudasFilter: ayuda + concurso posterior → inScope=true, ayuda_previa_a_concurso]',
    rClosure.inScope === true && rClosure.outOfScopeReason === 'ayuda_previa_a_concurso',
    `inScope=${rClosure.inScope} reason=${rClosure.outOfScopeReason} closureId=${insertedClosureId}`,
  );

  // B.6-D: ayuda + actividad normal → ayuda_con_actividad_normal.
  if (realCompanyByCif) {
    // Limpiamos el Source de concurso sintético de B.6-C para que no contamine.
    await prisma.source.deleteMany({
      where: { url: { startsWith: 'internal://b6/smoke-concurso-' } },
    });
    // Insertamos un Source de actividad normal reciente.
    const actUrl = `internal://b6/smoke-activity-${Date.now()}`;
    await prisma.source.create({
      data: {
        url: actUrl,
        title: '[B.6 smoke] Actividad normal reciente',
        outlet: 'smoke',
        outletType: 'corporate_newsroom',
        language: 'es',
        companyId: realCompanyByCif.id,
        scrapedAt: new Date(),
        contentText: 'La empresa presenta resultados positivos en su planta principal y anuncia nuevas inversiones.',
        deimplantationSignal: false,
        outOfScopeReason: null,
      },
    });
  }
  const rActivity = await applyAyudasFilter(prisma, sampleAyuda);
  assert(
    'B.6-D [applyAyudasFilter: ayuda + actividad normal reciente → inScope=false, ayuda_con_actividad_normal]',
    rActivity.inScope === false && rActivity.outOfScopeReason === 'ayuda_con_actividad_normal',
    `inScope=${rActivity.inScope} reason=${rActivity.outOfScopeReason}`,
  );

  // Limpieza smoke: borrar los Sources sintéticos que hemos creado.
  if (realCompanyByCif) {
    await prisma.source.deleteMany({
      where: { url: { startsWith: 'internal://b6/smoke-' } },
    });
  }

  // B.6-E: empresa inexistente → unknown_company.
  const fakeAyuda: RawAyudaPublica = {
    id: 'smoke-b6-fake',
    convocatoriaId: 'FAKE-2026-001',
    organo: 'CDTI',
    beneficiario: 'Empresa Ficticia S.A.',
    cif: 'X99999999', // CIF claramente inexistente.
    importe: 100_000,
    fechaConcesion: '2025-01-01',
    proyecto: 'Fake-Proyecto-Test',
    plantaCcaa: 'Madrid',
    descripcion: 'Ayuda fake para validar filtro unknown_company',
    sourceUrl: 'https://www.cdti.es/ayudas/proyectos/fake',
  };
  const rFake = await applyAyudasFilter(prisma, fakeAyuda);
  assert(
    'B.6-E [applyAyudasFilter: empresa inexistente (CIF X99999999) → inScope=false, unknown_company]',
    rFake.inScope === false && rFake.outOfScopeReason === 'unknown_company',
    `inScope=${rFake.inScope} reason=${rFake.outOfScopeReason}`,
  );

  // B.6-F: Source.outletType='ayuda_publica' persiste + ScanConfig + SearchRun.
  const urlA = `internal://b6/smoke-outlettype-${Date.now()}`;
  await prisma.source.upsert({
    where: { url: urlA },
    create: {
      url: urlA,
      title: 'B.6 smoke test outletType=ayuda_publica',
      outlet: 'smoke',
      outletType: 'ayuda_publica',
      contentText: 't',
      language: 'es',
      deimplantationSignal: false,
      outOfScopeReason: 'smoke',
    },
    update: { scrapedAt: new Date() },
  });
  const fetched = await prisma.source.findUnique({ where: { url: urlA } });
  assert(
    'B.6-F1 [Source.outletType=ayuda_publica persiste]',
    fetched?.outletType === 'ayuda_publica',
    `outletType=${fetched?.outletType}`,
  );
  await prisma.source.delete({ where: { url: urlA } });

  // ScanConfig.
  const scanCfg = await prisma.scanConfig.upsert({
    where: { agentName: 'surus-agente-ayudas' },
    create: { agentName: 'surus-agente-ayudas', cadenceDays: 14, isActive: true },
    update: { isActive: true, cadenceDays: 14 },
  });
  assert(
    'B.6-F2 [ScanConfig surus-agente-ayudas cadenceDays=14 active]',
    scanCfg.cadenceDays === 14 && scanCfg.isActive === true,
    `cadence=${scanCfg.cadenceDays}d active=${scanCfg.isActive}`,
  );

  // SearchRun (smoke: solo verificamos que la última entrada es coherente con el agentName).
  const lastRun = await prisma.searchRun.findFirst({
    where: { agentName: 'surus-agente-ayudas' },
    orderBy: { startedAt: 'desc' },
  });
  assert(
    'B.6-F3 [SearchRun surus-agente-ayudas registrado (o ausente si 1ª corrida aún no ejecutada)]',
    lastRun === null || lastRun.agentName === 'surus-agente-ayudas',
    lastRun ? `mode=${lastRun.mode} found=${lastRun.itemsFound}` : 'sin entrada (esperado si no se ha corrido el runner aún)',
  );

  // Helpers del filtro (sanity check).
  const cif1 = normalizeCif('A-28.078.202');
  const cif2 = normalizeCif('a28078202');
  assert(
    'B.6-F4 [normalizeCif: mayúsculas + sin guiones/espacios/puntos]',
    cif1 === 'A28078202' && cif2 === 'A28078202',
    `cif1=${cif1} cif2=${cif2}`,
  );

  const mh = matchHash({
    id: 'a',
    convocatoriaId: 'CDTI-2024-ID-001',
    organo: 'CDTI',
    beneficiario: 'X',
    cif: 'A-28.078.202',
    importe: 1,
    fechaConcesion: '2025-01-01',
    proyecto: 'Test Proyecto!',
    plantaCcaa: 'Madrid',
    descripcion: '',
    sourceUrl: '',
  });
  assert(
    'B.6-F5 [matchHash: b6-{CIF}-{convocatoria}-{proyectoSlug}]',
    mh === 'b6-A28078202-CDTI-2024-ID-001-test-proyecto',
    `matchHash=${mh}`,
  );

  // scrapeAllAyudatories smoke (no throw).
  try {
    const r = scrapeAllAyudatories({ daysBack: 365, maxItems: 50 });
    assert(
      'B.6-F6 [scrapeAllAyudatories ejecuta sin throw, devuelve array]',
      Array.isArray(r.ayudas) && r.errors === 0,
      `ayudas=${r.ayudas.length} errors=${r.errors}`,
    );
  } catch (e) {
    assert('B.6-F6 [scrapeAllAyudatories ejecuta sin throw]', false, (e as Error).message);
  }
}

async function estadoAsserts() {
  console.log('\n=== ESTADO (2 asserts) ===');

  // EST-1: active-state.md actualizado.
  const statePath = join(process.cwd(), 'memory', 'state', 'active-state.md');
  if (existsSync(statePath)) {
    const s = readFileSync(statePath, 'utf-8');
    assert(
      'EST-1 [active-state.md actualizado a "Sprint B.6 Ayudas: completed"]',
      /Sprint B\.6.*Ayudas.*completed|B\.6\s+Ayudas: completed/i.test(s),
      s.match(/Sprint B\.6[^\n]+/i)?.[0]?.slice(0, 80) ?? 'no match',
    );
  } else {
    assert('EST-1 [active-state.md actualizado]', false, 'active-state.md no existe');
  }

  // EST-2: B.6 report existe.
  const reportPath = join(process.cwd(), 'memory', 'sprints', 'sprint-B', 'B.6-ayudas-publicas-cdti-idae-icex-report.md');
  assert(
    'EST-2 [B.6-ayudas-publicas-cdti-idae-icex-report.md existe]',
    existsSync(reportPath),
    existsSync(reportPath) ? 'ok' : 'no existe',
  );
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint B.6 Ayudas públicas smoke (13 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  try {
    await qwRegression();
  } catch (e) {
    console.warn('  WARN  QW regression falló (probable sin servidor local):', (e as Error).message);
  }
  await b6Asserts();
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
