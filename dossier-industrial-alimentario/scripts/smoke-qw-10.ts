// scripts/smoke-qw-10.ts — QW-10: Responsables por sede (noticia → planta → contactos)
// 9 asserts: schema, SQL, endpoints, componente, página, idempotencia, tipos
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const F = (rel: string) => path.join(ROOT, rel);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

function read(rel: string): string {
  const p = F(rel);
  if (!fs.existsSync(p)) throw new Error(`file not found: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

console.log('\n[QW-10] Responsables por sede (Source → Plant → Contacts) — smoke\n');

const schema = read('prisma/schema.prisma');
const sql = read('deploy/qw10-source-plant.sql');
const hallazgosRoute = read('app/api/hallazgos/[id]/responsables/route.ts');
const porSedeRoute = read('app/api/responsables/por-sede/route.ts');
const card = read('app/empresas/[slug]/_components/ResponsablesPorSedeCard.tsx');
const page = read('app/empresas/[slug]/page.tsx');
const hallazgoPage = read('app/hallazgos/[id]/page.tsx');
const backfill = read('scripts/backfill-source-plant.ts');

// 1. Schema: Source tiene plantId + relación Plant
check(
  'prisma/schema.prisma: Source tiene plantId opcional + relación Plant',
  /model\s+Source\s*\{[\s\S]*?plantId\s+String\?\s+[\s\S]*?plant\s+Plant\?/.test(schema),
);

// 2. Schema: índice en Source.plantId
check(
  'prisma/schema.prisma: Source.@@index incluye plantId',
  /@@index\(\[plantId\]\)/.test(schema),
);

// 3. Schema: Plant tiene sources (relación inversa)
check(
  'prisma/schema.prisma: Plant.sources[] como relación inversa',
  /sources\s+Source\[\]/.test(schema),
);

// 4. SQL migración: ALTER TABLE + IF NOT EXISTS (idempotente) + FK SetNull
check(
  'deploy/qw10-source-plant.sql idempotente: ADD COLUMN IF NOT EXISTS',
  /ADD COLUMN IF NOT EXISTS "plantId"/.test(sql),
);
check(
  'deploy/qw10-source-plant.sql: FK con ON DELETE SET NULL',
  /ON DELETE SET NULL/.test(sql),
);

// 5. Endpoint hallazgos/[id]/responsables: usa prisma.plantContact.findMany filtrado por plantId del Source
check(
  'app/api/hallazgos/[id]/responsables/route.ts: query contactos por plantId',
  /prisma\.plantContact\.findMany\(\s*\{[\s\S]*?where:\s*\{\s*plantId:\s*source\.plantId/.test(hallazgosRoute),
);
check(
  'app/api/hallazgos/[id]/responsables/route.ts: 404 con sugerencia si no plantId',
  /success:\s*true[\s\S]*?note:/.test(hallazgosRoute),
);

// 6. Endpoint por-sede: agrupa contactos por planta e identifica primaryResponsable
check(
  'app/api/responsables/por-sede/route.ts: agrupa por planta + primaryResponsable',
  /primaryResponsable[\s\S]*?roleCategory === 'plant_manager'/.test(porSedeRoute),
);
check(
  'app/api/responsables/por-sede/route.ts: soporta companySlug, companyId, plantId',
  /companySlug.*\?\.trim\(\)/.test(porSedeRoute)
    && /companyId.*\?\.trim\(\)/.test(porSedeRoute)
    && /plantId.*\?\.trim\(\)/.test(porSedeRoute),
);

// 7. Componente: renderiza responsable principal con email verificado destacado
check(
  'app/empresas/[slug]/_components/ResponsablesPorSedeCard.tsx: define tipo Contact con roleCategory',
  /roleCategory/.test(card),
);
check(
  'app/empresas/[slug]/page.tsx: calcula primaryResponsable con roleCategory plant_manager',
  /roleCategory === 'plant_manager'/.test(page) && /primaryResponsable:/.test(page),
);
check(
  'ResponsablesPorSedeCard: muestra email verificado con ✓ y no verificado con ⚠',
  /emailVerified[\s\S]*?✓|emailVerified[\s\S]*?⚠/.test(card),
);

// 8. Página /empresas/[slug] integra ResponsablesPorSedeCard
check(
  'app/empresas/[slug]/page.tsx: importa + usa ResponsablesPorSedeCard',
  /import\s+\{\s*ResponsablesPorSedeCard\s*\}\s+from\s+['"]\.\/_components\/ResponsablesPorSedeCard['"]/.test(page)
    && /<ResponsablesPorSedeCard/.test(page),
);

// 9. Página /hallazgos/[id] muestra contactos de la sede del hallazgo
check(
  'app/hallazgos/[id]/page.tsx: query PlantContact filtrado por plantId del source',
  /prisma\.plantContact\.findMany\(\s*\{[\s\S]*?where:\s*\{\s*plantId:\s*source\.plantId/.test(hallazgoPage),
);

// 10. Backfill script: idempotente (where plantId: null), heurística normalizada
check(
  'scripts/backfill-source-plant.ts: filtra por plantId: null (idempotente)',
  /where:\s*\{\s*plantId:\s*null\s*\}/.test(backfill),
);
check(
  'scripts/backfill-source-plant.ts: normaliza acentos (NFD + replace diacritics)',
  /normalize.*NFD/.test(backfill) && /\[̀-ͯ\]/.test(backfill),
);
check(
  'scripts/backfill-source-plant.ts: batch con take/skip (no OOM)',
  /take:\s*BATCH/.test(backfill) && /cursor/.test(backfill),
);

console.log(`\n[QW-10] Result: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
