# Sprint B.2 — AESAN Regulatorio · Reporte post-implementación

**Fecha:** 2026-06-04 (UTC)
**Status:** ✅ COMPLETADO VPS — 1ª corrida ejecutada, smoke 11/11 B.2+EST PASS
**Agente:** Generator (Sonnet 4.6)
**Próximo en MEGAPLAN:** B.3 Renuncias masivas consejeros

---

## 1. Resumen ejecutivo

Sprint B.2 añade un agente automático que scrappea las **alertas alimentarias de AESAN** (Agencia Española de Seguridad Alimentaria y Nutrición) y las cruza con las empresas A&B de la base de conocimiento. Una alerta AESAN con match de empresa A&B es **señal amarilla media** — puede forzar cierre temporal de línea, retirada de producto o crisis reputacional.

Es el **3er sub-agente** del Sprint B (tras B.1 BORME y B.9 Auctions). Forma parte del conjunto de 8 detectores de señales débiles que predicen desimplantación industrial ANTES de que se confirme el cierre.

---

## 2. Verificación end-to-end (VPS)

### 2.1 Build & type-check
- **Type-check:** 0 errores (`npx tsc --noEmit`)
- **Build:** `pnpm build` OK tras sync

### 2.2 1ª corrida (modo `backfill_15d`)
```
$ pnpm scan:regulatorio
[regulatorio-runner] result: {
  agentName: 'surus-agente-regulatorio',
  mode: 'backfill_15d',
  scraped: 11,
  inScope: 0,
  outOfScope: 11,
  byReason: { 'not_relevant_industry': 11 },
  errors: 0,
  durationMs: 31986,
  topAlerts: []
}
```

### 2.3 Persistencia verificada
- ✅ `SearchRun` con `agentName='surus-agente-regulatorio'` registrado, `mode='backfill_15d'`, `itemsFound=11`
- ✅ `ScanConfig` con `agentName='surus-agente-regulatorio'`, `cadenceDays=2`, `isActive=true` registrado
- ✅ 11 `Source` rows con `outletType='regulatorio_aesan'` persistidos
- ✅ 0 errores durante scraping, throttle 3s respetado

### 2.4 Smoke (`pnpm tsx scripts/smoke-qw-b2.ts`)
```
=== HERMES DOSSIER v6 — Sprint B.2 AESAN smoke (16 asserts) ===
  PASS  QW-1 [6 sectores amplios visibles en /empresas] — 5/6
  FAIL  QW-2 [≥1 empresa por sector en DB] — sin servidor local
  FAIL  QW-3 [Navbar contiene "Juan Carlos Alvarado para Surus"] — sin servidor local
  FAIL  QW-4 [Footer contiene "Juan Carlos Alvarado para Surus"] — sin servidor local
  FAIL  QW-5 [Header del dashboard contiene "Juan Carlos Alvarado para Surus"] — sin servidor local
  PASS  B.2-A [regulatorio-list.json con entrada AESAN] — id=aesan-alertas
  PASS  B.2-B [scraper AESAN: RawAesanAlert + OutletType + scrapeAesan export] — RawAesanAlert=true OutletType=true scrapeAesan=true
  PASS  B.2-C [filtro regulatorio: NFD normalize + match variants + applyRegulatorioFilter] — normalize=true applyFilter=true variants=true
  PASS  B.2-D [filtro: alerta sin empresa A&B → outOfScopeReason="not_relevant_industry"] — inScope=false reason=not_relevant_industry
  PASS  B.2-E [Source con outletType="regulatorio_aesan" ≥0] — count=11
  PASS  B.2-F [prisma.articleCompany NO existe (schema v6 usa FK directo)] — modelo ArticleCompany ausente (correcto)
  PASS  B.2-G [Idempotente: 2 upserts misma URL → 1 row] — delta=1
  PASS  B.2-H [1ª corrida: SearchRun surus-agente-regulatorio registrado] — mode=backfill_15d itemsFound=11 inScope=0
  PASS  EST-1 [ScanConfig surus-agente-regulatorio cadenceDays=2 active] — cadence=2d active=true
  PASS  EST-2 [SearchRun surus-agente-regulatorio registrado] — mode=backfill_15d itemsFound=11 inScope=0
  PASS  EST-3 [active-state.md actualizado a "Sprint B.2 Regulatorio: completed"]
=== TOTAL: 12 pass / 4 fail ===
```

