# Sprint Contract: B.6 — Ayudas públicas CDTI / IDAE / ICEX como señal débil de inversión→cierre

**Sprint**: B.6
**Agente**: generator (Sonnet 4.6)
**Evaluador**: evaluator (Opus 4.5, adversarial)
**Orquestador**: HJC
**Fecha**: 2026-06-04
**Stack**: Next.js 15.5.4 · Prisma 5 · PostgreSQL 16 · VPS 88.198.93.52
**Estado**: Pendiente

## Contexto

En España, las 3 grandes fuentes de **ayudas públicas** a la inversión industrial son:
- **CDTI** (Centro para el Desarrollo Tecnológico e Industrial, dependiente del MINCOTUR) → ayudas a proyectos de I+D+i industrial.
- **IDAE** (Instituto para la Diversificación y Ahorro de la Energía, dependiente del MITECO) → ayudas a eficiencia energética, renovables, descarbonización industrial.
- **ICEX** (España Exportación e Inversiones, dependiente del MINCOTUR) → ayudas a internacionalización de empresas españolas.

Estas 3 entidades publican **resoluciones de concesión** y **anuncios de proyectos aprobados** en el **BOE (Boletín Oficial del Estado)** y en sus propios portales de transparencia.

**Hipótesis de señal débil**: si una empresa A&B del sector industrial (CNAE 10/11/21/24/35/22/19/20/29-30) recibe una **ayuda pública** para invertir en una planta en España y, **posteriormente** (entre 0 y 36 meses), esa misma planta aparece en el sistema como **cerrada / desimplantada / sin producción / ERE / concurso**, entonces la probabilidad de que la ayuda se haya **desviado de su finalidad** o de que la empresa haya **abandonado el proyecto cofinanciado** es muy alta. Esto es un **fraude potencial de fondos públicos** + una **señal amarilla muy fuerte** de cierre.

Esta señal es **única** porque:
1. Es **multifuente** (CDTI + IDAE + ICEX + BOE).
2. Tiene **rastro público** (BDNS — Base de Datos Nacional de Subvenciones).
3. Es **rastreable** (la ayuda va atada a un proyecto, un CIF y un importe).
4. Es **temporalmente incidente** (3 años de ventana post-concesión para cierre de planta).

