---
name: surus-agente-boe-bop
description: Agente de detección de desimplantación en BOLETINES OFICIALES (BOE estatal + 17 BOP autonómicos/provinciales) y comunicaciones de SINDICATOS (CCOO, UGT, USO). Filtra SOLO ERE, cierres oficiales, desinversiones y regulatorios de empleo. EXCLUYE concursos de acreedores y subastas (out of scope de Surus). Cubre el 100% de la regulación oficial pública del territorio español.
triggers:
  - "Scrapear BOE y BOP autonómicos"
  - "Detectar ERE oficiales en boletines"
  - "Correr agente BOE/BOP HERMES"
  - "Cron de regulación oficial"
  - "Survey sindicatos A&B"
tools_required:
  - terminal
  - file
sector: alimentacion_bebidas
version: "1.0"
last_updated: "2026-06-02"
related_skills:
  - surus-agente-newsrooms
  - surus-agente-prensa
  - surus-dossier
  - surus-dominio
---

# SURUS — Agente BOE / BOP / Sindicatos

## Identidad

- **ID**: `surus-agente-boe-bop`
- **Tipo**: Detección de oferta + validación regulatoria
- **Dominio**: Boletines oficiales (BOE + 17 BOP) + sindicatos
- **País**: ES
- **Audiencia**: Departamento comercial Surus + validación cruzada
- **Método**: API BOE (REST XML/JSON) + HTTP BOP + HTTP sindicatos
- **Prioridad**: P1 (PRIMARY source regulatoria — confirma lo que prensa dice)
- **Cadencia**: cada 2 días
- **Estado**: activo

## Scope: REGULACIÓN OFICIAL de desimplantación

A diferencia de newsrooms y prensa, aquí la **VALIDEZ JURÍDICA** es lo que importa. Lo que entra en BOE/BOP es **confirmado oficialmente**.

**Positivas:**
- `ERE` (comunicación oficial de inicio, resolución, sentencia)
- `cierre patronal` (regulado en BOE)
- `desinversión` (anuncio en sección "Otros avisos")
- `liquidación de empresa` (fase previa al cierre)
- `ERE suspensivo` (precursor; mantener como señal media)
- `ERE extintivo` (CRÍTICO — suele preceder cierre 1-3 meses)

**Negativas — EXCLUIDAS DEL SCOPE Surus:**
- **Concurso de acreedores** (el cliente actual no es broker)
- **Subastas judiciales / notariales / BOE**
- **Licitaciones / concursos públicos** (Surus NO licita)
- **Modificaciones de estatutos** (sin impacto operativo)
- **Disoluciones de SL** sin empleados (>99% son shell companies)

## Keywords oficiales

```
expediente de regulación de empleo, ERE extintivo, ERE suspensivo,
despido colectivo, cierre de centro de trabajo, cierre de empresa,
despido objetivo, procedimiento concursal, [EXCLUIDO] concurso de
acreedores, [EXCLUIDO] subasta, transmisión de empresa, sucesión de
empresa, traslado de centro, deslocalización, regulación de empleo
de [empresa]
```

**Filtros de CNAE:** 10 (Industria de la alimentación) + 11 (Fabricación de bebidas) + anexos vinculados (46.3 distribución alimentaria mayorista).

## Fuentes

### BOE (https://boe.es)
- Endpoint búsqueda: `https://www.boe.es/buscar/boe.php`
- API JSON: `https://www.boe.es/datosabiertos/api/boe/sumario/YYYYMMDD`
- No requiere API key (es open data)
- Rate limit: 60 req/hora (estimado)

