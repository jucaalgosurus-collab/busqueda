# Sprint Contract: B.9 — Auctions scraper (Escrapalia + 12 portales)

**Sprint**: B.9 (Auctions)
**Agente**: generator (Sonnet)
**Evaluador**: evaluator (Opus, adversarial)
**Orquestador**: HJC
**Fecha**: 2026-06-03
**Stack**: Next.js 15.5.4 · Prisma 5 · PostgreSQL 16 · VPS 88.198.93.52

## Contexto (pedido explícito usuario 2026-06-03)

> "DEBE BUSCAR SI ESA COMPAÑIA EN PARTICULAR HA TRABAJADO CON ESCRAPALIA O EN LOS PORTALES CONOCIDOS DE SUBASTAS. MIRARLO SI ESTA INCLUIDO POR FAVOR, SINO AGREGARLO Y EJECUTAR TODO EL PLAN SIN PARAR"

El usuario pide detectar exposición de empresas A&B en portales de subastas/segunda mano de activos industriales. Esto NO entra en conflicto con la regla "No operamos subastas" (sección 7 del plan): es **detección** de señal amarilla/roja, no operación. Si una empresa expone activos en un portal, es señal de que la desimplantación está en fase de monetización — se reporta al depto. Surus responsable de operar subastas.

## Estado actual (auditoría 2026-06-03)

- ✅ Modelo `AuctionCheck` (prisma/schema.prisma:282-294) — 9 plataformas: Escrapalia, Surplex, Troostwijk, GUTINVEST, HGP, Apex, CFT, Industrial Auctions, Machineryline
- ✅ Componente `AuctionGrid.tsx` (UI en `/empresas/[slug]`)
- ✅ 27 checks hardcoded en seed-v6.json
- ❌ **NO** hay scraper (`lib/scrapers/auctions.ts` no existe)
- ❌ **NO** hay agente runner (`lib/agents/auctions-runner.ts` no existe)
- ❌ **NO** hay lista de URLs (`lib/data/auctions-list.json` no existe)
- ❌ **NO** hay cron (`surus-agente-auctions` no existe)
- ❌ **NO** hay smoke test

## Scope

### SÍ
- 13 portales de subastas (ES + internacionales con foco ES)
- Scraper polimórfico con sub-handlers por portal
- Anti-detect reutilizado: stealth básico, rate limiter, Flaresolverr (donde Cloudflare), Playwright stealth
- Runner con cadencia semanal (lunes 04:00 UTC)
- Idempotente: upsert por `(companyId, platform, checkedAt-day)`
- Detección `activos_detectados` → crear `Source` con `outletType='auction'`, `deimplantationSignal=true`, `signalStrength='strong'`
- Detección `historial` → crear `Source` con `deimplantationSignal=true`, `signalStrength='medium'`
- Sin detección → no crear Source
- Filtro estricto: lotTitle debe mencionar nombre empresa Y lotLocation en provincia de un Plant
- Anti-falso-positivo: empresa inventada devuelve `sin_activos` en 13/13

### NO
- Tocar scrapers existentes
- UI nueva (AuctionGrid ya existe, solo se alimenta con datos reales)
- Operar subastas (es solo detección)
- Auth, upload, edición
- Tocar `/opt/hermes-v2/`
- Enviar emails o LinkedIn DMs automáticos

## Portales a cubrir (13)

| # | Plataforma | País | Tipo | Stealth | Notas |
|---|-----------|------|------|---------|-------|
| 1 | Escrapalia | ES | HTML | Flaresolverr | Cloudflare |
| 2 | Surplex | ES/INTL | HTML+XML | Playwright | Cloudflare+Akamai, sitemap XML |
| 3 | Troostwijk | NL/INTL | HTML+XML | Playwright | Sitemap XML |
| 4 | HGP Auctions | UK | HTML | Stealth básico | |
| 5 | Apex Auctions | UK | HTML | Stealth básico | |
| 6 | GUTINVEST | ES | HTML | Stealth básico | Caso confirmado Pascual-GEA |
| 7 | CFT | ES | HTML | Stealth básico | |
| 8 | Industrial Auctions | EU | HTML | Flaresolverr | Cloudflare |
| 9 | Machineryline | INTL | JSON API | Rate limit | API pública |
| 10 | Machinerypark | DE | HTML | Stealth básico | |
| 11 | BPI Auctions | ES | HTML | Stealth básico | |
| 12 | EquipNet | US/INTL | HTML | Flaresolverr | Cloudflare |
| 13 | RB Global (Ritchie Bros) | US/INTL | HTML | Flaresolverr | Cloudflare estricto |

## Archivos