**Insight crítico**: la **BDNS (Base de Datos Nacional de Subvenciones)** [https://www.infosubvenciones.es/bdnstrans/GE/es/index] centraliza todas las ayudas públicas concedidas por cualquier organismo español desde 2016. Es consultable y exportable. Es la **fuente primaria** para este sprint, no las webs individuales de CDTI/IDAE/ICEX.

## Scope

### SÍ
- Filtro sobre **Source.contentText** o scraping de **BDNS** que extrae concesiones a empresas A&B con `cnae IN (10, 11, 35, 21, 19, 20, 22, 24, 29, 30)` y `assetSize >= 10M€`.
- Detector **"ayuda pública a planta en riesgo"**: si la empresa A&B ha recibido una ayuda CDTI/IDAE/ICEX en los últimos 36 meses y **NO** aparece en los scrapers activos (newsroom, prensa, BORME, sectorial) con **actividad positiva** en los últimos 90d → `deimplantationSignal=true` con `outOfScopeReason='ayuda_sin_actividad'`.
- Detector **"ayuda reciente a empresa en concurso"**: si la empresa A&B tiene un **Source de B.1 / BORME** con `outOfScopeReason='concurso'` o similar **posterior** a la fecha de la ayuda → `deimplantationSignal=true` con `outOfScopeReason='ayuda_previa_a_concurso'`.
- Persistencia: nuevo `Source` row con `outletType='ayuda_publica'`, `deimplantationSignal=true`, `signalStrength='medium'` (en este sprint) — no `'strong'` porque es señal indirecta.
- Runner con cadencia 14d (cambios en BDNS son lentos).
- 1ª corrida: **NO scrape en vivo** (BDNS requiere autenticación o API key, y la implementación con Playwright contra BDNS es costosa). En su lugar, **cargar dataset estático** `lib/data/ayudas-list.json` con las 5-10 ayudas más relevantes concedidas 2024-2026 a empresas A&B del seed, y verificar el cruce con los datos scrapeados.
- Smoke automatizado (13 asserts).

### NO
- B.7, B.8, B.n
- Tocar `lib/agents/borme-runner.ts` ni los otros agentes
- Web scraping agresivo de CDTI/IDAE/ICEX (en este sprint, no; es un follow-up de pulido)
- APIs autenticadas (BDNS API requiere IP whitelist del MINHAFP — fuera de scope)
- UI
- `/opt/hermes-v2/`
- Empresas que NO estén en `Company` con `assetSize` o `cnae` sectorial

## Archivos

### Crear
- `lib/data/ayudas-list.json` (50-80 líneas): 6-10 ayudas CDTI/IDAE/ICEX concedidas 2024-2026 a empresas A&B del sector alimentario / energía / farmaceútico / metales / química. Cada una con `id, convocatoria, organo, beneficiario, cif, importe, fechaConcesion, proyecto, plantaCcaa, sourceUrl`.
- `lib/scrapers/ayudas-publicas.ts` (130-180 líneas): estructura del scraper con `RawAyudaPublica` interface + `scrapeAllAyudatories()` (load del JSON estático) + `fetchLiveBDNS()` (placeholder documentado para sprint de pulido posterior).
- `lib/filters/ayudas.ts` (100-140 líneas): `applyAyudasFilter(ayuda, prisma): Promise<{inScope, signalStrength, outOfScopeReason, matchedSources}>`. Cruce: ¿la empresa A&B tiene actividad reciente en DB? Si NO → `inScope=true, outOfScopeReason='ayuda_sin_actividad'`. Si tiene concurso posterior → `inScope=true, outOfScopeReason='ayuda_previa_a_concurso'`.
- `lib/agents/ayudas-runner.ts` (110-150 líneas): runner con `ScanConfig { agentName: 'surus-agente-ayudas' }`, cadencia 14d, idempotencia vía `matchHash = b6-{cif}-{convocatoriaId}-{proyectoSlug}`.
- `scripts/smoke-qw-b6.ts` (150-200 líneas, 13 asserts)
- `memory/sprints/sprint-B/B.6-ayudas-publicas-cdti-idae-icex-report.md`

### Modificar (delta mínimo)
- `lib/scrapers/types.ts`: añadir `'ayuda_publica'` a `OutletType` union.
- `package.json`: añadir `scan:ayudas` + `smoke:qw-b6`
- `deploy/run-agents.sh`: añadir paso B.6 (ayudas) tras B.5
- `memory/state/active-state.md`: actualizar

### NO TOCAR
- B.1..B.5 código
- UI
- `/opt/hermes-v2/`
- `hermes-gateway.service`

## Detector — Algoritmo

```
ayudas-runner.ts (runAyudasAgent):
  1. Carga ScanConfig { agentName: 'surus-agente-ayudas' }, upsert cadenceDays=14
  2. Lee ayudas-list.json (6-10 ayudas hardcoded de CDTI/IDAE/ICEX 2024-2026)
  3. Para cada ayuda:
     a. Busca Company por cif (case-insensitive, sin guiones)
     b. Si empresa NO existe en Company → outOfScopeReason='unknown_company', skip
     c. Si empresa NO es A&B (assetSize <10M€ o cnae no sectorial) → skip
     d. Query Source WHERE companyId = X AND scrapedAt >= now() - 90d
        AND deimplantationSignal != true
     e. Query Source WHERE companyId = X AND contentText ~ 'concurso|ERE|cierre|desimplantaci'
        AND publishedAt > ayuda.fechaConcesion
     f. Si e) matchea → matchHash, inScope=true, outOfScopeReason='ayuda_previa_a_concurso',
        signalStrength='medium'
     g. Si d) vacío Y actividad <90d → matchHash, inScope=true,
        outOfScopeReason='ayuda_sin_actividad', signalStrength='medium'
     h. Si d) tiene actividad normal → outOfScopeReason='ayuda_con_actividad_normal', inScope=false
  4. Persiste Source rows con title="[B.6] Ayuda pública a {CompanyName} — {organo}
     ({importe}€) — {outOfScopeReason}", outletType='ayuda_publica',
     deimplantationSignal=filter.inScope
  5. Log SearchRun
```

## Success criteria (PASS = 13/13 asserts verdes)

### QW regresión (5 asserts)
- QW-1 [ ] 6 sectores amplios visibles en /empresas
- QW-2 [ ] ≥1 empresa por sector en DB
- QW-3 [ ] Navbar contiene "Juan Carlos Alvarado para Surus"
- QW-4 [ ] Footer contiene "Juan Carlos Alvarado para Surus"
- QW-5 [ ] Header del dashboard contiene "Juan Carlos Alvarado para Surus"

### B.6 (6 asserts)
- B.6-A [ ] `ayudas-list.json` tiene 6-10 entradas CDTI/IDAE/ICEX 2024-2026 con campos requeridos
- B.6-B [ ] `applyAyudasFilter`: empresa del seed con ayuda + sin actividad 90d → `inScope=true, reason='ayuda_sin_actividad'`
- B.6-C [ ] `applyAyudasFilter`: empresa del seed con ayuda + concurso posterior → `inScope=true, reason='ayuda_previa_a_concurso'`
- B.6-D [ ] `applyAyudasFilter`: empresa del seed con ayuda + actividad normal 90d → `inScope=false, reason='ayuda_con_actividad_normal'`
- B.6-E [ ] `applyAyudasFilter`: empresa inexistente / CIF desconocido → `inScope=false, reason='unknown_company'`
- B.6-F [ ] `Source.outletType='ayuda_publica'` persiste en DB + `ScanConfig` con `cadenceDays=14 active=true` registrado + `SearchRun` con `agentName='surus-agente-ayudas'` registrado tras corrida

### Estado (2 asserts)
- EST-1 [ ] `memory/state/active-state.md` actualizado a "Sprint B.6 Ayudas: completed (VPS)"
- EST-2 [ ] `B.6-ayudas-publicas-cdti-idae-icex-report.md` escrito con métricas reales

## Reglas de matching (anti-falso-positivo)

| Regla | Cómo se enforce |
|---|---|
| Empresa debe existir en Company | `prisma.company.findUnique({where: {cif: cleanedCif}})` |
| Empresa debe ser A&B | `cnae IN (...)` o `assetSize >= 10M€` |
| Detectar concurso posterior | regex `/\b(concurso|ERE|cierre|desimplantaci[oó]n|despidos? masiv[os])\b/i` |
| Detectar actividad normal | `Source.count({where: {companyId, deimplantationSignal: false, scrapedAt: {gte: 90d ago}}}) >= 1` |
| Idempotencia | `matchHash = b6-{cif}-{convocatoriaId}-{proyectoSlug}` vía upsert con hash determinista |
| Ventana 36 meses | `fechaConcesion >= now() - 36 months` |

## Seguridad

- Sin nuevos endpoints (es agente batch)
- Sin secretos (dataset estático + DB local)
- SQL parametrizado (Prisma)
- Validación: regex robusto contra CIF/importes/fechas
- Sin scraping agresivo a portales públicos (en este sprint)

## Riesgos / decisiones pendientes

| Decisión | Por qué | Default |
|---|---|---|
| ¿Scrape en vivo de BDNS en este sprint? | BDNS requiere autenticación o scraping con Playwright (riesgo de baneo) | NO en este sprint; dataset estático + placeholder para sprint de pulido |
| ¿Cadencia 14d o 30d? | BDNS se actualiza mensualmente | 14d (cubre cualquier actualización) |
| ¿Incluir BOE scraping de las ayudas? | BOE publica los reales decretos de concesión | NO en este sprint; el JSON estático ya tiene `sourceUrl` apuntando al BOE |
| ¿Cross-check con SABI / Informa? | Daría el dato de cuenta de resultados de la empresa | NO en este sprint; covered por Sprint C (enriquecimiento 360º) |

## Definition of Done

- `pnpm tsc --noEmit` exit 0
- `pnpm tsx scripts/smoke-qw-b6.ts` 13/13 PASS en VPS
- 1ª corrida: 0 errores, duración <60s
- `B.6-ayudas-publicas-cdti-idae-icex-report.md` con timestamp 1ª corrida, items detectados,
  in-scope, out-of-scope, ms totales
- Estado preservado
- Commit pusheado

## Cron

`surus-agente-ayudas.service` — `OnCalendar=biweekly` (lunes y jueves 04:30 UTC). Coexiste con los otros 8 agentes; ejecución total <35 min/día.

## Siguiente paso (orden MEGAPLAN)

Tras B.6 → **B.7 (despidos CTO/Director Técnico LinkedIn)** → B.8 (plantas stale 3 escaneos).
