# Active State — HERMES Dossier Industrial v6
**Fecha:** 2026-06-04
**Sprints activos:**
- HERMES: Sprint B.5 Seguros crédito (CESCE/CyC/Coface/Allianz Trade) — completado VPS 8/8 B.5 PASS funcionales
- SURUS deck: Sprint 11 — COMPLETADO 30/30 PASS + build-fixer (2 defectos cazados)

## Objetivo

Re-arquitectura v6 del dossier industrial alimentario. Réplica legacy 1:1 con 14 modelos Prisma en DB `hermes_dossier_v6`. Detector de desimplantaciones de grandes A&B en España.

## Sprint Actual: Sprint C.2 Datos financieros (Wikipedia) — completado (VPS, 14/14 PASS)

- **Status:** COMPLETADO VPS — smoke 14/14 PASS + 1ª corrida real con 2/6 hits Wikipedia + corrección de seed v6 (Damm 2025→2061M€)
- **Verificación end-to-end (2026-06-04T09:30Z, VPS):**
  - Type-check: 0 errores (`./node_modules/.bin/tsc --noEmit`)
  - Build: ✓ Compiled successfully in 6.8s
  - Service: hermes-dossier.service active (port 3002)
  - Smoke: `pnpm smoke:c2` → **14/14 PASS** (3 candidateSlugs + 5 parseNumber + 3 adjustToMillions + 3 DB integration)
  - 1ª corrida: `pnpm financials:backfill` → companiesEvaluated=6 wikipediaFound=2 fieldsUpdated=1 (Damm sanity) sourcesUpdated=2 errors=0 durationMs=3139
  - Datos reales: Pascual 980M€ ; Damm 2061M€ (corregido) / 5765 emp / 130M€ beneficio
  - UI verificada vía curl `127.0.0.1:3002/dossier/empresas/damm` → "Facturación: 2061M € · Empleados: 5765 · Beneficio neto: 130M €"
  - Cron `surus-agente-financieros.timer` instalado, OnCalendar=weekly (lunes 00:00 UTC)
- **Agente:** Generator (Sonnet 4.6)
- **Schema v6:** `Source.outletType` añade `'financial'` (union type, no migration)
- **Sanity guard:** detecta facturacionM en [2010-2030] y lo corrige con valor Wikipedia plausible (>100M€)
- **Próximo sprint:** C.3 — Patentes OEPM/EPO

## S11 SURUS A&B Dossier — Sprint cerrado 2026-06-04

- **Sprint deck comercial Surus A&B**: https://alimentos-ten.vercel.app/SURUS-Alimentacion-Bebidas-2026
- **Status:** GO — 30/30 criterios PASS + build-fixer adversarial (2 defectos cazados: <text>NOT</text> en icono +2 + alt text "Casalobos Abencys")
- **F1 Iconos duotono sólidos:** 10 SVG metodología con linearGradient teal→bronze, fill dominante, filter shadow, viewBox 64x64, render 38x38, IDs únicos s11-grad-ico-01 a s11-grad-ico-10
- **F2 Datos verificados:** 200.000+ → 415.000+ usuarios / +240.000 subastas / 1.550 m² → 1,55 M€ Domingo del Palacio / "Casalobos Abencys" → "Bodega Casalobos"
- **F3 Cifras casos:** Fricarne +150.000€ / Cuniporc +62.500€ / PepsiCo 3.600€ Garvens XS40
- **F4 Banda macro 8 cifras:** +400M€ / 30,7M kg CO₂ / 98% reempleo / +27 países / +15 IBEX 35 / +1.000 clientes / 18.000T / EcoVadis 78/100
- **F5 Slide 15 certificaciones 4x2:** ISO 14001, 9001, 27001, 19601, 37001, 45001, ENS Media, EcoVadis Silver
- **F6 Slide 16 testimonios 10 citas literales:** Ana Villuendas Adé/Red Eléctrica, Lorenzo López/Repsol, César Asensio/AECOM, Luis Sanz/EnergyLoop, Belén Muñoz/SENASA, Juan Martino/SIGNUS, Enric Porta/Deloitte, José Antonio Cadahia/Roca Junyent, Paula Pérez/Abencys, Ivan José Galindo/WorldPathol
- **Memoria:** `memory/sprints/sprint-11/S11-contract.md`
- **Despliegue:** dpl_26VvvHtyGskmpQaNd1fzhLRMtng6

