# Sprint E — PLAN MAESTRO 2026-06-04

> **Brief Juan Carlos (msg de hoy, verbatim, recortado):**
> "POR AHORA SOLO PLAN. TODO LO QUE SE HAGA TIENE QUE TENER ORQUESTADOR Y LOS AGENTES TODO. (…) Tiene que escanear prensa local y no lo veo ahí. El escaneo es importante sea ordenado y por fechas, ya que luego se necesita en la web el link de donde sale la información, qué compañía y qué instalación es. Luego quiero que se ordene por compañía e instalación ya que va a ser un dash muy grande si no se hace así. (…) ampliaras la cobertura de la lectura de los titulares a otros sectores industriales sectorizándolos. Primero Alimentos y Bebidas, Construcción, Vehículos, Maquinaria, Stock, Equipamiento Médico de Laboratorio y Biotecnología, Propiedad Intelectual Marcas y Patentes, Energía, Patentes, Industria en General. Tienes que catalogarlo BIEN. Tienes una API en sistema de DEEPSEEK que es la que quiero que uses para la mayoría de las operaciones, QWEN sólo cosas básicas si es necesario o respaldo. Te dije eliminaras B.1 BORME scraping. (…) UI Next.js tiene que cambiar (…) sala situacional completísima, visualmente impresionante y muy interactiva. (…) Detalle hay que hacer TODO, lo inmediato lo del mes y los fixes."

> **Regla de oro de este plan**: SOLO PLAN, cero ejecución. Cada bloque sale como sprint contract con criterios atómicos, dependencias mapeadas y dueño (agente). Cuando Juan Carlos diga "GO", el orchestrator dispara los sprints en el orden establecido.

---

## 0. Estado de partida real (sin auto-alabanza)

| Bloque | Estado | Evidencia |
|---|---|---|
| 7 fixes D.1 | ✅ aplicados (Telegram, env-file, Surus2024!, daysBack=2, sources stale, backup DB, query patentes) | `memory/state/active-state.md` |
| D.1.6 cache Hunter | ⚠️ migración local, `prisma migrate deploy` pendiente en VPS | `prisma/schema.prisma:523` |
| D.1.8 patentes regex | ⚠️ fix local, falta validar en run del lunes en VPS | `lib/scrapers/oepm.ts:55-83` |
| D.2 seed CNAE | ⚠️ 13 empresas en local, falta `pnpm seed:cnae` en VPS | `data/seed-cnae.json` |
| LinkedIn cookie | 🔴 muerta, decisión cookie vs RapidAPI pendiente | bloqueado por JC |
| Dossier Vercel | 🔴 nunca desplegado, sólo landing | reporte forense |
| Sectorización amplia (10 cat) | 🔴 NO hecha — `lib/industria.ts` sólo tiene 6 | brief de hoy |
| Prensa local | 🔴 NO existe — 1 entry "local" en JSON de 460 líneas | `lib/data/prensa-list.json` |
| Ordenamiento por fecha + link + compañía + sede | ⚠️ datos sí están en DB, UI no los ordena ni filtra | `app/empresas/page.tsx` |
| Sala situacional | 🔴 UI actual es ficha simple, no situacional | brief de hoy |
| DeepSeek como primario | ⚠️ wrapper existe (`lib/ia/deepseek.ts`), sólo 1 caller (daily-briefing) | `grep summarizeFindings` |
| Eliminar B.1 BORME scraping | 🔴 borme-runner.ts + borme.ts + 49 SearchRun siguen vivos | `lib/agents/borme-runner.ts` |

---

## 1. Catálogo de sprints (E.0 → E.12)

### Bloque INMEDIATO — drena la deuda D.1/D.2 ya iniciada

#### E.0 — Cerrar deuda D.1/D.2 en VPS (deploy + validación)
- **Tipo**: OPS+VALIDATION
- **Agente**: generator → evaluator
- **Output esperado**:
  1. `git pull` + `pnpm install` + `pnpm prisma generate` + `pnpm prisma migrate deploy` en `/opt/hermes-dossier/`
  2. `pnpm seed:cnae` (idempotente, sólo escribe si `cnae` es null)
  3. Reinicio de servicios: `surus-agente-patentes`, `hermes-daily-report` (smoke con `journalctl -u`)
  4. 1 corrida manual de `surus-agente-patentes` y verificar `itemsInScope >= 1`
  5. 1 corrida manual de `surus-agente-newsroom` con `daysBack=2` y verificar 0 errors
  6. Smoke Hunter en VPS: `npx tsx scripts/smoke-hunter-cache.ts` → 6/6 PASS