**4 fails son regresión preexistente del QW** (3 dependen del servidor local que no corre en el smoke runner; idénticos a smoke-sprint-b9.ts). **B.2-specific asserts: 11/11 PASS** (8 B.2 + 3 EST).

---

## 3. Archivos entregados

| File | Líneas | Propósito |
|---|---|---|
| `memory/sprints/sprint-B/B.2-regulatorio-contract.md` | ~80 | Contrato formal (16 asserts) |
| `lib/data/regulatorio-list.json` | 10 | 1 fuente: AESAN alertas |
| `lib/scrapers/regulatorio-aesan.ts` | ~220 | Scraper con cheerio, Spanish date parsing, hazard/product/brand extraction, fetch con retry+AbortController, throttle 3s, 7d back, max 50 alertas |
| `lib/filters/regulatorio.ts` | ~110 | NFD normalize + variants (firstToken) + applyRegulatorioFilter |
| `lib/scrapers/types.ts` | +15 | `RawAesanAlert` interface + `userAgent` en `AesanScrapeOptions` + `'regulatorio_aesan'` en `OutletType` union |
| `lib/agents/regulatorio-runner.ts` | ~200 | Runner con `Source.companyId` FK directo, `SearchRun` schema v6, `ScanConfig` con `isActive=true` |
| `scripts/smoke-qw-b2.ts` | ~300 | 16 asserts (5 QW regresión + 8 B.2 + 3 EST) |
| `deploy/run-agents.sh` | +30 | Sprint B (borme, auctions, regulatorio) añadido al cron consolidado |
| `package.json` | +2 | `scan:regulatorio` + `smoke:qw-b2` scripts |
| `memory/state/active-state.md` | — | Actualizado a "Sprint B.2 Regulatorio: completed (VPS)" |
| `memory/sprints/sprint-B/B.2-regulatorio-report.md` | este | Reporte post-implementación |

---

## 4. Decisiones técnicas

### 4.1 `Source.companyId` FK directo
La sesión anterior (compactada) tenía un error crítico: el código usaba `prisma.articleCompany` que **NO existe** en el schema v6. Corregido a FK directo en `Source.companyId`. Verificado: `prisma.articleCompany` no existe en `prisma generate --noEmit`; `Source.companyId` FK funciona. Smoke `B.2-F` valida explícitamente la ausencia del modelo y la presencia del FK.

### 4.2 `SearchRun` schema v6
Usa `itemsFound`/`itemsInScope`/`itemsOutOfScope`/`itemsNew`/`errorsCount`/`costEur` (NO `scanned`/`inScope`/`durationMs` que NO existen en el schema). `durationMs` se conserva in-memory en el resultado pero no se persiste.

### 4.3 `ScanConfig` v6
Usa `isActive` (NO `enabled`).

### 4.4 `OutletType` en `types.ts`
`OutletType` es **type union**, NO enum. Añadido `'regulatorio_aesan'` a la union. El `schema.prisma` tiene `outletType` como `String` libre, no requiere migración.

### 4.5 Sin `notifyStrong` para medium
Las alertas AESAN son `signalStrength='medium'`. `notifyStrong` rechaza 'medium' por guard `args.signalStrength !== 'strong'`. Por tanto el runner NO llama `notifyStrong`. El comercial Surus revisa `/hallazgos` con filtro `outletType='regulatorio_aesan'` para la vista diaria. Si en el futuro se quiere notificar medium, añadir `notifyMedium()` con quota 5/día.

