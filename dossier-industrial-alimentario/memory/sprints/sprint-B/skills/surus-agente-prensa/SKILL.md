---
name: surus-agente-prensa
description: Agente de detección de desimplantación industrial en PRENSA GENERAL + REGIONAL + LOCAL de las 17 CCAA españolas. Cubre cabeceras nacionales (El País, El Mundo, ABC, La Vanguardia), autonómicas (El Periódico, La Voz de Galicia, Deia, etc.) y locales/comarcales. Filtra SOLO señales de desimplantación territorial con geolocalización (region, province, ccaa). Complementa a newsrooms y sectorial.
triggers:
  - "Scrapear prensa general / regional / local"
  - "Detectar cierres de plantas por comunidad autónoma"
  - "Correr agente de prensa HERMES"
  - "Cron de prensa generalista"
  - "Survey territorial desimplantación"
tools_required:
  - terminal
  - file
sector: alimentacion_bebidas
version: "1.0"
last_updated: "2026-06-02"
related_skills:
  - surus-agente-newsrooms
  - surus-agente-sectorial
  - surus-dossier
  - surus-dominio
---

# SURUS — Agente Prensa General + Regional + Local

## Identidad

- **ID**: `surus-agente-prensa`
- **Tipo**: Detección de oferta (desimplantación circular)
- **Dominio**: Prensa generalista, regional y local
- **País**: ES (17 CCAA)
- **Audiencia**: Departamento comercial Surus
- **Método**: RSS-first → HTTP/cheerio
- **Prioridad**: P2 (validación territorial, geolocalización)
- **Cadencia**: cada 2 días
- **Estado**: activo

## Scope: Desimplantación con LOCALIZACIÓN

A diferencia de newsrooms (que a veces omiten el territorio), aquí el **municipio/provincia/CCAA** es CRÍTICO porque:
- Determina viabilidad logística de Surus
- Activa alertas para el depto. comercial por zona
- Permite cruzar con `Plant.region` y `Plant.province`

**Positivas:** mismas 6 categorías (asset_release, plant_closure, line_closure, ERE, divestment, decommissioning)

**Negativas:** M&A (-0.6), concurso/subasta, expansión greenfield, ERE suspensivo (temporal)

## Keywords con dimensión territorial

```
cierre fábrica [municipio], cierre planta [provincia], ERE [empresa] [CCAA],
despidos [sector] [localidad], deslocalización desde [CCAA], cierre de la
fábrica de [empresa] en [localidad], desinversión en [provincia], ... 
```

**También patrones regulatorios:**
- "aprobado el ERE" / "presentado el ERE" / "negociación del ERE"
- "concentración de producción" / "centralización" / "reagrupamiento"
- "sin acuerdo" / "desconvocada la huelga" (preludio de cierre)

## Cobertura territorial (17 CCAA + Ceuta/Melilla)

- **Nacional**: El País, El Mundo, ABC, La Vanguardia, RTVE, EFE
- **Andalucía**: Diario de Sevilla, Málaga Hoy, Huelva Información, Ideal
- **Aragón**: Heraldo de Aragón, El Periódico de Aragón
- **Asturias**: La Nueva España, El Comercio
- **Baleares**: Última Hora, Diario de Mallorca
- **Canarias**: Canarias7, La Provincia, Diario de Avisos
- **Cantabria**: El Diario Montañés
- **CLM**: La Tribuna, Lanza, ABC CLM
- **CyL**: El Norte de Castilla, Diario de León, Diario de Burgos
- **Cataluña**: La Vanguardia, El Periódico, Ara, Regió7
- **C. Valenciana**: Las Provincias, La Razón CV, Información Alicante
- **Extremadura**: Hoy, El Periódico Extremadura
- **Galicia**: La Voz de Galicia, Faro de Vigo, El Progreso
- **La Rioja**: La Rioja, Diario La Rioja
- **Madrid**: El País Madrid, Madrid Actual
- **Murcia**: La Verdad, La Opinión de Murcia
- **Navarra**: Diario de Navarra, Diario de Noticias
- **País Vasco**: Deia, El Correo, Gara

**Local/comarcal**: rotativos locales (mínimo 3 cabeceras por provincia con CNAE 10+11 importante)

## Procedimiento

1. Cargar ~80 cabeceras desde `ScanConfig.kind='prensa'`
2. **RSS-first** (la mayoría de prensa general tiene RSS)
3. **HTTP/cheerio** para index de últimas semanas
4. Extraer: `{ url, title, publishedAt, content, contentHash, outlet, outletType, region, province, ccaa }`
5. **NERC** (Named Entity Recognition) ligero para detectar:
   - Empresa (cruzar con tabla `Company`)
   - Municipio / Provincia / CCAA
6. **Filtrar** con keywords + descartar opinión / columna / viñeta
7. **Insertar** en `Source` con `outletType='nacional' | 'regional' | 'local'`
8. Si la empresa matchea una `Company` de la DB, linkear vía `ArticleCompany`
9. **Log** stats por CCAA

## Variables de entorno

```bash
DATABASE_URL=postgresql://surus:***@127.0.0.1:5432/hermes_dossier
MAX_PER_SOURCE=12
ONLY_SLUGS=
```

## Run command

```bash
cd /opt/hermes-dossier/apps/dossier-industrial
pnpm exec tsx scripts/scan-prensa.ts
```

Wrapper:

```bash
/root/.hermes/scripts/scan-prensa.sh
```

## Cadence

- **Frecuencia**: cada 2 días
- **Hora**: 02:00 UTC
- **Día**: par (2, 4, 6, ...)
- **Timeout**: 45 min (muchas fuentes)

## Output example

```json
{"outlet":"heraldo_aragon","ccaa":"AR","items":18,"matched":2,"inserted":2}
{"outlet":"la_voz_galicia","ccaa":"GA","items":14,"matched":1,"inserted":1,"deimpl":"plant_closure","loc":"Vigo"}
{"outlet":"el_pais_nacional","ccaa":"MD","items":22,"matched":3,"inserted":2}
```

## Notas operativas

- **Geocoding**: usar regex simple para CCAA/prov/municipio. El 80% están en el texto.
- **Empresa matching**: lista de ~50 grandes A&B + heurística de mayúsculas consecutivas
- **Idioma**: ES únicamente; descartar co-oficial (CA, GL, EU) solo si el artículo no tiene versión ES
- **Antidetección**: 1.5s entre requests; rotación de proxies NO necesaria (no somos scraping masivo)

## Aprendizajes

```yaml
pitfalls:
  - "El País y El Mundo tienen paywall parcial — no scrapeamos premium"
  - "Prensa local comarcal: webs caseras, sin RSS — HTTP-only"
  - "Sesgo de Madrid-capital: vigilar desbalance CCAA"
mejoras_pendientes:
  - "Integrar API oficial de BOE para desambiguar ERE 'presentado' vs 'aprobado'"
  - "NER con spaCy ES para empresa + municipio"
  - "Alertas Telegram por CCAA (no solo depto. central)"
```