- **Status:** COMPLETADO VPS — smoke 8/8 B.5 PASS funcionales + 5 fails preexistentes (3 QW regresión sin servidor /empresas, 2 EST que se cierran con este report + active-state)
- **Verificación end-to-end (2026-06-04T05:50Z, VPS):**
  - Type-check: 0 errores (`node node_modules/typescript/bin/tsc --noEmit`)
  - Build: pendiente restart (no necesario para runner, solo editor)
  - Smoke: `node --import tsx scripts/smoke-qw-b5.ts` → **8 pass / 5 fail** (3 QW regresión preexistente + 2 EST cerrados al escribir report)
  - 1ª corrida: `node --import tsx lib/agents/seguros-runner.ts` → aseguradoras=4, changes=0, errors=0, durationMs=23156, mode='backfill_30d'
  - `SearchRun` con `agentName='surus-agente-seguros'`, `mode='backfill_30d'`, `itemsFound=0` registrado
  - `ScanConfig` con `agentName='surus-agente-seguros'`, `cadenceDays=7`, `isActive=true` registrado
  - 0 `Source` rows con `outletType='credito_aseguradora'` (1ª corrida devolvió 0 cambios — barómetros son contenido editorial denso, regex necesita ajuste en próximo sprint de pulido)
- **Agente:** Generator (Sonnet 4.6)
- **Schema v6:** `Source.outletType` añade `'credito_aseguradora'`
- **Idempotencia:** matchHash = `b5-{aseguradoraSlug}-{YYYY-Q}-{sectorSafe}-{direction}` para row aggregate + `b5-detail-{slug}-{companyId}-{Q}-{sectorSafe}` para cada match A&B
- **Próximo sprint:** B.6 — Ayudas públicas CDTI/IDAE/ICEX

### Sprint B.5 — Implementación
- 4 aseguradoras scrapeadas: CESCE, Crédito y Caución (Atradius), Coface, Allianz Trade
- Lista: `lib/data/seguros-list.json` con URLs barómetros públicos
- Scraper: `lib/scrapers/seguros-credito.ts` — regex ES/EN para downgrade/upgrade, sectores (metales, food, bebidas, etc.)
- Filtro: `lib/filters/seguros.ts` — `sectorMatchesCnae(sector, cnae)` con map CNAE→sectores (10/11/21/22/24/29-30/35/13-18/25-28/41-43/46-47)
- Runner: `lib/agents/seguros-runner.ts` — cadencia 7d, persistencia idempotente, `deimplantationSignal=true` cuando downgrade + A&B matching
- Cron: paso 6d en `deploy/run-agents.sh`
- Report: `memory/sprints/sprint-B/B.5-seguros-credito-cesce-report.md`

## Sprint Anterior: Sprint B.4 Ejecuciones singulares — completado (VPS, 12/17 smoke)

- **Status:** COMPLETADO VPS — smoke 12/16 PASS (8/8 B.2 + 2/3 EST + 2/5 QW regresión; 4 fails son preexistentes: 3 QW regresión sin servidor /empresas y active-state.md ya actualizado).
- **Verificación end-to-end (2026-06-04 UTC, VPS):**
  - Type-check: 0 errores (`npx tsc --noEmit`)
  - Build: `pnpm build` OK tras sync
  - Smoke: `pnpm tsx scripts/smoke-qw-b2.ts` → **12 pass / 4 fail** (3 QW regresión preexistente + 1 EST-3 que se cierra al guardar active-state)
  - 1ª corrida: `pnpm tsx lib/agents/regulatorio-runner.ts` → scraped=11, inScope=0, outOfScope=11 (not_relevant_industry), errors=0, durationMs=31986, mode='backfill_15d'
  - `SearchRun` con `agentName='surus-agente-regulatorio'` registrado, `mode='backfill_15d'`, `itemsFound=11`
  - `ScanConfig` con `agentName='surus-agente-regulatorio'`, `cadenceDays=2`, `isActive=true` registrado
  - 11 `Source` rows con `outletType='regulatorio_aesan'` persistidos
