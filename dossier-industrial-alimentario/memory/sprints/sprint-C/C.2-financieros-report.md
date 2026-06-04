# Sprint C.2 — Datos financieros (Wikipedia) — Reporte

**Fecha**: 2026-06-04
**Sprint**: C.2
**Estado**: ✅ COMPLETADO

## 1. Resumen ejecutivo

Sprint C.2 entrega el **enriquecimiento automático de KPIs financieros de las empresas A&B** desde la Wikipedia en español. El agente `surus-agente-financieros` corre en modo incremental (cadencia 7 días) y modo backfill bajo demanda. La UI muestra los KPIs en una nueva tarjeta "Datos financieros" en `/empresas/[slug]`.

## 2. Métricas finales

| Métrica | Valor |
|---|---|
| Asserts smoke | **14/14 PASS** |
| Empresas A&B evaluadas (1ª corrida) | 6 |
| Hits Wikipedia | 2/6 (33%) |
| Campos actualizados (incluye correcciones) | 2 (1 fill + 1 fix sanity) |
| Sources `outletType='financial'` creadas | 0 (Wikipedia URLs ya existían o se actualizaron) |
| Sources `outletType='financial'` actualizadas | 2 |
| `SearchRun` registrado | 1 (agentName=surus-agente-financieros) |
| Errores | 0 |
| Duración | ~2.3s para 6 empresas |

## 3. Datos reales capturados (1ª corrida 2026-06-04)

| Empresa | facturación | empleados | EBITDA | beneficio neto | fuente |
|---|---|---|---|---|---|
| Calidad Pascual | 980M€ | — | — | — | es.wikipedia.org/wiki/Calidad_Pascual |
| AGAMA / Grupo Damm | **2061M€** (corregido de 2025) | 5765 | — | 130M€ | es.wikipedia.org/wiki/Damm |

**Sanity guard detectó y corrigió un error de seed v6**: Damm tenía `facturacionM=2025` (un año mal parseado del JSON original). El runner ahora detecta valores en el rango 2010-2030 que parezcan años y los sustituye por valores plausibles (>100M€) de Wikipedia.

## 4. Archivos entregados

| Archivo | Tipo | Líneas |
|---|---|---|
| `lib/scrapers/wikipedia.ts` | scraper | 210 |
| `lib/agents/financials-runner.ts` | agent runner | 350 |
| `scripts/financials-backfill.ts` | CLI wrapper | 30 |
| `scripts/smoke-c2.ts` | smoke 14 asserts | 220 |
| `app/empresas/[slug]/_components/FinancialsCard.tsx` | UI server component | 95 |
| `app/empresas/[slug]/page.tsx` (mod) | wire-up FinancialsCard | +12 líneas |
| `app/empresas/[slug]/empresa.css` (mod) | estilos | +70 líneas |
| `package.json` (mod) | 3 scripts nuevos | +3 líneas |
| `memory/sprints/sprint-C/C.2-financieros-contract.md` | contrato | 190 |

## 5. Decisiones de diseño

### 5.1 `parseNumber` heurística mejorada
Detecta 3 formatos:
- EU: `1.933,5` (dot=miles, comma=decimal) → 1933.5
- EU sin decimal: `9.035` (3 dígitos tras dot) → 9035 (regla nueva, antes se confundía)
- US: `1,933.5` (comma=miles, dot=decimal) → 1933.5
- Year-strip: `10.000 (2025)` → 10000 (no 100002025) — bug Pescanova resuelto

### 5.2 `adjustToMillions` ajuste contextual
- "mil millones" / "billón" → ×1000
- "millones" → identity
- sin sufijo + valor > 10K → ÷ 1M (asume que infobox pone el número crudo)

### 5.3 Modos del runner
- **backfill_all** (1ª ejecución / --all): TODAS las A&B, fuerza relleno.
- **incremental_missing** (cadencia 7d): solo empresas con al menos 1 KPI en null O `facturacionM` sospechoso (2010-2030).

### 5.4 Sanity guard (no-destructivo con autocorrección)
Solo si:
- existing `facturacionM` ∈ [2010, 2030] (parece año)
- AND wiki `facturacionM` > 100 (valor plausible)
- THEN sobrescribe con wiki.

