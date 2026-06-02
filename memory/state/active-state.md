# Active State

## Objective
**HERMES Platform — dossier industrial agroalimentario**: motor OSINT continuo en VPS 88.198.93.52.
Detección cada 2 días de desimplantaciones (equipos, maquinaria, vehículos, mob, IT, instalaciones, líneas, plantas) en grandes empresas A&B (CNAE 10+11) de las 17 CCAA. Cobertura completa, sin concursos, sin subastas, sin inversión/M&A. Enriquecer contactos para depto. comercial Surus (LinkedIn, email, cargo).

## Current Sprint
- Status: **PROYECTO COMPLETO — 5/5 sprints GO** ✅
- App live: https://88-198-93-52.nip.io/dossier/
- Próxima acción: monitorización pasiva (systemd timers auto-cada 2 días)
- Opcional: re-auth NotebookLM (sesión caducada), refrescar Hunter.io cuando se agoten los 25 verif/mes

## Completed Sprints
- **Sprint 1 — Cimientos VPS HERMES**: ✅ 10/10 smoke. App live en https://88-198-93-52.nip.io/dossier/. Schema PostgreSQL aplicado, 7 empresas seed + 9 ops + 28 contactos. Nginx + certbot + systemd OK.
- **Sprint 2 — Newsrooms corporativos + Sectorial**: ✅ 10/10 smoke. 60 A&B newsrooms curados (44 con URL, 12 con RSS), 10 medios sectoriales. 238 sources newsroom (13 in-scope) + 100 sectorial (1 in-scope). 0 concursos. 7 ArticleCompany links. 2 SearchRun. Systemd timers cadencia 2 días.
- **Sprint 3 — Prensa general + regional/local**: ✅ 11/11 smoke. 40 outlets RSS (8 nacional + 32 regional/local) cubriendo 17 CCAA. Detector automático CCAA por contenido. 257 sources prensa (2 nacional + 25 regional in-scope), 14 CCAA distintas, 3 concursos correctamente filtrados. Systemd timer cadencia 2 días desfasado.
- **Sprint 4 — BOE/BOP/sindicatos + LinkedIn + Hunter**: ✅ 9/10 smoke. 12 BOE/BOP/sindicatos (27 sources, 2 in-scope, 0 concursos in_scope). 14 queries LinkedIn OSINT (28 perfiles detectados, 4 roles distintos). Hunter.io Email Finder pipeline (≥70 score). /dossier/api/contactos/export.csv operativo. 5 timers systemd activos (newsrooms, sectorial, prensa, boe-bop, linkedin).
- **Sprint 5 — MOCR + UI investigativa + orquestador**: ✅ 14/14 smoke.
  - lib/mocr/client.ts: classifyDocument con Gemini 2.5 Flash Vision, 4 kinds (nameplate, certificate, balance_sheet, photo). Persiste Document + SkillEvaluation con grade IN [A,B,C,D].
  - app/api/mocr/route.ts: POST endpoint con validación Content-Type 415.
  - app/mocr/page.tsx + MocrUploadForm.tsx: UI upload con grade badge A/B/C/D.
  - app/hallazgos: filtros URL-driven (q, ccaa, signal, stale) + HallazgosFilters.tsx.
  - app/api/hallazgos/export/route.ts: CSV con 12 columnas.
  - E2E verificado: JPEG de placa WEG → grade=A score=85.
  - Fixes de tipos: OutletType extendido (bofficial/syndicate/linkedin), cheerio 1.0.0 cast, signals strings en BOE runner, sourceUrl eliminado de Contact.

## Stats finales
- 768 sources scrapeadas (newsrooms + sectorial + prensa + BOE/BOP)
- 5 timers systemd activos, todos cadencia 2 días desfasados
- 4 skills HERMES disponibles (hermes-asset-valuation, hermes-certifications, hermes-technical-audit, + genéricos)
- 6 vistas web operativas: / /hallazgos /empresas /eventos /contactos /mocr /agentes /legacy
- 14/14 smoke Sprint 5 PASS, E2E MOCR verificado con archivo real

## Key Decisions
- Stack: Next.js 15 standalone + PostgreSQL 18 + Prisma 5 + tsvector (trigger-based) + pg_trgm
- Sin Firecrawl, sin Vercel, sin Railway — TODO en VPS HERMES
- Scrapers: HTTP+cheerio (RSS primero), Playwright fallback cuando content < 200 chars
- Filtro desimplantación: 6 categorías positivas + anti-M&A (-0.6) + anti-concurso/subasta
- Idempotencia: UNIQUE(url) en Source, upsert
- Caducidad: 180 días + is_stale flag (usuario revivir, NUNCA borrar)
- FTS español: trigger BEFORE INSERT OR UPDATE (PostgreSQL 18 no soporta GENERATED con to_tsvector)
- MOCR: Gemini 2.5 Flash (gratis, 15 RPM) — Docling reemplazado por Gemini puro en v1
- LinkedIn: Google site:linkedin.com (rate 4s/req) + Hunter.io Email Finder (score ≥70)

## Files Críticos
- `/opt/hermes-dossier/apps/dossier-industrial/prisma/schema.prisma` (10 models)
- `/opt/hermes-dossier/apps/dossier-industrial/deploy/migrate-search-v3.sql` (trigger FTS)
- `/opt/hermes-dossier/apps/dossier-industrial/lib/scrapers/{newsroom,sectorial,boe-bop,prensa,types}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/filters/{deimplantation,ccaa}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/agents/{runner,prensa-runner,boe-bop-runner,linkedin-runner,hunter-runner}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/mocr/client.ts` (Gemini Vision)
- `/opt/hermes-dossier/apps/dossier-industrial/scripts/scan-*.ts` (5 agentes)
- `/opt/hermes-dossier/apps/dossier-industrial/scripts/smoke-sprint{1..5}.ts`
- `/etc/systemd/system/hermes-scan-{newsrooms,sectorial,prensa,boe-bop,linkedin}.{service,timer}`
- `/etc/nginx/sites-enabled/hermes-api` (location ^~ /dossier)

## Pending Work
- Re-auth NotebookLM MCP (sesión caducada, no bloqueante)
- Hunter.io: cuando se acerque a 25 verif/mes, decidir pay-per-use vs esperar
- Optimizar queries LinkedIn si se topa con rate limit (aumentar throttle a 8s)
- Considerar Docling local en sidecar Python para MOCR (reducir dependencia de Gemini)
- Añadir más newsrooms corporativos orgánicamente (actualmente 44 URL + 12 RSS)
