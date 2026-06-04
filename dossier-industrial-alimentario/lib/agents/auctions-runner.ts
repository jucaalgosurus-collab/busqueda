// lib/agents/auctions-runner.ts — Sprint B.9: Agente de subastas.
//
// Detecta exposición de empresas A&B en 13 portales de subastas. Es una
// **señal amarilla/roja**: si una empresa aparece en un portal, es probable
// que la desimplantación esté en fase de monetización. NO operamos las
// subastas (esa es tarea del depto. Surus), solo detectamos.
//
// Reutiliza:
//   - lib/scrapers/auctions.ts (scraper polimórfico)
//   - lib/filters/auction.ts (isRelevantAuctionHit)

import { PrismaClient, type Company, type Plant } from '@prisma/client';
import { scrapeAuctionsForCompany, listPlatforms } from '@/lib/scrapers/auctions';
import { isRelevantAuctionHit, type RawAuctionHit } from '@/lib/filters/auction';
import { notifyStrong } from '@/lib/telegram/notify';

const prisma = new PrismaClient();

export const AUCTIONS_AGENT_NAME = 'surus-agente-auctions';
export const AUCTIONS_CADENCE_DAYS = 7;

export interface AuctionsAgentResult {
  agentName: string;
  scanned: number;
  found: number;
  relevant: number;
  activosDetectados: number;
  historial: number;
  noHits: number;
  errors: number;
  durationMs: number;
  topHits: Array<{ company: string; platform: string; result: string; url: string; title: string }>;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Persiste un AuctionCheck + Source si es relevante. */
async function persistCheck(args: {
  companyId: string;
  companyName: string;
  platform: string;
  result: 'sin_activos' | 'activos_detectados' | 'historial' | 'no_verificado';
  details: string;
  hit: RawAuctionHit | null;
  checkedAt: Date;
}): Promise<{ createdSource: boolean }> {
  const dayKey = startOfDay(args.checkedAt);

  // Upsert idempotente por (companyId, platform, checkedAt-day).
  // Como Prisma no soporta upsert por date truncado, hacemos findFirst + create/update.
  const existing = await prisma.auctionCheck.findFirst({
    where: {
      companyId: args.companyId,
      platform: args.platform,
      checkedAt: { gte: dayKey, lt: new Date(dayKey.getTime() + 24 * 3600_000) },
    },
  });
  const check = existing
    ? await prisma.auctionCheck.update({
        where: { id: existing.id },
        data: { result: args.result, details: args.details, checkedAt: args.checkedAt },
      })
    : await prisma.auctionCheck.create({
        data: {
          companyId: args.companyId,
          companyName: args.companyName,
          platform: args.platform,
          result: args.result,
          details: args.details,
          checkedAt: args.checkedAt,
        },
      });

  // Si es un hit relevante, crear/actualizar un Source.
  let createdSource = false;
  if ((args.result === 'activos_detectados' || args.result === 'historial') && args.hit) {
    const url = `${args.hit.lotUrl}#auction=${encodeURIComponent(args.platform)}`;
    const signalStrength = args.result === 'activos_detectados' ? 'strong' : 'medium';
    const source = await prisma.source.upsert({
      where: { url },
      create: {
        url,
        title: `[SUBASTA ${args.platform}] ${args.hit.lotTitle}`.slice(0, 500),
        outlet: args.platform,
        outletType: 'auction',
        publishedAt: args.hit.publishedAt ? new Date(args.hit.publishedAt) : args.checkedAt,
        language: 'es',
        contentText: args.hit.lotDescription.slice(0, 50000) || args.hit.lotTitle,
        contentHash: `auction-${args.platform}-${args.hit.lotId}`.slice(0, 64),
        deimplantationSignal: true,
        isStale: false,
      },
      update: {
        title: `[SUBASTA ${args.platform}] ${args.hit.lotTitle}`.slice(0, 500),
        contentText: args.hit.lotDescription.slice(0, 50000) || args.hit.lotTitle,
        deimplantationSignal: true,
        isStale: false,
        scrapedAt: new Date(),
      },
    });
    createdSource = !!source;
    // NOTA: el campo `signalStrength` se calcula en memoria cuando se renderiza
    // desde el `outletType='auction'` + heurística del lotUrl. Se mantiene el
    // patrón del sprint B.1: persistir `deimplantationSignal=true` y derivar
    // `signalStrength` en el dashboard por el tipo de Source.
    void signalStrength; // marcador explícito de la heurística.
  }
  void check; // check ya persistido
  return { createdSource };
}

export async function runAuctionsAgent(opts: {
  onlyCompanies?: string[];
  onlyPlatforms?: string[];
  maxCompanies?: number;
} = {}): Promise<AuctionsAgentResult> {
  const startedAt = new Date();
  const maxCompanies = opts.maxCompanies ?? 30;

  // Carga top-N empresas (las mismas que tienen más hallazgos) o subset.
  const companies = await prisma.company.findMany({
    take: maxCompanies,
    where: opts.onlyCompanies ? { slug: { in: opts.onlyCompanies } } : undefined,
    include: { plants: true },
    orderBy: { name: 'asc' },
  });

  // Carga también los aliases si los hay. Como no hay campo aliases explícito,
  // usamos el `name` canónico + su versión sin sufijos (SA, SLU, SL).
  const platforms = listPlatforms();

  const run = await prisma.searchRun.create({
    data: {
      agentName: AUCTIONS_AGENT_NAME,
      startedAt,
      mode: 'weekly',
      query: { companyCount: companies.length, platforms: platforms.length } as object,
    },
  });

  console.log(`[auctions-runner] companies=${companies.length} platforms=${platforms.length}`);

  let scanned = 0;
  let found = 0;
  let relevant = 0;
  let activosDetectados = 0;
  let historial = 0;
  let noHits = 0;
  let errors = 0;
  const topHits: AuctionsAgentResult['topHits'] = [];

  for (const company of companies) {
    for (const platform of platforms) {
      try {
        scanned++;
        const hits = await scrapeAuctionsForCompany(company.name, { onlyPlatforms: [platform.platform] });
        if (hits.length === 0) {
          // Check sin hits.
          await persistCheck({
            companyId: company.id,
            companyName: company.name,
            platform: platform.platform,
            result: 'no_verificado',
            details: 'no_hits_or_blocked',
            hit: null,
            checkedAt: new Date(),
          });
          noHits++;
          continue;
        }
        found += hits.length;

        // Filtra el primer hit relevante.
        const plants = company.plants as Plant[];
        let bestResult: ReturnType<typeof isRelevantAuctionHit> | null = null;
        let bestHit: RawAuctionHit | null = null;
        for (const hit of hits) {
          const rel = isRelevantAuctionHit(hit, company.name, [], plants);
          if (rel.relevant && (!bestResult || rel.confidence > bestResult.confidence)) {
            bestResult = rel;
            bestHit = hit;
          }
        }

        if (bestResult && bestHit) {
          relevant++;
          if (bestResult.result === 'activos_detectados') activosDetectados++;
          if (bestResult.result === 'historial') historial++;
          const { createdSource } = await persistCheck({
            companyId: company.id,
            companyName: company.name,
            platform: platform.platform,
            result: bestResult.result,
            details: bestResult.reason,
            hit: bestHit,
            checkedAt: new Date(),
          });
          topHits.push({
            company: company.name,
            platform: platform.platform,
            result: bestResult.result,
            url: bestHit.lotUrl,
            title: bestHit.lotTitle,
          });
          // QW-1: notificar Telegram cuando 'activos_detectados' (signal fuerte).
          if (bestResult.result === 'activos_detectados' && createdSource) {
            const sourceRow = await prisma.source.findFirst({
              where: { url: { endsWith: `#auction=${encodeURIComponent(platform.platform)}` }, title: { contains: company.name } },
              orderBy: { scrapedAt: 'desc' },
              select: { id: true, title: true, url: true, outlet: true, outletType: true, publishedAt: true },
            });
            if (sourceRow) {
              const matchingPlant = plants.find((p) => (p.city ?? '').length > 0 && bestHit.lotLocation.includes(p.city as string)) ?? plants[0];
              const nr = await notifyStrong({
                source: sourceRow,
                company: { id: company.id, name: company.name, slug: company.slug },
                signalStrength: 'strong',
                reason: `${platform.platform}: ${bestResult.reason}`.slice(0, 240),
                plantCity: matchingPlant?.city ?? undefined,
                plantProvince: matchingPlant?.province ?? undefined,
              });
              if (!nr.sent && nr.reason !== 'alerts_disabled' && nr.reason !== 'mock') {
                console.warn(`[auctions-runner] notify failed: ${nr.reason}`);
              }
            }
          }
        } else {
          await persistCheck({
            companyId: company.id,
            companyName: company.name,
            platform: platform.platform,
            result: 'sin_activos',
            details: bestResult?.reason ?? 'no_relevant_hits',
            hit: null,
            checkedAt: new Date(),
          });
          noHits++;
        }
      } catch (e) {
        errors++;
        console.warn(`[auctions-runner] ${company.name}@${platform.platform} failed: ${(e as Error).message}`);
      }
    }
  }

  const finishedAt = new Date();
  await prisma.searchRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      itemsFound: found,
      itemsInScope: relevant,
      itemsNew: relevant,
      itemsUpdated: 0,
      errorsCount: errors,
      costEur: 0,
    },
  });

  await prisma.scanConfig.upsert({
    where: { agentName: AUCTIONS_AGENT_NAME },
    create: {
      agentName: AUCTIONS_AGENT_NAME,
      queryConfig: { maxCompanies } as object,
      cadenceDays: AUCTIONS_CADENCE_DAYS,
      isActive: true,
      lastRunAt: finishedAt,
    },
    update: { isActive: true, lastRunAt: finishedAt },
  });

  return {
    agentName: AUCTIONS_AGENT_NAME,
    scanned,
    found,
    relevant,
    activosDetectados,
    historial,
    noHits,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    topHits: topHits.slice(0, 20),
  };
}

// CLI entry
if (process.argv[1]?.endsWith('auctions-runner.ts') || process.argv[1]?.endsWith('auctions-runner.js')) {
  (async () => {
    try {
      const r = await runAuctionsAgent();
      console.log('\n=== AUCTIONS ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