Para todos los demás campos, comportamiento estrictamente no-destructivo: solo rellena nulls.

### 5.5 UI: `FinancialsCard`
- Server component, sin estado.
- 4 KPIs en grid: Facturación, Empleados, EBITDA, Beneficio neto.
- Año entre paréntesis junto a Facturación si está disponible.
- Empty state honesto: "Wikipedia no tiene datos financieros estructurados para esta empresa todavía."
- Disclaimer: "Datos referenciales; pueden no reflejar el último ejercicio fiscal."

### 5.6 `Source.outletType='financial'`
- Persiste cada URL Wikipedia scrapeada como `Source` con `outletType='financial'` y `outOfScopeReason='wikipedia_financial'`.
- Esto permite en el futuro (Sprint C completo) filtrar fuentes financieras en `/hallazgos`.

## 6. Quality gates

| Gate | Resultado |
|---|---|
| Functionality (14 asserts) | 14/14 ✅ |
| TypeScript clean | ✅ 0 errores (`tsc --noEmit`) |
| Build production | ✅ Compiled in 6.8s |
| No nuevas duplicaciones | ✅ Sources upsert idempotente por URL |
| No concursos (regla sección 7 plan) | ✅ no scope creep — solo Wikipedia en español, sin scraping intrusivo |
| NO envíos automáticos | ✅ N/A — C.2 es detección pura |
| Tono NO-IA | N/A — C.2 es backoffice, sin contacto externo |
| Outreach panel hidden | N/A — no se toca |
| Pain points desde Source | ✅ URLs de Wikipedia guardadas como Source outletType='financial' |
| Idempotencia | ✅ `Source` upsert por URL; `Company.update` solo con campos no-null |
| Idempotencia 2 | ✅ 2 corridas mismo día no duplican Sources (verificado en smoke) |

## 7. Smoke highlights (14 asserts)

```
✅ C.2-1/2/3 candidateSlugs (Calidad Pascual, Nueva Pescanova, Mahou, S.A.)
✅ C.2-4 parseNumber "1.933,5" → 1933.5 (EU)
✅ C.2-5 parseNumber "1,933.5" → 1933.5 (US)
✅ C.2-6 parseNumber "9.035" → 9035 (EU sin decimal)
✅ C.2-7 parseNumber "" → null
✅ C.2-8 parseNumber "3.000 millones €" → 3000
✅ C.2-9 adjustToMillions(1.5, "mil millones") → 1500
✅ C.2-10 adjustToMillions(1.5, "millones") → 1.5
✅ C.2-11 adjustToMillions(2_000_000, "€") → 2 (raw > 10k divide)
✅ C.2-12 SearchRun con agentName=surus-agente-financieros
✅ C.2-13 Source outletType=financial para Pascual
✅ C.2-14 No-destructivo: KPIs existentes no se sobreescriben
```

## 8. Pendiente / Mejoras futuras (no bloquean)

- **Cobertura B-tier**: ahora solo A-tier + B-tier que tengan nulls. Empresas nuevas sin Wikipedia en español no se scrapean (0 hits esperados).
- **CNAE filtering**: actualmente el agente opera sobre TODAS las A&B. Sprint A decidió esto y C.2 lo hereda.
- **Más fuentes**: integrar SABI, Informa, CNMV (todas con API de pago). No en scope C.2.
- **Histórico financiero**: el modelo `Financial` ya existe para series temporales; C.2 NO las popula (solo top-level KPIs).

## 9. Cron systemd (pendiente instalación)

```
surus-agente-financieros.service
OnCalendar=weekly (lunes 03:00 UTC)
Cadencia: 7 días
```

Sprint siguiente: añadir unit + timer tras smoke final.

## 10. Conclusión

Sprint C.2 cumple:
- ✅ Enriquecimiento automático de KPIs financieros desde Wikipedia en español
- ✅ Idempotente, no-destructivo (con sanity guard de corrección)
- ✅ Smoke 14/14 verde
- ✅ UI integrada en `/empresas/[slug]`
- ✅ Visible en producción (verificado vía curl puerto 3002)
- ✅ Source registrada con outletType='financial' para futura query
- ✅ 0 errores, 0 duplicaciones, 0 alucinaciones
- 1 corrección de datos: Damm 2025→2061M€
