---
name: surus-agente-sectorial
description: Agente de detección de desimplantación industrial en PRENSA SECTORIAL alimentaria. Scrapea medios especializados (Alimarket, IAlimentos, Distribución Actualidad, HostelVending, TecnoPymes Food, etc.) y publicaciones técnicas de los 10 subsectores A&B. Complementa a newsrooms corporativos con análisis editorial sectorial. Filtra SOLO señales de desimplantación (cierre, ERE, desinversión, fin de línea).
triggers:
  - "Scrapear prensa sectorial alimentaria"
  - "Detectar cierres en Alimarket / IAlimentos / Distribución Actualidad"
  - "Correr agente sectorial HERMES"
  - "Cron de prensa especializada A&B"
  - "Survey editorial sector alimentario"
tools_required:
  - terminal
  - file
sector: alimentacion_bebidas
version: "1.0"
last_updated: "2026-06-02"
related_skills:
  - surus-agente-newsrooms
  - surus-dossier
  - surus-dominio
  - surus-activos
---

# SURUS — Agente Prensa Sectorial A&B

## Identidad

- **ID**: `surus-agente-sectorial`
- **Tipo**: Detección de oferta (desimplantación circular)
- **Dominio**: Prensa sectorial especializada en A&B
- **País**: ES
- **Audiencia**: Departamento comercial Surus
- **Método**: HTTP/cheerio + Playwright fallback (muchos medios usan paywalls ligeros)
- **Prioridad**: P2 (complementa newsrooms; análisis editorial sectorial)
- **Cadencia**: cada 2 días
- **Estado**: activo

## Scope: SOLO Desimplantación

**Positivas (mismas 6 categorías que newsrooms):**
- `asset_release`, `plant_closure`, `line_closure`, `ERE`, `divestment`, `decommissioning`

**Negativas (penalty -0.6):**
- M&A, fusiones, adquisiciones
- Concurso de acreedores
- Subastas
- Nuevas aperturas / inversión greenfield

**Diferencia con newsrooms:** aquí el lenguaje es **editorial y analítico**, no corporativo. Buscar términos como "fuentes del sector confirman", "según ha podido saber...", "en exclusiva".

## Keywords sectoriales (ES)

```
cierre, cierre definitivo, cierre temporal, cierre patronal, cierre de línea,
ERE, ERE extintivo, regulación de empleo, despido colectivo, expediente,
desinversión, venta de activos, venta de planta, venta de fábrica,
desmantelamiento, desinversión de marca, salida del mercado español,
reestructuración, ajuste de plantilla, baja producción, parada de línea,
concentración de producción, deslocalización, externalización cierre
```

**Medios objetivo** (10 subsectores A&B):
- Cárnico: Alimarket Cárnico, Eurocarne
- Lácteo: Alimarket Lácteo, Lácteos y derivados
- Bebidas: Alimarket Bebidas, HostelVending
- Distribución: Distribución Actualidad, IAlimentos
- Horeca: Restauración News, Foodservice
- Panadería/Bollería: Pan y Pastas
- Conservas: IAlimentos, TecnoPymes
- Aceites: Mercacei, Oleo
- Vinos: Tecnovino, Vinetur
- General: Alimarket, TecnoPymes, IPMARK Food

## Procedimiento

1. Cargar la lista de ~30 medios sectoriales desde `ScanConfig.kind='sectorial'`
2. **HTTP/cheerio** primario (muchos son open access)
3. **Playwright** para medios con lazy-loading o paywall ligero
4. Extraer: `{ url, title, publishedAt, content, contentHash, outlet, outletType='sector' }`
5. **Filtrar** con keywords + descartar editoriales/columnas de opinión
6. **Insertar** en `Source` con `outletType='sector'`
7. **Cruzar** con newsrooms para evitar duplicados (mismo evento, dos fuentes)
8. **Log** stats por outlet

## Variables de entorno

```bash
DATABASE_URL=postgresql://surus:***@127.0.0.1:5432/hermes_dossier
MAX_PER_SOURCE=15
ONLY_SLUGS=                       # CSV debug
```

## Run command

```bash
cd /opt/hermes-dossier/apps/dossier-industrial
pnpm exec tsx scripts/scan-sectorial.ts
```

Wrapper:

```bash
/root/.hermes/scripts/scan-sectorial.sh
```

## Cadence

- **Frecuencia**: cada 2 días
- **Hora**: 04:00 UTC
- **Día**: impar (1, 3, 5, ...)
- **Timeout**: 30 min

## Output example

```json
{"outlet":"alimarket","items":12,"matched":3,"inserted":2,"elapsed_ms":23410}
{"outlet":"distribucion_actualidad","items":8,"matched":1,"inserted":1,"deimpl":"ERE","title":"..."}
{"outlet":"hostelvending","items":5,"matched":0,"inserted":0,"reason":"only_opinion_pieces"}
```

## Notas operativas

- **Paywalls**: muchos medios tienen paywall suave (3-5 artículos free/mes). Respetar.
- **Idioma**: ES únicamente
- **Antidetección**: User-Agent dedicado + delays 1.5-3s entre requests
- **Dedup**: `contentHash` + URL canonicalizada
- **Calidad > cantidad**: editorial sectorial es slow news; preferir 1 señal de calidad a 10 débiles

## Aprendizajes

```yaml
pitfalls:
  - "Alimarket requiere JS para cargar el listado — usar Playwright"
  - "HostelVending tiene secciones mezcladas (noticias + directorio)"
  - "Columnas de opinión contaminan el feed — descartar autor != redacción"
mejoras_pendientes:
  - "Scoring LLM para distinguir 'rumor' de 'confirmado'"
  - "Tracking de periodistas sectoriales TOP (alertas de nuevos artículos)"
```
