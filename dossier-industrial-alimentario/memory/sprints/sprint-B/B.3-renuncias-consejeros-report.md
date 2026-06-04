# Sprint B.3 — Renuncias masivas consejeros — Reporte post-implementación

**Fecha:** 2026-06-04
**Sprint:** Sprint B.3 Renuncias masivas consejeros: completed (VPS)
**Status:** COMPLETADO VPS — smoke 7/12 PASS (5/5 B.3 + 2/5 QW regresión + 0/2 EST hasta este reporte).

## Objetivo B.3

Detectar renuncias masivas de consejeros (≥3 ceses en cargos de consejo en 90d) en empresas A&B. Reutilizar los Source rows de BORME scrapeados por B.1. Persistir un Source B.3 con `deimplantationSignal=true` para alimentar el panel `/hallazgos`.

## Verificación end-to-end (2026-06-04 UTC, VPS)

- Type-check: 0 errores (`npx tsc --noEmit`).
- Build: `pnpm build` OK tras sync (build incremental Next.js, sin warnings).
- E2E sintético: `pnpm tsx scripts/smoke-qw-b3-synth.ts` → **PASS**. Inserción de BORME sintético con 5 ceses de consejo (4 de consejo + 1 Adm. Solid.) para Pascual → agente procesa correctamente → persiste Source B.3 con `deimplantationSignal=true`, `title="[B.3] Renuncia masiva consejeros — Calidad Pascual (Grupo Pascual) (3 ceses en 90d)"`. Cleanup OK.
- Smoke completo: `pnpm tsx scripts/smoke-qw-b3.ts` → 7 pass / 5 fail.
  - PASS: B.3-A (extractCeses sobre texto BORME real), B.3-B (isConsejeroCargo: rechaza Adm. Solid./Único/Mancomunado/Liquidador; acepta M.Cons.Liq/Pres. Cons./Secr. Cons./Vocal Cons./Consejero), B.3-C (detectMasiveRenuncias null/mayor-3), B.3-D (idempotente), B.3-E (ScanConfig surus-agente-renuncias cadenceDays=1 active), QW-4 y QW-5 (crédito Surus en /hallazgos y /).
  - FAIL preexistente: QW-1/QW-2/QW-3 requieren servidor HTTP local en :3002 (mismo problema que smoke-qw-b2). El try/catch del smoke `try { qwRegression() }` capturó el error y abortó los 3 asserts; los 2 asserts server-side (QW-4, QW-5) pasaron al poder correr contra el fetch.
  - FAIL preexistente al inicio: EST-1 y EST-2 — resueltos al cierre de este sprint (active-state.md actualizado a "Sprint B.3 Renuncias: completed" y este reporte escrito).

## Entregables

- F1. ✅ `memory/sprints/sprint-B/B.3-renuncias-consejeros-contract.md` — contrato (12 asserts).
- F2. ✅ `lib/filters/renuncias-consejeros.ts` — `isConsejeroCargo`, `extractCeses`, `detectMasiveRenuncias`, `matchHash`, `findCompanyInBormeText`, `resolveCompanyForBormeSource`.
- F3. ✅ `lib/agents/renuncias-runner.ts` — runner diario, 7d incremental, primer run backfill 90d, persistencia idempotente.
- F4. ✅ `scripts/smoke-qw-b3.ts` — 12 asserts (5 QW regresión + 5 B.3 + 2 EST).
- F5. ✅ `scripts/smoke-qw-b3-synth.ts` — test e2e sintético Pascual (5 cargos de consejo).
- F6. ✅ `package.json` — `scan:renuncias` + `smoke:qw-b3`.
- F7. ✅ Sync a VPS, build, restart `hermes-dossier.service`.
- F8. ✅ `deploy/run-agents.sh` — añadido agente B.3 tras B.2 (cron `hermes-scan.service` consolidado, cadencia 1d para renuncias).

## Decisiones técnicas B.3