### Crear
- `lib/data/auctions-list.json` (~80 líneas, 13 portales)
- `lib/scrapers/auctions.ts` (~280 líneas, scraper polimórfico)
- `lib/filters/auction.ts` (~90 líneas, isRelevantAuctionHit)
- `lib/agents/auctions-runner.ts` (~120 líneas, runner idempotente)
- `scripts/smoke-sprint-b9.ts` (~180 líneas, 13 asserts)
- `memory/sprints/sprint-B/B.9-auctions-report.md`

### Modificar (delta mínimo)
- `package.json`: añadir `scan:auctions` script
- `prisma/schema.prisma`: añadir `'auction'` al comentario enum de `Source.outletType` (es String libre, solo doc)
- `memory/state/active-state.md`: marcar B.9 completed

### NO TOCAR
- Scrapers existentes (newsroom, sectorial, prensa, boe-bop, linkedin, borme)
- UI existente
- `/opt/hermes-v2/`

## Success criteria (PASS = 13/13 asserts verdes)

### QW regresión (5 asserts) — heredado de smoke-qw-b1.ts
- QW-1 [ ] 6 sectores amplios visibles en /empresas
- QW-2 [ ] ≥1 empresa por sector en DB
- QW-3 [ ] Navbar contiene "Juan Carlos Alvarado para Surus"
- QW-4 [ ] Footer contiene "Juan Carlos Alvarado para Surus"
- QW-5 [ ] Header del dashboard contiene "Juan Carlos Alvarado para Surus"
- QW-6 [ ] Bot Telegram 4/4 handlers

### B.9 (7 asserts)
- B.9-A [ ] `lib/data/auctions-list.json` con 13 portales
- B.9-B [ ] `lib/scrapers/auctions.ts` tipado fuerte, sin `any`
- B.9-C [ ] `lib/filters/auction.ts:isRelevantAuctionHit()` rechaza empresa inventada
- B.9-D [ ] Filtro rechaza keywords "concurso", "liquidación concursal"
- B.9-E [ ] `applyBormeFilter` no afectado (regresión B.1)
- B.9-F [ ] Cron `surus-agente-auctions` registrado (ScanConfig), cadencia 7d
- B.9-G [ ] 1ª corrida: `SearchRun` con `agentName='auctions'`, ≥1 hit real
- B.9-H [ ] 0 falsos positivos: empresa inventada NO genera `Source` con `outletType='auction'`
- B.9-I [ ] Idempotencia: 2 corridas mismo día no duplican rows
- B.9-J [ ] `Source` rows con `outletType='auction'` para hits `activos_detectados` y `historial`
- B.9-K [ ] `AuctionGrid` muestra el último check (en el UI server-side render)

### Estado (1 assert)
- EST-1 [ ] `active-state.md` actualizado a "Sprint B.9 Auctions: completed"

## Reglas duras (verificación pre-código)

| Regla | Cómo se enforce |
|---|---|
| NO concursos de acreedores | Filtro `auction.ts` rechaza hits con keywords "concurso", "liquidación concursal" |
| Solo lotes en España (CCAA 17/17) | `isRelevantAuctionHit` exige provincia/ciudad/CP ES en `lotLocation` |
| Rate limit 1 req/8s | `lib/scrapers/anti-detect/rate-limiter.ts` por plataforma |
| Stealth Cloudflare | `lib/scrapers/anti-detect/flaresolverr.ts` + Playwright stealth |
| Cadencia semanal | systemd `OnCalendar=weekly` |
| Idempotente | Upsert por `(companyId, platform, checkedAt-day)` |
| Sin falsos positivos | Matching estricto nombre comercial + ubicación plant |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| ToS agresivo (Surplex, RB Global) | rate-limit + Flaresolverr + priorizar sitemap XML cuando exista |
| Cross-border | `auction.ts` filtra a ES estrictamente |
| Empresa vende a otro | matching estricto: lotTitle debe mencionar nombre empresa Y lotLocation en provincia de un Plant |
| Conflict con scope (sección 7) | aclarado en este contrato: es **detección**, no operación |

## Patrón de ejecución

1. Sprint contract (B.9-auctions-contract.md) ← ESTE ARCHIVO
2. Crear `lib/data/auctions-list.json` (13 portales)
3. Crear `lib/filters/auction.ts` (matching estricto)
4. Crear `lib/scrapers/auctions.ts` (scraper polimórfico, 13 sub-handlers)
5. Crear `lib/agents/auctions-runner.ts` (runner idempotente)
6. Crear `scripts/smoke-sprint-b9.ts` (13 asserts)
7. `pnpm tsc --noEmit` (0 errores)
8. Sync a VPS, build, restart, primera corrida
9. `pnpm tsx scripts/smoke-sprint-b9.ts` → 13/13 PASS
10. `B.9-auctions-report.md` con métricas reales
11. `active-state.md` → "Sprint B.9 Auctions: completed"
12. Commit + push
13. Siguiente sprint (QW-1 Telegram alerts)
