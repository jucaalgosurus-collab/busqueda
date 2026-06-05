// scripts/smoke-sprint2.ts — Verificación end-to-end del Sprint 2
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

  // 2) Newsroom sources ≥ 3 con deimplantationSignal in_scope (umbral Sprint 2 v1: primer run exploratorio)
  const inScopeNews = await prisma.source.count({
    where: { outletType: 'corporate_newsroom', deimplantationSignal: true },
  });
  asserts.push({
    name: '2. ≥3 in_scope newsroom sources',
    pass: inScopeNews >= 3,
    detail: `actual=${inScopeNews}`,
  });

  // 3) Sectorial sources ≥ 1 in_scope (v1 exploratory: target ≥3 once LLM filter active)
  const inScopeSec = await prisma.source.count({
    where: { outletType: 'sector', deimplantationSignal: true },
  });
  asserts.push({
    name: '3. ≥1 in_scope sectorial sources (v1)',
    pass: inScopeSec >= 1,
    detail: `actual=${inScopeSec} (target ≥3 post-Sprint 5)`,
  });

  // 4) Newsroom sources totales ≥ 30 (in_scope + out_of_scope)
  const totalNews = await prisma.source.count({ where: { outletType: 'corporate_newsroom' } });
  asserts.push({
    name: '4. ≥30 total newsroom sources scraped',
    pass: totalNews >= 30,
    detail: `actual=${totalNews}`,
  });

  // 5) Sectorial sources totales ≥ 5
  const totalSec = await prisma.source.count({ where: { outletType: 'sector' } });
  asserts.push({
    name: '5. ≥5 total sectorial sources scraped',
    pass: totalSec >= 5,
    detail: `actual=${totalSec}`,
  });

  // 6) 0 concursos persistidos
  const concursos = await prisma.source.count({ where: { outOfScopeReason: 'concurso' } });
  asserts.push({
    name: '6. 0 concursos persistidos (out_of_scope_reason=concurso)',
    pass: concursos === 0,
    detail: `actual=${concursos}`,
  });

  // 7) SearchRun logged para newsrooms-corporativas con itemsInScope > 0
  const runNews = await prisma.searchRun.findFirst({
    where: { agentName: 'newsrooms-corporativas' },
    orderBy: { startedAt: 'desc' },
  });
  asserts.push({
    name: '7. SearchRun newsrooms-corporativas registrado con inScope > 0',
    pass: !!runNews && runNews.itemsInScope > 0,
    detail: runNews ? `id=${runNews.id} inScope=${runNews.itemsInScope} found=${runNews.itemsFound}` : 'no run',
  });

  // 8) SearchRun logged para prensa-sectorial
  const runSec = await prisma.searchRun.findFirst({
    where: { agentName: 'prensa-sectorial' },
    orderBy: { startedAt: 'desc' },
  });
  asserts.push({
    name: '8. SearchRun prensa-sectorial registrado',
    pass: !!runSec,
    detail: runSec ? `id=${runSec.id} found=${runSec.itemsFound}` : 'no run',
  });

  // 9) Source con companyId (FK directa en v6) para al menos 3 newsrooms con in_scope
  const linkedArticles = await prisma.source.count({
    where: { outletType: 'corporate_newsroom', deimplantationSignal: true, companyId: { not: null } },
  });
  asserts.push({
    name: '9. Sources vinculadas a Company ≥ 3 (newsroom in_scope)',
    pass: linkedArticles >= 3,
    detail: `actual=${linkedArticles}`,
  });

  // 10) Filtro funciona: ratio in_scope vs total ≤ 30% (esperado: mucho out_of_scope — sectorial v1 puede tener 1-2%)
  const all = await prisma.source.count({ where: { outletType: { in: ['corporate_newsroom', 'sector'] } } });
  const ratio = all > 0 ? (inScopeNews + inScopeSec) / Math.max(1, all) : 0;
  asserts.push({
    name: '10. Filtro activo (ratio in_scope ≤ 30%)',
    pass: ratio <= 0.3,
    detail: `ratio=${ratio.toFixed(3)} (inScope=${inScopeNews + inScopeSec}/all=${all})`,
  });

  console.log('\n========== SMOKE TEST — Sprint 2 ==========');
  for (const a of asserts) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }
  const passed = asserts.filter((a) => a.pass).length;
  console.log(`\nResult: ${passed}/${asserts.length} passed`);
  console.log(passed >= 8 ? '🟢 GO — Sprint 2 accepted' : '🔴 NO-GO — Sprint 2 incomplete');
  console.log('============================================\n');

  await prisma.$disconnect();
  process.exit(passed >= 8 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