- **Criterio PASS (hard)**:
  - `EmailVerification` tabla existe en DB
  - `Company.count >= 21` (8 viejas + 13 nuevas)
  - 1 nueva `Patent` row o `SearchRun.itemsInScope >= 1` en lunes 8 jun
  - 0 errors en `journalctl -u surus-agente-newsroom -n 50`
- **Dependencias**: ninguna (es el primero)
- **Tiempo**: 30 min ejecución + 24h espera para el siguiente run scheduled

#### E.1 — Hotfix LinkedIn (decisión binaria de JC)
- **Tipo**: DECISION + IMPL
- **Agente**: orchestrator pide a JC → si OK → generator
- **Output esperado**:
  - Opción A: JC regenera cookie `li_at` desde su browser y la pega en `/etc/hermes/hermes.env` como `LINKEDIN_LI_AT_COOKIE=...` mode 600
  - Opción B: provisionar RapidAPI ($50/mes) y refactor `lib/agents/linkedin-runner.ts` para usar el endpoint en lugar de scraping directo
- **Criterio PASS**:
  - 1 corrida de `linkedin-runner` devuelve ≥1 perfil real para una empresa seed
- **Dependencias**: input humano de JC
- **Tiempo**: 15 min si cookie / 2h si RapidAPI

---

### Bloque ARQUITECTURA — refactor que habilita TODO lo de la sala situacional

#### E.2 — Eliminar B.1 BORME scraping (deprecation segura)
- **Tipo**: REFACTOR + DATA
- **Agente**: planner → generator → evaluator
- **Output esperado**:
  1. Marcar `borme-runner.ts` como deprecated: el runner ya no se ejecuta, pero la lectura de `BormeEvent` (histórico ya ingestado) sigue disponible en `/empresas/[slug]` mediante un componente que sólo lee
  2. Borrar timer systemd `surus-agente-borme.timer` + `.service` (con backup `.bak-<ts>`)
  3. Borrar `lib/scrapers/borme.ts` SI y sólo SI ningún otro runner depende de él (grep first)
  4. Mantener tabla `BormeEvent` en schema — el histórico es legalmente útil; no se purga
  5. Quitar referencias a borme del `daily-briefing-runner.ts` (resumen Telegram)
  6. Documentar la decisión en `memory/decisions/2026-06-04-eliminar-borme.md`
- **Criterio PASS**:
  - `grep -r "borme-runner" --include="*.ts"` → 0 hits en `lib/agents/` o `scripts/`
  - `systemctl list-timers | grep borme` → vacío
  - `BormeEvent` count en DB no cambia (es histórico, no se borra)
  - Build pasa: `pnpm build` → 0 errors
- **Dependencias**: ninguna (independiente)
- **Tiempo**: 45 min

#### E.3 — Sectorización amplia: 10 categorías (refactor `lib/industria.ts`)
- **Tipo**: SCHEMA + DATA + UI
- **Agente**: architect (decide taxonomía) → generator → evaluator
- **Output esperado**:
  1. **Refactor `lib/industria.ts`** con 10 sectores exactos del brief, con `cnaePrefix` correcto:
     | # | Sector | CNAE prefix | contactosHabilitados |
     |---|---|---|---|
     | 1 | Alimentos y Bebidas | 10, 11 | true |
     | 2 | Construcción | 41, 42, 43 | false |
     | 3 | Vehículos | 29, 30 (transporte) | false |
     | 4 | Maquinaria | 28 | false |
     | 5 | Stock industrial | (categoría transversal, sin CNAE) | false |
     | 6 | Equipamiento Médico de Laboratorio y Biotecnología | 21, 26.6, 32.5, 72.11 | false |
     | 7 | Propiedad Intelectual Marcas y Patentes | (transversal, vía OEPM/EUIPO) | false |
     | 8 | Energía | 05, 06, 07, 08, 09, 19, 35 | false |
     | 9 | Patentes | (alias de PI, queda como tag) | false |
     | 10 | Industria en General | 13, 14, 15, 16, 17, 18, 20, 22, 23, 24, 25, 27, 31, 32, 33 | false |
  2. **Backfill DB**: re-evaluar `Company.sector` para todas las empresas existentes (script `scripts/backfill-sectors.ts`) sin sobreescribir asignaciones manuales
  3. **Backfill `Source.outletType`**: añadir nueva columna `Source.sector` que se computa al ingestar (filtro contenido + outlet)
  4. **R1 honrado**: re-correr lectura de medios para sectorizar las 1.597 prensa + 1.151 newsroom ya ingestadas — sprint E.3b dependiente
  5. Tests: `scripts/smoke-sectorizacion-10.ts` con 10 asserts (una por sector)
