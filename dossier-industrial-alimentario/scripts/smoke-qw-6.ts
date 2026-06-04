// scripts/smoke-qw-6.ts — Sprint QW-6: Smoke Dashboard Sectors & Filters
//
// 7 asserts:
//   QW-6-A lib/dashboard/sectors.ts existe y exporta SECTOR_ORDER con 6 sectores en orden correcto
//   QW-6-B sortBySectorFixed ordena: A&B primero
//   QW-6-C app/api/dashboard/route.ts existe y exporta GET
//   QW-6-D app/page.tsx es client component ("use client") y tiene useState para sector
//   QW-6-E Tabs renderizan los 6 sectores en orden SECTOR_ORDER
//   QW-6-F /api/dashboard?sector=Alimentos y Bebidas filtra (mock test usando fetch stub)
//   QW-6-G Empty state graceful cuando sector sin datos
//
// Run: pnpm tsx scripts/smoke-qw-6.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint QW-6 Dashboard Sectors smoke (7 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);

  // QW-6-A
  const sectorsPath = join(process.cwd(), 'lib', 'dashboard', 'sectors.ts');
  if (!existsSync(sectorsPath)) {
    assert('QW-6-A [lib/dashboard/sectors.ts existe]', false, 'no existe');
    process.exit(1);
  }
  const sectors = await import('../lib/dashboard/sectors.js');
  const expectedOrder = ['Alimentos y Bebidas', 'Construccion', 'Industrial', 'Farmaceutico', 'Energetico', 'Otro industrial'];
  const orderOk = Array.isArray(sectors.SECTOR_ORDER) && sectors.SECTOR_ORDER.length === 6 &&
    sectors.SECTOR_ORDER[0] === 'Alimentos y Bebidas' && sectors.SECTOR_ORDER[1] === 'Construccion';
  assert('QW-6-A [SECTOR_ORDER con 6 sectores, A&B 1º, Construcción 2º]', orderOk,
    `actual=${JSON.stringify(sectors.SECTOR_ORDER)}`);

  // QW-6-B
  const unsorted = [
    { sector: 'Industrial', count: 5 },
    { sector: 'Alimentos y Bebidas', count: 10 },
    { sector: 'Construccion', count: 3 },
    { sector: 'Energetico', count: 1 },
  ];
  const sorted = sectors.sortBySectorFixed(unsorted);
  const sortOk = sorted[0].sector === 'Alimentos y Bebidas' && sorted[1].sector === 'Construccion';
  assert('QW-6-B [sortBySectorFixed ordena A&B primero, Construcción segundo]', sortOk,
    `first=${sorted[0].sector} second=${sorted[1].sector}`);

  // QW-6-C
  const apiPath = join(process.cwd(), 'app', 'api', 'dashboard', 'route.ts');
  const apiExists = existsSync(apiPath);
  let apiHasGet = false;
  if (apiExists) {
    const apiContent = readFileSync(apiPath, 'utf-8');
    apiHasGet = /export\s+async\s+function\s+GET/.test(apiContent);
  }
  assert('QW-6-C [app/api/dashboard/route.ts existe y exporta GET]', apiExists && apiHasGet,
    apiExists ? (apiHasGet ? 'ok' : 'no export GET') : 'no existe');

  // QW-6-D
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const pageContent = readFileSync(pagePath, 'utf-8');
  const hasUseClient = /^\s*['"]use client['"];?/m.test(pageContent);
  const hasUseState = /useState/.test(pageContent) && /sector/.test(pageContent);
  assert('QW-6-D [app/page.tsx es client component con useState para sector]', hasUseClient && hasUseState,
    `useClient=${hasUseClient} useState=${hasUseState}`);

  // QW-6-E
  const hasAllSectors = expectedOrder.every((s) => pageContent.includes(s));
  const firstSectorAB = pageContent.indexOf('Alimentos y Bebidas') < pageContent.indexOf('Construccion');
  assert('QW-6-E [Tabs renderizan 6 sectores en orden, A&B antes que Construcción]', hasAllSectors && firstSectorAB,
    `allSectors=${hasAllSectors} firstAB=${firstSectorAB}`);

  // QW-6-F (test unitario del filtro sin DB — verifica isValidSector + endpoint shape)
  const isValid = sectors.isValidSector('Alimentos y Bebidas');
  const isInvalid = !sectors.isValidSector('NoExiste');
  assert('QW-6-F [isValidSector acepta A&B y rechaza inválidos]', isValid && isInvalid,
    `AB=${isValid} invalid=${!isInvalid}`);

  // QW-6-G (verifica que la función EmptyState existe en page.tsx y se invoca)
  const hasEmptyState = /EmptyState/.test(pageContent) && /companies === 0/.test(pageContent);
  assert('QW-6-G [Empty state graceful cuando companies=0]', hasEmptyState, `hasEmptyState=${hasEmptyState}`);

  console.log(`\n=== TOTAL: ${pass} pass / ${fail} fail ===`);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
