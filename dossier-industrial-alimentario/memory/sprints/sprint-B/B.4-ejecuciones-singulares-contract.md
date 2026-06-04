# Sprint Contract: B.4 — Ejecuciones singulares (no concursos) — tensión financiera pre-concursal

**Sprint**: B.4
**Agente**: generator (Sonnet)
**Evaluador**: evaluator (Opus, adversarial)
**Orquestador**: HJC
**Fecha**: 2026-06-04
**Stack**: Next.js 15.5.4 · Prisma 5 · PostgreSQL 16 · VPS 88.198.93.52
**Estado**: Pendiente

## Contexto

BORME (B.1) + BOE/BOP/sindicatos + Prensa ya scrapean miles de actos. Muchos contienen:
- **Ejecuciones hipotecarias singulares** (`Ejec. Hipot.` en BORME)
- **Embargos** (`Embargo`, `Anotación preventiva de embargo`)
- **Demandas civiles/mercantiles** (`Demanda de juicio verbal`, `Demanda de reclamación de cantidad`)
- **Anuncios de subasta notarial / judicial** sin declaración concursal
- **Cancelaciones de cuentas / disoluciones operativas sin concurso** (cuando se cierra línea de negocio)

Cuando una empresa A&B acumula **≥1 ejecución singular + ≥1 embargo** en 90d, es **señal amarilla fuerte** de tensión financiera **sin necesidad de declaración concursal formal**. El operador Surus lo prefiere a un concurso declarado: la empresa está saneando pero no ha cruzado el Rubicón concursal, hay margen para desimplantación ordenada.

El usuario aprobó el sprint B (señales débiles) el 2026-06-03. B.1, B.2, B.3, B.9 ya completados. B.4 cubre el patrón de ejecuciones civiles / hipotecarias.

## Scope

### SÍ
- Filtro sobre `Source.contentText` que extrae: ejecuciones hipotecarias, embargos, demandas civiles/mercantiles, subastas judiciales, anotaciones preventivas
- Detector "tensión financiera": ≥1 ejecución hipotecaria + ≥1 embargo en 90d por `companyId` (O BIEN ≥2 embargos en 90d)
- Filtro duro anti-concursos: si el mismo BORME/BOE contiene "concurso", "concurso de acreedores", "liquidación concursal", "quita y espera", "suspensión de pagos" → `outOfScopeReason='concurso'`
- Filtro adicional: solo empresas A&B (`assetSize >= 10M€` o `cnae IN (10, 11, 35, 21, 19, 20, 22, 24, 29, 30)`)
- Persistencia: nuevo `Source` row con `outletType='bofficial_borme'` o `bofficial` (según origen), `deimplantationSignal=true`, `contentText` con resumen de los actos detectados
- Runner diario, cadencia 1d (los BORME son diarios y la ventana de pre-concurso es estrecha)
- 1ª corrida: analizar los 1715+ actos BORME pre-existentes + BOE/BOP scrapeados
- Smoke automatizado (13 asserts)

### NO
- B.5..B.n
- Tocar `lib/agents/borme-runner.ts` ni `lib/agents/boe-bop-runner.ts` (reutiliza datos ya scrapeados)
- Concursos de acreedores (outOfScopeReason='concurso' explícito)
- M&A, subastas industriales, email/LinkedIn automático
- `/opt/hermes-v2/` o `hermes-gateway.service`
- UI
- Empresas que NO tengan `companyId` (no se puede agrupar)

## Archivos

### Crear
- `lib/filters/ejecuciones-singulares.ts` (100-140 líneas): `extractEjecuciones(text): EjecMatch[]`,
  `extractEmbargos(text): EmbMatch[]`, `containsConcursoKeyword(text): boolean`,
  `detectTensionFinanciera(companyId, daysBack=90): Promise<TensionMatch | null>`
- `lib/agents/ejecuciones-runner.ts` (110-150 líneas): runner que para cada
  A&B con `companyId` filtra sus Source rows BORME+BOE, agrupa, y persiste Source nuevos
  cuando hay ejecución + embargo en 90d
- `scripts/smoke-qw-b4.ts` (150-200 líneas, 13 asserts)
- `memory/sprints/sprint-B/B.4-ejecuciones-singulares-report.md`

### Modificar (delta mínimo)
- `package.json`: añadir `scan:ejecuciones` + `smoke:qw-b4`
- `deploy/run-agents.sh`: añadir paso B.4 (ejecuciones) tras renuncias
- `memory/state/active-state.md`: actualizar
- `lib/filters/deimplantation.ts`: añadir al enum/conjunto la keyword `ejecucion_hipotecaria` (opcional, ver "decisión pendiente")

### NO TOCAR
- B.1, B.2, B.3, B.9 código
- UI
- `/opt/hermes-v2/`
- `hermes-gateway.service`

## Detector — Algoritmo

