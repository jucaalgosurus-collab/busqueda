// scripts/smoke-sprint4.ts — Verificación end-to-end del Sprint 4 (BOE/BOP/LinkedIn/Hunter)
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

  // 2) BOE/BOP/sindicatos sources ≥ 10
  const totalBoe = await prisma.source.count({ where: { outletType: 'bofficial' } });
  asserts.push({
    name: '2. ≥10 BOE/BOP/sindicatos sources',
    pass: totalBoe >= 10,
    detail: `actual=${totalBoe}`,
  });

  // 3) BOE/BOP ERE detectado ≥ 1
  const inScopeBoe = await prisma.source.count({
    where: { outletType: 'bofficial', deimplantationSignal: true },
  });
  asserts.push({
    name: '3. ≥1 in_scope BOE/BOP',
    pass: inScopeBoe >= 1,
    detail: `actual=${inScopeBoe}`,
  });

  // 4) CERO concursos en in_scope (consistencia filtro negativo)
  const concursosInScope = await prisma.source.count({
    where: { deimplantationSignal: true, outOfScopeReason: 'concurso' },
  });
  asserts.push({
    name: '4. 0 concursos in_scope (consistencia filtro)',
    pass: concursosInScope === 0,
    detail: `actual=${concursosInScope}`,
  });

  // 5) SearchRun boe-bop-sindicatos logged
  const runBoe = await prisma.searchRun.findFirst({
    where: { agentName: 'boe-bop-sindicatos' },
    orderBy: { startedAt: 'desc' },
  });
  asserts.push({
    name: '5. SearchRun boe-bop-sindicatos registrado',
    pass: !!runBoe,
    detail: runBoe ? `id=${runBoe.id} found=${runBoe.itemsFound} inScope=${runBoe.itemsInScope}` : 'no run',
  });

  // 6) Decisores LinkedIn con linkedinUrl ≥ 5 (umbral v1: 1 query genera 0-3)
  const contactsWithLi = await prisma.plantContact.count({ where: { linkedinUrl: { not: null } } });
  asserts.push({
    name: '6. ≥5 contactos con LinkedIn',
    pass: contactsWithLi >= 5,
    detail: `actual=${contactsWithLi}`,
  });

  // 7) SearchRun linkedin-osint logged
  const runLi = await prisma.searchRun.findFirst({
    where: { agentName: 'linkedin-osint' },
    orderBy: { startedAt: 'desc' },
  });
  asserts.push({
    name: '7. SearchRun linkedin-osint registrado',
    pass: !!runLi,
    detail: runLi ? `id=${runLi.id} profiles=${runLi.itemsFound} contacts=${runLi.itemsInScope}` : 'no run',
  });

  // 8) Roles relevantes representados: al menos 2 distintos roleCategory
  const roles = await prisma.plantContact.groupBy({
    by: ['roleCategory'],
    where: { linkedinUrl: { not: null } },
    _count: { roleCategory: true },
  });
  asserts.push({
    name: '8. ≥2 roles distintos representados',
    pass: roles.length >= 2,
    detail: `roles=${roles.length} (${roles.map((r) => r.roleCategory).join(', ')})`,
  });

  // 9) Hunter.io enricher (si corrió): al menos 1 email_verified
  // (opcional si HUNTER_API_KEY no está configurado)
  const verified = await prisma.plantContact.count({ where: { emailVerified: true } });
  asserts.push({
    name: '9. Hunter enricher (≥1 email_verified) — opcional si HUNTER_API_KEY activa',
    pass: verified >= 1,
    detail: `actual=${verified} (si HUNTER_API_KEY no configurado, free tier no aplica)`,
  });

  // 10) Vista /contactos operativa: API export CSV responde
  let exportOk = false;
  try {
    const r = await fetch('http://localhost:3000/dossier/api/contactos/export.csv');
    exportOk = r.ok;
  } catch { exportOk = false; }
  asserts.push({
    name: '10. /dossier/api/contactos/export.csv responde 200',
    pass: exportOk,
    detail: exportOk ? 'OK' : 'no responde o error',
  });

  console.log('\n========== SMOKE TEST — Sprint 4 ==========');
  for (const a of asserts) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }
  const passed = asserts.filter((a) => a.pass).length;
  console.log(`\nResult: ${passed}/${asserts.length} passed`);
  console.log(passed >= 7 ? '🟢 GO — Sprint 4 accepted' : '🔴 NO-GO — Sprint 4 incomplete');
  console.log('============================================\n');

  await prisma.$disconnect();
  process.exit(passed >= 7 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