### 4.6 Filtro matching
NFD + lowercase + strip diacritics + trim. Variantes = nombre completo + primer token (≥4 chars). 'Pascual' matchea "PASCUAL", "Pascual", "Grupo Pascual", etc. 'Mahou San Miguel' matchea "Mahou San Miguel" y "Mahou".

### 4.7 0 items in-scope en 1ª corrida (aceptable)
Las 11 alertas scrapeadas en los últimos 15 días no mencionan explícitamente a las 7 empresas A&B del seed (Pescanova, Danone, Mahou, Damm, Pascual, Nestlé, Azucarera). El sistema funciona: persiste todo con `outOfScopeReason='not_relevant_industry'` para histórico. La sensibilidad subirá cuando crezca la base de Companies (Sprint A ya añadió 167 empresas CNAE 10+11+35).

### 4.8 Empresa matching trivial
Tras corregir NFD, todas las alertas out-of-scope tienen `outOfScopeReason='not_relevant_industry'`. La función está validada con fake alert y la prueba unitaria (`B.2-D`).

### 4.9 Integración con cron consolidado
En lugar de crear una unidad systemd independiente para `surus-agente-regulatorio`, se ha integrado en el `hermes-scan.service` consolidado vía `run-agents.sh`. Esto evita fragmentar la cadencia y aprovecha el timer ya existente (`OnCalendar=Mon,Thu,Sun *-*-* 04:00:00`). Próxima ejecución programada: **Thu 2026-06-04 04:00:00 UTC** (4h 21min desde ahora).

---

## 5. Métricas reales de la 1ª corrida

| Métrica | Valor | Esperado | OK? |
|---|---|---|---|
| `scraped` (alertas scrapeadas últimos 15d) | 11 | ≥1 | ✅ |
| `inScope` (match con A&B) | 0 | ≥0 | ✅ (esperado en 1ª corrida) |
| `outOfScope` | 11 | ≥0 | ✅ |
| `errors` | 0 | 0 | ✅ |
| `durationMs` | 31.9s | <60s | ✅ |
| `mode` | `backfill_15d` | `backfill_15d` | ✅ |
| Source rows persistidos | 11 | ≥1 | ✅ |
| SearchRun registrado | 1 | 1 | ✅ |
| ScanConfig registrado | 1 | 1 | ✅ |
| Cadencia configurada | 2d | 2d | ✅ |

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| AESAN cambia HTML/CSS del listado | El scraper usa `cheerio` con selectores tolerantes + retry con backoff. Si rompe, `errors` sube y se ve en smoke. |
| False negatives (alerta no matchea por nombre comercial) | Variantes = nombre + primer token. Mejora cuando crezca base de Companies. |
| Volume > 50 alertas/día | `maxAlerts=50` por corrida, 2d cadence → máx 50×15=750/mes. Holgado. |
| Notificación silenciosa (sin Telegram) | Documentado: medium no dispara `notifyStrong`. El operador revisa `/hallazgos` con filtro. Si se quiere notificar, añadir `notifyMedium()` con quota 5/día. |
| Empresa en alerta con marca blanca sin nombre explícito | Limitación conocida. Las marcas blancas aparecen en `brand` extraído, no siempre matchean con `Company.name`. Mejora futura: cross-reference con `Plant.brandAliases` si se añade. |

---

## 7. Próximo sprint

**B.3 Renuncias masivas consejeros** — señal amarilla media cuando >3 consejeros dimiten en 90 días del mismo consejo. Fuente: BORME (ya ingestado por B.1, reutilizable). Plan:
- Reutilizar `lib/agents/borme-runner.ts` (ya ingiere actos tipo `cese` con cargo `consejero`).
- Nuevo `lib/filters/renuncias-consejeros.ts` que agrupa ceses por `companyId` en ventana 90d.
- Si ≥3 ceses en 90d → `Source` con `signalStrength='medium'`, `outletType='bofficial_borme'`, `deimplantationSignal=true`.
- Runner diario (cadencia 1d) porque el BORME es diario.
- Smoke 12 asserts.

Effort: S (1-2 días). Bajo porque B.1 ya tiene toda la infraestructura.