- **Criterio PASS**:
  - `INDUSTRIAS.length === 10`
  - 100% de Companies tienen un sector ∈ las 10
  - `Source.sector` poblado en ≥80% de sources con publishedAt >= 2026-01-01
- **Dependencias**: E.2 cerrado (para no tocar borme-runner mientras refactorizamos)
- **Tiempo**: 4h (split en E.3 schema/taxonomía + E.3b backfill)

#### E.3b — Backfill sectorización en sources históricas (R1 cumplido)
- **Tipo**: DATA-BACKFILL
- **Agente**: generator
- **Output esperado**:
  1. Script `scripts/backfill-source-sectors.ts` con bucket processing (100 sources/batch)
  2. Re-evaluar 1.597 prensa + 1.151 newsroom + 121 stale (skip stale) → asignar `Source.sector` y, si la noticia menciona explícitamente una sede, `Source.plantId`
  3. Logging por batch en `/var/log/hermes-scan/backfill-sectors.log`
- **Criterio PASS**:
  - ≥80% de sources tienen `sector` no-null
  - ≥30% tienen `plantId` no-null (objetivo conservador)
  - 0 sources perdidas (count antes == count después)
- **Dependencias**: E.3 schema cerrado
- **Tiempo**: ~6h ejecución (no humano)

#### E.4 — DeepSeek como LLM primario (Qwen relegado a backup)
- **Tipo**: REFACTOR
- **Agente**: generator → security-reviewer
- **Output esperado**:
  1. Auditar TODOS los call sites LLM:
     - `lib/ia/email-generator.ts` (ya usa DeepSeek inline — armonizar a `lib/ia/deepseek.ts`)
     - `lib/agents/daily-briefing-runner.ts` (ya usa `summarizeFindings`)
     - Cualquier ruta API que llame Ollama (`grep ollama` → `deploy/run-agents.sh`)
  2. Crear `lib/ia/llm-router.ts` con función `callLLM({ prompt, fallbackToQwen?: boolean })`:
     - Default: DeepSeek
     - Fallback Qwen sólo si `process.env.LLM_FORCE_FALLBACK === '1'` o si DeepSeek devuelve 5xx
  3. Variables de entorno en `/etc/hermes/hermes.env` (mode 600): `DEEPSEEK_API_KEY` (ya), `DEEPSEEK_MODEL=deepseek-chat`, `LLM_FALLBACK_OLLAMA_URL=http://127.0.0.1:11434`
  4. Quitar Ollama de paths críticos (BORME estaba eliminado en E.2 — confirmar que ningún runner se queda colgado)
  5. Smoke: `scripts/smoke-llm-router.ts` con 4 asserts (DeepSeek OK, DeepSeek 500 → Qwen, ambos caídos → error claro, MOCK funciona)
- **Criterio PASS**:
  - `grep -r "ollama" lib/ --include="*.ts"` → 0 hits en código de producción
  - 1 corrida real de daily-briefing genera resumen vía DeepSeek (validar `model: 'deepseek-chat'` en log)
  - Coste por run DeepSeek < $0.01 (es barato, validar con `usage` en respuesta)
- **Dependencias**: E.0 cerrado (env-file consolidado)
- **Tiempo**: 2h

---

### Bloque OSINT — añade nuevas fuentes y reordena

#### E.5 — Agente Prensa Local (nuevo, no existe hoy)
- **Tipo**: NEW-AGENT + DATA
- **Agente**: planner → generator → evaluator
- **Output esperado**:
  1. **Investigación previa**: usar `gh search code "rss prensa local españa"` + Exa para descubrir feeds RSS de diarios locales por provincia
  2. **Nuevo JSON** `lib/data/prensa-local-list.json` con ≥50 medios locales (mínimo 1 por provincia, donde exista)
  3. **Nuevo runner** `lib/agents/prensa-local-runner.ts` (réplica de `prensa-runner.ts` con `outletType='local'` + `kind='local'`)
  4. **Nuevo timer systemd** `surus-agente-prensa-local.{service,timer}` (cadence 2d, igual que prensa regional)
  5. **Filtro asociación a sede**: por cada artículo, si menciona un topónimo que matchea una `Plant.city`, asociar `Source.plantId`
  6. Tests: `scripts/smoke-prensa-local.ts` con 5 asserts (lista válida, runner ingest 1 artículo mock, filtro asocia plant correcta)
