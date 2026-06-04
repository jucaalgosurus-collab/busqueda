// scripts/backfill-source-sectors.ts — Sprint E.3b — backfill Source.sector.
//
// Recorre TODAS las sources históricas y asigna sector vía:
//   1. sectorFromOutlet(outletType) si transversal (PI, Stock, AESAN)
//   2. sectorFromCnae(company.cnae) si companyId != null
//   3. null (no se puede inferir)
//
// Procesa en batches de 100, loguea progreso en /var/log/hermes-scan/backfill-sectors.log.
//
// Run: pnpm tsx scripts/backfill-source-sectors.ts [--dry-run]

import { PrismaClient } from '@prisma/client';
import { sectorFromCnae, sectorFromOutlet, type IndustriaSector } from '../lib/industria';
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const BATCH = 100;
const LOG = '/var/log/hermes-scan/backfill-sectors.log';

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try {
    mkdirSync('/var/log/hermes-scan', { recursive: true });
    appendFileSync(LOG, line);
  } catch {
    // en local sin permisos, no rompe
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  log(`E.3b backfill Source.sector — dry-run=${dryRun}`);

  const totalBefore = await prisma.source.count();
  const alreadySourced = await prisma.source.count({ where: { sector: { not: null } } });
  const toProcess = totalBefore - alreadySourced;
  log(`Total: ${totalBefore}, ya con sector: ${alreadySourced}, a procesar: ${toProcess}`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined = undefined;

  // Cache de cnae por companyId
  const cnaeCache = new Map<string, string | null>();

  while (true) {
    const batch = await prisma.source.findMany({
      where: { sector: null },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, outletType: true, companyId: true },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const s of batch) {
      processed++;
      // 1) Intentar por outletType (transversal)
      let sector: IndustriaSector | null = sectorFromOutlet(s.outletType);
      // 2) Si no, intentar por company.cnae
      if (!sector && s.companyId) {
        let cnae = cnaeCache.get(s.companyId);
        if (cnae === undefined) {
          const company = await prisma.company.findUnique({
            where: { id: s.companyId },
            select: { cnae: true, sector: true },
          });
          cnae = company?.cnae ?? null;
          cnaeCache.set(s.companyId, cnae);
        }
        if (cnae) sector = sectorFromCnae(cnae);
      }
      if (!sector) {
        skipped++;
        continue;
      }
      if (!dryRun) {
        await prisma.source.update({ where: { id: s.id }, data: { sector } });
      }
      updated++;
    }
    if (processed % 500 === 0) {
      log(`progress: processed=${processed}/${toProcess} updated=${updated} skipped=${skipped}`);
    }
  }

  const totalAfter = await prisma.source.count();
  const nowSourced = await prisma.source.count({ where: { sector: { not: null } } });
  log(`DONE: processed=${processed} updated=${updated} skipped=${skipped}`);
  log(`Total sources: ${totalBefore} → ${totalAfter} (diff=${totalAfter - totalBefore})`);
  log(`Sources con sector: ${alreadySourced} → ${nowSourced} (${((nowSourced / totalAfter) * 100).toFixed(1)}%)`);
  if (totalBefore !== totalAfter) {
    log(`ERROR: count mismatch before/after`);
    process.exit(2);
  }
  process.exit(0);
}

main()
  .catch((e) => {
    log(`FATAL: ${(e as Error).message}\n${(e as Error).stack}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
