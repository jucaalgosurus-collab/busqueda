# Sprint Contract: B.2 — Anuncios regulatorios (AESAN alertas alimentarias) como señal débil

**Sprint**: B.2
**Agente**: generator (Sonnet)
**Evaluador**: evaluator (Opus, adversarial)
**Orquestador**: HJC
**Fecha**: 2026-06-04
**Stack**: Next.js 15.5.4 · Prisma 5 · PostgreSQL 18 · VPS 88.198.93.52

## Contexto

Las **señales regulatorias** son una de las 8 señales débiles que predicen
desimplantación antes de que se confirme. La fuente de mayor valor para A&B
es **AESAN** (Agencia Española de Seguridad Alimentaria y Nutrición):

- Alertas alimentarias (listeria, salmonella, alérgenos no declarados,
  contaminantes) son **señal amarilla fuerte** — pueden forzar cierre
  temporal de línea, retirada de producto, o crisis reputacional.
- Una alerta que menciona a una empresa A&B de nuestra base de conocimiento
  es candidato directo a lead de desimplantación.

### Decisión de scope (reducida vs plan original)

Tras investigar APIs públicas, las opciones reales son:

| Fuente | Formato | Valor A&B | Scraping factible |
|---|---|---|---|
| **AESAN alertas** (SCIRI) | HTML estático, sin AJAX, sin paginación | **ALTO** | ✅ SÍ |
| AESA (aviación) | No público | NINGUNO | ❌ NO |
| MITECO sanciones | No hay API JSON; solo datasets estáticos CKAN | BAJO | ⚠️ Datasets pesados, baja cadencia |
| MITECO API RSS INSPIRE | ATOM, no sanciones | BAJO | ⚠️ ATOM, no relacionado |
| RASFF (EU) | Portal web con CSV/XLS export | ALTO (UE) | ❌ NO (sin API, scope UE no ES) |
| BOE (ya en boe-bop-runner) | XML | MEDIO | ✅ Sí (ya cubierto) |

**Decisión**: B.2 cubre SOLO AESAN. MITECO y RASFF quedan para sprints
futuros (B.6 MITECO ayudas públicas, sprint posterior RASFF).

El sprint B.1 (BORME) ya está en producción. B.2 cubre AESAN.
B.3..B.8 son sprints posteriores.

## Scope

### SÍ
- Scraper de `aesan.gob.es/AECOSAN/web/seguridad_alimentaria/alertas_alimentarias/listado/`
  (HTML estático, sin AJAX, sin paginación, sin rate limit aparente).
- Para cada alerta, fetch el detalle individual y extraer:
  - título completo
  - fecha
  - referencia (ej. `ES2026/327`)
  - producto afectado
  - peligro (hazard)
  - empresa/marca mencionada (si aparece)
- Cross-reference automático con `Company` por nombre normalizado (NFD + diacritics) — reusa patrón `backfill-source-plant.ts`.
- Persistencia como `Source` con `outletType='regulatorio_aesan'` y `companyId` directo (FK), `deimplantationSignal=true`. La fuerza de la señal se codifica en `outOfScopeReason` (null si in-scope) y la categoría de empresa; en B.2 todas las alertas matcheadas son señal **medium** (amarilla fuerte).
- Items sin empresa A&B matcheada → `outOfScopeReason='not_relevant_industry'` (persiste para histórico, pero sin signal).
- Runner con cadencia 2d desfasado (entre BORME y BOE/BOP).
- Cron `surus-agente-regulatorio` systemd timer.
- Smoke automatizado: 5 QW regresión + 8 B.2 asserts + 3 estado.

### NO
- B.3..B.n
- AESA (aviación) — no tiene feed público
- MITECO sanciones — sin API JSON; scope lo descarta
- RASFF — sin API pública automatizable
- Internacional: solo España
- M&A, concursos, subastas
- Auth, edición inline, upload

## Archivos

### Crear
- `lib/scrapers/regulatorio-aesan.ts` (220-300 líneas, fetch listado + cada alerta)
- `lib/agents/regulatorio-runner.ts` (100-130 líneas, runner del AESAN scraper)
- `lib/filters/regulatorio.ts` (60-90 líneas, matching empresa A&B)
- `lib/data/regulatorio-list.json` (URL base + selectores CSS)
- `scripts/smoke-qw-b2.ts` (140-180 líneas, 16 asserts)
- `memory/sprints/sprint-B/B.2-regulatorio-report.md`

