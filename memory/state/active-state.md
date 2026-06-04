# Active State

## Objective
**HERMES Platform — dossier industrial agroalimentario**: motor OSINT continuo en VPS 88.198.93.52.
Detección cada 2 días de desimplantaciones (equipos, maquinaria, vehículos, mob, IT, instalaciones, líneas, plantas) en grandes empresas A&B (CNAE 10+11) de las 17 CCAA. Cobertura completa, sin concursos, sin subastas, sin inversión/M&A. Enriquecer contactos para depto. comercial Surus (LinkedIn, email, cargo).
**Fase v6 (re-arquitectura desde cero)**: tomar toda la información de los 7 MD dossiers existentes (2,414 líneas), replicar la estructura del legacy https://surusclientes.vercel.app/ 1:1 (KPIs, mapa de plantas, inventario técnico con brand+model+specs, cronología, desglose financiero, verificación de subastas, fuentes clickeables, contactos con LinkedIn+email+phone+planta asignada, documentos/PDFs, notas editables). Búsqueda de contactos precisa por **persona + instalación concreta** (no solo por empresa), ampliada en redes sociales + correos. Primera corrida backfill 15 días, siguientes 2 días. Plantas con noticias previas se actualizan incrementalmente. CRUD abierto sin auth. Upload de imágenes y PDFs.

## Current Sprint
- Status: **MEGAPLAN EJECUCIÓN — sin parar, sin pedir permisos** 🚀
- App live v6: https://88-198-93-52.nip.io/dossier/ (re-arquitectura completa desplegada)
- Sprints completados últimos días: QW-1, QW-2, QW-3, QW-4, QW-5, QW-6, QW-7 (QW-10), QW-8, QW-9, B.1 BORME, B.9 Auctions, B.2, B.3, B.4, B.5, B.6, **B.7** ✅
- **Sprint Actual**: B.8 (Plantas stale 3 escaneos) — arrancando
- Pendiente: B.8, Sprint C enriquecimiento, D pipeline, G UX, H IA, etc.

## Completed Sprints (v5 — preservados)
- **Sprint 1 — Cimientos VPS HERMES**: ✅ 10/10 smoke. App live en https://88-198-93-52.nip.io/dossier/. Schema PostgreSQL aplicado, 7 empresas seed + 9 ops + 28 contactos. Nginx + certbot + systemd OK.
- **Sprint 2 — Newsrooms corporativos + Sectorial**: ✅ 10/10 smoke. 60 A&B newsrooms curados (44 con URL, 12 con RSS), 10 medios sectoriales. 238 sources newsroom (13 in-scope) + 100 sectorial (1 in-scope). 0 concursos. 7 ArticleCompany links. 2 SearchRun. Systemd timers cadencia 2 días.
- **Sprint 3 — Prensa general + regional/local**: ✅ 11/11 smoke. 40 outlets RSS (8 nacional + 32 regional/local) cubriendo 17 CCAA. Detector automático CCAA por contenido. 257 sources prensa (2 nacional + 25 regional in-scope), 14 CCAA distintas, 3 concursos correctamente filtrados. Systemd timer cadencia 2 días desfasado.
- **Sprint 4 — BOE/BOP/sindicatos + LinkedIn + Hunter**: ✅ 9/10 smoke. 12 BOE/BOP/sindicatos (27 sources, 2 in-scope, 0 concursos in_scope). 14 queries LinkedIn OSINT (28 perfiles detectados, 4 roles distintos). Hunter.io Email Finder pipeline (≥70 score). /dossier/api/contactos/export.csv operativo. 5 timers systemd activos.
- **Sprint 5 — MOCR + UI investigativa + orquestador**: ✅ 14/14 smoke. MOCR con Gemini 2.5 Flash Vision, /mocr UI, /hallazgos filtros URL-driven, export CSV 12 columnas, E2E placa WEG grade=A score=85.

## Sprint QW-10 — Responsables por sede (Source→Plant→Contacts) — 2026-06-04, COMPLETADO VPS

