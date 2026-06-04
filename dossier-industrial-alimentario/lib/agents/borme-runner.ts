// lib/agents/borme-runner.ts — DEPRECATED 2026-06-04 (Sprint E.2)
//
// El runner de scraping diario de BORME quedó reemplazado por el pipeline
// `lib/borme/` (Sprint C.1, commit 8b957dd) que ingiere el histórico
// oficial una vez y lo cruza con Companies via matchHash idempotente.
// La lectura del histórico sigue disponible en /empresas/[slug] mediante
// el componente RegistroMercantilCard que sólo LEE de la tabla BormeEvent.
//
// Por qué se elimina:
// - Doble flujo: scraping diario de BORME + ingest histórica generaban
//   rows Source duplicadas (Source.outletType='bofficial_borme') y ruido
//   en el conteo de hallazgos.
// - Costo de oportunidad: 1 slot de timer systemd + 1 correa al BOE
//   diaria para ≤2 hits legítimos / trimestre (medido en 90d backfill).
// - Mantenimiento: el BOE datos abiertos cambió 2 veces el schema en
//   2025, y cada cambio requería tocar el parser.
//
// Lo que se preserva:
// - Tabla `BormeEvent` (schema.prisma) — el histórico es legalmente útil.
// - `lib/borme/` (parser, matcher, upsert) — sigue siendo el origen de verdad.
// - `RegistroMercantilCard.tsx` — sigue leyendo BormeEvent sin cambios.
//
// Lo que se ELIMINA:
// - Este runner no se ejecuta. La función `runBormeAgent` ahora es un
//   shim que devuelve 0 items y un warning.
// - `lib/scrapers/borme.ts` se borra (no hay otros consumidores).
// - Scripts npm `scan:borme*` y `borme:historico` se quitan de package.json.
// - systemd timer `surus-agente-borme.{service,timer}` se borran en VPS.
//
// Decisión documentada en:
//   memory/decisions/2026-06-04-eliminar-borme.md

import { PrismaClient } from '@prisma/client';
import { notifyStrong } from '@/lib/telegram/notify';
import type { SignalStrength } from '@/lib/scrapers/types';

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

export const BORME_AGENT_NAME = 'surus-agente-borme';
export const BORME_CADENCE_DAYS = 2;
export const BORME_DEPRECATED_AT = '2026-06-04';

/** Shim deprecado. Devuelve 0 items y un warning. No scrapers, no DB writes. */
export async function runBormeAgent(_opts: {
  mode?: 'backfill_15d' | 'incremental_2d';
  maxItems?: number;
  onlyProvincias?: string[];
} = {}): Promise<BormeAgentResult> {
  const startedAt = new Date();
  console.warn(
    `[borme-runner] DEPRECATED ${BORME_DEPRECATED_AT} — scraping daily BORME eliminado (Sprint E.2). ` +
      `El histórico se lee vía lib/borme/ + tabla BormeEvent (Sprint C.1).`,
  );
  return {
    agentName: BORME_AGENT_NAME,
    mode: 'incremental_2d',
    scanned: 0,
    found: 0,
    inScope: 0,
    outOfScope: 0,
    maRejected: 0,
    auctionRejected: 0,
    new: 0,
    errors: 0,
    durationMs: Date.now() - startedAt.getTime(),
    topItems: [],
  };
}

// CLI entry — sólo warning, no scrape.
if (process.argv[1]?.endsWith('borme-runner.ts') || process.argv[1]?.endsWith('borme-runner.js')) {
  (async () => {
    try {
      const r = await runBormeAgent();
      console.log('\n=== BORME (DEPRECATED) ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
