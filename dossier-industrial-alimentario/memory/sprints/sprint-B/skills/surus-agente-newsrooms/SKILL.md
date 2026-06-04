---
name: surus-agente-newsrooms
description: Agente de detección de desimplantación industrial alimentaria en newsrooms corporativos A&B (CNAE 10+11). Scrapea ~50 grandes empresas (Pescanova, Nestlé, Mahou, Danone, Pascual, ElPozo, Campofrío, Borges, Deoleo, AB-InBev, Coca-Cola EP, PepsiCo, etc.) vía RSS-first / HTTP / Playwright fallback. Filtra SOLO señales de desimplantación (cierre, ERE, desinversión, fin de línea) y descarta M&A, concursos y subastas.
triggers:
  - "Scrapear newsrooms corporativos A&B"
  - "Detectar desimplantaciones en grandes empresas alimentarias"
  - "Correr agente de newsrooms HERMES"
  - "Cron de newsrooms corporativos"
  - "Survey cierre de plantas en A&B"
tools_required:
  - terminal
  - file
sector: alimentacion_bebidas
version: "1.0"
last_updated: "2026-06-02"
related_skills:
  - surus-dossier
  - surus-dominio
  - surus-activos
---

# SURUS — Agente Newsrooms Corporativos A&B

## Identidad

- **ID**: `surus-agente-newsrooms`
- **Tipo**: Detección de oferta (desimplantación circular)
- **Dominio**: Sector privado — grandes empresas A&B (CNAE 10+11)
- **País**: ES (17 CCAA)
- **Audiencia**: Departamento comercial Surus (asesoría, NO broker)
- **Método**: RSS-first → HTTP/cheerio → Playwright fallback
- **Prioridad**: P1 (PRIMARY source — primera pista de desimplantación)
- **Cadencia**: cada 2 días
- **Estado**: activo

## Scope: SOLO Desimplantación

**Positivas (6 categorías)** → guardar en `Source.deimplantationSignal=true`:
- `asset_release` — venta/liberación de activos (maquinaria, líneas)
- `plant_closure` — cierre total de planta/fábrica
- `line_closure` — cierre parcial de una línea de producción
- `ERE` — Expediente de Regulación de Empleo (despidos colectivos ≥ 30 días)
- `divestment` — desinversión de unidad de negocio o marca
- `decommissioning` — desmantelamiento técnico de equipos/plantas

**Negativas (anti-M&A, anti-concurso, anti-subasta)** → marcar `outOfScopeReason`:
- Fusiones, adquisiciones, joint-ventures → `out_of_scope:m&a` (penalty -0.6)
- Concursos de acreedores → `out_of_scope:concurso`
- Subastas judiciales / notariales → `out_of_scope:subasta`
- Inversión en nueva planta → `out_of_scope:new_plant`
- Ampliación de capacidad → `out_of_scope:capacity_expansion`

## Keywords (ES)

```
cierre fábrica, cierre planta, cierre línea, ERE, regulación de empleo,
despidos, desinversión, vende planta, vende fábrica, vende línea, vende activos,
desmantelamiento, desmontaje, desinstalación, baja de inventario, fin de producción,
paralización, traslado producción, deslocalización, externalización cierre
```

## Procedimiento

1. Cargar la lista de ~50 companies A&B con `newsroomUrl` y/o `rssUrl` desde la DB (tabla `Company` + `ScanConfig`)
2. Por cada source, intentar **cascada**:
   - **RSS** (`rss-parser`): si `rssUrl` existe, items en < 5s
   - **HTTP/cheerio**: si no hay RSS, GET a `newsroomUrl` + extraer links de `<article>` / `<div class="post">` / `<li class="entry">`
   - **Playwright**: si cheerio < 200 chars o < 5 links, fallback headless
3. Por cada artículo, extraer: `{ url, title, publishedAt, content, contentHash, outlet, outletType='corporate_newsroom' }`
4. **Filtrar** con keywords positivas (1+ match) vs negativas (penalty fuerte)
5. **Insertar** en `Source` con `deimplantationSignal=true` + `outletType='corporate_newsroom'`
6. **Registrar** `SearchRun` con stats (total, matched, inserted, errors)
7. **Log** estructurado a stdout (JSON line por source)

## Variables de entorno (NO hardcoded en este SKILL)

```bash
DATABASE_URL=postgresql://surus:***@127.0.0.1:5432/hermes_dossier
MAX_PER_SOURCE=8                 # default; ajustar por sprint
ONLY_SLUGS=                      # opcional: CSV de slugs (debug)
LOG_LEVEL=info
```

Las credenciales están en `/opt/hermes-dossier/.env` (chmod 600).

## Salida (tabla `Source`)

| Columna | Tipo | Ejemplo |
|---------|------|---------|
| id | uuid | `8c2f...` |
| url | text | `https://www.nestle.es/sala-prensa/...` |
| title | text | `Nestlé anuncia el cierre de la planta de...` |
| outlet | text | `Nestlé España` |
| outletType | text | `corporate_newsroom` |
| publishedAt | timestamptz | `2026-06-02T10:00:00Z` |
| deimplantationSignal | bool | `true` |
| outOfScopeReason | text? | `null` o `m&a` |
| content | text | cuerpo del artículo (≤8KB) |
| contentHash | text | SHA-256 del content (dedup) |

## Run command

```bash
cd /opt/hermes-dossier/apps/dossier-industrial
pnpm exec tsx scripts/scan-newsrooms.ts
```

Wrapper watchdog (sin LLM, retries automáticos):

```bash
/root/.hermes/scripts/scan-newsrooms.sh
```

## Cadence

- **Frecuencia**: cada 2 días (`*/2`)
- **Hora preferida**: 02:00 UTC (low traffic)
- **Día del mes**: impar (1, 3, 5, 7, ...)
- **Tiempo máximo**: 30 min (timeout systemd)

## Output example (3-5 líneas reales)

```json
{"source":"nestle_es","items":3,"matched":1,"inserted":1,"elapsed_ms":12830}
{"source":"mahou_smiguel","items":5,"matched":0,"inserted":0,"reason":"no_keywords"}
{"source":"danone_es","items":2,"matched":1,"inserted":1,"deimpl":"plant_closure","title":"Danone cierra su planta de..."}
```

## Notas operativas

- **Rate limit**: 30 req/min agregado (User-Agent dedicado: `HERMES-DossierBot/1.0`)
- **Idioma**: ES; detectar `lang` del content y descartar `lang != es`
- **Anti-detección**: 1s entre requests + backoff exponencial en 429
- **Geo**: 17 CCAA; mapear `region` y `province` en `Source` cuando sea posible
- **Dedup**: `contentHash` SHA-256 → ON CONFLICT DO NOTHING

## Aprendizajes

```yaml
pitfalls:
  - "RSS de algunas newsrooms está vacío aunque la sección 'Sala de Prensa' tenga contenido"
  - "Playwright consume 100MB RAM por source — limitar a 3 concurrentes"
  - "Algunas newsrooms usan cookie wall → detectar y descartar"
mejoras_pendientes:
  - "Añadir scoring LLM (Gemini) para desambiguar M&A vs desinversión"
  - "Cross-ref con LinkedIn para validar movimientos corporativos"
```
