// scripts/smoke-v6.ts — Verificación end-to-end de HERMES Dossier v6
// Ejecuta contra la DB del VPS (hermes_dossier_v6) y la app en producción.
// Debe pasar todos los asserts para GO.

import { PrismaClient } from '@prisma/client';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const prisma = new PrismaClient();

interface Assert {
  id: number;
  name: string;
  pass: boolean;
  detail?: string;
  category: 'schema' | 'seed' | 'api' | 'security' | 'structure';
}

const asserts: Assert[] = [];
let rid = 0;
const a = (name: string, pass: boolean, detail?: string, category: Assert['category'] = 'schema') => {
  asserts.push({ id: ++rid, name, pass, detail, category });
};

async function main() {
  console.log('=== HERMES DOSSIER v6 — SMOKE END-TO-END ===\n');

  // -------------------- 1. SCHEMA --------------------
  try {
    const count = await prisma.company.count();
    a('1. Schema v6 (Company table queryable)', true, `${count} companies`);
  } catch (e) {
    a('1. Schema v6 applied', false, e instanceof Error ? e.message : String(e));
  }

  // -------------------- 2. SEED v6 COUNTS --------------------
  const counts = {
    company: await prisma.company.count(),
    plant: await prisma.plant.count(),
    plantContact: await prisma.plantContact.count(),
    inventory: await prisma.technicalInventory.count(),
    operation: await prisma.operation.count(),
    timelineEvent: await prisma.timelineEvent.count(),
    financial: await prisma.financial.count(),
    source: await prisma.source.count(),
    auctionCheck: await prisma.auctionCheck.count(),
    document: await prisma.document.count(),
    note: await prisma.note.count(),
  };

  a('2. 7 companies seeded', counts.company === 7, `actual=${counts.company}`, 'seed');
  a('3. ≥30 plants seeded', counts.plant >= 30, `actual=${counts.plant}`, 'seed');
  a('4. ≥30 plantContacts seeded', counts.plantContact >= 30, `actual=${counts.plantContact}`, 'seed');
  a('5. ≥40 inventory items', counts.inventory >= 40, `actual=${counts.inventory}`, 'seed');
  a('6. ≥20 operations', counts.operation >= 20, `actual=${counts.operation}`, 'seed');
  a('7. ≥50 timeline events', counts.timelineEvent >= 50, `actual=${counts.timelineEvent}`, 'seed');
  a('8. ≥20 financials', counts.financial >= 20, `actual=${counts.financial}`, 'seed');
  a('9. ≥50 sources', counts.source >= 50, `actual=${counts.source}`, 'seed');
  a('10. ≥20 auction checks', counts.auctionCheck >= 20, `actual=${counts.auctionCheck}`, 'seed');

  // -------------------- 3. PLANT-CONTACT JOIN INTEGRITY --------------------
  // v6: PlantContact.plantId es NOT NULL. Buscamos rows donde el FK apunte a plant inexistente
  // (no se puede comprobar con `plant: null` porque el campo no es nullable).
  const allContacts = await prisma.plantContact.findMany({ select: { id: true, plantId: true } });
  const validPlantIds = new Set(
    (await prisma.plant.findMany({ select: { id: true } })).map((p) => p.id),
  );
  const orphanContacts = allContacts.filter((c) => !validPlantIds.has(c.plantId)).length;
  a('11. No orphan PlantContact (FK integrity)', orphanContacts === 0, `orphans=${orphanContacts}`, 'schema');

  // -------------------- 4. UNIQUE CONSTRAINTS --------------------
  const pescanova = await prisma.company.findUnique({ where: { slug: 'pescanova' } });
  a('12. Pescanova company exists', pescanova !== null, pescanova?.name, 'seed');
  if (pescanova) {
    const chapela = await prisma.plant.findFirst({
      where: { companyId: pescanova.id, name: 'Chapela' },
    });
    a('13. Pescanova Chapela plant exists', chapela !== null, chapela ? `${chapela.ccaa} · ${chapela.specialty}` : 'missing', 'seed');
  }

  // -------------------- 5. STRUCTURAL FILES --------------------
  const cwd = process.cwd();
  const requiredFiles = [
    'prisma/schema.prisma',
    'data/seed-v6.json',
    'scripts/seed-v6.ts',
    'app/contactos/page.tsx',
    'app/contactos/ContactosFilter.tsx',
    'app/contactos/ContactosFilter.tsx',
    'app/api/contactos/export.csv/route.ts',
    'app/api/contactos/search/route.ts',
    'app/api/empresas/[slug]/route.ts',
    'app/api/empresas/[slug]/notes/route.ts',
    'app/api/empresas/[slug]/upload/route.ts',
    'app/empresas/[slug]/page.tsx',
    'app/empresas/[slug]/empresa.css',
    'app/empresas/[slug]/_components/Hero.tsx',
    'app/empresas/[slug]/_components/KpiBento.tsx',
    'app/empresas/[slug]/_components/ContactsByPlant.tsx',
    'app/empresas/[slug]/_components/InventoryTable.tsx',
    'app/empresas/[slug]/_components/OperationsTimeline.tsx',
    'app/empresas/[slug]/_components/FinancialChart.tsx',
    'app/empresas/[slug]/_components/PlantMap.tsx',
    'app/empresas/[slug]/_components/AuctionGrid.tsx',
    'app/empresas/[slug]/_components/SourcesList.tsx',
    'app/empresas/[slug]/_components/DocumentsGrid.tsx',
    'app/empresas/[slug]/_components/NotesEditor.tsx',
    'app/empresas/[slug]/_components/ActionBar.tsx',
    'lib/scrapers/anti-detect/index.ts',
    'lib/scrapers/anti-detect/stealth.ts',
    'lib/scrapers/anti-detect/rate-limiter.ts',
    'lib/scrapers/anti-detect/user-agent-rotator.ts',
    'lib/scrapers/anti-detect/proxy-rotator.ts',
    'lib/scrapers/anti-detect/flaresolverr.ts',
    'docs/AUDIT-ANTI-DETECCION-V2.md',
  ];
  for (const f of requiredFiles) {
    const p = join(cwd, f);
    a(`FILE ${f}`, existsSync(p), existsSync(p) ? `${statSync(p).size} bytes` : 'MISSING', 'structure');
  }

  // -------------------- 6. SECURITY: NO SECRETS IN JSON --------------------
  const seedJson = JSON.parse(readFileSync(join(cwd, 'data/seed-v6.json'), 'utf-8'));
  const seedStr = JSON.stringify(seedJson);
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /AIzaSy[A-Za-z0-9_-]{20,}/,
    /AQ\.Ab[A-Za-z0-9_-]{20,}/,
    /ce0edc32d98cd7d9e02a5e64ac67ff8f69c66f6e/,
    /Surus2024!/,
    /Hermes2026/,
  ];
  let leakedSecret = '';
  for (const p of secretPatterns) {
    if (p.test(seedStr)) {
      leakedSecret = p.source;
      break;
    }
  }
  a('14. seed-v6.json no contiene secretos', !leakedSecret, leakedSecret ? `LEAK: ${leakedSecret}` : 'clean', 'security');

  // -------------------- 7. .env.example exists --------------------
  const envExample = existsSync(join(cwd, '.env.example'));
  a('15. .env.example present (placeholders OK in git)', envExample, 'present', 'security');

  // -------------------- RESUMEN --------------------
  const total = asserts.length;
  const passed = asserts.filter((x) => x.pass).length;
  const failed = asserts.filter((x) => !x.pass);

  console.log('\n--- Categoría: schema ---');
  for (const a of asserts.filter((x) => x.category === 'schema')) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }
  console.log('\n--- Categoría: seed ---');
  for (const a of asserts.filter((x) => x.category === 'seed')) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }
  console.log('\n--- Categoría: structure ---');
  for (const a of asserts.filter((x) => x.category === 'structure')) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }
  console.log('\n--- Categoría: security ---');
  for (const a of asserts.filter((x) => x.category === 'security')) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }

  console.log(`\n=== ${passed}/${total} asserts passed ===`);
  if (failed.length > 0) {
    console.log(`\n🔴 FAILED (${failed.length}):`);
    for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail ?? 'no detail'}`);
    console.log('\nNO-GO: build not accepted.');
  } else {
    console.log('\n🟢 GO: v6 build accepted.');
  }

  await prisma.$disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
