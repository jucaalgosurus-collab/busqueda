// scripts/borme-historico-backfill.ts — Sprint C.1
// Backfill 365d de eventos BORME para las Companies A&B.
// 1) Carga las Companies objetivo.
// 2) Scrapea BORME (scrapeBorme ya itera `daysBack` días internamente).
// 3) Parsea cada RawBormeItem en ParsedBormeEvent (extrae CNAE).
// 4) Matchea contra Company[] por CIF / nombre / fuzzy.
// 5) Upsert idempotente en BormeEvent.
// 6) Backfilla Company.cif / cnae desde el último evento relevante.
//
// Uso:
//   pnpm borme:historico                  # backfill 365d
//   pnpm borme:historico --days=90        # 90d
//   pnpm borme:historico --dry-run        # no escribe DB

import { PrismaClient } from '@prisma/client';
import { scrapeBorme } from '../lib/scrapers/borme';
import { parseBormeEvent } from '../lib/borme/parser';
import { matchAll } from '../lib/borme/matcher';
import { upsertBormeEvent, backfillCompanyFromBorme } from '../lib/borme/upsert';

const prisma = new PrismaClient();

interface BackfillStats {
  daysScraped: number;
  rawItemsScraped: number;
  eventsParsed: number;
  eventsCreated: number;
  eventsSkipped: number;
  companiesMatched: number;
  companiesBackfilled: string[];
  errors: number;
  durationMs: number;
}

function parseArgs(): { days: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  let days = 365;
  let dryRun = false;
  for (const a of args) {
    if (a.startsWith('--days=')) days = parseInt(a.split('=')[1], 10);
    if (a === '--dry-run') dryRun = true;
  }
  return { days, dryRun };
}

async function main() {
  const { days, dryRun } = parseArgs();
  const startMs = Date.now();
  console.log(`[c1-backfill] start days=${days} dryRun=${dryRun}`);

  const stats: BackfillStats = {
    daysScraped: 0,
    rawItemsScraped: 0,
    eventsParsed: 0,
    eventsCreated: 0,
    eventsSkipped: 0,
    companiesMatched: 0,
    companiesBackfilled: [],
    errors: 0,
    durationMs: 0,
  };

  // 1) Carga las Companies objetivo (A&B)
  const companies = await prisma.company.findMany({
    where: { tier: { in: ['A', 'B'] } },
    select: { id: true, slug: true, name: true, cif: true, hqRegion: true },
  });
  console.log(`[c1-backfill] target companies: ${companies.length}`);

  if (companies.length === 0) {
    console.log('[c1-backfill] no A/B companies, exit');
    stats.durationMs = Date.now() - startMs;
    console.log(`[c1-backfill] DONE ${JSON.stringify(stats, null, 2)}`);
    await prisma.$disconnect();
    return;
  }

  // 2) Scrapea BORME. Limitamos a las PROVINCIAS donde las Companies tienen Plants
  //    (BOE usa nombre de provincia en mayúsculas en itemMeta.titulo, no CCAA).
  const companyIds = companies.map((c) => c.id);
  const plants = await prisma.plant.findMany({
    where: { companyId: { in: companyIds }, province: { not: null } },
    select: { province: true },
  });
  const targetProvincias = Array.from(
    new Set(plants.map((p) => p.province).filter((p): p is string => !!p))
  ).map((p) => p.toUpperCase().trim());
  console.log(`[c1-backfill] target provincias: ${targetProvincias.length} (${targetProvincias.join(', ')})`);

  let rawItems: Awaited<ReturnType<typeof scrapeBorme>> = [];
  try {
    rawItems = await scrapeBorme({
      daysBack: days,
      maxItems: 5000,
      onlyProvincias: targetProvincias.length > 0 ? targetProvincias : null,
      onLog: (m: string) => console.log(`  [borme] ${m}`),
    });
    stats.daysScraped = days;
    stats.rawItemsScraped = rawItems.length;
  } catch (err) {
    stats.errors++;
    console.error(`[c1-backfill] scrapeBorme error:`, String(err).slice(0, 300));
  }

  if (rawItems.length === 0) {
    console.log('[c1-backfill] no raw items scraped, exit');
    stats.durationMs = Date.now() - startMs;
    console.log(`[c1-backfill] DONE ${JSON.stringify(stats, null, 2)}`);
    await prisma.$disconnect();
    return;
  }

  // 3) Parsea todos los items
  const events = rawItems.map(parseBormeEvent);
  stats.eventsParsed = events.length;

  // 4) Matchea contra companies
  const matched = matchAll(events, companies);
  const matchedSet = new Set<string>();

  for (const { event, match } of matched) {
    if (!match) continue;
    matchedSet.add(match.company.id);

    if (dryRun) {
      stats.eventsSkipped++;
      continue;
    }

    try {
      const result = await upsertBormeEvent(prisma, event, match.company.id);
      if (result.action === 'created') stats.eventsCreated++;
      else stats.eventsSkipped++;
    } catch (err) {
      stats.errors++;
      console.error(`[c1-backfill] upsert error:`, String(err).slice(0, 200));
    }
  }
  stats.companiesMatched = matchedSet.size;

  // 5) Backfill Company.cif/cnae desde eventos existentes
  if (!dryRun) {
    for (const companyId of matchedSet) {
      try {
        const result = await backfillCompanyFromBorme(prisma, companyId);
        if (result.updatedFields.length > 0 && !stats.companiesBackfilled.includes(companyId)) {
          stats.companiesBackfilled.push(companyId);
        }
      } catch (err) {
        stats.errors++;
        console.error(`[c1-backfill] backfill error for ${companyId}:`, String(err).slice(0, 200));
      }
    }
  }

  stats.durationMs = Date.now() - startMs;
  console.log(`[c1-backfill] DONE ${JSON.stringify(stats, null, 2)}`);

  await prisma.$disconnect();
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[c1-backfill] FATAL:', err);
  process.exit(1);
});