- **Criterio PASS**:
  - `prensa-local-list.json` tiene ≥50 entries con campos: `slug, outlet, url, rss?, region, provincia, ccaa, kind:'local'`
  - 1 corrida real ingiere ≥10 artículos nuevos en 7 días
  - ≥30% de los artículos quedan con `plantId` no-null (asociación a sede)
- **Dependencias**: E.3 sectorización cerrada (para que Source.sector se rellene también)
- **Tiempo**: 6h (la mayor parte: investigar feeds RSS reales)

#### E.6 — Ordenamiento + asociación link/empresa/sede (es lo que pide JC literal)
- **Tipo**: SCHEMA + UI
- **Agente**: generator → evaluator
- **Output esperado**:
  1. Toda lista de Sources en la UI debe ordenarse por `publishedAt DESC` (default), con override `?sort=scrapedAt|publishedAt|company|plant`
  2. Cada row visible debe mostrar 4 columnas: **fecha · link · empresa · sede**
  3. Si `Source.plantId` es null, mostrar sede como "(sin asociar)" + acción "Asociar a sede" (Sprint admin → backlog)
  4. Endpoint `GET /api/sources?company=&plant=&sector=&kind=&from=&to=` con paginación 50/pág
  5. Tests: `scripts/smoke-sources-api.ts` con 6 asserts
- **Criterio PASS**:
  - `/api/sources?sort=publishedAt` devuelve JSON ordenado descendiente
  - `/api/sources?company=X` filtra correctamente
  - UI muestra las 4 columnas para cualquier ruta donde aparezcan Sources
- **Dependencias**: E.3 (necesita `Source.sector`)
- **Tiempo**: 3h

---

### Bloque UI — la sala situacional

#### E.7 — Sala situacional v1 (rediseño `/dashboard` + `/empresas`)
- **Tipo**: UI-REDESIGN
- **Agente**: architect (decide estilo visual) → generator → e2e-runner
- **Output esperado**:
  1. **Decidir dirección visual** (no template-genérico): editorial + bento + dark-luxury con disciplina. Referencias: Bloomberg Terminal, Palantir Foundry, NotebookLM.
  2. **Layout principal `/dashboard`** (single-page situacional, no muchas rutas):
     - Header: contador en vivo (Companies, Plants, Sources últimas 24h, Sources últimos 7d, Patents, BormeEvents)
     - Mapa de España SVG con plantas marcadas por sector (color = sector)
     - Filtros laterales sticky: Sector (chips, 10), CCAA (chips, 17), Estado planta (chips, 8), Tipo fuente (chips, 5), Rango fechas (datepicker)
     - Grid bento de las últimas 50 noticias (orden por publishedAt) con columnas fecha · link · empresa · sede · sector
     - Panel derecho: alertas de `Plant.isStale`, alertas de `Operation.type='plant_closure'` recientes
  3. **Tipografía**: serif para titulares (Fraunces o IBM Plex Serif), sans para datos (Inter o IBM Plex Sans), monospace para números (JetBrains Mono)
  4. **Tokens CSS** en `app/globals.css` con paleta intencional (no gris-default)
  5. **Animaciones**: solo `transform` + `opacity`. Stagger en entrada del grid.
  6. **Accesibilidad**: semántica correcta, focus visible, reduced-motion honra
  7. **Performance**: LCP < 2.5s, INP < 200ms, JS gzip < 300kb
  8. Tests visuales: Playwright screenshots @ 768/1024/1440 + Lighthouse score ≥90 perf + ≥95 a11y
- **Criterio PASS**:
  - Dashboard pasa el "anti-template checklist" (≥4 de las 10 cualidades exigidas en `web/design-quality.md`)
  - Filtros combinan correctamente (sector + CCAA + fechas)
  - Lighthouse perf ≥90, a11y ≥95
- **Dependencias**: E.3, E.6 (necesita datos sectorizados y API ordenable)
- **Tiempo**: 12h (es el bloque grueso de UI)

#### E.8 — Filtros adicionales: nombre empresa + sede + sector (autocomplete)
- **Tipo**: UI + API
- **Agente**: generator
- **Output esperado**:
  1. Componente `<SearchCommand />` (estilo Cmd+K / cmdk) con tres tabs: Empresas, Sedes, Sectores
  2. Backend `/api/search?q=…` con full-text vía `Source.contentTsv` (ya existe en schema) + LIKE en `Company.name` + `Plant.city`
  3. Atajo de teclado global `⌘+K` (Mac) / `Ctrl+K` (Win/Linux)
  4. Tests: `scripts/smoke-search.ts` con 4 asserts
