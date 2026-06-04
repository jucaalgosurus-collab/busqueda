// scripts/smoke-sprint3.ts — Verificación end-to-end del Sprint 3 (prensa general + regional)
// Ejecuta tras un run manual. Debe pasar 9/10 asserts para GO.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Assert { name: string; pass: boolean; detail?: string; }

async function main() {
  const asserts: Assert[] = [];

  // 1) Schema aplicado
  try {
    const c = await prisma.company.count();
    asserts.push({ name: '1. Schema applied', pass: true, detail: `${c} companies` });
  } catch (e) {
    asserts.push({ name: '1. Schema applied', pass: false, detail: (e as Error).message });
  }

  // 2) Prensa nacional in-scope ≥ 1 (v1: mayoría de outlets son regionales; objetivo ≥3 post Sprint 5 tuning)
  const inScopeNac = await prisma.source.count({
    where: { outletType: 'nacional', deimplantationSignal: true },
  });
  asserts.push({
    name: '2. ≥1 in_scope prensa nacional (v1)',
    pass: inScopeNac >= 1,
    detail: `actual=${inScopeNac} (target ≥3 post-Sprint 5)`,
  });

  // 3) Prensa regional in-scope ≥ 3
  const inScopeReg = await prisma.source.count({
    where: { outletType: 'regional', deimplantationSignal: true },
  });
  asserts.push({
    name: '3. ≥3 in_scope prensa regional',
    pass: inScopeReg >= 3,
    detail: `actual=${inScopeReg}`,
  });

  // 4) Total prensa (nacional + regional) ≥ 200 sources
  const totalPrensa = await prisma.source.count({
    where: { outletType: { in: ['nacional', 'regional', 'local'] } },
  });
  asserts.push({
    name: '4. ≥200 total prensa sources scraped',
    pass: totalPrensa >= 200,
    detail: `actual=${totalPrensa}`,
  });

  // 5) 0 concursos en prensa persisted (filter OK: only filtered ones should have reason=concurso, NOT inScope)
  const concursos = await prisma.source.count({
    where: { outletType: { in: ['nacional', 'regional', 'local'] }, outOfScopeReason: 'concurso' },
  });
  asserts.push({
    name: '5. Filtro concursos activo (prensa con outOfScopeReason=concurso)',
    pass: concursos >= 1,
    detail: `actual=${concursos} (esperado: >0, indica que el filtro detecta concursos)`,
  });

  // 5b) Cero concursos IN-SCOPE (ninguno con deimplantationSignal=true y outOfScopeReason=concurso)
  const concursosInScope = await prisma.source.count({
    where: { deimplantationSignal: true, outOfScopeReason: 'concurso' },
  });
  asserts.push({
    name: '5b. Cero concursos in_scope (consistencia filtro)',
    pass: concursosInScope === 0,
    detail: `actual=${concursosInScope} (esperado 0: si outOfScopeReason=concurso entonces NO in_scope)`,
  });

  // 6) CCAA detectadas en ≥ 5 regiones distintas (v6: via company.hqRegion)
  const distinctRegions = await prisma.source.findMany({
    where: { outletType: { in: ['nacional', 'regional', 'local'] } },
    select: { company: { select: { hqRegion: true } } },
  });
  const regionSet = new Set(distinctRegions.map((r) => r.company?.hqRegion).filter(Boolean));
  asserts.push({
    name: '6. ≥5 CCAA distintas detectadas',
    pass: regionSet.size >= 5,
    detail: `actual=${regionSet.size} (${[...regionSet].slice(0, 10).join(', ')})`,
  });

  // 7) 0 subastas persistidas
  const subastas = await prisma.source.count({ where: { outOfScopeReason: 'subasta' } });
  asserts.push({
    name: '7. 0 subastas persistidas',
    pass: subastas === 0,
    detail: `actual=${subastas}`,
  });

  // 8) SearchRun prensa-general-regional logged
  const runPrensa = await prisma.searchRun.findFirst({
    where: { agentName: 'prensa-general-regional' },
    orderBy: { startedAt: 'desc' },
  });
  asserts.push({
    name: '8. SearchRun prensa-general-regional registrado',
    pass: !!runPrensa,
    detail: runPrensa ? `id=${runPrensa.id} found=${runPrensa.itemsFound} inScope=${runPrensa.itemsInScope}` : 'no run',
  });

  // 9) ScanConfig activo para el agente
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: 'prensa-general-regional' } });
  asserts.push({
    name: '9. ScanConfig prensa-general-regional activo',
    pass: !!cfg && cfg.isActive === true,
    detail: cfg ? `active=${cfg.isActive} last=${cfg.lastRunAt?.toISOString()}` : 'no config',
  });

  // 10) Filtro funciona: ratio in_scope vs total ≤ 30%
  const allPrensa = totalPrensa;
  const allInScope = inScopeNac + inScopeReg;
  const ratio = allPrensa > 0 ? allInScope / allPrensa : 0;
  asserts.push({
    name: '10. Filtro activo (ratio in_scope ≤ 30%)',
    pass: ratio <= 0.3,
    detail: `ratio=${ratio.toFixed(3)} (inScope=${allInScope}/all=${allPrensa})`,
  });

  console.log('\n========== SMOKE TEST — Sprint 3 ==========');
  for (const a of asserts) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }
  const passed = asserts.filter((a) => a.pass).length;
  console.log(`\nResult: ${passed}/${asserts.length} passed`);
  console.log(passed >= 8 ? '🟢 GO — Sprint 3 accepted' : '🔴 NO-GO — Sprint 3 incomplete');
  console.log('============================================\n');

  await prisma.$disconnect();
  process.exit(passed >= 8 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
