// scripts/smoke-v6-structure.mjs — Verificación estructural de archivos (sin DB, sin tsx)
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const asserts = [];
const a = (name, pass, detail, category = 'structure') => {
  asserts.push({ name, pass, detail, category });
};

const cwd = process.cwd();

const requiredFiles = [
  'prisma/schema.prisma',
  'data/seed-v6.json',
  'scripts/seed-v6.ts',
  'app/contactos/page.tsx',
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
  'app/empresas/[slug]/_components/PlantMap.tsx',
  'app/empresas/[slug]/_components/InventoryTable.tsx',
  'app/empresas/[slug]/_components/OperationsTimeline.tsx',
  'app/empresas/[slug]/_components/FinancialChart.tsx',
  'app/empresas/[slug]/_components/AuctionGrid.tsx',
  'app/empresas/[slug]/_components/ContactsByPlant.tsx',
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
  'scripts/parse-md-dossiers.ts',
];

for (const f of requiredFiles) {
  const p = join(cwd, f);
  if (existsSync(p)) {
    const size = statSync(p).size;
    a(f, size > 100, `${size} bytes`);
  } else {
    a(f, false, 'MISSING');
  }
}

// Secret leak
try {
  const seedJson = JSON.parse(readFileSync(join(cwd, 'data/seed-v6.json'), 'utf-8'));
  const seedStr = JSON.stringify(seedJson);
  const patterns = [
    { name: 'OpenAI-style', re: /sk-[a-zA-Z0-9]{20,}/ },
    { name: 'Gemini', re: /AIzaSy[A-Za-z0-9_-]{20,}/ },
    { name: 'Google API key', re: /AQ\.Ab[A-Za-z0-9_-]{20,}/ },
    { name: 'Hunter.io', re: /ce0edc32d98cd7d9e02a5e64ac67ff8f69c66f6e/ },
    { name: 'DB password', re: /Surus2024!/ },
  ];
  for (const { name, re } of patterns) {
    a(`No ${name} in seed-v6.json`, !re.test(seedStr), re.test(seedStr) ? 'LEAKED' : 'clean', 'security');
  }
} catch (e) {
  a('seed-v6.json parseable', false, e.message, 'security');
}

const envExample = existsSync(join(cwd, '.env.example'));
a('.env.example present (placeholders OK in git)', envExample, 'present', 'security');

const schema = readFileSync(join(cwd, 'prisma/schema.prisma'), 'utf-8');
const modelMatches = schema.match(/^model\s+\w+\s*{/gm) ?? [];
a('schema.prisma has ≥14 models', modelMatches.length >= 14, `${modelMatches.length} models`, 'completeness');

const seedJson = JSON.parse(readFileSync(join(cwd, 'data/seed-v6.json'), 'utf-8'));
const expectedCounts = {
  companies: 7,
  plants: 30,
  plantContacts: 30,
  technicalInventory: 40,
  operations: 20,
  timelineEvents: 50,
  financials: 20,
  sources: 50,
  auctionChecks: 20,
};
for (const [k, min] of Object.entries(expectedCounts)) {
  const actual = Array.isArray(seedJson[k]) ? seedJson[k].length : 0;
  a(`seed-v6.json.${k} ≥${min}`, actual >= min, `actual=${actual}`, 'completeness');
}

const total = asserts.length;
const passed = asserts.filter((x) => x.pass).length;
const failed = asserts.filter((x) => !x.pass);

console.log('=== HERMES DOSSIER v6 — STRUCTURAL SMOKE ===\n');
for (const cat of ['structure', 'security', 'completeness']) {
  console.log(`--- ${cat} ---`);
  for (const x of asserts.filter((a) => a.category === cat)) {
    console.log(`${x.pass ? '✓' : '✗'} ${x.name}${x.detail ? `  (${x.detail})` : ''}`);
  }
  console.log('');
}
console.log(`=== ${passed}/${total} asserts passed ===`);
if (failed.length > 0) {
  console.log(`\n🔴 FAILED (${failed.length}):`);
  for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail ?? 'no detail'}`);
}
process.exit(failed.length > 0 ? 1 : 0);
