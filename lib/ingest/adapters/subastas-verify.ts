// lib/ingest/adapters/subastas-verify.ts — Adapter para VERIFICACIÓN de subastas
// Sprint G.1 — R-01: SOLO verifica si empresa está en subastas, NO scrapea
// Este adapter NO extrae datos de subastas. Solo confirma la presencia
// de una empresa en portales de subastas (consulta índice/cache).

import type { Adapter, AdapterConfig, AdapterResult, RawArticle } from '../types';

export const subastasVerifyAdapter: Adapter = {
  name: 'subastas-verify',
  type: 'subastas_verify',

  async run(_config: AdapterConfig): Promise<AdapterResult> {
    const startedAt = Date.now();
    // R-01: NO scraping de subastas. Este adapter es SOLO verificación
    // mediante índice local (alimentado manualmente por el equipo Surus).
    return {
      adapterName: 'subastas-verify',
      scanned: 0,
      found: 0,
      inScope: 0,
      errors: 0,
      durationMs: Date.now() - startedAt,
      articles: [],
    };
  },
};