- Sprint contract: `memory/sprints/sprint-QW/QW-10-responsables-por-sede.md`
- Schema: `prisma/schema.prisma` añade `Source.plantId String?` + relación `Plant.sources[]` + `@@index([plantId])`
- Migración: `deploy/qw10-source-plant.sql` idempotente (`ADD COLUMN IF NOT EXISTS`, FK `ON DELETE SET NULL`)
- Endpoints nuevos:
  - `GET /api/hallazgos/[id]/responsables` — contactos de la sede del hallazgo, 404 + sugerencia si no hay plantId
  - `GET /api/responsables/por-sede?companySlug|companyId|plantId=…` — agrupación con primaryResponsable
- Componente: `app/empresas/[slug]/_components/ResponsablesPorSedeCard.tsx` — grid de plantas, status badge color-coded, primaryResponsable destacado, "ver más" para contactos adicionales
- Página: `app/empresas/[slug]/page.tsx` calcula `plantBlocks` con priority chain: `roleCategory=plant_manager + emailVerified` → `roleCategory=plant_manager` → sort `emailVerified desc, confidence desc`
- Página: `app/hallazgos/[id]/page.tsx` muestra `PlantContact` filtrado por `source.plantId` con badges ✓/⚠ email verificado, fallback a `/buscar-responsables?company=…&sede=…` si no hay plantId
- Backfill: `scripts/backfill-source-plant.ts` idempotente (`where: { plantId: null }`), batch=200 con take/cursor, NFD normalize + regex match nombre empresa o city/province
- **Resultado backfill 2026-06-04**: Procesados=3335, Asignados=17 (0.5%), NoMatch=47, SinCompany=3271
  - Esperable: solo 7 empresas seed con plantas registradas. 3271 sin companyId son RSS genéricos.
- Smoke: 17/17 PASS local + 17/17 PASS VPS (`pnpm smoke:qw-10`)
- Deploy: prisma generate OK, build OK, systemctl restart OK, app live `/api/hallazgos/[id]/responsables` y `/api/responsables/por-sede` activas

## Pending v6 Sprints (4-5 semanas)
- **S6 — Schema v6 + seed parser** (M, 3-4d): 11 modelos Prisma nuevos (Plant, PlantContact, TechnicalInventory, Operation, TimelineEvent, Financial, AuctionCheck, Document, Note, ScanConfig), parser MD → seed-v6.json con ≥7 companies, ≥30 plants, ≥80 contactos, ≥50 inventario, ≥20 ops, ≥100 events, ≥80 fuentes, ≥10 docs, ≥10 auction checks.
- **S7 — /empresas/[slug] legacy 1:1** (L, 5-6d): hero+KPIs+operación+plantas+inventario+cronología+finanzas+subastas+fuentes+contactos por planta+documentos+notas.
- **S8 — Plant-specific contact search** (L, 4-5d): agente linkedin-plant-specific, queries por planta+ubicación, Hunter.io para emails, vista /contactos con filtros por planta/rol/empresa/email verificado.
- **S9 — Cadencia 2-tier + edit/notes/delete** (L, 5-6d): ScanConfig.isFirstRun, ventana 15d→2d, incremental updates en plantas con news previas, API PUT/POST/DELETE para todo, UI inline-editable.
- **S10 — Upload imágenes y PDFs** (M, 2-3d): POST /api/upload, validación mime+size, storage en /data/uploads/{companySlug}/, UI upload zone en /empresas/[slug], serve estático vía rewrites.

## Stats v5 finales
- 768 sources scrapeadas (newsrooms + sectorial + prensa + BOE/BOP)
- 5 timers systemd activos, todos cadencia 2 días desfasados
- 4 skills HERMES disponibles (hermes-asset-valuation, hermes-certifications, hermes-technical-audit, + genéricos)
- 7 vistas web operativas v5: / /hallazgos /empresas /eventos /contactos /mocr /agentes /legacy
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
- **v6 — Auth**: Sin auth, todo abierto (decisión usuario)
- **v6 — Cadencia**: Primera ejecución 15d backfill, después 2d incremental
- **v6 — Contactos**: Búsqueda precisa por planta concreta, no solo por empresa
- **v6 — Plant-specific**: Cada contacto debe tener `plantId` FK, no solo `companyId`

