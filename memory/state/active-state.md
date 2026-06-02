# Active State

## Objective
**HERMES Platform — dossier industrial agroalimentario**: motor OSINT continuo en VPS 88.198.93.52.
Detección cada 2 días de desimplantaciones (equipos, maquinaria, vehículos, mob, IT, instalaciones, líneas, plantas) en grandes empresas A&B (CNAE 10+11) de las 17 CCAA. Cobertura completa, sin concursos, sin subastas, sin inversión/M&A. Enriquecer contactos para depto. comercial Surus (LinkedIn, email, cargo).

## Current Sprint
- Status: **Sprint 2 GO 10/10** — completado
- Next: Sprint 3 — Prensa general + regional/local (17 CCAA)

## Completed Sprints
- **Sprint 1 — Cimientos VPS HERMES**: ✅ 10/10 smoke. App live en https://88-198-93-52.nip.io/dossier/. Schema PostgreSQL aplicado, 7 empresas seed + 9 ops + 28 contactos. Nginx + certbot + systemd OK.
- **Sprint 2 — Newsrooms corporativos + Sectorial**: ✅ 10/10 smoke.
  - 60 A&B newsrooms curados (44 con URL verificada, 12 con RSS)
  - 10 medios sectoriales (Alimarket, Interempresas, Eurocarne, Olimerca, etc.)
  - 238 sources newsroom (13 in-scope desimplantación) + 100 sources sectorial (1 in-scope)
  - 0 concursos persistidos (filtro negativo OK)
  - 7 ArticleCompany links newsroom in-scope ↔ Company
  - 2 SearchRun loggeados (newsrooms + sectorial)
  - Systemd timers cadencia 2 días instalados:
    - hermes-scan-newsrooms.timer: próximo 2026-06-03 00:09 UTC
    - hermes-scan-sectorial.timer: próximo 2026-06-04 00:06 UTC (desfasado 1 día)

## Pending Sprints
- **Sprint 3 — Prensa general + regional/local (17 CCAA)**
  - 30+ outlets RSS cubriendo 17 CCAA
  - Detector automático de CCAA (regex + heurística por nombre del medio)
  - Sistema: systemd hermes-scan-prensa.timer
  - Meta: ≥200 sources tras 4 días
- **Sprint 4 — BOE/BOP/sindicatos + LinkedIn OSINT**
  - BOE sección laboral/industria, BOP 50 provincias (sin concursos), sindicatos industria
  - BORME solo escisiones/liquidaciones no concursales
  - LinkedIn OSINT (Google site:linkedin.com, ofertas de empleo reveladoras)
  - Hunter.io pay-per-use para emails
  - Meta: 0 concursos, ≥50 decisores A&B con LinkedIn, ≥10 emails enriquecidos
- **Sprint 5 — MOCR + UI investigativa + orquestador**
  - Docling + Gemini Vision para placas/certificados/balances
  - Skills hermes-asset-valuation, hermes-certifications, hermes-technical-audit
  - UI /hallazgos con FTS ES, filtros, export CSV
  - Pydantic-AI orchestrator con retries + DLQ

## Key Decisions
- Stack: Next.js 15 standalone + PostgreSQL 18 + Prisma 5 + tsvector (trigger-based) + pg_trgm
- Sin Firecrawl, sin Vercel, sin Railway — TODO en VPS HERMES
- Scrapers: HTTP+cheerio (RSS primero), Playwright fallback cuando content < 200 chars
- Filtro desimplantación: 6 categorías positivas + anti-M&A (-0.6) + anti-concurso/subasta
- Idempotencia: UNIQUE(url) en Source, upsert
- Caducidad: 180 días + is_stale flag (usuario revivir, NUNCA borrar)
- FTS español: trigger BEFORE INSERT OR UPDATE (PostgreSQL 18 no soporta GENERATED con to_tsvector)

## Files Críticos
- `/opt/hermes-dossier/apps/dossier-industrial/prisma/schema.prisma` (10 models)
- `/opt/hermes-dossier/apps/dossier-industrial/deploy/migrate-search-v3.sql` (trigger FTS)
- `/opt/hermes-dossier/apps/dossier-industrial/lib/scrapers/{newsroom,sectorial,types}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/filters/deimplantation.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/agents/runner.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/scripts/scan-{newsrooms,sectorial}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/scripts/smoke-sprint{1,2}.ts`
- `/etc/systemd/system/hermes-scan-{newsrooms,sectorial}.{service,timer}`
- `/etc/nginx/sites-enabled/hermes-api` (location ^~ /dossier)

## Pending Work
- Sprint 3 código: list 30+ outlets, scraper prensa, agente, smoke-sprint3
- Commit Sprint 2 a git
- Re-auth NotebookLM (sesión caducada)
- Verificar `/dossier/contactos` muestra ahora los 7 ArticleCompany links
