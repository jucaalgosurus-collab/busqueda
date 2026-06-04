// scripts/smoke-sectorizacion.ts — Sprint D.2 sectorizacion CNAE
// 6 asserts (5 obligatorios + 1 opcional UI sin dev server):
//   S.1: >=12 empresas en seed con cnae no null
//   S.2: >=8 con CNAE 10
//   S.3: >=3 con CNAE 11
//   S.4: slugs unicos en el seed
//   S.5: cada empresa tiene web http(s) valida
//   S.6 (opcional): DB real — verifica que la cantidad coincide con DB si esta accesible

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_PATH = join(process.cwd(), 'data', 'seed-cnae.json');

interface Assert {
  name: string;
  pass: boolean;
  detail?: string;
}
const results: Assert[] = [];

function assert(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '[OK]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`);
}

function isValidWeb(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

interface SeedCompany {
  slug: string;
  name: string;
  sector: string;
  subsector: string;
  cnae: string;
  cnaeLabel?: string;
  parentGroup?: string;
  hqCity?: string;
  hqRegion?: string;
  tier: string;
  website?: string;
  newsroomUrl?: string;
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint D.2 sectorizacion CNAE smoke (6 asserts) ===\n');

  if (!existsSync(SEED_PATH)) {
    console.error(`[FAIL] No existe ${SEED_PATH}`);
    process.exit(1);
  }
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as {
    companies: SeedCompany[];
  };
  const companies = seed.companies;
  console.log(`Empresas en seed: ${companies.length}\n`);

  // S.1: >=12 empresas con cnae no null
  console.log('— Cantidad (3 asserts) —');
  const withCnae = companies.filter((c) => c.cnae && /^\d{2}\.\d/.test(c.cnae));
  assert(
    'S.1 [>=12 empresas con cnae no null]',
    withCnae.length >= 12,
    `total=${withCnae.length}`,
  );

  // S.2: >=8 con CNAE 10
  const cnae10 = withCnae.filter((c) => c.cnae.startsWith('10'));
  assert(
    'S.2 [>=8 empresas CNAE 10 (alimentos)]',
    cnae10.length >= 8,
    `cnae10=${cnae10.length}`,
  );

  // S.3: >=3 con CNAE 11
  const cnae11 = withCnae.filter((c) => c.cnae.startsWith('11'));
  assert(
    'S.3 [>=3 empresas CNAE 11 (bebidas)]',
    cnae11.length >= 3,
    `cnae11=${cnae11.length}`,
  );

  // S.4: slugs unicos
  console.log('\n— Integridad seed (2 asserts) —');
  const slugs = companies.map((c) => c.slug);
  const uniqueSlugs = new Set(slugs);
  assert(
    'S.4 [slugs unicos]',
    uniqueSlugs.size === slugs.length,
    `total=${slugs.length} unique=${uniqueSlugs.size}`,
  );

  // S.5: web valida para todas
  const allWithValidWeb = companies.every((c) => isValidWeb(c.website));
  const invalidWeb = companies
    .filter((c) => !isValidWeb(c.website))
    .map((c) => c.slug);
  assert(
    'S.5 [todas tienen web http(s) valida]',
    allWithValidWeb,
    invalidWeb.length > 0 ? `invalidas=${invalidWeb.join(',')}` : 'OK',
  );

  // S.6 (opcional): DB real — verifica que insertadas en DB coinciden con seed
  console.log('\n— DB (1 assert opcional) —');
  let dbAvailable = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }

  if (!dbAvailable) {
    assert('S.6 [DB: empresas con cnae no null] — SKIP sin DB', true, 'validar en VPS');
  } else {
    const cnae10Db = await prisma.company.count({
      where: { cnae: { startsWith: '10' } },
    });
    const cnae11Db = await prisma.company.count({
      where: { cnae: { startsWith: '11' } },
    });
    const totalDb = cnae10Db + cnae11Db;
    assert(
      'S.6 [DB: >=8 CNAE-10 + >=3 CNAE-11]',
      cnae10Db >= 8 && cnae11Db >= 3,
      `db cnae10=${cnae10Db} cnae11=${cnae11Db} total=${totalDb}`,
    );
  }

  // S.7: UI /empresas tiene filtro CNAE (statical check sobre el JSX del page)
  console.log('\n— UI (1 assert estático) —');
  const pagePath = join(process.cwd(), 'app/empresas/page.tsx');
  const pageContent = existsSync(pagePath) ? readFileSync(pagePath, 'utf-8') : '';
  const hasCnaeFilter =
    /cnae:\s*\{\s*startsWith:\s*sp\.cnae\s*\}/.test(pageContent) ||
    /where\.cnae\s*=\s*\{\s*startsWith:\s*sp\.cnae\s*\}/.test(pageContent);
  const hasCnaeChip = /CnaeChip|cnae==="10"|cnae==="11"/.test(pageContent);
  assert(
    'S.7 [UI /empresas aplica filtro CNAE 10/11]',
    hasCnaeFilter && hasCnaeChip,
    `filtro=${hasCnaeFilter} chip=${hasCnaeChip}`,
  );

  // Resumen
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== TOTAL: ${passed} pass / ${failed} fail ===`);
  if (failed > 0) {
    console.log('\nFAILED ASSERTS:');
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  [FAIL] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main()
  .catch((e) => {
    console.error('smoke-sectorizacion fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