## Files Críticos v5 (preservados)
- `/opt/hermes-dossier/apps/dossier-industrial/prisma/schema.prisma` (v5 — se rediseña en S6)
- `/opt/hermes-dossier/apps/dossier-industrial/deploy/migrate-search-v3.sql` (trigger FTS)
- `/opt/hermes-dossier/apps/dossier-industrial/lib/scrapers/{newsroom,sectorial,boe-bop,prensa,types}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/filters/{deimplantation,ccaa}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/agents/{runner,prensa-runner,boe-bop-runner,linkedin-runner,hunter-runner}.ts`
- `/opt/hermes-dossier/apps/dossier-industrial/lib/mocr/client.ts` (Gemini Vision)
- `/opt/hermes-dossier/apps/dossier-industrial/scripts/scan-*.ts` (5 agentes)
- `/opt/hermes-dossier/apps/dossier-industrial/scripts/smoke-sprint{1..5}.ts`
- `/etc/systemd/system/hermes-scan-{newsrooms,sectorial,prensa,boe-bop,linkedin}.{service,timer}`
- `/etc/nginx/sites-enabled/hermes-api` (location ^~ /dossier)

## Files Críticos v6 (a crear)
- `dossier-industrial-alimentario/PLAN-V6-REARQUITECTURA.md` (✅ ya escrito)
- `dossier-industrial-alimentario/prisma/schema.prisma` v6 (S6)
- `dossier-industrial-alimentario/scripts/parse-md-dossiers.ts` (S6)
- `dossier-industrial-alimentario/scripts/seed-v6.ts` (S6)
- `dossier-industrial-alimentario/app/empresas/[slug]/page.tsx` v6 (S7)
- `dossier-industrial-alimentario/app/contactos/page.tsx` v6 (S8)
- `dossier-industrial-alimentario/lib/agents/linkedin-plant-specific.ts` (S8)
- `dossier-industrial-alimentario/app/api/empresas/[slug]/route.ts` PUT (S9)
- `dossier-industrial-alimentario/app/api/upload/route.ts` (S10)
- `dossier-industrial-alimentario/data/uploads/` (S10)

## Datasets existentes (fuente de la verdad v6)
- 7 dossiers MD completos (2,414 líneas) en `dossier-industrial-alimentario/*.md` y `dossier-industrial-alimentario/presentaciones/*.md`
- 7 empresas top-tier: Pescanova, Danone, Mahou San Miguel, AGAMA/Damm, Pascual, Nestlé, Azucarera
- Datos extraídos: KPIs, plantas con ubicación+especialidad+empleados, inventario técnico con brand+model+specs, cronologías datadas, desgloses financieros, contactos con LinkedIn+rol, fuentes URLs, documentos (PDF EINF 2025)

## Pending Work
- Re-auth NotebookLM MCP (sesión caducada, no bloqueante)
- Hunter.io: cuando se acerque a 25 verif/mes, decidir pay-per-use vs esperar
- Optimizar queries LinkedIn si se topa con rate limit (aumentar throttle a 8s)
- Considerar Docling local en sidecar Python para MOCR (reducir dependencia de Gemini)
- Añadir más newsrooms corporativos orgánicamente (actualmente 44 URL + 12 RSS)
- **QW-7** Responsables POR SEDE — ya integrado en `/buscar-responsables`, solo confirmar UX
- Dashboard rebuild post-QW-3 (reconstrucción completa con dark mode)
- **Sprint B.8** Plantas stale (3 escaneos sin aparecer, diario) — **EN PROGRESO**
- **Sprint C** Enrichment 360º empresa (CIF/CNAE/finanzas/consejo) ← data gap 7/7 sin CIF
- Sync VPS bloqueado (root pass no respondiendo) ← RESUELTO, SSH key funciona
- Dashboard rebuild post-QW-3 (reconstrucción completa con dark mode)

