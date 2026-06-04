// scripts/backfill-company-sectors.ts — Sprint E.3 — re-asignar Company.sector vía CNAE.
//
// Backwards compat: 6 sectores viejos → 10 sectores nuevos.
//   'Otro industrial'     → 'Industria en General'
//   'Industrial'          → se re-evalúa (puede ir a Vehiculos, Maquinaria, Industria en General)
//   'Farmaceutico'        → 'Equipamiento Medico Laboratorio Biotecnologia'
//   'Energetico'          → 'Energia'
//   'Construccion'        → 'Construccion' (sin cambio)
//
// Política: re-asignar solo si cnae != null. Sin cnae, mantener el sector manual.
// Loguea los cambios.
//
// Run: pnpm tsx scripts/backfill-company-sectors.ts [--dry-run]

import { PrismaClient } from '@prisma/client';
import { sectorFromCnae, INDUSTRIAS, type IndustriaSector } from '../lib/industria';

const prisma = new PrismaClient();
const VALID = new Set<string>(INDUSTRIAS.map((i) => i.sector));

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`E.3 backfill Company.sector — dry-run=${dryRun}`);

  const total = await prisma.company.count();
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, sector: true, cnae: true },
  });
  console.log(`Total companies: ${total}`);

  let changed = 0;
  let kept = 0;
  let invalid = 0;
  const sample: Array<{ name: string; from: string; to: string; cnae: string | null }> = [];

  for (const c of companies) {
    const currentIsValid = VALID.has(c.sector);
    if (!c.cnae) {
      // Sin cnae: si el sector actual NO es válido (legacy 6), marcar para revisión
      if (!currentIsValid) {
        invalid++;
        if (sample.length < 5) sample.push({ name: c.name, from: c.sector, to: '<needs manual review>', cnae: null });
      } else {
        kept++;
      }
      continue;
    }
    const newSector = sectorFromCnae(c.cnae);
    if (newSector !== c.sector) {
      if (!dryRun) {
        await prisma.company.update({ where: { id: c.id }, data: { sector: newSector } });
      }
      changed++;
      if (sample.length < 5) sample.push({ name: c.name, from: c.sector, to: newSector, cnae: c.cnae });
    } else {
      kept++;
    }
  }

  console.log(`\n=== RESULT ===`);
  console.log(`Total: ${total}`);
  console.log(`Changed: ${changed}`);
  console.log(`Kept: ${kept}`);
  console.log(`Invalid (no cnae, sector legacy): ${invalid}`);
  console.log(`\nSample changes:`);
  for (const s of sample) console.log(`  ${s.name} (${s.cnae ?? 'no-cnae'}): ${s.from} → ${s.to}`);
  process.exit(0);
}

main()
  .catch((e) => { console.error('FATAL:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