### Modificar (delta mínimo)
- `lib/scrapers/types.ts`: añadir `RawAesanAlert` y `'regulatorio_aesan'` a `OutletType` (String libre, no enum real en schema v6)
- `lib/filters/regulatorio.ts` (nuevo, NO en `deimplantation.ts` para evitar acoplamiento con B.1): matching empresa A&B
- `package.json`: añadir `scan:regulatorio` + `smoke:qw-b2`
- `memory/state/active-state.md`: actualizar

### NO requiere schema migration
- `Source.outletType` ya es `String` (no enum) en schema v6. NO toca `prisma/schema.prisma`.
- Source NO tiene `signalStrength` (verificado: sólo `deimplantationSignal`, `outOfScopeReason`, `isStale`). La fuerza medium se infiere por la categoría de match (empresa A&B matcheada).

### NO TOCAR
- Scrapers existentes (newsroom, sectorial, prensa, boe-bop, linkedin, borme, auctions)
- `B.1-borme-runner.ts`
- UI v5/v6
- `/opt/hermes-v2/`
- `hermes-gateway.service`

## Success criteria (PASS = 16/16 asserts verdes)

### QW regresión (5 asserts)
- QW-1 [ ] `smoke:qw-1` 5/5 PASS
- QW-2 [ ] `smoke:qw-2` PASS
- QW-3 [ ] `smoke:qw-3` 9/9 PASS
- QW-4 [ ] `smoke:qw-4` PASS
- QW-5 [ ] `smoke:qw-5` PASS

### B.2 (8 asserts)
- B.2-A [ ] `lib/scrapers/regulatorio-aesan.ts` parsea listado: extrae `[{title, url, date}]`
- B.2-B [ ] Fetch de detalle individual: extrae `producto, hazard, empresa` del HTML
- B.2-C [ ] `lib/filters/regulatorio.ts` matchea empresa A&B por nombre normalizado (NFD + diacritics + lowercase)
- B.2-D [ ] Items in-scope con `outletType='regulatorio_aesan'`, `deimplantationSignal=true`, `companyId` FK directo (NO tabla `ArticleCompany` — esa tabla NO existe en schema v6)
- B.2-E [ ] Items out-of-scope: alerta sin empresa A&B → `outOfScopeReason='not_relevant_industry'`
- B.2-F [ ] Idempotente: 2 corridas mismo día no duplican rows (UNIQUE url)
- B.2-G [ ] Cron `surus-agente-regulatorio` registrado, cadencia 2d, desfasado vs BORME
- B.2-H [ ] 1ª corrida: ≥1 item scrapeado (in-scope o out-of-scope) — sin CAPTCHA bloqueante

### Estado (3 asserts)
- EST-1 [ ] `memory/state/active-state.md` actualizado a "Sprint B.2 Regulatorio: completed"
- EST-2 [ ] `B.2-regulatorio-report.md` escrito con métricas reales
- EST-3 [ ] `git commit` pusheado

## Seguridad

- URL validada: solo `aesan.gob.es/AECOSAN/web/seguridad_alimentaria/...`
- Throttle 1 req cada 3s (sitio público sin ToS agresivo, pero no abusar)
- Sin secretos en código (`.env`)
- Sin SQL concatenado (Prisma parametrizado)
- Respeta `robots.txt` (verificar `User-agent: *` en `/robots.txt` antes de scrapear)
- Fetch con `Accept-Language: es-ES` para contenido correcto

## Definition of Done

- `pnpm tsc --noEmit` exit 0
- `pnpm smoke:qw-b2` 16/16 PASS en VPS
- Cron `systemctl list-timers | grep regulatorio` muestra el timer activo
- `B.2-regulatorio-report.md` con timestamp 1ª corrida, items scrapeados,
  in-scope, out-of-scope, ms totales
- Estado preservado
- Commit pusheado

## Anti-evasion (rechazo explícito)

| Pretensión | Veredicto |
|---|---|
| "AESAN no tiene API" | RECHAZADO. Hay HTML estático scrapeable. |
| "MITECO es complicado, lo dejamos" | ACEPTADO. Está fuera de scope. |
| "Empresa matching es fuzzy, costo alto" | RECHAZADO. NFD + lowercase es trivial. |
| "0 items in-scope en 1ª corrida" | ACEPTABLE si se scrapean items out-of-scope. |
| "Solo 3 items scrapeados, lentísimo" | RECHAZADO. Subir concurrencia o reducir throttle. |
| "AESAN cambia HTML, frágil" | ACEPTABLE si el smoke lo testea con mock. |