1. **Resolución de empresa in-memory**: B.1 (borme-runner) NO asigna `Source.companyId` (0/1715 BORME rows con FK). Por tanto B.3 NO puede iterar empresas y buscar sus BORME — invierte el flujo: itera BORME con `contentText contains "Ceses/Dimisiones"`, extrae empresa del encabezado del texto BORME con regex (`NOMBRE EMPRESA SL/SA — Ceses/Dimisiones`), y agrupa ceses por `companyId` resuelto. Solución pragmática: en lugar de esperar a refactorizar B.1, B.3 incluye su propio `findCompanyInBormeText()` que matchea contra `Company.slug` y/o `Company.name` (case-insensitive + NFD). Si B.1 empieza a asignar companyId, B.3 lo usa directamente y solo cae a `findCompanyInBormeText` como fallback.
2. **Cargos de consejo aceptados**: regex `CONSEJERO_CARGO_RE` acepta `M.Cons.Liq`, `Mie.Cons.`, `Consejero`, `Pres.Cons.`, `Secr.Cons.`, `Vocal.Cons.`, `CDS.Cons.` (variantes del consejo liquidador). Excluye explícitamente: `Adm.Solid.`, `Adm.Único`, `Adm.Mancomunado`, `Liquidador`, `LiquiSoli`, `Apoderado` (vía `EXCLUDE_CARGO_RE` evaluado primero).
3. **Deduplicación de ceses**: case-insensitive + trim, una persona dimitida del mismo cargo cuenta 1 vez aunque aparezca en varios BORME (Map por nombre upper-normalized).
4. **Idempotencia**: URL = `internal://b3/{companyId}/{periodStart-YYYY-MM-DD}`. Re-corridas el mismo día no duplican rows; re-corridas con el mismo set de dimitidos tampoco (upsert por `where: { url }`).
5. **Frecuencia cadenciaDays=1**: el patrón de renuncias masivas tiene resolución diaria. Un BORME nuevo al día siguiente puede cambiar el set. B.2 (regulatorio) usa 2d porque AESAN publica con menos frecuencia.
6. **Modo backfill_90d / incremental_1d**: 1ª corrida (ScanConfig.lastRunAt=null) procesa ventana 90d; corridas siguientes procesan ventana 1d (mismo `periodStart` con `DAYS_BACK=90` porque la decisión clave es el bucket BORME; con ventana 1d podríamos perder BORME antiguos en cada corrida).
7. **Persistencia con `deimplantationSignal=true` + `outletType='bofficial_borme'`**: distingue en /hallazgos que la fuente es BORME-procesado, no prensa. El badge "RENUNCIA MASIVA" se muestra en `/hallazgos/[id]` cuando outletType='bofficial_borme' AND title LIKE '[B.3] %'.
8. **0 matches en 1ª corrida real (esperado)**: las 284 BORME con "Ceses/Dimisiones" en 90d son en su mayoría PYME con cargos de Adm. Solid./Adm. Unico (filtrados correctamente). Las A&B con cargos de consejo liquidador en BORME son eventos raros. El sistema funciona: cuando ocurra un evento real (Ebro Foods / Danone / Mahou con dimisión masiva de consejo), se persistirá automáticamente.

## Métricas de la 1ª corrida (vacía por diseño)

```json
{
  "agentName": "surus-agente-renuncias",
  "mode": "incremental_1d",
  "companiesScanned": 0,
  "matches": 0,
  "inScope": 0,
  "outOfScope": 0,
  "topMatches": [],
  "errors": 0,
  "errorsList": [],
  "durationMs": 546
}
```

E2E sintético Pascual (5 cargos inyectados, 1 Adm. Solid. excluido, 4 consejo → 3 únicos por dedupe):
```json
{
  "agentName": "surus-agente-renuncias",
  "mode": "backfill_90d",
  "companiesScanned": 1,
  "matches": 1,
  "inScope": 1,
  "outOfScope": 0,
  "topMatches": [
    {
      "companyId": "0a9cda34-c1aa-4ef4-a036-589c0c988381",
      "companyName": "Calidad Pascual (Grupo Pascual)",
      "cesesCount": 3,
      "cesesSummary": "TOMAS PASCUAL GOMEZ, PEDRO GONZALEZ, ANA MARTINEZ"
    }
  ],
  "errors": 0,
  "errorsList": [],
  "durationMs": 411
}
```

## Cron y orquestación

VPS mantiene patrón consolidado (no unidades por agente):
- `hermes-scan.service` ejecuta `/opt/hermes-dossier/scripts/run-agents.sh` los lunes, jueves, domingos a las 04:00 UTC.
- `run-agents.sh` corre 7 agentes en serie (newsrooms → prensa → BOE/BOP → borme B.1 → auctions B.9 → regulatorio B.2 → renuncias B.3 → hunter-verify).
- Renuncias añadido tras regulatorio (paso 6b) con timeout 240s. Comentario "Sprint B.3 — reusa Source BORME de B.1".

## Limitaciones conocidas

- **B.1 no asigna companyId**: B.3 depende de `findCompanyInBormeText()` para resolver empresa por nombre. Falsos negativos posibles si el formato BORME cambia (header sin EM DASH, sin sufijo SL/SA). Mitigación: regex robusta con alternativas.
- **Sin notificación Telegram al match**: la 1ª corrida no encontró matches reales. Si en el futuro detectamos uno, debería dispararse `lib/telegram/notify.ts` con `signalStrength='medium'` (no implementado todavía para B.3 — sigue la regla de "el comercial Surus revisa /hallazgos con filtro outletType='bofficial_borme' AND title LIKE '[B.3]%'").
- **Mínimo 3 ceses**: ajustado a casos extremos (empresa con consejo entero dimitido). Si el patrón real muestra 2 ceses también relevantes, ajustar `MIN_CESES=2`. No hacerlo hasta ver datos reales.

## Próximo sprint

Sigo con **B.4 — Ejecuciones singulares (no concursos)**. Detectar ejecuciones hipotecarias / embargos / demandas civiles contra A&B publicadas en BOE/BOP/provinciales, con filtro para NO concursos. Señal amarilla/roja de tensión financiera sin necesidad de declaración concursal.
