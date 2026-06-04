// scripts/smoke-v6-structure.ts — Solo verificación estructural de archivos (sin DB)
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Assert {
  name: string;
  pass: boolean;
  detail?: string;
  category: 'structure' | 'security' | 'completeness';
}

const asserts: Assert[] = [];
const a = (name: string, pass: boolean, detail?: string, category: Assert['category'] = 'structure') => {
  asserts.push({ name, pass, detail, category });
};

const cwd = process.cwd();

const requiredFiles = [
  // Schema + seed
  'prisma/schema.prisma',
  'data/seed-v6.json',
  'scripts/seed-v6.ts',
  // Contactos (v6 schema)
  'app/contactos/page.tsx',
  'app/contactos/ContactosFilter.tsx',
  'app/api/contactos/export.csv/route.ts',
  'app/api/contactos/search/route.ts',
  // Empresa CRUD
  'app/api/empresas/[slug]/route.ts',
  'app/api/empresas/[slug]/notes/route.ts',
  'app/api/empresas/[slug]/upload/route.ts',
  // Empresa page
  'app/empresas/[slug]/page.tsx',
  'app/empresas/[slug]/empresa.css',
  // 12 components
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
  // Anti-detect
  'lib/scrapers/anti-detect/index.ts',
  'lib/scrapers/anti-detect/stealth.ts',
  'lib/scrapers/anti-detect/rate-limiter.ts',
  'lib/scrapers/anti-detect/user-agent-rotator.ts',
  'lib/scrapers/anti-detect/proxy-rotator.ts',
  'lib/scrapers/anti-detect/flaresolverr.ts',
  'docs/AUDIT-ANTI-DETECCION-V2.md',
  // Parser
  'scripts/parse-md-dossiers.ts',
];

for (const f of requiredFiles) {
  const p = join(cwd, f);
  if (existsSync(p)) {
    const size = statSync(p).size;
    a(f, size > 100, `${size} bytes`, 'structure');
  } else {
    a(f, false, 'MISSING', 'structure');
  }
}

// Secret leak check
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
  a('seed-v6.json parseable', false, e instanceof Error ? e.message : String(e), 'security');
}

// .env.example present?
const envExample = existsSync(join(cwd, '.env.example'));
a('.env.example present (placeholders OK in git)', envExample, 'present', 'security');

// schema.prisma has 14 models
const schema = readFileSync(join(cwd, 'prisma/schema.prisma'), 'utf-8');
const modelMatches = schema.match(/^model\s+\w+\s*{/gm) ?? [];
a('schema.prisma has ≥14 models', modelMatches.length >= 14, `${modelMatches.length} models`, 'completeness');

// seed-v6.json entity counts
const seedJson = JSON.parse(readFileSync(join(cwd, 'data/seed-v6.json'), 'utf-8'));
const expectedCounts: Record<string, [number, number]> = {
  companies: [7, 7],
  plants: [30, 100],
  plantContacts: [30, 100],
  technicalInventory: [40, 100],
  operations: [20, 100],
  timelineEvents: [50, 200],
  financials: [20, 100],
  sources: [50, 200],
  auctionChecks: [20, 50],
};
for (const [k, [min, _max]] of Object.entries(expectedCounts)) {
  const actual = Array.isArray(seedJson[k]) ? seedJson[k].length : 0;
  a(`seed-v6.json.${k} ≥${min}`, actual >= min, `actual=${actual}`, 'completeness');
}

const total = asserts.length;
const passed = asserts.filter((x) => x.pass).length;
const failed = asserts.filter((x) => !x.pass);

console.log('=== HERMES DOSSIER v6 — STRUCTURAL SMOKE ===\n');
for (const cat of ['structure', 'security', 'completeness'] as const) {
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
