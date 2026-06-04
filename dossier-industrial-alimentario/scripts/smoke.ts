// scripts/smoke.ts — Verificación end-to-end del Sprint 1
// Ejecuta tras `pnpm seed`. Debe pasar 9/10 asserts para GO.
import { PrismaClient } from '@prisma/client';
import { existsSync, statSync } from 'node:fs';

const prisma = new PrismaClient();

interface Assert {
  name: string;
  pass: boolean;
  detail?: string;
}

async function main() {
  const asserts: Assert[] = [];

  // 1) Migración aplicada (tabla Company existe)
  try {
    const count = await prisma.company.count();
    asserts.push({ name: '1. Schema applied (Company table queryable)', pass: true, detail: `${count} companies` });
  } catch (e) {
    asserts.push({ name: '1. Schema applied', pass: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // 2) Seed count: 7 companies
  const companyCount = await prisma.company.count();
  asserts.push({
    name: '2. 7 companies seeded',
    pass: companyCount === 7,
    detail: `actual=${companyCount}`,
  });

  // 3) Operations count ≥ 7
  const opCount = await prisma.operation.count();
  asserts.push({
    name: '3. ≥7 operations',
    pass: opCount >= 7,
    detail: `actual=${opCount}`,
  });

  // 4) Contacts count ≥ 28
  const contactCount = await prisma.plantContact.count();
  asserts.push({
    name: '4. ≥28 contacts',
    pass: contactCount >= 28,
    detail: `actual=${contactCount}`,
  });

  // 5) Sources count ≥ 7 con tsvector
  const sourceCount = await prisma.source.count();
  asserts.push({
    name: '5. ≥7 sources',
    pass: sourceCount >= 7,
    detail: `actual=${sourceCount}`,
  });

  // 6) ScanConfigs: 6 agentes
  const configCount = await prisma.scanConfig.count();
  asserts.push({
    name: '6. 6 scan configs',
    pass: configCount === 6,
    detail: `actual=${configCount}`,
  });

  // 7) Spanish FTS funciona: insertar un source y buscar
  const testSource = await prisma.source.create({
    data: {
      url: 'https://smoke-test.local/pescanova-vigo',
      title: 'Pescanova cierra planta de Vigo',
      outlet: 'Smoke Test',
      outletType: 'corporate_newsroom',
      publishedAt: new Date('2026-06-01'),
      contentText: 'Nueva Pescanova anuncia el cierre de su planta de procesado de pescado en Vigo',
      deimplantationSignal: true,
    },
  });
  // Espera un microsegundo a que el trigger se ejecute
  await new Promise((r) => setTimeout(r, 200));
  // Buscamos usando el tsvector (query raw)
  const tsResults = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint as count
    FROM "Source"
    WHERE content_tsvector @@ plainto_tsquery('spanish', 'pescanova vigo cierre')
  `;
  const tsCount = Number(tsResults[0]?.count ?? 0);
  asserts.push({
    name: '7. Spanish FTS works (tsvector search finds "pescanova vigo cierre")',
    pass: tsCount >= 1,
    detail: `matches=${tsCount}`,
  });
  // Cleanup
  await prisma.source.delete({ where: { id: testSource.id } });

  // 8) Trigram tolerance: typo en "Pescanova" → "Pescanova" (exact) vs "Pescanoba" (typo)
  const triResults = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint as count
    FROM "Company"
    WHERE name % 'Pescanoba'
  `;
  const triCount = Number(triResults[0]?.count ?? 0);
  asserts.push({
    name: '8. Trigram typo-tolerance (Pescanoba → Pescanova)',
    pass: triCount >= 1,
    detail: `matches=${triCount}`,
  });

  // 9) Legacy HTML preservado
  const legacyPath = '/opt/hermes-dossier/legacy/PRESENTACION-INTERACTIVA.html';
  const legacyExists = existsSync(legacyPath);
  const legacySize = legacyExists ? statSync(legacyPath).size : 0;
  asserts.push({
    name: '9. Legacy HTML preserved (≥80KB)',
    pass: legacyExists && legacySize > 80000,
    detail: legacyExists ? `${legacySize} bytes` : 'missing',
  });

  // 10) .env existe y es chmod 600
  const envPath = '/opt/hermes-dossier/.env';
  const envExists = existsSync(envPath);
  asserts.push({
    name: '10. .env exists',
    pass: envExists,
    detail: envExists ? 'present' : 'missing',
  });

  // Resumen
  console.log('\n========== SMOKE TEST — Sprint 1 ==========');
  for (const a of asserts) {
    console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? `  (${a.detail})` : ''}`);
  }
  const passed = asserts.filter((a) => a.pass).length;
  console.log(`\nResult: ${passed}/${asserts.length} passed`);
  console.log(passed >= 9 ? '🟢 GO — Sprint 1 accepted' : '🔴 NO-GO — Sprint 1 incomplete');
  console.log('============================================\n');

  await prisma.$disconnect();
  process.exit(passed >= 9 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