- **Criterio PASS**:
  - Buscar "pascual" devuelve la Company + sus 5 Plants + ≥10 Sources relevantes
  - Latencia P95 < 200ms para queries de hasta 3 palabras
- **Dependencias**: E.7 (host del componente)
- **Tiempo**: 4h

---

### Bloque MES — items mensuales (no-urgentes pero hay que tenerlos)

#### E.9 — 50–200 companies reales (expansión CNAE_INE)
- **Tipo**: DATA-INGEST
- **Agente**: generator
- **Output esperado**:
  1. Descargar listado INE CNAE 10+11 + (ahora también 41/42/43/29/28/35/26.6) — el campo `Stock` y `PI` no son CNAE, no aplican
  2. Cruzar con eInforma / Axesor (top facturación por CNAE) si APIs disponibles, si no scrape público
  3. Filtrar: facturación > 50M€/año (umbral grande-empresa) — configurable
  4. Upsert idempotente con `seed:industrial` (igual patrón que `seed:cnae`)
  5. Tests: 10 asserts mínimo
- **Criterio PASS**:
  - Total Companies ≥ 50 (umbral mínimo) o ≥ 200 (objetivo)
  - 0 duplicados (count Company.cif unique)
- **Dependencias**: E.3 (taxonomía 10-sectores)
- **Tiempo**: 8h

#### E.10 — Panel admin oculto con auth (mensaje 7729)
- **Tipo**: AUTH + UI
- **Agente**: planner → generator → security-reviewer
- **Output esperado**:
  1. Ruta `/admin` protegida por `SURUS_ADMIN_TOKEN` (header `x-admin-token` o cookie)
  2. Saludo personalizado: "Hola Juan Carlos. Hoy hay X noticias de desimplantación en empresas relevantes para Surus."
  3. Login simple (no OAuth — sólo token compartido en `/etc/hermes/hermes.env`)
  4. CSP estricto con nonce (ver `web/security.md`)
  5. Rate limit 10 req/min por IP en `/api/admin/*`
- **Criterio PASS**:
  - `/admin` sin token → 401
  - `/admin` con token → 200 + saludo
  - 0 secrets en HTML público
- **Dependencias**: E.7 (estilo visual coherente)
- **Tiempo**: 4h

#### E.11 — Deploy híbrido: Vercel landing + VPS dossier con TLS
- **Tipo**: OPS
- **Agente**: planner → generator
- **Output esperado**:
  1. **Vercel**: subir el dossier completo al proyecto `surusclientes` (no la landing actual)
  2. **VPS**: instalar Caddy (más simple que nginx para TLS automático) → `dossier.surus.es` con Let's Encrypt
  3. Decidir: ¿el dominio público es Vercel o VPS? Recomendación: Vercel = landing + redirect a VPS-detrás-de-CDN para el dossier (porque scrapers escriben en VPS DB y Vercel no puede)
  4. DNS: `surusclientes.com → vercel`, `dossier.surusclientes.com → VPS:443`
  5. Health checks: `https://dossier.surusclientes.com/api/health` → 200 OK
