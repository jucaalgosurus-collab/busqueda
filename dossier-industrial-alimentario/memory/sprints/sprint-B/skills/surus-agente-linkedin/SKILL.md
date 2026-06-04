---
name: surus-agente-linkedin
description: Agente OSINT de LinkedIn (Google site:linkedin.com) para ENRIQUECER contactos del depto. comercial Surus. NO contacta, NO envía mensajes. Detecta: (a) profesionales que mencionan "cierre de planta", "ERE", "desinversión" en su actividad reciente en empresas A&B españolas; (b) headhunters, abogados, consultoras especializados en restructuring; (c) HR directors y CFO en empresas target. Output va a la tabla `Contact` con enrichment score.
triggers:
  - "Enriquecer contactos con LinkedIn OSINT"
  - "Detectar profesionales A&B en LinkedIn"
  - "Correr agente LinkedIn HERMES"
  - "Cron de LinkedIn OSINT"
  - "Survey de RH/CFO en empresas target"
tools_required:
  - terminal
  - file
sector: alimentacion_bebidas
version: "1.0"
last_updated: "2026-06-02"
related_skills:
  - surus-agente-newsrooms
  - surus-agente-boe-bop
  - surus-dossier
  - surus-dominio
  - surus-compradores
---

# SURUS — Agente LinkedIn OSINT (Enrichment)

## Identidad

- **ID**: `surus-agente-linkedin`
- **Tipo**: **Enrichment** de contactos (NO outreach, NO scraping masivo)
- **Dominio**: LinkedIn público (vía Google `site:linkedin.com`)
- **País**: ES
- **Audiencia**: Departamento comercial Surus (asesores)
- **Método**: Google dorks `site:linkedin.com` + HTTP/cheerio
- **Prioridad**: P2 (enrichment secundario; CRÍTICO para funnel comercial)
- **Cadencia**: cada 2 días
- **Estado**: activo

## Scope: ENRICHMENT (no outreach)

**Qué hace:**
- Encuentra perfiles LinkedIn de personas que:
  1. Están/publicaron sobre "cierre de planta", "ERE", "desinversión" en su actividad reciente (Google indexa esto)
  2. Trabajan en empresas A&B target (CNAE 10+11, top 50)
  3. Son perfiles con rol de decisión: HR Director, CFO, COO, Director de Planta, Restructuring Lead
  4. Headhunters, abogados, consultoras especializadas en restructuring/restructuración industrial

**Qué NO hace (regla de oro):**
- NO envía invitaciones
- NO envía mensajes
- NO scrapea perfiles privados (login required)
- NO contacta a nadie
- NO hace outreach automatizado

**Por qué es valioso para Surus:**
El depto. comercial necesita CONTEXTOS de contacto. Si sabemos que un CFO publicó sobre "proceso de restructuración en Pescanova", el asesor puede llamarle con un mensaje informado (no spam).

## Queries Google (dorks)

### Personas con publicaciones sobre desimplantación
```
site:linkedin.com "cierre de planta" "España" -jobs -hiring
site:linkedin.com "ERE" "expediente de regulación" -jobs
site:linkedin.com "desinversión" "alimentación" "España"
site:linkedin.com "restructuring" "plant closure" Spain
site:linkedin.com "plant manager" "food industry" Spain
```

### Roles target en empresas A&B
```
site:linkedin.com "Director de RRHH" "Nestlé" OR "Pescanova" OR "Danone"...
site:linkedin.com "CFO" "alimentación" "España"
site:linkedin.com "Director de Planta" "Mahou" OR "Pascual" OR "ElPozo"...
```

### Profesionales del ecosistema
```
site:linkedin.com "headhunter" "restructuring" "industria"
site:linkedin.com "abogado" "derecho laboral" "ERE"
site:linkedin.com "consultor" "desimplantación" "industrial"
```

## Procedimiento

1. **Generar ~50 queries** desde la lista de top 50 A&B + keywords
2. **Google search** (rate-limited, 1 query / 8 segundos)
3. Por cada resultado LinkedIn público, extraer:
   - URL canónica del perfil
   - Nombre + cargo actual
   - Empresa actual
   - Ciudad/región
   - Headline (snippet de Google)
4. **Filtrar** perfiles con señal de desimplantación (score 0-1)
5. **Matchear** contra `Contact` y `Company` (lookup por slug)
6. **Insertar/actualizar** en `Contact` con `enrichmentSource='linkedin_osint'`
7. **Log** stats por query

## Variables de entorno

```bash
DATABASE_URL=postgresql://surus:***@127.0.0.1:5432/hermes_dossier
MAX_QUERIES=20
ONLY_ROLES=CFO,HR_Director,Plant_Manager,COO,Restructuring_Lead
HUNTER_API_KEY=***   # si se quiere enrichment adicional (email, teléfono)
```

## Run command

```bash
cd /opt/hermes-dossier/apps/dossier-industrial
pnpm exec tsx scripts/scan-linkedin.ts
```

Wrapper:

```bash
/root/.hermes/scripts/scan-linkedin.sh
```

## Cadence

- **Frecuencia**: cada 2 días
- **Hora**: 06:00 UTC (off-peak Google)
- **Día**: impar (1, 3, 5, ...)
- **Timeout**: 45 min (Google delays)

## Output example

```json
{"query":"site:linkedin.com ERE Nestlé España","results":8,"matched":3}
{"match":{"name":"J. García","role":"HR Director","company":"Nestlé España","region":"Madrid","signal_score":0.7,"deimpl_topic":"ERE_speculation"}}
{"match":{"name":"M. López","role":"CFO","company":"Nueva Pescanova","signal_score":0.8,"deimpl_topic":"restructuring"}}
```

## Notas operativas — Compliance

- **LinkedIn ToS**: NO scrapeo de LinkedIn directamente. SOLO Google indexa resultados públicos. Esto es OSINT legal y legítimo.
- **GDPR**: solo datos públicamente visibles. No almacenar emails/teléfono salvo consentimiento explícito.
- **Rate limit**: 1 query / 8s; máximo 20 queries / sesión; cooldown 24h entre escaneos de la misma persona.
- **Honestidad en uso**: el enriquecimiento es INTERNO para que el asesor llegue mejor informado. NO se usa para spam.
- **Logs**: guardar timestamp + query + IP; auditable.

## Aprendizajes

```yaml
pitfalls:
  - "Google 'site:linkedin.com' a veces devuelve resultados de /pulse (artículos), no perfiles"
  - "Resultados en otros idiomas (PT, FR) — filtrar lang=es"
  - "Perfiles privados no aparecen en Google — no intentar scrapeo"
mejoras_pendientes:
  - "Cross-ref con Hunter.io para email corporativo (con consentimiento)"
  - "Scoring de proximidad a ERE confirmado (BOE + LinkedIn = match fuerte)"
  - "Alerta Telegram cuando un CFO/HRD publica sobre desinversión"
```