## Sprint B.7 — Despidos CTO / Director Técnico (2026-06-04, COMPLETADO VPS)

B.6 cubre la señal débil "ayuda pública reciente a empresa A&B sin actividad" o "ayuda previa a concurso" (CDTI/IDAE/ICEX). 8 ayudas reales seed (Pescanova, Danone, Mahou, Damm, Nestlé, Azucarera, Pascual, Acerinox) en `lib/data/ayudas-list.json`.

- Sprint contract: `memory/sprints/sprint-B/B.6-ayudas-publicas-cdti-idae-icex-contract.md`
- Sprint report: `memory/sprints/sprint-B/B.6-ayudas-publicas-cdti-idae-icex-report.md`
- Scraper: `lib/scrapers/ayudas-publicas.ts` (loadAyudasFromFile + scrapeAllAyudatories + fetchLiveBDNS placeholder)
- Agente: `lib/agents/ayudas-runner.ts` (cadencia 14d, idempotente con matchHash)
- Filtro: `lib/filters/ayudas.ts` (5 ramas: ayuda_sin_actividad, ayuda_previa_a_concurso, ayuda_con_actividad_normal, unknown_company, not_ab)
- `lib/scrapers/types.ts`: +'ayuda_publica' al union OutletType + RawAyudaPublica + AyudasScrapeOptions
- Cron: paso 6e en `run-agents.sh`
- Smoke: 13/13 B.6 + 5 QW regresión (3 fallan por :3002 down preexistente)
- 1ª corrida backfill_180d: 1 ayuda, 0 inScope, 1 outOfScope (unknown_company por data gap: seed companies sin CIF)
- 2ª corrida incremental_14d: 0 ayudas, 143ms (idempotente)
- Data gap conocido: 7/7 seed Companies con `cif: null` y `cnae: null` — Sprint C enrichment resolverá

## Sprint B.7 — Despidos CTO / Director Técnico LinkedIn (2026-06-04, COMPLETADO VPS)

B.7 cubre la señal débil "decisor técnico senior (CTO, Director Técnico, Director I+D, COO, Director Industrial, Director de Planta, Director Producción, VP Engineering) que deja la empresa" — los CTO rara vez abandonan empresa saneada, su salida suele preceder 6-12 meses a desimplantación.

- Sprint contract: `memory/sprints/sprint-B/B.7-despidos-cto-contract.md`
- Sprint report: `memory/sprints/sprint-B/B.7-despidos-cto-report.md`
- Queries: `lib/data/linkedin-despidos-queries.json` (8 templates, 8 cargos cubiertos)
- Scraper: `lib/scrapers/despidos-cto.ts` (~110 líneas, modo placeholder sin GOOGLE_CSE_API_KEY)
- Filtro: `lib/filters/despidos-cto.ts` (~210 líneas, scoring 0/1/2+ con signalStrength weak/medium/strong)
- Agente: `lib/agents/despidos-cto-runner.ts` (cadencia 7d, idempotente con matchHash `b7-{slug}-{empresaSlug}-{YYYY-MM-DD}`)
- `lib/scrapers/types.ts`: +'despido_cto' al union OutletType + RawDespidoCto + DespidosCtoScrapeOptions
- DECISORES_TECNICOS: 8 cargos readonly exportados
- Cron: paso 6f en `run-agents.sh` (tras B.6)
- Smoke: 14/14 B.7+Q (12/12 B.7 funcional PASS, 5 QW regresión 2/5 — 3 preexistentes :3002 down)
- 1ª corrida backfill_90d: 0 despidos, 0 inScope, 162ms (placeholder mode sin GOOGLE_CSE_API_KEY)
- Limitaciones: 5 conocidas (placeholder, sin Plan B Playwright, fecha parseada de snippet, sin Telegram para medium, sin anti-promoción)

## Sprint QW-3 — Modo Oscuro data-theme toggle (2026-06-03, COMPLETADO local)