- **Criterio PASS**:
  - URL pública con `https://` válido (cert Let's Encrypt no-self-signed)
  - JC abre URL desde móvil y carga
  - 0 mixed-content warnings
- **Dependencias**: E.7 (UI ya rediseñada)
- **Tiempo**: 6h

---

### Bloque FIX — los fixes pendientes que aún no entraron

#### E.12 — Sanciones SANCO + CNMC (lo que era C.4 / D.3)
- **Tipo**: NEW-AGENT
- **Agente**: planner → generator
- **Output esperado**:
  1. Scraper `lib/scrapers/sanciones.ts` para SANCO (Comisión Nacional Sanidad) + CNMC (Comisión Nacional Mercados y Competencia)
  2. Runner `lib/agents/sanciones-runner.ts` con cadence 7d
  3. Modelo `Sancion` en schema (companyId, organismo, expediente, sanctionedAt, multaEur, motivo, sourceUrl)
  4. UI: tab "Sanciones" en `/empresas/[slug]`
- **Criterio PASS**:
  - 1 corrida ingiere ≥1 sanción real por organismo
- **Dependencias**: E.7 (estilo)
- **Tiempo**: 6h

---

## 2. Dependencias y orden recomendado

```
E.0 (deuda VPS) ──┬─> E.1 (LinkedIn decisión)
                  │
                  └─> E.2 (eliminar BORME) ──> E.3 (10 sectores) ──┬─> E.3b (backfill)
                                                                    │
                                                                    ├─> E.5 (prensa local)
                                                                    │
                                                                    ├─> E.6 (orden+link+empresa+sede)
                                                                    │
                                                                    ├─> E.9 (50–200 companies)
                                                                    │
                                                                    └─> E.7 (sala situacional) ──┬─> E.8 (search ⌘K)
                                                                                                  ├─> E.10 (admin auth)
                                                                                                  ├─> E.11 (deploy híbrido)
                                                                                                  └─> E.12 (sanciones)

E.4 (DeepSeek primario) — paralelo, depende sólo de E.0 (env-file)
```

Sprints **paralelizables**: { E.2, E.4 } | { E.5, E.6, E.9 } | { E.8, E.10, E.12 }

---

## 3. Restricciones innegociables (verbatim)

1. **Supreme Order 2026-06-03** (`memory/feedback-no-direct-writes.md`): TODO en este workspace pasa por `orchestrator → planner → sprint contract → generator → evaluator`. Cualquier write directo sin contrato = falta grave.
2. **R1**: al expandir sectores, re-correr lectura de medios. Cubierto por E.3b.
3. **R2**: TODO lo ejecuta el VPS. Yo audito, no ejecuto scrapers en local.
4. **NO auto-alabanza**. Reportes sin emojis, sin "perfectamente", sin "completado con éxito". Si algo no está hecho, decirlo.
5. **NO pisar `active-state.md` del VPS**. Append, no replace.
6. **NO cambiar systemd units, nginx, etc.** sin pedir OK explícito.
7. **Secrets**: hardcode = falta grave. Todo va a `/etc/hermes/hermes.env` (mode 600, root).

---

## 4. Riesgos y mitigaciones

| Riesgo | Sprint | Mitigación |
|---|---|---|
| Backfill sectorización (1597+1151 sources) tarda >24h y bloquea Postgres | E.3b | Bucket 100/batch, sleep 200ms entre batches, `pg_repack` después |
| Refactor LLM rompe daily-briefing (Telegram en silencio) | E.4 | Mantener `summarizeFindings` exportado como wrapper de `callLLM` durante 1 release |
| Sala situacional con mapa SVG pesa > 300kb JS | E.7 | Dynamic import del mapa, lazyload del bento debajo de viewport |
| Prensa local feeds RSS rotos | E.5 | Validar 50 feeds con HEAD + parsear 1 entry antes de aceptar el medio |
| Eliminar BORME borra histórico por error | E.2 | NO borrar tabla `BormeEvent`, sólo runner + timer. `pg_dump` antes |
| Vercel no puede leer Postgres del VPS | E.11 | Vercel = landing estática; dossier real en VPS detrás de Caddy. Vercel sólo redirige |

---

## 5. Cobertura del brief (matriz de trazabilidad)

| Item brief | Sprint que lo cubre |
|---|---|
| "Tiene que escanear prensa local y no lo veo ahí" | **E.5** |
| "El escaneo es importante sea ordenado y por fechas" | **E.6** |
| "Se necesita en la web el link, qué compañía, qué instalación" | **E.6** (cols fecha·link·empresa·sede) |
| "Que se ordene por compañía e instalación" | **E.6 + E.7** (filtros) |
| "Ampliaras la cobertura a otros sectores… 10 categorías" | **E.3** |
| "Catalogarlo BIEN" | **E.3** + **E.3b backfill** |
| "DeepSeek primario, Qwen sólo backup" | **E.4** |
| "Eliminaras B.1 BORME scraping" | **E.2** |
| "Sala situacional completísima, visualmente impresionante" | **E.7** |
| "Filtrar por sector, nombre, locación de instalación" | **E.7 + E.8** |
| "Brutal cantidad y forma de entregar la información" | **E.7** (bento + mapa + KPIs) |
| "TODO, lo inmediato, lo del mes, los fixes" | **E.0–E.12** completo |

12/12 items cubiertos.

---

## 6. Próximo paso

JC dice "GO E.0" (o el sprint que quiera abrir primero) y el orchestrator dispara la cadena `planner → sprint contract → generator → evaluator`. Sin "GO", este documento queda en disco y el código no se toca.
