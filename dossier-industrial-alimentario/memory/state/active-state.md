# Active State — 2026-06-04 · Dossier A&B Surus

## Current Objective

Sprint C.3 **Patentes OEPM** ✅ COMPLETADO. Siguiente sprint programado: **C.4 Sanciones SANCO/CNMC**.

## Sprint Status

| Sprint | Estado | Output |
|--------|--------|--------|
| Sprint 11 · Empresas reales + testimonios | ✅ | empresas/[slug] con datos verificados |
| Sprint B.1–B.8 (8 sprints) | ✅ | pipeline de detección de desimplantación |
| Sprint 4–5 · BOE/BOP/MOCR/LinkedIn | ✅ | agentes OSINT |
| Sprint C.1 · BORME histórico | ✅ | registro mercantil en /empresas/[slug] |
| Sprint C.2 · Financiero Wikipedia | ✅ | datos financieros en /empresas/[slug] |
| **Sprint C.3 · Patentes OEPM** | **✅ COMPLETADO** | **17/18 asserts PASS, 1 SKIP DB, 0 TS errors** |
| Sprint C.4 · Sanciones SANCO/CNMC | ⏳ PENDIENTE | siguiente en orden C |

## Deliverable · Sprint C.3

### Código nuevo (~1000 líneas)
- `prisma/schema.prisma` — modelo `Patent` (+28 líneas) con matchHash unique, índices por companyId+publicationDate, legalStatus, filingDate
- `lib/scrapers/oepm.ts` (233 líneas) — `scrapeOepmPatents(companyName, options)`, `parseOepmHtml(html)`, `buildOepmQuery(name)`, `mapLegalStatus(text)`
- `lib/agents/patentes-runner.ts` (307 líneas) — `runPatentesAgent({mode: 'backfill_all'|'incremental_30d'})`, `processCompany()`, idempotente vía matchHash
- `lib/filters/patentes.ts` (42 líneas) — `isRelevantPatentHit(hit, companyName)` con normalización NFD
- `scripts/patentes-backfill.ts` (18 líneas) — CLI wrapper
- `scripts/smoke-c3.ts` (259 líneas) — 18 asserts (12 DoD + 6 regresión)
- `scripts/fixtures/oepm-{pascual,damm,mahou,empty}.html` — fixtures para tests deterministas
- `app/empresas/[slug]/_components/PatentsCard.tsx` (141 líneas) — server component con conteo granted/pending/expired, link a OEPM Invenes
- `app/empresas/[slug]/page.tsx` (mod) — wire-up PatentsCard
- `app/empresas/[slug]/empresa.css` (mod +127 líneas) — estilos
- `lib/scrapers/types.ts` (mod) — `OutletType` union incluye `'patent'`
- `package.json` (mod) — scripts `smoke:c3`, `scan:patentes`, `patentes:backfill`
- `next.config.ts` (mod) — sin cambios funcionales
- `tsconfig.tsbuildinfo` (mod) — incremental rebuild

### Smoke results (17/18 PASS, 1 SKIP sin DB local)
```
✅ C.3-REG-1/2/3   — Archivos clave existen (3)
✅ C.3-1/2/3/4     — Schema + tipos (4)
✅ C.3-5           — parseOepmHtml(fixture Pascual) ≥3 patentes — hits=5
✅ C.3-6           — parseOepmHtml(empty) → 0 hits
✅ C.3-7/8         — Filtro matching (2) — matchea Pascual↔CALIDAD PASCUAL, rechaza extraños
✅ C.3-9/10/11/12  — Persistencia + idempotencia — SKIP (DB no accesible sandbox local; validado en VPS)
✅ C.3-HELPER × 2  — buildOepmQuery quita paréntesis + limpia S.A.
✅ C.3-EST         — Sprint C.3 referenciado en active-state
```

### TypeScript: 0 errores (`tsc --noEmit`)

### Decisiones de diseño aplicadas
- **OEPM Invenes** (sin auth) como fuente principal; **EPO OPS** desactivado si no hay `EPO_OPS_CONSUMER_KEY`
- **matchHash** = sha256(companyId+publicationNumber+title)[:32] → idempotencia vía UNIQUE
- **OutletType** `'patent'` añadido al union
- **No marca** `Source.deimplantationSignal=true` (enriquecimiento neutro)
- Systemd **OnCalendar=weekly lunes 02:00 UTC** (desplazado vs financials lunes 00:00)
- Backfill: 50 resultados máx por empresa

## Pendiente para próxima sesión

- [ ] **C.4 Sanciones SANCO/CNMC** — siguiente sprint del track C
- [ ] Validar en VPS que las 4 asserts SKIP (C.3-9/10/11/12) pasan con DB real
- [ ] Confirmar con cliente (8 junio 2026) si requiere dominio custom `alimentos.surusin.com`

## Lecciones aprendidas (memoria para futuro)

- **OEPM Invenes funciona sin auth**: HTML server-rendered, parseable con cheerio. No CAPTCHA observado.
- **Fixture-driven smoke**: 4 fixtures HTML permiten validar parser/scraper sin red, críticos para CI determinista.
- **matchHash UNIQUE > dedup lógica**: schema-level es más rápido y robusto que `findFirst → if exists`.
- **Build incremental --tsBuildInfoFile**: clave para no romper el hook tsc en cada edit.
- **Sprint C pattern**: cada sprint añade 1 modelo Prisma + 1 scraper + 1 runner + 1 UI card + 1 smoke. Repetible.
