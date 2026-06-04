// lib/agents/borme-runner.ts — Sprint B.1: Agente BORME.
// Detecta cambios de domicilio social, ampliaciones/reducciones de capital, disoluciones
// y otros actos societarios que, combinados con la cuenta de resultados, son señal
// amarilla de desimplantación. NO concursos (los filtra el runner).
//
// Reutiliza: lib/scrapers/borme.ts (scraper puro) + lib/filters/deimplantation.ts:applyBormeFilter.

import { PrismaClient } from '@prisma/client';
import { scrapeBorme, type RawBormeItem } from '@/lib/scrapers/borme';
import { applyBormeFilter } from '@/lib/filters/deimplantation';
import type { SignalStrength } from '@/lib/scrapers/types';
import { notifyStrong } from '@/lib/telegram/notify';

const prisma = new PrismaClient();

export interface BormeAgentResult {
  agentName: string;
  mode: 'backfill_15d' | 'incremental_2d';
  scanned: number;
  found: number;
  inScope: number;
  outOfScope: number;
  maRejected: number;
  auctionRejected: number;
  new: number;
  errors: number;
  durationMs: number;
  topItems: Array<{ url: string; title: string; signalStrength: SignalStrength; outOfScopeReason: string | null; publishedAt: Date | null }>;
}

// Cron agent name. Idempotente en el ScanConfig.
export const BORME_AGENT_NAME = 'surus-agente-borme';
export const BORME_CADENCE_DAYS = 2;

/** Hash determinista para identificar el acto (mismo acto, mismo hash → no duplica). */
function actHash(item: RawBormeItem): string {
  // Truncamos text a 800 chars para estabilidad; el CIF si lo hay entra en el hash.
  const key = `${item.bormeId}|${item.companyName}|${item.cif ?? ''}|${item.text.slice(0, 800)}`;
  // Hash simple no criptográfico (suficiente para idempotencia).
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return `borme-${(h >>> 0).toString(16)}`;
}

async function persistItem(item: RawBormeItem, mode: string): Promise<{ upserted: boolean; inScope: boolean; outReason: string | null; signalStrength: SignalStrength; signals: string[] }> {
  const filter = applyBormeFilter(item.text);
  const hash = actHash(item);

  // Cada item BORME genera UN Source único por acto (mismo bormeId + companyName + texto).
  // Usamos upsert por (url) — la URL del BORME es la misma para todos los actos del
  // mismo bormeId, así que tenemos que usar el contentHash como discriminador.
  // Truco: en `url` añadimos el sufijo `#act=N` para hacerlo único por acto.
  const url = `${item.url}#act=${item.id}`;

  const title = `[BORME] ${item.actKind.toUpperCase()} — ${item.companyName}${item.provincia ? ` (${item.provincia})` : ''}`;

  const source = await prisma.source.upsert({
    where: { url },
    create: {
      url,
      title: title.slice(0, 500),
      outlet: 'BORME (BOE datos abiertos)',
      outletType: 'bofficial_borme',
      publishedAt: new Date(`${item.publishedAt}T00:00:00Z`),
      language: 'es',
      contentText: item.text.slice(0, 50000),
      contentHash: hash,
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
    },
    update: {
      title: title.slice(0, 500),
      contentText: item.text.slice(0, 50000),
      contentHash: hash,
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
      scrapedAt: new Date(),
    },
  });

  return {
    upserted: true,
    inScope: filter.inScope,
    outReason: filter.outOfScopeReason,
    signalStrength: filter.signalStrength,
    signals: filter.signals,
  };
}