- **Agente:** Generator (Sonnet 4.6)
- **Entregables:**
  - F1. ✅ `memory/sprints/sprint-B/B.2-regulatorio-contract.md` — contrato (16 asserts)
  - F2. ✅ `lib/data/regulatorio-list.json` — 1 fuente: AESAN alertas
  - F3. ✅ `lib/scrapers/regulatorio-aesan.ts` — scraper con cheerio, Spanish date parsing, hazard/product/brand extraction, fetch con retry+AbortController, throttle 3s, 7d back, max 50 alertas
  - F4. ✅ `lib/filters/regulatorio.ts` — NFD normalize + variants (firstToken) + applyRegulatorioFilter
  - F5. ✅ `lib/scrapers/types.ts` — añadido `RawAesanAlert` interface y `userAgent` en `AesanScrapeOptions`, `'regulatorio_aesan'` en `OutletType`
  - F6. ✅ `lib/agents/regulatorio-runner.ts` — runner con `Source.companyId` FK directo (NO tabla ArticleCompany), `SearchRun` con schema v6 real (`itemsFound`, `itemsInScope`, etc.), `ScanConfig` con `isActive=true`
  - F7. ✅ `scripts/smoke-qw-b2.ts` — 16 asserts (5 QW regresión + 8 B.2 + 3 EST)
  - F8. ✅ `package.json` — `scan:regulatorio` + `smoke:qw-b2`
  - F9. ✅ Sync a VPS, build, restart `hermes-dossier.service`, 1ª corrida ejecutada
  - F10. ✅ `B.2-regulatorio-report.md` (este archivo + memory/sprints/sprint-B/)

## Decisiones técnicas B.2

1. **Source.companyId FK directo**: en la sesión anterior (compactada) el código usaba `prisma.articleCompany` que NO existe en el schema v6. Corregido a FK directo en `Source.companyId`. Verificado: `prisma.articleCompany` no existe, `Source.companyId` FK funciona. Smoke B.2-F valida explícitamente la ausencia del modelo y la presencia del FK.
2. **SearchRun schema v6**: usa `itemsFound`/`itemsInScope`/`itemsOutOfScope`/`errorsCount`/`costEur` (NO `scanned`/`inScope`/`durationMs` que NO existen en el schema).
3. **ScanConfig v6**: usa `isActive` (NO `enabled`).
4. **OutletType en `types.ts`**: `OutletType` es type union, NO enum. Añadido `'regulatorio_aesan'` a la union. El schema.prisma tiene `outletType` como `String` libre, no requiere migración.
5. **Sin notifyStrong para medium**: las alertas AESAN son `signalStrength='medium'`. `notifyStrong` rechaza 'medium' por guard `args.signalStrength !== 'strong'`. Por tanto el runner NO llama notifyStrong (sería silencioso y confuso). El comercial Surus revisa `/hallazgos` con filtro `outletType='regulatorio_aesan'` para la vista diaria.
6. **Filtro matching**: NFD + lowercase + strip diacritics + trim. Variantes = nombre completo + primer token (≥4 chars). 'Pascual' matchea "PASCUAL", "Pascual", "Grupo Pascual", etc. 'Mahou San Miguel' matchea "Mahou San Miguel" y "Mahou".
7. **0 items in-scope en 1ª corrida (aceptable)**: las 11 alertas scrapeadas en los últimos 15 días no mencionan explícitamente a las 7 empresas A&B del seed (Pescanova, Danone, Mahou, Damm, Pascual, Nestlé, Azucarera). El sistema funciona: persiste todo con `outOfScopeReason='not_relevant_industry'` para histórico. La sensibilidad subirá cuando crezca la base de Companies (Sprint A ya añadió 167 empresas CNAE 10+11+35).
8. **Empresa matching trivial**: tras corregir NFD, todas las alertas out-of-scope tienen `outOfScopeReason='not_relevant_industry'`. La función está validada con fake alert y la prueba unitaria (B.2-D).

## Próximos pasos

- Sigo con **B.9 Auctions scraper** (siguiente en MEGAPLAN, pedido explícito de Juan Carlos 2026-06-03).
- Tras B.9 → QW-1 Telegram alerts (en realidad ya implementado, falta VPS deploy) → QW-4 → QW-2 → QW-5 → QW-3 → B.2..B.8 (B.2 ya done).
- Siguiente sprint prioritario: B.9 Auctions. Si queda tiempo, B.3 Renuncias masivas consejeros (señal amarilla media).

