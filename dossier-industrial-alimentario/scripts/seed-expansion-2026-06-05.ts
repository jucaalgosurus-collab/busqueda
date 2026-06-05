// scripts/seed-expansion-2026-06-05.ts — E.9 ampliado: 270 CNAE-INEs reales
//
// Procesa data/seed-cnae.json + data/seed-expansion.json + data/seed-expansion-2.json
// Idempotente: inserta si no existe, actualiza cnae si existe pero sin cnae, skip si ya tiene cnae.
//
// Reglas:
//   - Web http(s) real obligatoria
//   - CNAE formato XX.X
//   - Slug kebab-case único
//   - Tier A/B/C
//   - Datos basados en ranking Alimarket 2024-2025, CNMC, FIAB, Mercabarna
//
// Uso: pnpm seed:expansion-2026-06-05

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
const SEED_PATHS = [
  join(process.cwd(), 'data', 'seed-cnae.json'),
  join(process.cwd(), 'data', 'seed-expansion.json'),
  join(process.cwd(), 'data', 'seed-expansion-2.json'),
  join(process.cwd(), 'data', 'seed-expansion-3.json'),
];

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

function isValidWeb(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeSlug(s: string): string {
  return s
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
    .replace(/ñ/g, 'n').replace(/ü/g, 'u')
    .replace(/Á/g, 'a').replace(/É/g, 'e').replace(/Í/g, 'i').replace(/Ó/g, 'o').replace(/Ú/g, 'u')
    .replace(/Ñ/g, 'n')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function main() {
  const companies: SeedCompany[] = [];
  for (const p of SEED_PATHS) {
    if (!existsSync(p)) {
      console.warn(`SKIP file not found: ${p}`);
      continue;
    }
    const seed = JSON.parse(readFileSync(p, 'utf-8'));
    for (const c of seed.companies || []) {
      companies.push({ ...c, slug: normalizeSlug(c.slug) });
    }
  }
  console.log(`Empresas totales en seed files: ${companies.length}`);

  // Dedup por slug
  const bySlug = new Map<string, SeedCompany>();
  for (const c of companies) {
    if (!bySlug.has(c.slug)) bySlug.set(c.slug, c);
    else {
      const existing = bySlug.get(c.slug)!;
      bySlug.set(c.slug, { ...existing, ...c, cnae: c.cnae || existing.cnae });
    }
  }
  const uniq = Array.from(bySlug.values());
  console.log(`Slugs únicos tras dedup: ${uniq.length}`);

  let inserted = 0, updated = 0, unchanged = 0, skipped = 0;
  const skippedDetails: string[] = [];

  for (const c of uniq) {
    if (!isValidWeb(c.website)) {
      skippedDetails.push(`SKIP ${c.slug} — web invalida (${c.website})`);
      skipped++;
      continue;
    }
    if (!/^\d{2}\.\d/.test(c.cnae)) {
      skippedDetails.push(`SKIP ${c.slug} — cnae invalido (${c.cnae})`);
      skipped++;
      continue;
    }
    const existing = await prisma.company.findUnique({ where: { slug: c.slug } });
    if (!existing) {
      await prisma.company.create({
        data: {
          slug: c.slug,
          name: c.name,
          sector: c.sector,
          subsector: c.subsector,
          cnae: c.cnae,
          parentGroup: c.parentGroup ?? null,
          hqCity: c.hqCity ?? null,
          hqRegion: c.hqRegion ?? null,
          tier: c.tier,
          website: c.website,
          status: 'active',
        },
      });
      inserted++;
    } else if (!existing.cnae) {
      await prisma.company.update({
        where: { id: existing.id },
        data: {
          cnae: c.cnae,
          sector: c.sector,
          subsector: c.subsector,
          website: c.website,
          parentGroup: c.parentGroup ?? existing.parentGroup,
        },
      });
      updated++;
    } else {
      unchanged++;
    }
  }

  if (skippedDetails.length) {
    console.log('--- SKIP details ---');
    console.log(skippedDetails.slice(0, 20).join('\n'));
    if (skippedDetails.length > 20) console.log(`... +${skippedDetails.length - 20} more`);
  }

  const total = await prisma.company.count({ where: { cnae: { not: null } } });
  const cnae10 = await prisma.company.count({ where: { cnae: { startsWith: '10' } } });
  const cnae11 = await prisma.company.count({ where: { cnae: { startsWith: '11' } } });
  console.log(`RESUMEN: ${inserted} insertadas, ${updated} actualizadas, ${unchanged} sin cambios, ${skipped} skipped`);
  console.log(`TOTAL DB con cnae: ${total} (CNAE 10: ${cnae10}, CNAE 11: ${cnae11})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
