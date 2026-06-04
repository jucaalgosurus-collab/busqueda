// lib/agents/ayudas-runner.ts — Sprint B.6
//
// Detecta ayudas públicas CDTI / IDAE / ICEX concedidas a empresas A&B y
// mide la "señal débil" de desimplantación:
//   - ayuda_sin_actividad: empresa A&B recibió ayuda pero NO tiene actividad
//     normal en los últimos 90d (silencio operativo = sospecha de cierre).
//   - ayuda_previa_a_concurso: empresa A&B recibió ayuda y POSTERIORMENTE
//     tiene un Source con keyword de cierre/concurso → fraude potencial de
//     fondos públicos + cierre.
//   - ayuda_con_actividad_normal: empresa A&B con ayuda + actividad normal
//     reciente → no es señal (se persiste como histórico).
//
// Schema v6:
//   - Source.outletType String union → 'ayuda_publica' (Sprint B.6).
//   - Source.companyId FK directo (NO ArticleCompany).
//   - Source NO tiene columna signalStrength (solo deimplantationSignal/outOfScopeReason/isStale).
//   - ScanConfig usa isActive (NO enabled).
//   - SearchRun usa itemsFound/itemsInScope/itemsOutOfScope/errorsCount.
//
// Idempotencia: matchHash = b6-{cif}-{convocatoriaId}-{proyectoSlug}.
//   Garantiza 1 row por (CIF, convocatoria, proyecto).

import { PrismaClient } from '@prisma/client';
import { scrapeAllAyudatories, type RawAyudaPublica } from '@/lib/scrapers/ayudas-publicas';
import { applyAyudasFilter, matchHash as computeMatchHash } from '@/lib/filters/ayudas';

const prisma = new PrismaClient();

export interface AyudasAgentResult {
  agentName: string;
  mode: 'backfill_180d' | 'incremental_14d';
  ayudas: number;
  inScope: number;
  outOfScope: number;
  byReason: Record<string, number>;
  topHits: Array<{
    convocatoriaId: string;
    organo: string;
    beneficiario: string;
    importe: number;
    fechaConcesion: string;
    company: string;
    outOfScopeReason: string;
  }>;
  errors: number;
  durationMs: number;
}

export const AYUDAS_AGENT_NAME = 'surus-agente-ayudas';
export const AYUDAS_CADENCE_DAYS = 14;
const BACKFILL_DAYS = 180;

async function ensureScanConfig(): Promise<void> {
  await prisma.scanConfig.upsert({
    where: { agentName: AYUDAS_AGENT_NAME },
    create: {
      agentName: AYUDAS_AGENT_NAME,
      cadenceDays: AYUDAS_CADENCE_DAYS,
      isActive: true,
      lastRunAt: null,
    },
    update: { isActive: true, cadenceDays: AYUDAS_CADENCE_DAYS },
  });
}

async function isFirstRun(): Promise<boolean> {
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: AYUDAS_AGENT_NAME } });
  return !cfg?.lastRunAt;
}