export async function runBormeAgent(opts: {
  mode?: 'backfill_15d' | 'incremental_2d';
  maxItems?: number;
  onlyProvincias?: string[];
} = {}): Promise<BormeAgentResult> {
  const startedAt = new Date();
  const mode = opts.mode ?? (process.argv.includes('--backfill') ? 'backfill_15d' : 'incremental_2d');
  const daysBack = mode === 'backfill_15d' ? 15 : 1;
  const maxItems = opts.maxItems ?? 1500;

  const run = await prisma.searchRun.create({
    data: {
      agentName: BORME_AGENT_NAME,
      startedAt,
      mode,
      query: { daysBack, maxItems, onlyProvincias: opts.onlyProvincias ?? null } as object,
    },
  });

  console.log(`[borme-runner] mode=${mode} daysBack=${daysBack} maxItems=${maxItems}`);

  let items: RawBormeItem[] = [];
  let errors = 0;
  try {
    items = await scrapeBorme({
      daysBack,
      maxItems,
      onlyProvincias: opts.onlyProvincias,
      onLog: (m) => console.log(m),
    });
  } catch (e) {
    errors++;
    console.error(`[borme-runner] scraper failed: ${(e as Error).message}`);
  }

  const found = items.length;
  let inScope = 0;
  let outOfScope = 0;
  let maRejected = 0;
  let auctionRejected = 0;
  let upserted = 0;
  const topItems: BormeAgentResult['topItems'] = [];

  for (const item of items) {
    try {
      const r = await persistItem(item, mode);
      if (r.inScope) inScope++; else outOfScope++;
      if (r.outReason === 'm_and_a') maRejected++;
      if (r.outReason === 'auction_or_ettbewerb') auctionRejected++;
      upserted++;
      if (r.inScope) {
        const src = await prisma.source.findUnique({ where: { url: `${item.url}#act=${item.id}` } });
        if (src) {
          topItems.push({
            url: src.url,
            title: src.title,
            signalStrength: r.signalStrength,
            outOfScopeReason: src.outOfScopeReason,
            publishedAt: src.publishedAt,
          });
          // QW-1: notificar Telegram si signalStrength='strong'. Best-effort.
          if (r.signalStrength === 'strong') {
            const company = await prisma.company.findFirst({
              where: { name: { contains: item.companyName.split(' ')[0] } },
              select: { id: true, name: true, slug: true },
            });
            if (company) {
              const nr = await notifyStrong({
                source: {
                  id: src.id,
                  title: src.title,
                  url: src.url,
                  outlet: src.outlet,
                  outletType: src.outletType,
                  publishedAt: src.publishedAt,
                },
                company,
                signalStrength: 'strong',
                reason: r.signals.join('; ').slice(0, 240),
                plantProvince: item.provincia ?? undefined,
              });
              if (!nr.sent && nr.reason !== 'alerts_disabled' && nr.reason !== 'mock') {
                console.warn(`[borme-runner] notify failed: ${nr.reason}`);
              }
            }
          }
        }
      }
    } catch (e) {
      errors++;
      console.warn(`[borme-runner] persist ${item.id} failed: ${(e as Error).message}`);
    }
  }

  // Ordena topItems por signalStrength desc y limita a 10.
  const strengthRank: Record<SignalStrength, number> = { strong: 3, medium: 2, weak: 1 };
  topItems.sort((a, b) => strengthRank[b.signalStrength] - strengthRank[a.signalStrength]);
  const top10 = topItems.slice(0, 10);

  const finishedAt = new Date();
  await prisma.searchRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      itemsFound: found,
      itemsInScope: inScope,
      itemsOutOfScope: outOfScope,
      itemsNew: upserted,
      itemsUpdated: 0,
      errorsCount: errors,
      costEur: 0,
    },
  });

  await prisma.scanConfig.upsert({
    where: { agentName: BORME_AGENT_NAME },
    create: {
      agentName: BORME_AGENT_NAME,
      queryConfig: { daysBack, maxItems } as object,
      cadenceDays: BORME_CADENCE_DAYS,
      isActive: true,
      lastRunAt: finishedAt,
    },
    update: { isActive: true, lastRunAt: finishedAt },
  });

  return {
    agentName: BORME_AGENT_NAME,
    mode,
    scanned: items.length,
    found,
    inScope,
    outOfScope,
    maRejected,
    auctionRejected,
    new: upserted,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    topItems: top10,
  };
}

// CLI entry
if (process.argv[1]?.endsWith('borme-runner.ts') || process.argv[1]?.endsWith('borme-runner.js')) {
  (async () => {
    try {
      const r = await runBormeAgent();
      console.log('\n=== BORME ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