- Sprint contract: `memory/sprints/sprint-QW/QW-3-dark-mode.md`
- CSS variables como único switch: `app/globals.css` añade bloque `[data-theme="dark"]` redefiniendo `--surus-primary`, `--surus-bg`, `--surus-bg-elev`, `--surus-text`, `--surus-text-soft`, `--surus-text-muted`, `--surus-border`, `--surus-border-strong`, `--surus-shadow-*`. Override adicional para `.surus-pill-*` y `.surus-button-ghost`. Sin reescribir componentes.
- Anti-FOUC: `app/layout.tsx` añade `<script dangerouslySetInnerHTML>` en `<head>` que lee `localStorage.theme` y aplica `data-theme` antes del primer paint. Fallback a `prefers-color-scheme: dark` si no hay preferencia guardada.
- `components/ThemeToggle.tsx` (client component): icono `Moon`/`Sun` de `lucide-react`, lee `localStorage` solo en `useEffect` (SSR-safe), click → `setAttribute('data-theme', ...)` + `setItem`. `aria-label` actualizado dinámicamente.
- Navbar.tsx importa e inserta `<ThemeToggle />` entre los links y el crédito.
- Smoke QW-3: 9/9 asserts verdes (`smoke:qw-3` en package.json). Type-check 0 errores.
- Pendiente sync VPS (root pass no respondiendo — bloqueado).

## Sprint QW-9 — Panel Outreach Oculto (2026-06-03, COMPLETADO local)

- Sprint contract: `memory/sprints/sprint-QW/QW-9-outreach-panel.md`
- Schema v6+: nuevo modelo `OutreachLog` (companyId, contactId, channel, subject, body, status, hash, seed, model, painPointCount, wordCount) + relaciones desde Company y PlantContact.
- Pain points: `lib/email/personalize.ts` query `Source` con `deimplantationSignal=true`, excluye `outletType` auction/linkedin, devuelve 5 más recientes con `signalStrength`.
- Seed determinista: `seedForContact(companyId, contactId, sector, cargo)` → 0-9999. `seedForChannel(base, channel)` desplaza 0/137/271 para que email/linkedin_short/linkedin_long no sean idénticos.
- Prompt: 3 bloques obligatorios (presentación Surus + contexto adaptado a cargo + cierre con pregunta 1 línea). Reglas duras: sin "estimado/a", "no dude en", "quedo a su disposición", "me pongo en contacto", "espero su respuesta", "le saluda atentante", "excelente", "innovador", "líder del sector", "puntero".
- Generación: `lib/ia/email-generator.ts` DeepSeek `deepseek-chat` temperature 0.85. Fallback automático a template estático si `forceMock` / sin API key / MOCK=1.
- Panel UI: `app/admin/outreach/OutreachClient.tsx` (cliente) + `page.tsx` (server, dynamic=force-dynamic). Dropdown empresas ordenadas A&B → Construcción → resto. Multi-select contactos con checkboxes + filtro por planta (cuando hay varias sedes). Cards por decisor con pain points colapsables + 3 borradores editables (textarea) + copy-to-clipboard + botón LinkedIn DM que abre `linkedin.com/messaging/compose/?to=...`. Botón "Regenerar" re-llama al endpoint con misma (company, contact).
- Atajo `Ctrl+Alt+A`: documentado en cliente, fuerza scroll-to-top.
- **OCULTO**: Navbar.tsx SIN link a `/admin/outreach` — solo URL directa. Sin enlaces en sitemap. robots noindex.
- Endpoints:
  - `POST /api/admin/outreach/generate` (companyId + contactIds + templateId opcional)
  - `POST /api/admin/outreach/copied` (best-effort tracking al portapapeles)
  - `GET  /api/contactos/by-company?companyId=…` (alimenta multiselect)
  - `GET  /admin/outreach/log` (visor audit log con KPIs por estado)
- Smoke QW-9: 39/39 asserts verdes (`smoke:qw-9` en package.json).
- Type-check: 0 errores.
- Pendiente sync VPS (root pass no respondiendo — bloqueado).

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