### BOP autonómicos/provinciales (17)
- Andalucía: `https://www.juntadeandalucia.es/eboja`
- Aragón: `http://www.boa.aragon.es`
- Asturias: `https://sede.asturias.es/bopa`
- Baleares: `https://www.caib.es/eboibfront`
- Canarias: `http://www.boc.canarias.es`
- Cantabria: `https://boc.cantabria.es`
- CLM: `https://docm.jccm.es`
- CyL: `https://bocyl.jcyl.es`
- Cataluña: `https://dogc.gencat.cat`
- C. Valenciana: `https://dogv.gva.es`
- Extremadura: `http://doe.juntaex.es`
- Galicia: `https://www.xunta.gal/dog`
- La Rioja: `https://web.larioja.org/bor`
- Madrid: `https://bocm.es`
- Murcia: `https://www.borm.es`
- Navarra: `https://bon.navarra.es`
- País Vasco: `https://www.euskadi.eus/bopv`

### Sindicatos (webs oficiales)
- CCOO Industria: `https://industria.ccoo.es` (notas de prensa)
- UGT FICA: `https://www.ugtfica.es` (notas de prensa)
- USO: `https://www.uso.es` (sector industria)
- ELA (País Vasco): `https://www.ela.eus`
- LAB (País Vasco/Navarra): `https://www.lab.eus`
- CGT: `https://www.cgt.es`

## Procedimiento

1. **BOE**: GET al sumario del día → filtrar secciones relevantes (Sec. V "Anuncios" + Sec. III "Otras disposiciones")
2. **BOP**: HTTP al homepage del día → buscar por término "ERE" + nombre empresa (top 50 A&B) + CNAE 10+11
3. **Sindicatos**: HTTP/cheerio a notas de prensa → matchear empresas
4. Extraer: `{ url, title, publishedAt, content, contentHash, outlet, outletType, bofficialSection }`
5. **Filtrar**: ERE/cierre/ERE extintivo/ERE suspensivo en ES
6. **DESCARTAR**: concursos de acreedores, subastas
7. **Insertar** con `outletType='bofficial' | 'syndicate'`
8. **Cruzar** con `Operation` y `Plant` por nombre normalizado de empresa
9. **Log** stats por boletín

## Variables de entorno

```bash
DATABASE_URL=postgresql://surus:***@127.0.0.1:5432/hermes_dossier
MAX_PER_SOURCE=15
ONLY_SLUGS=
BOE_DATE_FROM=YYYY-MM-DD         # default: hoy - 2 días
BOE_DATE_TO=YYYY-MM-DD           # default: hoy
```

## Run command

```bash
cd /opt/hermes-dossier/apps/dossier-industrial
pnpm exec tsx scripts/scan-boe-bop.ts
```

Wrapper:

```bash
/root/.hermes/scripts/scan-boe-bop.sh
```

## Cadence

- **Frecuencia**: cada 2 días
- **Hora**: 04:00 UTC
- **Día**: par (2, 4, 6, ...)
- **Timeout**: 30 min

## Output example

```json
{"source":"boe","section":"V","items":42,"matched":3,"ere_count":2,"closure_count":1}
{"source":"dogc","ccaa":"CT","items":18,"matched":1,"deimpl":"ERE extintivo","empresa":"Piensos del Vallès"}
{"source":"ccoo_industria","items":7,"matched":2,"reason":"official_union_communique"}
```

## Notas operativas

- **Concursos y subastas**: doble filtro (keywords exclusion + scoring -0.6)
- **ERE en BOE suele aparecer 7-15 días después del hecho**: scoring temporal importante
- **BOP autonómicos tienen formatos MUY distintos**: cada scraper es bespoke
- **Sindicatos publican ANTES del BOE**: usar como early warning
- **Validación cruzada**: si prensa + BOE coinciden → score alto
- **Falsos positivos**: "ERE" aparece en secciones de jurisprudencia; filtrar por sección "Anuncios" / "Otros"

## Aprendizajes

```yaml
pitfalls:
  - "BOP CyL y BOCan son los más difíciles técnicamente (PDFs)"
  - "Sindicatos publican la MISMA nota en estatal + autonómica (dedup)"
  - "Concurso de acreedores contamina el feed (filtro estricto)"
mejoras_pendientes:
  - "OCR de PDFs escaneados en BOP antiguos"
  - "Cross-ref con `Operation.legalReference` cuando se confirma"
  - "Telegram alert inmediato para ERE extintivo confirmado en BOE"
```
