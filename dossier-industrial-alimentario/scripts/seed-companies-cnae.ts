// scripts/seed-companies-cnae.ts — Sprint D.2 sectorizacion CNAE
// Idempotente: añade/actualiza 13 empresas A&B con campo cnae (CNAE 10 o 11).
// NO pisa empresas existentes si ya tienen cnae con valor distinto.
// Uso: pnpm seed:cnae
//   (lee DATABASE_URL de .env)

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const SEED_PATH = join(process.cwd(), 'data', 'seed-cnae.json');

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

interface SeedFile {
  companies: SeedCompany[];
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

async function main() {
  if (!existsSync(SEED_PATH)) {
    throw new Error(`No se encontro ${SEED_PATH}`);
  }
  const seed: SeedFile = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SEED CNAE — Sprint D.2 sectorizacion');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Origen: ${SEED_PATH}`);
  console.log(`Empresas en seed: ${seed.companies.length}`);
  console.log('');

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let skippedInvalidWeb = 0;
  let skippedNoCnae = 0;

  for (const c of seed.companies) {
    if (!isValidWeb(c.website)) {
      console.warn(`  SKIP ${c.slug} — web no valida (${c.website})`);
      skippedInvalidWeb++;
      continue;
    }
    if (!c.cnae || !/^\d{2}\.\d/.test(c.cnae)) {
      console.warn(`  SKIP ${c.slug} — cnae invalido (${c.cnae})`);
      skippedNoCnae++;
      continue;
    }

    const existing = await prisma.company.findUnique({
      where: { slug: c.slug },
    });

    if (!existing) {
      // INSERT
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
      console.log(`  + ${c.slug} (nuevo) — cnae=${c.cnae}`);
    } else if (existing.cnae === null || existing.cnae === undefined) {
      // UPDATE: cnae estaba vacio, lo rellenamos
      await prisma.company.update({
        where: { id: existing.id },
        data: {
          cnae: c.cnae,
          sector: c.sector,
          subsector: c.subsector,
          website: c.website,
        },
      });
      updated++;
      console.log(`  ~ ${c.slug} (cnae ${existing.cnae ?? 'null'} -> ${c.cnae})`);
    } else if (existing.cnae === c.cnae) {
      // Sin cambios
      unchanged++;
      console.log(`  = ${c.slug} (sin cambios — cnae=${c.cnae})`);
    } else {
      // Mismo slug, cnae distinto — NO pisamos (regla D.2-S3)
      unchanged++;
      console.log(
        `  = ${c.slug} (NO se pisa — cnae actual=${existing.cnae} seed=${c.cnae})`,
      );
    }
  }

  // Resumen
  const total = await prisma.company.count({
    where: { cnae: { not: null } },
  });
  const cnae10 = await prisma.company.count({
    where: { cnae: { startsWith: '10' } },
  });
  const cnae11 = await prisma.company.count({
    where: { cnae: { startsWith: '11' } },
  });

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESUMEN:');
  console.log(`  ${inserted} insertadas, ${updated} actualizadas, ${unchanged} sin cambios`);
  if (skippedInvalidWeb > 0) console.log(`  ${skippedInvalidWeb} saltadas (web invalida)`);
  if (skippedNoCnae > 0) console.log(`  ${skippedNoCnae} saltadas (cnae invalido)`);
  console.log('');
  console.log(`Total DB con cnae no null: ${total}`);
  console.log(`  CNAE 10 (alimentos): ${cnae10}`);
  console.log(`  CNAE 11 (bebidas):   ${cnae11}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('seed:cnae fallo:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
