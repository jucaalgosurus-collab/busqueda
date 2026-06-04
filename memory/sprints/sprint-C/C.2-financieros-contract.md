# Sprint Contract: C.2 — Datos financieros (Wikipedia scraper)

**Estado**: ✅ COMPLETADO VPS
**Fecha**: 2026-06-04
**Agent**: generator + code-reviewer + evaluator
**Effort**: S (1 día)
**Report**: `memory/sprints/sprint-C/C.2-financieros-report.md`

## 1. Objetivo

Enriquecer `Company.facturacionM`, `facturacionYear`, `ebitdaM`, `beneficioNetoM` y `empleadosTotal` con datos extraídos de la Wikipedia en español. Es la primera fase del enriquecimiento financiero (sin coste de API: Wikipedia es gratis). Futuras fases: CNMV para cotizadas, BORME cuentas anuales para el resto, SABI/Informa si hay API.

## 2. Schema v6

- `Company` ya tiene los 6 campos KPI: `facturacionM Float?`, `facturacionYear Int?`, `ebitdaM Float?`, `beneficioNetoM Float?`, `deudaNetaM Float?`, `empleadosTotal Int?` (schema v6 desde S6).
- `Source.outletType` es `String` union — se añade el valor `'financial'` SIN migración. Otros outletTypes existentes: `'corporate_newsroom' | 'nacional' | 'regional' | 'local' | 'sector' | 'bofficial' | 'syndicate' | 'linkedin' | 'ayuda_publica' | 'regulatorio' | 'borme' | 'auction' | 'despido_cto' | 'financial'`.

## 3. Scraper `lib/scrapers/wikipedia.ts` (~200 líneas)

- `scrapeWikipediaFinancials(companyName: string): Promise<WikiScrapeResult>` — 1 Company por llamada.
- Pipeline:
  1. `candidateSlugs(name)` — quita `(...)`, sufijos SA/SL, genera combinaciones decrecientes (`Calidad_Pascual`, `Grupo_Pascual`, `Pascual`).
  2. Para cada slug, hace `GET https://es.wikipedia.org/wiki/{slug}` con `User-Agent: HERMES-Dossier/1.0` y `Accept-Language: es-ES,es;q=0.9`. Valida status 200 y `data.length > 500` (evita páginas vacías o de redirección).
  3. Si OK, llama a `parseInfobox(html, url)`.
- `parseInfobox(html, url)`:
  - Carga cheerio, busca `table.infobox, table.wikitable` (Wikipedia empresa).
  - Itera `<tr>` extrayendo `<th>` (label) + `<td>` (value) → `rawFields: Record<string, string>`.
  - Mapea campos:
    - `facturacionM`: regex `/facturaci[óo]n|ingresos|ventas|revenue/i` → `parseNumber(v)` + `adjustToMillions(n, v)`.
    - `facturacionYear`: extrae primer `\b(20[12]\d)\b` del texto de facturación.
    - `empleadosTotal`: regex `/empleados|trabajadores|workers|empleo/i`.
    - `ebitdaM`: regex `/^ebitda$/i`.
    - `beneficioNetoM`: regex `/beneficio\s*neto|net\s*income|utilidad/i`.
- `parseNumber(raw)`:
  - Quita todo lo que no sea dígito, punto, coma.
  - Detecta formato EU (1.933,5) vs US (1,933.5) vs sin separador.
- `adjustToMillions(value, contextRaw)`:
  - "mil millones" / "billón" → ×1000.
  - "millones" → keep.
  - Sin sufijo y valor >10000 → divide por 1M (asume raw euros).
- Retorna `WikiFinancial { facturacionM, facturacionYear, empleados, ebitdaM, beneficioNetoM, fuente, rawFields }` o `null` si infobox sin datos financieros útiles.

## 4. Agente `lib/agents/financials-runner.ts` (~210 líneas)

- `runFinancialsAgent({ dryRun }): Promise<FinancialsAgentResult>`.
- `FINANCIALS_AGENT_NAME = 'surus-agente-financieros'`, `FINANCIALS_CADENCE_DAYS = 7`.
- `ensureScanConfig` upsert en `ScanConfig` (1ª ejecución: `lastRunAt=null`).
- `isFirstRun()` decide modo:
  - `backfill_all`: TODAS las Companies A&B (8).
  - `incremental_missing`: solo Companies con AL MENOS 1 KPI en null (`facturacionM OR ebitdaM OR empleadosTotal OR beneficioNetoM`).
- Pipeline:
  1. Carga companies (mode-dependent).
  2. Para cada company: `scrapeWikipediaFinancials(company.name)`.
  3. Si `found: true`:
     - `buildUpdateData(current, wiki)` — NO destructivo: solo rellena campos null. Devuelve `data + updatedFields[]`.
     - `prisma.company.update({ data })` (solo si hay campos a rellenar).
     - `persistWikipediaSource(wiki, company)` — upsert Source con `url = wiki.fuente` (Wikipedia URL única). `outletType='financial'`. `outOfScopeReason='wikipedia_financial'`. `deimplantationSignal=false`. Auditoría completa.
  4. `SearchRun { agentName, mode, itemsFound, itemsNew, itemsInScope, itemsOutOfScope, errorsCount }`.
  5. `ScanConfig.lastRunAt = now`.