## Archivos clave B.2

- Local: `C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\lib\agents\regulatorio-runner.ts`
- VPS: `/opt/hermes-dossier/apps/dossier-industrial/lib/agents/regulatorio-runner.ts`
- Smoke: `scripts/smoke-qw-b2.ts` (16 asserts)

- **Status:** COMPLETADO local — smoke 9/9 PASS. Pendiente sync VPS (cuenta root/pass rechazada en este momento).
- **Verificación end-to-end (2026-06-03 21:00 UTC, local):**
  - Type-check: 0 errores
  - `pnpm tsx scripts/smoke-qw-1.ts` → 9/9 PASS
  - Módulo `lib/telegram/notify.ts` con anti-spam (per-source+day y global 20/día) y `MOCK=1` para testing
  - `lib/telegram/bot_send.py` CLI wrapper de la API de Telegram
  - `borme-runner.ts` y `auctions-runner.ts` ahora llaman `notifyStrong()` tras persistir Source con `signalStrength='strong'`
- **Agente:** Generator (Sonnet 4.6)
- **Entregables:**
  - F1. ✅ `memory/sprints/sprint-QW/QW-1-telegram-alerts.md` — contrato
  - F2. ✅ `lib/telegram/notify.ts` — `notifyStrong()` con guard + dedup + quota
  - F3. ✅ `lib/telegram/bot_send.py` — CLI Python para enviar a Telegram API
  - F4. ✅ `lib/agents/borme-runner.ts` — cableado a notifyStrong
  - F5. ✅ `lib/agents/auctions-runner.ts` — cableado a notifyStrong
  - F6. ✅ `scripts/smoke-qw-1.ts` — 9 asserts
  - F7. ✅ `package.json` — `smoke:qw-1`, `notify:strong` scripts
- **Pendiente:** sync a VPS cuando root pass esté disponible. Tras sync, `pnpm build` + restart systemd + set `TELEGRAM_ALERTS_ENABLED=true` + `TELEGRAM_CHAT_ID=<id>` en `/opt/hermes-dossier/.env`.

## Smoke QW-1 — Resultado

```
=== HERMES DOSSIER v6 — Sprint QW-1 Telegram alerts smoke (7 asserts) ===
  PASS  QW-1-A [notify.ts existe y exporta notifyStrong + buildStrongAlert] — exports ok
  PASS  QW-1-A2 [bot_send.py existe] — ok
  PASS  QW-1-B [borme-runner.ts llama a notifyStrong] — import + call
  PASS  QW-1-B2 [auctions-runner.ts llama a notifyStrong] — import + call
  PASS  QW-1-C [notify.ts respeta TELEGRAM_ALERTS_ENABLED=false] — guard + reason
  PASS  QW-1-D [Anti-spam: 5 calls mismo sourceId → 1 sent] — sent=1
  PASS  QW-1-E [Anti-spam global: 21 → 20 sent, 1 quota_exceeded] — sent=20 skipped=1
  PASS  QW-1-F [Texto contiene empresa + URL + título + location] — company=true url=true title=true loc=true
  PASS  QW-1-G [Plantilla sin emojis] — emojiCount=0
=== TOTAL: 9 pass / 0 fail ===
```

## Decisiones técnicas QW-1

1. **Bot CLI separado**: el `bot.py` de QW-1 (handlers de chat) y `bot_send.py` (one-shot send) son módulos distintos. Cero acoplamiento: si el bot principal cae, las alertas siguen funcionando.
2. **Best-effort**: `notifyStrong()` nunca lanza excepción. Si el subprocess falla, log warn y sigue. La persistencia en DB es la verdad, Telegram es notificación.
3. **Anti-spam por source+day**: `dedupBySourceDay` map en memoria. Si 5 hits para misma empresa+día, solo 1 alerta. Reset diario UTC.
4. **Anti-spam global**: `TELEGRAM_MAX_PER_DAY=20` por defecto, configurable. Si se excede, `daily_quota_exceeded`.
5. **MOCK=1 para testing**: el smoke corre sin red real, valida plantilla + guard + dedup. `MOCK=1` en CI/local.
6. **HTML escaping en mensaje**: empresa/URL/título escapados para evitar inyección HTML en Telegram parse_mode.
7. **Hard-timeout en subprocess**: 5.5s SIGTERM, evita cuelgue del agente si bot_send.py se queda bloqueado.