async function persistAyuda(
  ayuda: RawAyudaPublica,
): Promise<{ inScope: boolean; outReason: string | null; companyName: string | null }> {
  const filter = await applyAyudasFilter(prisma, ayuda);
  const url = computeMatchHash(ayuda);

  const baseTitle = `[${ayuda.organo}] Ayuda pública a ${ayuda.beneficiario} — ${ayuda.proyecto} (${ayuda.importe.toLocaleString('es-ES')}€)`;
  const contentText = `Ayuda pública concedida por ${ayuda.organo} en convocatoria ${ayuda.convocatoriaId}.

Beneficiario: ${ayuda.beneficiario} (CIF ${ayuda.cif})
Importe: ${ayuda.importe.toLocaleString('es-ES')}€
Fecha concesión: ${ayuda.fechaConcesion}
Proyecto: ${ayuda.proyecto}
Planta: ${ayuda.plantaCcaa}
Descripción: ${ayuda.descripcion}
URL fuente: ${ayuda.sourceUrl}

${filter.inScope
  ? `⚠️ SEÑAL DÉBIL DETECTADA — ${filter.outOfScopeReason}:
  ${filter.outOfScopeReason === 'ayuda_previa_a_concurso'
    ? `La empresa ${filter.company?.name} tiene ${filter.matchedSources.filter((s) => s.kind === 'closure').length} Source(s) con keyword de cierre/concurso POSTERIOR(es) a la fecha de la ayuda. Posible desvío de fondos públicos + cierre operativo.`
    : `La empresa ${filter.company?.name} NO tiene actividad normal scrapeada en los últimos 90d tras recibir la ayuda. Silencio operativo = sospecha de cierre o abandono del proyecto.`
  }

Empresa A&B: ${filter.company?.name ?? 'n/d'} (CIF ${filter.company?.cif ?? 'n/d'})`
  : filter.outOfScopeReason === 'ayuda_con_actividad_normal'
    ? `Empresa con actividad normal reciente (${filter.matchedSources.length} Source(s) scrapeado(s) en últimos 90d sin señal de desimplantación). No es señal — persistido como histórico.`
    : filter.outOfScopeReason === 'unknown_company'
      ? `CIF ${ayuda.cif} no encontrado en la base de Companies. Persistido como histórico sin FK.`
      : filter.outOfScopeReason === 'not_ab'
        ? `Empresa ${filter.company?.name} no califica como A&B (CNAE o assetSize). Persistido como histórico.`
        : 'Persistido como histórico.'}`.slice(0, 50_000);

  await prisma.source.upsert({
    where: { url },
    create: {
      url,
      title: baseTitle.slice(0, 500),
      outlet: `${ayuda.organo} (ayuda pública)`,
      outletType: 'ayuda_publica',
      publishedAt: new Date(ayuda.fechaConcesion),
      language: 'es',
      companyId: filter.company?.id ?? null,
      contentText,
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
    },
    update: {
      title: baseTitle.slice(0, 500),
      contentText,
      deimplantationSignal: filter.inScope,
      outOfScopeReason: filter.outOfScopeReason,
      isStale: false,
      scrapedAt: new Date(),
    },
  });

  return {
    inScope: filter.inScope,
    outReason: filter.outOfScopeReason,
    companyName: filter.company?.name ?? null,
  };
}

export async function runAyudasAgent(opts: { dryRun?: boolean; daysBack?: number } = {}): Promise<AyudasAgentResult> {
  const start = Date.now();
  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_180d' | 'incremental_14d' = firstRun ? 'backfill_180d' : 'incremental_14d';
  const daysBack = opts.daysBack ?? (firstRun ? BACKFILL_DAYS : AYUDAS_CADENCE_DAYS);

  const scrapeResult = scrapeAllAyudatories({ daysBack, maxItems: 100 });

  const byReason: Record<string, number> = {};
  let inScope = 0;
  let outOfScope = 0;
  const topHits: AyudasAgentResult['topHits'] = [];
  let errors = scrapeResult.errors;

  for (const ayuda of scrapeResult.ayudas) {
    try {
      const r = await persistAyuda(ayuda);
      if (r.inScope) {
        inScope++;
        if (topHits.length < 10) {
          topHits.push({
            convocatoriaId: ayuda.convocatoriaId,
            organo: ayuda.organo,
            beneficiario: ayuda.beneficiario,
            importe: ayuda.importe,
            fechaConcesion: ayuda.fechaConcesion,
            company: r.companyName ?? '(sin match)',
            outOfScopeReason: r.outReason ?? 'unknown',
          });
        }
      } else {
        outOfScope++;
        const key = r.outReason ?? 'unknown';
        byReason[key] = (byReason[key] ?? 0) + 1;
      }
    } catch (e) {
      errors++;
      const key = 'persist_error';
      byReason[key] = (byReason[key] ?? 0) + 1;
      outOfScope++;
    }
  }

  if (!opts.dryRun) {
    await prisma.searchRun.create({
      data: {
        agentName: AYUDAS_AGENT_NAME,
        mode,
        itemsFound: scrapeResult.ayudas.length,
        itemsNew: inScope,
        itemsInScope: inScope,
        itemsOutOfScope: outOfScope,
        errorsCount: errors,
        startedAt: new Date(start),
        finishedAt: new Date(),
      },
    });
    await prisma.scanConfig.update({
      where: { agentName: AYUDAS_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  }

  return {
    agentName: AYUDAS_AGENT_NAME,
    mode,
    ayudas: scrapeResult.ayudas.length,
    inScope,
    outOfScope,
    byReason,
    topHits,
    errors,
    durationMs: Date.now() - start,
  };
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('ayudas-runner.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  runAyudasAgent({ dryRun })
    .then((r) => {
      console.log('[ayudas-runner] result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[ayudas-runner] error:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
