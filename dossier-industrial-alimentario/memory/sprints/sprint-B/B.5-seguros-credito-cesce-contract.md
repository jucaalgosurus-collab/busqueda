# Sprint Contract: B.5 — Cambios en seguros de crédito (CESCE / Coface / Allianz Trade / CyC)

**Agent**: Generator (Sonnet 4.6) → Evaluator (Opus 4.5) adversarial
**Sprint ID**: B.5
**Effort**: S (1-2 días)
**Estado**: pendiente ejecutar

## Objetivo

Detectar **bajadas de rating sectorial** publicadas por las 4 principales aseguradoras de crédito que operan en España (CESCE, Crédito y Caución/Atradius, Coface, Allianz Trade/Euler Hermes). Una bajada de assessment de un sector (p.ej. "Metals" en España) en el que operan empresas A&B de nuestra base de conocimiento es **señal amarilla** de tensión financiera que precede a desimplantaciones.

**Insight crítico** (verificado 2026-04 vía search engine): Allianz Trade y Coface publican **barómetros semanales/mensuales** con cambios sectoriales por país. CESCE publica trimestral. CyC mensual. Las publicaciones son **a nivel sector/país**, no empresa individual. Por tanto, el cruce se hace:
1. Detectar cambio de assessment del sector en país ES.
2. Listar empresas A&B del sector (por CNAE) en la base.
3. Para cada empresa A&B del sector afectado → marcar `deimplantationSignal=true` con `outOfScopeReason=null`.

## Success criteria (Definition of Done)

- [ ] **F1**: `memory/sprints/sprint-B/B.5-seguros-credito-cesce-contract.md` (este archivo).
- [ ] **F2**: `lib/data/seguros-list.json` con 4 aseguradoras (CESCE, CyC, Coface, Allianz Trade) y URLs de sus barómetros públicos.
- [ ] **F3**: `lib/scrapers/seguros-credito.ts` con scraper polimórfico (`scrapeAseguradoraBarometer(aseguradora, options)`) que extrae cambios sectoriales en España. Fetch HTML estático, regex sobre la página de barómetro.
- [ ] **F4**: `lib/filters/seguros.ts` con `applySegurosFilter(raw, prisma)` que cruza sector downgradeado con CNAE de Companies activas.
- [ ] **F5**: `lib/agents/seguros-runner.ts` con cadencia 7d, persistencia idempotente vía matchHash, `outletType='credito_aseguradora'`, `deimplantationSignal=true` cuando hay match con A&B.
- [ ] **F6**: `scripts/smoke-qw-b5.ts` con **13 asserts** (5 QW regresión + 6 B.5 funcionales + 2 EST).
- [ ] **F7**: `package.json` con scripts `scan:seguros` y `smoke:qw-b5`.
- [ ] **F8**: `deploy/run-agents.sh` con paso B.5 tras B.4.
- [ ] **F9**: VPS sync, `pnpm tsc --noEmit` 0 errores, smoke 13/13 PASS funcional, `scan:seguros` 1ª corrida sin errors.
- [ ] **F10**: `memory/sprints/sprint-B/B.5-seguros-credito-cesce-report.md` con métricas reales.
- [ ] **F11**: `memory/state/active-state.md` actualizado a "Sprint B.5 Seguros: completed (VPS)".
- [ ] **F12**: Cron `surus-agente-seguros` registrado con `cadenceDays=7`.

## Arquitectura

### Tipo de señal: SECTORIAL (no individual)

| Aseguradora | Cadencia pública | URL barómetro | País |
|---|---|---|---|
| **CESCE** | Trimestral | https://www.cesce.es/es/comunicacion/sala-de-prensa | ES |
| **Crédito y Caución (Atradius)** | Mensual | https://www.creditoycaucion.es/sala-prensa | ES |
| **Coface** | Trimestral | https://www.coface.com/newsroom | Multi-país |
| **Allianz Trade (Euler Hermes)** | Semanal | https://www.allianz-trade.com/en/economic-research/sector-risks | Multi-país |

**Decisión de cadencia del agente**: 7 días (semanal). Suficiente porque CESCE/Coface/Allianz publican al menos 1 actualización/mes, y con backfill de 30 días en la 1ª corrida capturamos el último ciclo de cada una.

### Schema v6 (mismas reglas que B.2/B.3/B.4)

- `Source.outletType`: añadir `'credito_aseguradora'` al union.
- Persistir 1 row por (aseguradora, periodo_trimestral, sector_afectado).
- Idempotencia: `matchHash = b5-{aseguradoraSlug}-{YYYY-Q}-{sector}-{dirección}`.
- `companyId`: NO asignable (el cambio es sectorial, no por empresa). Se persiste sin FK; el `findCompanyBySector` se hace en query-time.
- `deimplantationSignal`: `true` si sector downgradeado tiene ≥1 A&B en DB; `false` si sector no tiene A&B (persiste como histórico).
- `outOfScopeReason`: `'not_relevant_industry'` si ninguna A&B del sector; `null` si match.

### Detector — señales a capturar (regex)

```typescript
const DOWNGRADE_RE = /\b(?:downgrade|rebaja|baj[oó]da|cambio\s+negativo|revisi[oó]n\s+a\s+la\s+baja|perspectiva\s+negativa|riesgo\s+creciente|empeoramiento)\b/i;
const UPGRADE_RE = /\b(?:upgrade|subida|mejora|cambio\s+positivo|revisi[oó]n\s+al\s+alza|perspectiva\s+positiva|riesgo\s+decreciente)\b/i;
const SECTOR_RE = /\b(metales|alimentaci[oó]n|bebidas|hosteler[ií]a|qu[ií]mica|farmac[eé]utico|construcci[oó]n|automoci[oó]n|textil|energ[ií]a|retail|distribuci[oó]n|agr[ií]cola|pescado|c[aá]rnico|lácteos|panader[ií]a|cerveza|conservero|aceite)\b/i;
```

Cruce CNAE → sector (subset):
- `10` (Industria alimentación) → "alimentación" / "alimentario"
- `11` (Fabricación bebidas) → "bebidas" / "cerveza"
- `21` (Fabricación productos farmacéuticos) → "farmacéutico"
- `35` (Suministro energía) → "energía"
- `24` (Metalurgia) → "metales"

## Anti-falsos positivos

- Solo considerar cambios con keyword `downgrade/upgrade` Y mención explícita de país (España) o sector.
- Si la página solo lista "riesgo medio" sin cambio → outOfScope.
- Si la página es comunicados corporativos (no barómetros) → outOfScope.

## Cron

`surus-agente-seguros.service` — `OnCalendar=weekly` (lunes 04:00 UTC). Coexiste con los otros 7 agentes; ejecución total <30 min/día.

## Riesgos

- **ToS de las aseguradoras**: barómetros son contenido editorial público, no scraping agresivo. Fetch 1x/semana con User-Agent identificable. NO bypass de paywall — si hay paywall, marcar como `outOfScopeReason='paywall'`.
- **Sectores en inglés vs español**: Coface/Allianz publican en EN, CESCE/CyC en ES. Regex cubre ambos.
- **47 downgrades/quarter CESCE**: si publicaran lista completa, integrar. Si no, solo aggregate (cifra total + sectores top).

## Siguiente paso (orden MEGAPLAN)

Tras B.5 → B.6 (CDTI/IDAE/ICEX) → B.7 (despidos CTO LinkedIn) → B.8 (plantas stale 3 escaneos).