- CLI: `node --experimental-strip-types lib/agents/financials-runner.ts [--dry-run]`.

## 5. Backfill `scripts/financials-backfill.ts`

- Wrapper CLI sobre `runFinancialsAgent({ dryRun })`.
- Logs con formato `[financials-backfill] start / eval=N / found=N / fieldsUpdated=N / sourcesCreated=N / durationMs=N`.

## 6. UI `app/empresas/[slug]/_components/FinancialsCard.tsx`

- Server component que renderiza grid 4-col con los KPIs: facturación (M€ + año), empleados, EBITDA, beneficio neto.
- Si TODOS los KPIs están null: muestra mensaje "Wikipedia sin datos, ejecutar backfill".
- Si AL MENOS 1 KPI existe: muestra los que hay + link a la fuente Wikipedia (icono external-link).
- Estilo consistente con el resto de cards editoriales.

## 7. Smoke `scripts/smoke-c2.ts` (10 asserts)

- **C.2-1/2/3**: `candidateSlugs("Calidad Pascual (Grupo Pascual)")` devuelve `["Calidad_Pascual", "Grupo_Pascual", "Pascual"]` (orden decreciente).
- **C.2-4**: `candidateSlugs("Nueva Pescanova")` devuelve `["Nueva_Pescanova", "Pescanova"]`.
- **C.2-5**: `candidateSlugs("Mahou, S.A.")` devuelve `["Mahou"]` (sin ", S.A.").
- **C.2-6**: `parseNumber("1.933,5") === 1933.5` (EU).
- **C.2-7**: `parseNumber("1,933.5") === 1933.5` (US).
- **C.2-8**: `parseNumber("9.035") === 9035` (sin separador decimal).
- **C.2-9**: `adjustToMillions(1.5, "mil millones €") === 1500`.
- **C.2-10**: `adjustToMillions(1.5, "millones €") === 1.5`.
- **C.2-11 (DB integration)**: `runFinancialsAgent` deja `facturacionM` no-null en ≥1 Company A&B.
- **C.2-12 (DB integration)**: `Source` con `outletType='financial'` para la misma Company.
- **C.2-13 (no-regresión)**: `buildUpdateData` es no-destructivo (current.facturacionM=100 → no se sobreescribe con wiki.facturacionM=200).

## 8. Package.json scripts

- `"scan:financials": "tsx lib/agents/financials-runner.ts"`
- `"financials:backfill": "tsx scripts/financials-backfill.ts"`
- `"smoke:c2": "tsx scripts/smoke-c2.ts"`

## 9. Cron systemd

- `hermes-scan-financieros.{service,timer}` cadencia 7d.
- `OnCalendar=weekly` (Mon 05:00 UTC, paso 6h en `run-agents.sh`).

## 10. Success criteria (12/12 ✅)

- [x] **C.2-1**: `scrapeWikipediaFinancials` retorna `{ found: true }` para al menos 1 de las 8 A&B (Pascual, Pescanova, Mahou, Damm, Danone, Nestlé, Azucarera, Bimbo).
- [x] **C.2-2**: `Company.facturacionM` no-null en ≥1 A&B.
- [x] **C.2-3**: `Company.empleadosTotal` no-null en ≥1 A&B.
- [x] **C.2-4**: `Source.outletType='financial'` rows para cada hit.
- [x] **C.2-5**: NO destructivo — Companies con valores existentes NO se sobreescriben.
- [x] **C.2-6**: `smoke:c2` ≥10/10 PASS.
- [x] **C.2-7**: `SearchRun` con `agentName='surus-agente-financieros'` registrado.
- [x] **C.2-8**: `FinancialsCard` renderiza en `/empresas/[slug]` con KPIs visibles.
- [x] **C.2-9**: 1ª corrida real con ≥1 hit real verificado en DB.
- [x] **C.2-10**: 0 errores, 0 falsos positivos.
- [x] **C.2-11**: cron semanal activo en VPS.
- [x] **C.2-12**: datos persisten en `Company` + Source tras `pnpm build + systemctl restart`.

## 11. Coste

- 0€ API (Wikipedia, sin auth, sin rate limit).
- ~1-2s por Company (1-3 requests HTTP).
- ~8-15s compute para 8 A&B.
- 0 columnas nuevas (todos los campos ya existen en v6).

## 12. Próximos pasos

- **C.2.b — CNMV cotizadas**: para Empresas en IBEX/continuo, llamar a CNMV API pública (sin auth) para datos auditados.
- **C.2.c — BORME cuentas anuales**: para el resto, scraping de `BOE.es/datosabiertos` busca eventos tipo `cuentas` y extrae cifra de facturación del rawText.
- **C.2.d — Deuda neta**: source adicional (BME Growth, InfoEmpresas) si queremos llegar al 6º KPI.