```
ejecuciones-runner.ts (runEjecucionesAgent):
  1. Carga ScanConfig { agentName: 'surus-agente-ejecuciones' }, upsert cadenceDays=1
  2. Carga todas las A&B con companyId en Company (top 167)
  3. Para cada empresa:
     a. Query Source WHERE companyId = X AND outletType IN ('bofficial_borme','bofficial')
        AND publishedAt >= now() - 90d
     b. Para cada Source:
        - Si containsConcursoKeyword(contentText) → outOfScopeReason='concurso', skip
        - Extrae bloque con keywords:
          · Ejec. Hipot. / Ejecución Hipotecaria / Ejec. num. XXX/YYYY
          · Embargo / Anotación preventiva de embargo
          · Demanda / Reclamación de cantidad
          · Subasta judicial / Subasta notarial
        - Cuenta ejecuciones y embargos únicos
     c. Match si: (ejecuciones >= 1 AND embargos >= 1) OR (embargos >= 2)
  4. Persiste Source rows con title="[B.4] Tensión financiera pre-concursal — {CompanyName}
     ({n} ejecuciones + {m} embargos en 90d)", outletType='bofficial_borme' o 'bofficial',
     deimplantationSignal=true, contentText con actos detectados
  5. Log SearchRun
  6. (futuro) notifyMedium si Telegram quotas disponibles
```

## Success criteria (PASS = 13/13 asserts verdes)

### QW regresión (5 asserts)
- QW-1 [ ] 6 sectores amplios visibles en /empresas
- QW-2 [ ] ≥1 empresa por sector en DB
- QW-3 [ ] Navbar contiene "Juan Carlos Alvarado para Surus"
- QW-4 [ ] Footer contiene "Juan Carlos Alvarado para Surus"
- QW-5 [ ] Header del dashboard contiene "Juan Carlos Alvarado para Surus"

### B.4 (6 asserts)
- B.4-A [ ] Filtro ejecuciones: extrae ≥1 ejecución hipotecaria de texto real del DB en ≤100ms
- B.4-B [ ] Filtro embargos: extrae ≥1 embargo de texto real del DB en ≤100ms
- B.4-C [ ] Filtro anti-concursos: BORME con "concurso de acreedores" → outOfScopeReason='concurso', no cuenta
- B.4-D [ ] Detector tensión: 1 ejecución + 1 embargo en 90d → match; 0 ejecuciones → null
- B.4-E [ ] Idempotente: 2 corridas mismo día no duplican Source rows
- B.4-F [ ] Cron/cadencia 1d registrada en ScanConfig

### Estado (2 asserts)
- EST-1 [ ] `memory/state/active-state.md` actualizado a "Sprint B.4 Ejecuciones: completed"
- EST-2 [ ] `B.4-ejecuciones-singulares-report.md` escrito con métricas reales

## Reglas de matching (anti-falso-positivo)

| Regla | Cómo se enforce |
|---|---|
| Detecta ejecución hipotecaria | Regex `/\bEjec(?:ució|uc\.)?\.\s*Hipot(?:ecaria)?\.?\b\|Ejecución\s+Hipotecaria\b/i` |
| Detecta embargo | Regex `/\bEmbargo\b\|Anotaci[oó]n\s+preventiva\s+de\s+embargo\b/i` |
| Detecta subasta judicial | Regex `/\bSubasta\s+(?:judicial|notarial)\b/i` |
| Filtro duro anti-concurso | `containsConcursoKeyword()` ignora si detecta concurso, quita, suspensión, liquidación concursal |
| Ventana 90d | `publishedAt >= now() - 90d` |
| Empresa A&B | Filtro sobre `Company` table |
| Idempotencia | `UNIQUE(companyId, contentHash)` vía upsert con hash determinista |
| Match logic | `(ejecuciones >= 1 AND embargos >= 1) OR (embargos >= 2)` |

## Seguridad

- Sin nuevos endpoints (es agente batch)
- Sin secretos (usa DB local)
- SQL parametrizado (Prisma)
- Validación de entrada: regex robusto contra NIF/CIF/importes/direcciones

## Risks / decisiones pendientes

| Decisión | Por qué | Default |
|---|---|---|
| ¿Añadir `ejecucion_hipotecaria` al enum `outOfScopeReason` de `Source`? | Para tracking granular | NO — `deimplantationSignal=true` + `outOfScopeReason=null` es suficiente (es in-scope). Solo necesitamos el enum si el operador quiere filtrar por keyword en UI. |
| ¿Solo BORME o también BOE/BOP? | BOE/BOP scrapea más amplio (subastas judiciales, demandas civiles reales) | AMBOS: `outletType IN ('bofficial_borme','bofficial')` |
| ¿Threshold ejecución + embargo o solo embargos? | 1 embargo puede ser aislado | (1 ejec + 1 embargo) OR (≥2 embargos) — más robusto |

## Definition of Done

- `pnpm tsc --noEmit` exit 0
- `pnpm tsx scripts/smoke-qw-b4.ts` 13/13 PASS en VPS
- 1ª corrida: 0 errores, duración <60s
- `B.4-ejecuciones-singulares-report.md` con timestamp 1ª corrida, items detectados,
  in-scope, out-of-scope, ms totales
- Estado preservado
- Commit pusheado
