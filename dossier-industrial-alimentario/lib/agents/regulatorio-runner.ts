// lib/agents/regulatorio-runner.ts — Sprint B.2: Agente AESAN alertas alimentarias.
//
// Detecta alertas regulatorias AESAN que mencionan empresas A&B de nuestra
// base de conocimiento. Una alerta alimentaria (Listeria, Salmonella, alérgeno
// no declarado) sobre una A&B es señal amarilla fuerte — puede forzar cierre
// temporal de línea, retirada de producto o crisis reputacional.
//
// Schema v6: Source.companyId es FK directo (sin tabla ArticleCompany).
// Al persistir, asignamos companyId en el upsert cuando hay match.
// Source NO tiene columna signalStrength (sólo deimplantationSignal, outOfScopeReason, isStale).
//
// Reutiliza:
//   - lib/scrapers/regulatorio-aesan.ts (scraper puro)
//   - lib/filters/regulatorio.ts:applyRegulatorioFilter (matching A&B)
//   - lib/telegram/notify.ts: notifyStrong (alertas in-scope → Telegram)

import { PrismaClient } from '@prisma/client';
import { scrapeAesan, type RawAesanAlert } from '@/lib/scrapers/regulatorio-aesan';
import { applyRegulatorioFilter } from '@/lib/filters/regulatorio';
import { notifyStrong } from '@/lib/telegram/notify';

const prisma = new PrismaClient();

export interface RegulatorioAgentResult {
  agentName: string;
  mode: 'backfill_15d' | 'incremental_2d';
  scraped: number;
  inScope: number;
  outOfScope: number;
  byReason: Record<string, number>;
  errors: number;
  durationMs: number;
  topAlerts: Array<{
    url: string;
    title: string;
    matchedCompany: string | null;
    hazard: string | null;
    product: string | null;
    brand: string | null;
    outOfScopeReason: string | null;
  }>;
}

export const REGULATORIO_AGENT_NAME = 'surus-agente-regulatorio';
export const REGULATORIO_CADENCE_DAYS = 2;

async function persistAlert(
  alert: RawAesanAlert,
  _mode: string,
): Promise<{ upserted: boolean; inScope: boolean; matchedCompany: { id: string; name: string; slug: string } | null; outReason: string | null }> {
  const filter = await applyRegulatorioFilter(prisma, alert);

  const title = `[AESAN] ${alert.title}`;
  const companyId = filter.matchedCompany?.id ?? null;

  await prisma.source.upsert({
    where: { url: alert.url },
    create: {
      url: alert.url,
      title: title.slice(0, 500),
      outlet: 'AESAN (SCIRI)',
      outletType: 'regulatorio_aesan',
      publishedAt: new Date(alert.date),
      language: 'es',
      companyId,
      contentText: alert.content.slice(0, 50_000),
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
    },
    update: {
      title: title.slice(0, 500),
      contentText: alert.content.slice(0, 50_000),
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
      companyId,
      scrapedAt: new Date(),
    },
  });

  return {
    upserted: true,
    inScope: filter.inScope,
    matchedCompany: filter.matchedCompany,
    outReason: filter.outOfScopeReason,
  };
}

async function ensureScanConfig(): Promise<void> {
  await prisma.scanConfig.upsert({
    where: { agentName: REGULATORIO_AGENT_NAME },
    create: {
      agentName: REGULATORIO_AGENT_NAME,
      cadenceDays: REGULATORIO_CADENCE_DAYS,
      isActive: true,
      lastRunAt: null,
    },
    update: { isActive: true, cadenceDays: REGULATORIO_CADENCE_DAYS },
  });
}

async function isFirstRun(): Promise<boolean> {
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: REGULATORIO_AGENT_NAME } });
  return !cfg?.lastRunAt;
}

export async function runRegulatorioAgent(opts: { daysBack?: number; maxAlerts?: number; dryRun?: boolean } = {}): Promise<RegulatorioAgentResult> {
  const start = Date.now();
  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_15d' | 'incremental_2d' = firstRun ? 'backfill_15d' : 'incremental_2d';
  const daysBack = opts.daysBack ?? (firstRun ? 15 : REGULATORIO_CADENCE_DAYS);
  const maxAlerts = opts.maxAlerts ?? 50;

  const result = await scrapeAesan({ daysBack, maxAlerts });

  const byReason: Record<string, number> = {};
  let inScope = 0;
  let outOfScope = 0;
  const topAlerts: RegulatorioAgentResult['topAlerts'] = [];

  if (!opts.dryRun) {
    for (const alert of result.alerts) {
      const r = await persistAlert(alert, mode);
      if (r.inScope) {
        inScope++;
        if (r.matchedCompany) {
          topAlerts.push({
            url: alert.url,
            title: alert.title,
            matchedCompany: r.matchedCompany.name,
            hazard: alert.hazard,
            product: alert.product,
            brand: alert.brand,
            outOfScopeReason: null,
          });
        }
      } else {
        outOfScope++;
        const key = r.outReason ?? 'unknown';
        byReason[key] = (byReason[key] ?? 0) + 1;
      }
    }
  }

  // Log SearchRun
  if (!opts.dryRun) {
    await prisma.searchRun.create({
      data: {
        agentName: REGULATORIO_AGENT_NAME,
        mode,
        itemsFound: result.alerts.length,
        itemsNew: inScope,
        itemsInScope: inScope,
        itemsOutOfScope: outOfScope,
        errorsCount: result.errors.length,
        startedAt: new Date(start),
        finishedAt: new Date(),
      },
    });
    await prisma.scanConfig.update({
      where: { agentName: REGULATORIO_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  }

  // Notificación Telegram. Las alertas AESAN son 'medium' — NO pasan el guard
  // de notifyStrong (que sólo envía signalStrength='strong'). Por tanto usamos
  // un wrapper best-effort: intenta notifyStrong, si devuelve signal_not_strong
  // no es un error (es esperado para medium). Para 'medium' no spameamos: la
  // periodicidad 2d ya marca el ritmo. El comercial Surus puede revisar /hallazgos.
  // Si en el futuro se quiere notificar medium, añadir notifyMedium() con quota 5/día.

  return {
    agentName: REGULATORIO_AGENT_NAME,
    mode,
    scraped: result.alerts.length,
    inScope,
    outOfScope,
    byReason,
    errors: result.errors.length,
    durationMs: Date.now() - start,
    topAlerts: topAlerts.slice(0, 10),
  };
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('regulatorio-runner.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  runRegulatorioAgent({ dryRun })
    .then((r) => {
      console.log('[regulatorio-runner] result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[regulatorio-runner] error:', e);
      process.exit(1);
    });
}
