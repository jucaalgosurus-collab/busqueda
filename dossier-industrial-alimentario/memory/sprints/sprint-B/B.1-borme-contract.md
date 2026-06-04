# Sprint Contract: B.1 — BORME (cambios domicilio + desimplantación A&B)

**Sprint**: B.1
**Agente**: generator (Sonnet)
**Evaluador**: evaluator (Opus, adversarial)
**Orquestador**: HJC
**Fecha**: 2026-06-03
**Stack**: Next.js 15.5.4 · Prisma 5 · PostgreSQL 16 · VPS 88.198.93.52

## Contexto

BORME (Boletín Oficial del Registro Mercantil) publica a diario actos societarios
de empresas españolas: cambios de domicilio, ampliaciones, reducciones de capital,
disoluciones, nombramientos de administradores, etc. Es una **señal amarilla**
de desimplantación cuando un cambio se combina con la cuenta de resultados.

El usuario aprobó el sprint B (señales débiles) el 2026-06-03. B.1 cubre BORME;
B.2 (anuncios regulatorios) y siguientes son sprints posteriores.

## Scope

### SÍ
- Scraper puro de `https://www.boe.es/diario_borme/` (XML/JSON)
- Filtrado anti-M&A y anti-subasta/concurso (preservar scope del usuario:
  NO concursos, NO subastas, NO email/LinkedIn automático)
- Runner con cadencia 2d, first-run backfill 15d
- 1ª corrida con ≥10 items in-scope
- Cron cableado en VPS
- Smoke automatizado de los 5 QW (regresión) + 7 asserts de B.1
- Documentación y preservación de estado

### NO
- B.2..B.n
- Tocar los 5 scrapers existentes (newsroom, sectorial, prensa, boe-bop, linkedin)
- `/opt/hermes-v2/` o `hermes-gateway.service`
- Auth, upload, edición inline
- Cualquier cambio en UI

## Archivos

### Crear
- `lib/scrapers/borme.ts` (220-280 líneas)
- `lib/agents/borme-runner.ts` (90-130 líneas)
- `scripts/smoke-qw-b1.ts` (130-180 líneas, 13 asserts)
- `memory/sprints/sprint-B/B.1-borme-report.md`

### Modificar (delta mínimo)
- `lib/scrapers/types.ts`: añadir `RawBormeItem`
- `lib/filters/deimplantation.ts`: añadir `applyBormeFilter`
- `package.json`: añadir `scan:borme`
- `memory/state/active-state.md`: actualizar

### NO TOCAR
- Scrapers existentes
- UI v5
- `/opt/hermes-v2/`
- `hermes-gateway.service`

## Success criteria (PASS = 13/13 asserts verdes)

### QW regresión (5 asserts)
- QW-1 [ ] 6 sectores amplios visibles en /empresas
- QW-2 [ ] ≥1 empresa por sector en DB
- QW-3 [ ] Navbar contiene "Juan Carlos Alvarado para Surus"
- QW-4 [ ] Footer contiene "Juan Carlos Alvarado para Surus"
- QW-5 [ ] Header del dashboard contiene "Juan Carlos Alvarado para Surus"
- QW-6 [ ] Bot Telegram 4/4 handlers (texto, voz, foto, comando desconocido)

### B.1 (7 asserts)
- B.1-A [ ] `lib/scrapers/borme.ts` tipado fuerte, sin `any`
- B.1-B [ ] Items en DB con `outletType='bofficial_borme'`, `url` UNIQUE
- B.1-C [ ] Filtro desimplantación: ≥1 keyword match O score > 0.5
- B.1-D [ ] Anti-M&A: keywords "fusión|adquisición|absorción" → `signal=false`, `outOfScopeReason='m_and_a'`
- B.1-E [ ] Anti-subasta/concurso: keywords "subasta|concurso|liquidación concursal" → `signal=false`, `outOfScopeReason='auction_or_ettbewerb'`
- B.1-F [ ] Cron `surus-agente-borme` registrado, cadencia 2d
- B.1-G [ ] 1ª corrida: `SearchRun.mode='backfill_15d'`, ≥10 items nuevos
- B.1-H [ ] 0 falsos positivos M&A/subasta marcados como signal=true

### Estado (3 asserts)
- EST-1 [ ] `memory/state/active-state.md` actualizado a "Sprint B.1 BORME: completed"
- EST-2 [ ] `B.1-borme-report.md` escrito con métricas reales
- EST-3 [ ] `git commit` pusheado

## Seguridad

- URLs validadas: solo `https://www.boe.es/diario_borme/*`
- UA rotado vía `lib/scrapers/anti-detect/user-agent-rotator.ts`
- Throttle 1 req cada 4s, máx 30 items/req
- Sin secretos en código (`.env`)
- Sin SQL concatenado (Prisma parametrizado)

## Definition of Done

- `pnpm tsc --noEmit` exit 0
- `pnpm ts-node scripts/smoke-qw-b1.ts` 13/13 PASS en VPS
- Cron `hermes cron list` muestra `surus-agente-borme`
- `B.1-borme-report.md` con timestamp 1ª corrida, items scrapeados, in-scope, out-of-scope, ms totales
- Estado preservado
- Commit pusheado

## Anti-evasion (rechazo explícito)

| Pretensión | Veredicto |
|---|---|
| "Los QW ya están, no re-verifico" | RECHAZADO. Smoke es regresión obligatoria. |
| "BORME da 8 items, no 10" | RECHAZADO. Ampliar keywords. |
| "Cron luego" | RECHAZADO. Sin cron, B.1 incumple. |
| "Ya existía scraper BORME v0" | VERIFICAR primero. Auditar antes de sobrescribir. |
