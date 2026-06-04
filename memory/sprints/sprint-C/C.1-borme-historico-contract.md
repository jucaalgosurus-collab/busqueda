# Sprint Contract: C.1 — BORME Histórico (backfill 365d para enriquecer Company)

- **Agente**: generator
- **Effort**: M (2-3 días)
- **Dependencias**: B.1 BORME scraper (existe, 356 líneas)
- **Objetivo**: poblar `Company.cif`, `Company.cnae`, `Company.domicilio_social`, `Company.capital_social`, `Company.ultimaCuentaDepositada` con datos reales del BORME de los últimos 365 días para las 7 seed + futuras A&B.

---

## Hipótesis

> Si scrapeamos el BORME de los últimos 365 días y matcheamos por nombre normalizado de empresa, podemos extraer CIF, CNAE, capital social, fecha última cuenta depositada, cambios de domicilio, y composición del consejo. Esta información es **oficial** (BOE) y desbloquea: filtros A&B reales (cif), búsqueda por CNAE subsector, join con OEPM/Registro Mercantil, y el panel `/empresas/[slug]` con ficha 360º.

---

## Deliverables (9/9)

| # | Archivo | Estado |
|---|---------|--------|
| 1 | `memory/sprints/sprint-C/C.1-borme-historico-contract.md` | ✅ contrato |
| 2 | `prisma/schema.prisma` (modelo `BormeEvent`) | ⏳ |
| 3 | `deploy/c1-borme-historico-migration.sql` | ⏳ |
| 4 | `lib/borme/parser.ts` (parsea XML BORME → eventos normalizados) | ⏳ |
| 5 | `lib/borme/matcher.ts` (match nombre empresa BORME ↔ Company, normaliza CIF) | ⏳ |
| 6 | `lib/borme/upsert.ts` (idempotente por matchHash `sha256(cif+tipo+fecha+numero_borme)`) | ⏳ |
| 7 | `scripts/borme-historico-backfill.ts` (365d backfill runner) | ⏳ |
| 8 | `scripts/smoke-c1.ts` (12 asserts) | ⏳ |
| 9 | `app/empresas/[slug]/_components/RegistroMercantilCard.tsx` (UI) | ⏳ |

---

## Schema

```prisma
model BormeEvent {
  id            String   @id @default(cuid())
  companyId     String?
  matchHash     String   @unique  // sha256(cif+tipo+fecha+numero_borme)
  cif           String?  // CIF normalizado (sin guiones, mayúsculas)
  companyName   String   // nombre como aparece en BORME
  fecha         DateTime
  tipo          String   // 'constitucion' | 'cambio_domicilio' | 'ampliacion_capital' | 'reduccion_capital' | 'escision' | 'cuentas' | 'consejo' | 'disolucion' | 'nombramiento' | 'cese'
  numeroBorme   String   // ej: 'BORME-A-2026-45-12'
  rawJson       Json     // payload completo del XML parseado
  fuente        String   // URL al BORME original
  matchedAt     DateTime @default(now())

  company       Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  @@index([companyId])
  @@index([cif])
  @@index([fecha])
  @@index([tipo])
}
```

---

## Lógica de matching

### Normalización CIF
```ts
normalizeCif(input: string): string
// A12345678 → A12345678
// A-12.345.678 → A12345678
// A 12 345 678 → A12345678
// ES-A12345678 → A12345678
// '' → null
```

### Match nombre empresa
```ts
matchCompanyName(bormeName: string, companies: Company[]): Company | null
// Quita SA/SL/SOCIEDAD ANONIMA/etc al final
// Quita acentos
// Lowercase + trim + colapsa espacios
// Jaro-Winkler ≥ 0.92 o contiene
```

---

## Success criteria (12 asserts)

| # | Criterio | Categoría |
|---|----------|-----------|
| C.1-1 | `BormeEvent` model existe en `schema.prisma` | schema |
| C.1-2 | Migración idempotente `CREATE TABLE IF NOT EXISTS` aplicada a `hermes_dossier` | deploy |
| C.1-3 | `normalizeCif('A-12.345.678')` → `'A12345678'` | unit |
| C.1-4 | `normalizeCif('ES-A12345678')` → `'A12345678'` | unit |
| C.1-5 | `normalizeCif('')` → `null` | unit |
| C.1-6 | `matchCompanyName('PASCUAL, S.A.', companies)` encuentra `Pascual SA` con score ≥0.92 | unit |
| C.1-7 | `upsertBormeEvent` idempotente: 2 inserts con mismo matchHash → 1 row | unit |
| C.1-8 | Runner 365d backfill corre sin error y registra ≥1 evento en DB real (VPS) | integration |
| C.1-9 | `Company.cif` se rellena vía JOIN con último `BormeEvent` con `cif` no null | integration |
| C.1-10 | `Company.cnae` se rellena desde evento `constitucion` o `cuentas` | integration |
| C.1-11 | `GET /dossier/empresas/[slug]` muestra `RegistroMercantilCard` con datos | UI |
| C.1-12 | Smoke `smoke:c1` ≥11/12 PASS en local y VPS | smoke |

---

## Reglas duras

| Regla | Mitigación |
|---|---|
| BOE rate limit 429 | Backoff exponencial 1s→30s, `p-limit(5)` concurrencia |
| CIF con formatos heterogéneos | `normalizeCif` único + 20+ casos test |
| Empresa sin BORME 365d | `borme_empty: true` en metadata + no bloquea |
| XML BORME malformado | `try/catch` por evento, no aborta backfill completo |
| Match nombre falso positivo | Jaro-Winkler ≥ 0.92 + requiere mismo CCAA/provincia |

---

## Cron (NO diario, NO backfill periódico)

- **Backfill 365d**: 1 sola vez, manual, para sembrar histórico
- **Incremental diario**: ya cubierto por `borme-runner.ts` (B.1, cadencia 2d)
- **C.1 NO añade cron nuevo** — es enrichment one-shot

---

## Coste

- **API BOE**: 0€ (datos abiertos)
- **Compute**: ~30 min para 365d backfill
- **Storage**: ~1 row por evento Borme (estimado 1000-5000 rows para 7 empresas en 365d)
- **Network**: 100-500 MB de XML descargado

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| BOE API caída durante backfill | Reanuda desde último día scrapeado, idempotente |
| Empresa con muchos eventos (>100) en 365d | `LIMIT 1000` por empresa como safety cap |
| Match por nombre ambiguo (Pescanova, S.A. vs Pescanova Distribución) | Requiere además mismo `provincia` o `cif parcial` |
| XML BORME inconsistente entre secciones | Parser tolerante con `try/catch` por sección |
| BOE exige user-agent identificable | UA: `HERMES-Dossier/1.0 (Surus Industrial OSINT)` |

---

## Próximos pasos (post-C.1)

- **C.2 Datos financieros** (M, 3-4d): capital social, últimas cuentas, tendencia — todo extraído de eventos `cuentas` + `ampliacion_capital` + `reduccion_capital`
- **C.3 Patentes OEPM/EPO** (S, 1-2d): join con `Company.cif` para buscar titular
- **C.4 Sanciones SANCO/CNMC** (S, 1-2d): join con `Company.cif`
- **C.7 Inventario técnico estimado** (M, 2-3d): usa `Company.cnae` para activar `hermes-asset-valuation`
- **C.6 Noticias 365d** (S, 1d): extender backfill de prensa a 1 año (ya hay infra de QW-8)
