// scripts/borme-historico-backfill.ts — DEPRECATED 2026-06-04 (Sprint E.2)
//
// El backfill histórico de BORME ya corrió 1 vez en Sprint C.1 (commit
// 8b957dd): ingestó 365d de eventos para las 8 Companies A&B originales
// y los persistió en la tabla BormeEvent con matchHash idempotente.
// Repetirlo duplicaría rows y generaría falsos positivos en matchers
// (CIF normalizado puede chocar con un histórico de otra empresa del
// mismo grupo).
//
// Si necesitas re-correrlo (ej. se añadieron Companies nuevas):
//   1. Resucitar `lib/scrapers/borme.ts` desde git history (commit
//      anterior a 8b957dd) y ajustar el scraper a la versión actual del
//      BOE datos abiertos (schema cambia 2x/año).
//   2. Actualizar el rango de fechas en la línea `daysScraped` aquí.
//
// Decisión: este script ya no corre. Reemplazado por la lectura
// directa de BormeEvent desde /empresas/[slug] (RegistroMercantilCard).

const DEAD_MSG = `
[DEPRECATED 2026-06-04 — Sprint E.2]
El backfill histórico de BORME es una operación ONE-SHOT.
Ya corrió en Sprint C.1 (commit 8b957dd) y se preserva en la tabla BormeEvent.

Si necesitas RE-INGESTAR (ej. nuevas Companies):
  - Resucita lib/scrapers/borme.ts desde git (commit previo a 8b957dd)
  - Ajusta schema actual del BOE datos abiertos
  - Vuelve a popular este script

No se ejecuta. No se elimina el archivo para mantener trazabilidad.
`;

console.log(DEAD_MSG);
process.exit(0);