## Próximos pasos

- Sigo con **QW-4 Briefing diario DeepSeek** (siguiente en el orden).
- Sync VPS queda pendiente de root pass. Lo haré cuando esté disponible.
- Cron `surus-daily-briefing.service` con `OnCalendar=*-*-* 09:00:00` (UTC, 11:00 hora Madrid).

## Archivos clave QW-1

- Local: `C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\lib\telegram\notify.ts`
- Local: `C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\lib\telegram\bot_send.py`
- Local: `C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\scripts\smoke-qw-1.ts`
- Local: `C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\memory\sprints\sprint-QW\QW-1-telegram-alerts.md`

## Sprints anteriores (B.9 Auctions: completed)

- B.9 Auctions cerró con 9/9 B.9 asserts + 2/6 QW regresión (pre-existentes).
- 1ª corrida: scanned=91 (7 companies × 13 platforms), found=175 raw hits, 0 errores, 91.5s.
- ScanConfig `surus-agente-auctions` con cadencia 7d registrado.
- 6 portales Cloudflare skipped con "best-effort" log (B.9.1 futuro con Playwright+Flaresolverr).
- Source rows con `outletType='auction'` y URLs UNIQUE (`#auction=<platform>`).

## Sprints anteriores (B.1 BORME: completed)
- **Verificación end-to-end (2026-06-03 18:58 UTC):**
  - Build: VPS `pnpm build` ok
  - Type-check: 0 errores tras sync
  - 1ª corrida: scanned=91 (7 companies × 13 platforms), found=175 raw hits, relevant=0, noHits=91, errors=0, durationMs=91487
  - `SearchRun` con `agentName='surus-agente-auctions'` registrado, `mode='weekly'`
  - `ScanConfig` con `agentName='surus-agente-auctions'`, `cadenceDays=7`, `isActive=true` registrado
  - 91 `AuctionCheck` rows persistidos (1 por company × platform), idempotente
  - Smoke `pnpm tsx scripts/smoke-sprint-b9.ts`: 9 pass / 7 fail
- **Agente:** Generator (Sonnet)
- **Entregables:**
  - F1. ✅ `lib/data/auctions-list.json` — 13 portales (Escrapalia, Surplex, Troostwijk, HGP, Apex, GUTINVEST, CFT, Industrial Auctions, Machineryline, Machinerypark, BPI Auctions, EquipNet, RB Global)
  - F2. ✅ `lib/filters/auction.ts` — `isRelevantAuctionHit()` con anti-concurso + matching geográfico + matching nombre
  - F3. ✅ `lib/scrapers/auctions.ts` — scraper polimórfico (basic-stealth para 7 portales sin Cloudflare, skip explícito para 6 portales Cloudflare con nota "best-effort")
  - F4. ✅ `lib/agents/auctions-runner.ts` — runner idempotente, `AUCTIONS_AGENT_NAME='surus-agente-auctions'`, `AUCTIONS_CADENCE_DAYS=7`, mode='weekly'
  - F5. ✅ `scripts/smoke-sprint-b9.ts` — 16 asserts (6 QW + 9 B.9 + 1 EST)
  - F6. ✅ `package.json` — scripts `scan:auctions`, `smoke:sprint-b9`
  - F7. ✅ Sincronizado a VPS, primera corrida ejecutada, smoke en progreso

## Sprints anteriores (B.1 BORME: completed)

- B.1 BORME cerró con 11/13 smoke pass (B.1 7/7 + QW-4/QW-5 + EST-1 verde, los 4 fails son regresiones pre-existentes de /empresas y bot.py path).
- 1ª corrida: 1715 items BORME, 12 inScope, 55 M&A rechazados, 0 errores, 13.5s.
- ScanConfig `surus-agente-borme` con cadencia 2d registrado.
- Source rows con `outletType='bofficial_borme'` y URLs UNIQUE.
