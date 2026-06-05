# PLAN MAESTRO v2 — HERMES/Dossier Industrial

> Versión: 2.0 (2026-06-06) · Sucesor de `PLAN-MAESTRO-spec-100.md` v1
> Decisiones durables del usuario integradas: (1) subastas eliminadas, (2) selector global por sector, (3) A&B prioridad #1 cobertura secundaria del resto, (4) plantilla correo Surus con 3 anclajes.
> Modo de ejecución: **execute-to-completion** tras aprobación del plan (instrucción usuario 2026-06-06).

---

## 0. Reglas durables (deben respetarse en cada sprint)

| # | Regla | Origen | Vigente |
|---|---|---|---|
| R-01 | Subastas: ELIMINADAS del plan. No se scrapea Escrapalia, Surplex, TBAuctions, Troostwijk, Maynards, Bidspotter, GoIndustry, Heritage Global, Rabin, ni ninguna otra plataforma de subasta. | Usuario 2026-06-06 | sí |
| R-02 | HERMES solo detecta, NO contacta. El contacto lo hace el equipo comercial Surus. | Memoria durable | sí |
| R-03 | Menú oculto: genera BORRADORES, no envía. | Memoria durable | sí |
| R-04 | NO suscripción Alimarket. | Memoria durable | sí |
| R-05 | NO concursos/subastas como línea de negocio. | Memoria durable | sí |
| R-06 | 0 € presupuesto externo. Solo APIs existentes: DeepSeek, Gemini, Hunter.io, BOE API REST, Google News RSS. | Usuario 2026-06-05 | sí |
| R-07 | DeepSeek = IA primaria. Gemini = secundaria (solo cuando DeepSeek no pueda, ej: navegación web con grounding, multimodal). | Usuario 2026-06-05 | sí |
| R-08 | A&B = prioridad #1 con TODAS las etapas de cadena (primaria → transformación → distribución). Resto de sectores = cobertura secundaria con misma estructura técnica pero menor profundidad de keywords. | Usuario 2026-06-06 | sí |
| R-09 | UI con selector global de sector en navbar: A&B / Energía / Química / Construcción / Banca / Defensa. Cambio 1 click. | Usuario 2026-06-06 | sí |
| R-10 | Plantilla correo Surus: 3 anclajes obligatorios = (a) recuperación contable, (b) servicio integral, (c) compliance/trazabilidad. | Usuario 2026-06-06 (correo anonimizado) | sí |
| R-11 | Tono Surus: formal-cordial, primera frase con contexto de la noticia, cierre con pregunta de 10 min. | Usuario 2026-06-06 | sí |
| R-12 | 80% test coverage mínimo. | Memoria durable | sí |
| R-13 | Sprints atómicos, output conciso, no auto-alabanza. | Memoria durable | sí |
| R-14 | daysBack corto incremental scanning, matchHash idempotency. HERMES = detección temprana, no archivo histórico. | Memoria durable | sí |
| R-15 | REALIDAD.md = single source of truth. | Memoria durable | sí |
| R-16 | NO tocar `/opt/hermes-v2/` (Surus V3, otro sistema). | Memoria durable | sí |
| R-17 | SFTP/SCP via SSH key, nunca `dangerouslyDisableSandbox`. | Memoria durable | sí |
| R-18 | No etiquetar modelo activo. | Memoria durable | sí |
| R-19 | NUNCA escribir a workspace sin protocolo completo HJC (orchestrator → planner → sprint contract → generator → evaluator → code-reviewer/security-reviewer). | Memoria durable (orden suprema 2026-06-03) | sí |

---

## 1. Selector global de sector (Regla R-09)

```
[Navbar HERMES]
   ├─ A&B        ← default ON, cobertura prioritaria
   ├─ Energía    ← cobertura secundaria
   ├─ Química    ← cobertura secundaria
   ├─ Construcción ← cobertura secundaria
   ├─ Banca      ← cobertura secundaria
   └─ Defensa    ← cobertura secundaria
```

El selector aplica a:
- Adapters de ingest (filtra CNAE-4d + keywords)
- Clasificador DeepSeek (ajusta prompt por sector)
- Vista de empresas (filtro por sector)
- Menú oculto (plantilla correo se ajusta al sector)

Sectores **NO** incluidos (out of scope): Agricultura, Minería, Pesca extractiva, Servicios, Hostelería, Retail no alimentario, Logística pura, Telecomunicaciones.

---

## 2. Mapa de dependencias

```
                          ┌─► [S.2 Top-100 A&B + secundario]
                          │                │
                          │                ▼
[S.2 datos] ─────────────►├─► [G.1 Scrapling + adapters INV-1..8]
                          │                │
                          │                ├─► [G.2 Adaptive selectors]
                          │                │
                          │                └─► [G.3 Gemini grounding fallback]
                          │                          │
                          │                          ▼
                          │                       [M.1 EventCluster cross-fuente]
                          │                                 │
                          │                                 ▼
                          │                              [UI.1 Streamlit + sector selector]
                          │                                          │
                          │                                          ▼
                          │                                       [UI.2 Deep Dive empresa]
                          │                                                 │
                          │                                                 ▼
                          │                                              [HIDDEN-1]
                          │
                          └─► [Orch.1 paralelización] (ortogonal)
                                                       │
                                                       └─► [CRM.1 pipeline]
```

**Eliminado de v1**: M.2 (subastas cross-check). Razón: R-01.

**Añadido en v2**: HIDDEN-1 (menú oculto Surus).

---

## 3. Bloque DATOS

### Sprint S.2 — Top-N por sector con priorización A&B

**Objetivo**: obtener la lista curada de empresas objetivo por sector, con foco A&B (todas las etapas de cadena) y cobertura secundaria del resto.

**Decisión arquitectural**: NO scraping de elEconomista (bloqueado por IP VPS persistentemente). Usar **DeepSeek razonamiento + Gemini grounding** para curación semiautomática desde BORME + cuentas anuales + dominio público.

**Deliverables**:
- 33 CNAE-4d A&B mapeados (1011-1107), todos con etiqueta de etapa de cadena:
  - **Primaria**: 1011, 1012, 1013, 1021, 1043, 1061, 1091, 1092
  - **Transformación**: 1022, 1031, 1032, 1039, 1042, 1044, 1052, 1053, 1054, 1071, 1072, 1073, 1081, 1082, 1083, 1084, 1085, 1086, 1089, 1101, 1102, 1103, 1104, 1105, 1106, 1107
  - **Distribución**: (no hay CNAE puro de distribución alimentaria; se cubre con PRENSA sectorial en G.1)
- CNAEs de cobertura secundaria documentados:
  - **Energía**: 3511, 3512, 3513, 3514, 3515, 3516, 3517, 3518, 3519, 3521, 3522, 3523
  - **Química**: 2011, 2012, 2013, 2014, 2015, 2016, 2017
  - **Construcción**: 4110, 4121, 4122, 4211, 4212, 4213, 4221, 4222, 4291, 4299
  - **Banca**: 6411, 6412, 6419, 6420
  - **Defensa**: 2540, 3040, 8010, 8020
- CSV por sector: `pos, cnae_4d, etapa_cadena, nombre, slug, facturacion_eur, provincia, fuente_url, signal_score`

**Success criteria**:
- ≥80 empresas A&B con facturación parseada
- ≥30 empresas por sector secundario
- Cero HTTP 429 sostenido
- CSV con `signal_score` (0-100) calculado por DeepSeek

**Coste**: 0€ (DeepSeek + Gemini grounding existentes).

**Dependencias**: ninguna.

---

## 4. Bloque INGEST — Anti-bot + adapters multi-fuente

### Sprint G.1 — Scrapling sidecar + 6 adapters

**Objetivo**: integrar Scrapling (Python, TLS fingerprint genuino) y desplegar 6 adapters organizados por tipo de fuente.

**Adapters a desplegar** (basados en INV-1..INV-8 del usuario — **7 adapters de ingest + 1 clasificador transversal**):

| # | Adapter | Fuentes | Cobertura | Método principal |
|---|---|---|---|---|
| 1 | `a&b-sectorial.ts` | alimarket.es RSS, revistaaral.com, distriactualidad, efeagro, europapress-agro, mercasa | A&B | RSS público + título trigger |
| 2 | `prensa-generalista.ts` | eldiario.es, publico.es, elconfidencial.com, vozpopuli.com, theobjective.com, okdiario.es | Todos sectores | RSS abierto |
| 3 | `prensa-comarcal.ts` | 60+ medios provinciales/comarcales de INV-3, priorización por densidad de CNAE | A&B + resto | RSS abierto (Alerta, El Correo de Andalucía, Lanza, NacióDigital, etc.) |
| 4 | `boe-borme.ts` | BOE API REST + BORME API REST | Todos sectores | API REST datos abiertos |
| 5 | `agencias-sindicatos.ts` | Europa Press RSS por sección, EFE Agro, CCOO Industria, UGT FICA, Google News RSS booleano | A&B prioritario | RSS |
| 6 | `radios-podcast.ts` | Cadenas SER, COPE, Onda Cero (podcasts locales iVoox) | A&B + resto | RSS podcast |
| 7 | `google-news-rss.ts` | Query booleana por sector | Todos | RSS dinámico |
| T | `clasificador-deepseek.ts` | (transversal a los 7 anteriores) | Todos | DeepSeek API |

**Adapters NO incluidos** (por R-01): ningún adapter de subastas, ni nacionales ni internacionales.

**Deliverables**:
- Sidecar Python FastAPI `/opt/hermes-scrapling/server.py` con `POST /scrape {url, selectors[]}`
- StealthyFetcher activado: TLS fingerprint randomizado, canvas/WebRTC/AudioContext spoofing
- Cliente TS `lib/scrapling/client.ts`
- 6 adapters TS en `lib/adapters/`
- Docker compose actualizado con servicio `scrapling`

**Success criteria**:
- Sidecar <2s p95 para página simple
- Sin HTTP 429 en 100 requests vs elEconomista
- WebRTC leak test: `browserleaks.com/webrtc` → "no leak"
- Canvas fingerprint cambia entre requests
- 6 adapters ejecutan diariamente y vuelcan a `EventRaw` en `hermes_dossier_v6`

**Coste**: 0€ (código abierto).

**Dependencias**: S.2 (datos objetivo para validar stealth).

### Sprint G.2 — Auto-reparación de selectores

**Objetivo**: que el motor guarde huella del primer match y reubique el más cercano ante cambios DOM.

**Deliverables**:
- `lib/scrapling/adaptive-selector.ts` con algoritmo de similarity:
  - Jaccard tokens texto
  - Levenshtein ratio
  - Distancia árbol DOM (ancestros comunes)
  - Score = 0.5·text + 0.3·tree + 0.2·css-class
- Snapshot store en `/var/lib/hermes/selectors/{domain}/{slug}.yaml`
- Hook PostToolUse: si selector primario falla → fallback chain automático

**Success criteria**:
- 1 dominio cambia DOM (test sintético): sistema recupera ≥80% extracciones
- Logs de fallback: `fallback_used: chain[1] | similarity: 0.87`
- p95 con fallback: <3s

**Coste**: 0€.

**Dependencias**: G.1.

### Sprint G.3 — Gemini grounding fallback (NO proxies residenciales)

**Objetivo**: cuando un dominio bloquea IP, el sistema usa Gemini con grounding Google Search como fallback de extracción.

**Cambio crítico vs v1**: v1 proponía proxies residenciales (5-15€/mes, R-06 lo prohíbe). v2 usa **Gemini grounding** que navega "por nosotros" sin exponer IP.

**Deliverables**:
- `lib/scrapling/gemini-fallback.ts`: cuando un adapter recibe HTTP 403/429/503 sostenido, llama a Gemini 2.5 Flash con URL + query específica
- Gemini extrae: `{title, body, fecha, autor, secciones_relevantes}` y lo inyecta al pipeline como si viniera del adapter original
- Caché: si la misma URL ya fue extraída por Gemini, no re-llamar (TTL 24h)
- Fallback chain: adapter nativo → Gemini grounding → evento manual (DeepSeek genera URL candidates desde el contexto)

**Success criteria**:
- 100 requests a elEconomista con adapter nativo: 0% éxito (esperado, baneados).
- Mismos 100 URLs vía Gemini fallback: ≥70% extracción completa.
- Sin fuga de IP real (Gemini navega desde infraestructura Google).
- Coste: $0 (Gemini API key existente, dentro de cuota gratuita).

**Coste**: 0€.

**Dependencias**: G.1 + G.2.

---

## 5. Bloque CLASIFICACIÓN & CORRELACIÓN

### Sprint M.1 — Match entre fuentes + EventCluster

**Objetivo**: fusionar "rumor comarcal detectado hace 15 días + noticia oficial Expansión = 1 sola alerta con severidad elevada".

**Deliverables**:
- Tabla `EventCluster` en `hermes_dossier_v6`:
  - `cluster_id` (uuid), `canonical_event_id` (FK Event)
  - `member_event_ids` (array FK)
  - `severity_score` (0-100)
  - `first_detected_at`, `last_updated_at`, `status` (rumor|confirmado|cerrado)
- Algoritmo `lib/merge/event-matcher.ts`:
  - Mismo CIF empresa + mismo CNAE 4d + ventana 30 días → cluster candidate
  - Embedding semántico (sentence-transformers o DeepSeek embeddings) de `noticia_texto` → coseno ≥ 0.75 → cluster
- Worker diario `merge-events.ts` que re-evalúa clusters y ajusta severity
- UI panel: "Detectado en: 3 fuentes · primera detección 2026-05-12 · severidad 85/100"

**Success criteria**:
- 10 eventos sintéticos (mismo evento, 3 coberturas) → 1 cluster por evento
- Falsos positivos <5%
- Severity: rumor 30-50, confirmado 60-80, cierre efectivo 80-100
- Severidad A&B boost: CNAE ∈ {1011, 1052, 1102, 1105, 1107} (cárnico, helados, vinos, cerveza, aguas) → +20 puntos

**Coste**: 0€ (cómputo local + DeepSeek embeddings).

**Dependencias**: S.2 (datos) + G.1 (scraping consistente).

**Nota**: M.2 (subastas) **ELIMINADO** por R-01. Si en el futuro Surus pide cross-check con activos, se reabre como sprint separado con Escrapalia + cualquier portal ES que el usuario apruebe.

---

## 6. Bloque UI — Estilo Apple + selector global de sector

### Sprint UI.1 — Streamlit + estética Apple HIG + sector selector

**Objetivo**: dashboard con estética Apple (bubble cards, DM Sans local, modo oscuro/claro) + selector global de sector en navbar.

**Decisión arquitectural**: ¿Streamlit (spec) o Next.js refinado? Pendiente de input usuario. Por defecto, **Next.js refinado** (mismo stack, menos fricción de despliegue).

**Deliverables** (asumiendo Next.js, ajustable):
- `app/layout.tsx` con navbar global incluyendo `<SectorSelector />` (R-09)
- `.streamlit/config.toml` o `tailwind.config.ts` con tema adaptativo
- `static/fonts/DM-Sans-*.woff2` local
- `static/css/bubble-cards.css`
- Custom components: `bubble_card`, `timeline_feed`, `kpi_grid`, `decision_hierarchy_tree`
- Cronología estricta: feed central `last_updated_at DESC`, badge "NUEVO" <48h
- Sidebar retráctil: filtros sector, fecha, provincia, gravedad
- Sector selector persiste en cookie + localStorage

**Cambio v1→v2**: añadido `SectorSelector` en navbar, persistencia de selección, todos los componentes respetan `sector` como prop.

**Success criteria**:
- Lighthouse >90 (perf, a11y, best practices)
- First paint <1.5s
- Modo oscuro/claro sin FOUC
- 4 breakpoints (320, 768, 1024, 1440) sin overflow
- Selector sector cambia toda la vista en <300ms

**Coste**: 0€.

**Dependencias**: M.1.

### Sprint UI.2 — Deep Dive: dossier de empresa + matriz de activos

**Objetivo**: vista de empresa con contexto NLP, matriz de activos, decisores, CRM embebido.

**Cambio v1→v2**: eliminada la "matriz de activos" basada en subastas (R-01). En su lugar, **matriz de eventos** con timeline + cross-cluster references.

**Deliverables**:
- Página `/company/[slug]` con tabs:
  - **Contexto NLP** (resumen ejecutivo con separación oficial vs operativa)
  - **Matriz de eventos** (timeline con todos los clusters donde aparece la empresa)
  - **Decisores** (árbol 3 niveles con email Hunter.io + botón copiar)
  - **CRM** (editor markdown + estado prospecto)
- Persistencia en `CompanyNote` y `ProspectState`
- Auto-save con debounce 2s
- Acciones rápidas: marcar como agotado (manual, sin integración subastas), asignar comercial, agendar follow-up

**Success criteria**:
- Notas persisten tras refresh
- Cambio de estado actualiza pipeline
- 1-click copy email
- Auditoría: cada cambio en `CompanyNoteAudit`

**Coste**: 0€.

**Dependencias**: UI.1 + CRM.1.

---

## 7. Bloque MENÚ OCULTO Surus

### Sprint HIDDEN-1 — Menú oculto con plantilla Surus

**Objetivo**: acceso oculto (`Ctrl+Alt+H` o URL directa) que para una empresa+sede seleccionada: busca responsables + resume problema detectado + genera borrador de correo Surus personalizado con los 3 anclajes.

**Razón de existir** (R-02, R-03): HERMES detecta, no contacta. Este menú es el **puente** entre detección y el equipo comercial de Surus, dándoles un borrador listo para revisión humana.

**Arquitectura**:

```
URL: /hidden/[token]/[empresaSlug]/[sedeId]
  Token: sha256(date + SURUS_HIDDEN_SECRET) rotación diaria

Activación:
  - Ctrl+Alt+H en la app
  - URL directa (no indexada, no en navbar)
  - No aparece en sitemap.xml
  - No aparece en robots.txt
  - Auditoría: cada acceso se loggea en `HiddenAccessLog`

Flujo:
  [1] Búsqueda de responsables
       ├─ PlantContact ya existente (matching histórico)
       ├─ Hunter.io /email-finder score≥70
       └─ LinkedIn profile discovery (Gemini grounding como fallback)

  [2] Problema detectado
       ├─ Lee clusters de EventCluster (M.1)
       ├─ Lee CompanyNote histórico
       ├─ Lee ProspectState
       └─ DeepSeek resume: "¿qué le pasa a esta empresa?"
           Output: {resumen_15w, señales_clave, riesgo_principal, ventana_oportunidad}

  [3] Generador de correo (R-10, R-11)
       ├─ DeepSeek temperature 0.85 (tono NO-IA)
       ├─ 3 anclajes obligatorios (validación post-generación):
       │   (a) "ingreso directo" / "recuperación contable" / "liquidez"
       │   (b) "valoración + desmantelamiento + venta" (servicio integral)
       │   (c) "certificado medioambiental" / "trazabilidad" / "sin pasivos"
       ├─ Tono: formal-cordial, "Estimado/a [Nombre]" o "Hola [Nombre]"
       ├─ Primera frase: contexto de la noticia ("Con la reciente confirmación de...")
       ├─ 3 plantillas: primer contacto, seguimiento, cierre
       └─ Validación: si falta algún ancla, regenerar con temperature 0.3

  [4] UI
       ├─ Editor markdown con preview
       ├─ Botones: "Copiar" / "Guardar en CompanyNote" / "Descartar" / "Regenerar"
       ├─ Indicador: "3/3 anclajes presentes ✓" / "⚠ falta ancla compliance"
       └─ Logout oculto: borra token, limpia localStorage
```

**Deliverables**:
- `app/api/hidden/search/route.ts` (responsables)
- `app/api/hidden/diagnostico/route.ts` (problema)
- `app/api/hidden/email-draft/route.ts` (correo)
- `app/hidden/[token]/page.tsx` (UI)
- `lib/ia/responsables-search.ts`
- `lib/ia/diagnostico-empresa.ts`
- `lib/ia/email-surus.ts` (DeepSeek + 3 anclajes + validación)
- `lib/auth/hidden-token.ts` (generación + verificación)
- `lib/audit/hidden-access.ts` (HiddenAccessLog)
- Test fixtures: 5 casos de Surus anonimizados del PDF `docs/raw/surus-dossier.txt`

**Success criteria**:
- Acceso solo con token válido (test: token inválido → 403)
- Búsqueda de responsables devuelve ≥1 contacto con email verificado score≥70
- Diagnóstico de empresa <3s p95
- Correo generado contiene los 3 anclajes (validación regex post-generación)
- 0 envíos automáticos (R-03): siempre "Copiar" o "Guardar", nunca "Enviar"
- Auditoría: cada acceso + cada generación se loggea

**Casos Surus de referencia** (extraídos del PDF `docs/raw/surus-dossier.txt`, 518 líneas): se usarán como fixtures para validar que el prompt DeepSeek genera correos con la estructura real de Surus.

**Coste**: 0€ (DeepSeek + Hunter.io + Gemini existentes).

**Dependencias**: UI.1 + M.1 + casos Surus del PDF.

---

## 8. Bloque CRM

### Sprint CRM.1 — Pipeline view + etiquetas + embudo

**Objetivo**: dashboard como "CRM ligero" con estados de prospecto.

**Deliverables**:
- Tabla `ProspectState`:
  - `state` enum: `prospeccion | contacto_establecido | auditoria_en_curso | desimplantacion_cerrada | descartado`
  - `assigned_to` (FK User), `last_activity_at`, `next_followup_at`
- Vista pipeline: columnas por estado, drag-and-drop
- Métricas: # prospectos por estado, valor estimado pipeline, tiempo medio por estado
- Filtros: comercial, sector, antigüedad
- Etiquetas A&B (si sector=A&B): `carnico | lacteo | aceite | panaderia | conservas | bebidas | otros_AB`

**Success criteria**:
- Drag-and-drop desktop + tablet
- Métricas tiempo real
- Permisos: solo asignado o admin

**Coste**: 0€.

**Dependencias**: UI.1 (base) + auth de usuarios.

---

## 9. Bloque ORQUESTACIÓN

### Sprint Orch.1 — Subagentes paralelos con aislamiento

**Objetivo**: "instancie simultáneamente decenas de procesos de extracción" (spec). Actual: 8 agents en serie.

**Deliverables**:
- Worker pool Python `/opt/hermes-orchestrator/`:
  - Cada agent en proceso aislado (multiprocessing o subprocess)
  - Cola de mensajes (Redis o RabbitMQ) para consolidar
  - Cap concurrencia: 4 agents simultáneos (límite RAM VPS)
- Hermes Agent envuelve el pool con RPC colapsable: `orchestrate({agents: [...]})`
- Telemetría: tiempo/agent, errores, throughput
- UI dashboard de orquestación con progreso

**Success criteria**:
- 8 agents en ≤30 min (vs ~2h serie)
- Sin colisión de contexto
- Si 1 agent falla, los otros 7 completan
- Telemetría exportable a Prometheus

**Coste**: 0€.

**Dependencias**: ninguna (ortogonal).

---

## 10. Resumen de sprints

| Sprint | Bloque | Coste | Duración | Prereq | Estado v2 |
|---|---|---|---|---|---|
| **S.2** | Datos | 0€ | 1 sprint | ninguna | NUEVO (DeepSeek curado, no scrape) |
| **G.1** | Stealth | 0€ | 2 sprints | S.2 | REESCRITO (6 adapters) |
| **G.2** | Stealth | 0€ | 1 sprint | G.1 | igual |
| **G.3** | Stealth | 0€ | 1 sprint | G.1 | REESCRITO (Gemini grounding, NO proxies) |
| **M.1** | Merge | 0€ | 1 sprint | S.2 + G.1 | igual |
| ~~**M.2**~~ | ~~Merge~~ | ~~0€~~ | ~~2 sprints~~ | ~~M.1~~ | **ELIMINADO (R-01)** |
| **UI.1** | UI | 0€ | 2 sprints | M.1 | REESCRITO (sector selector) |
| **UI.2** | UI | 0€ | 1 sprint | UI.1 + CRM.1 | REESCRITO (matriz eventos, no subastas) |
| **HIDDEN-1** | Menú Surus | 0€ | 2 sprints | UI.1 + M.1 | NUEVO |
| **CRM.1** | CRM | 0€ | 1 sprint | UI.1 | igual |
| **Orch.1** | Orch | 0€ | 2 sprints | ninguna | igual |

**Total**: 11 sprints · ~14 sprints-unidad · **coste monetario: 0€** (R-06).

---

## 11. Decisiones pendientes (input usuario antes de S.2)

1. **UI.1**: ¿Next.js refinado o pivotar a Streamlit (spec exige)?
2. **G.1 casos Surus**: ¿puedo procesar el PDF `docs/raw/surus-dossier.txt` ya (518 líneas) para extraer casos anonimizados como fixtures de HIDDEN-1?
3. **S.2 ventana de detección**: ¿"Top-100 con facturación reportada en BORME/cuentas anuales últimos 3 años" o ampliar a Top-200?

---

## 12. Modo de ejecución post-aprobación

Una vez aprobado este plan, la ejecución procede **de inicio a fin** (instrucción usuario 2026-06-06):
- Sprints se ejecutan en orden de dependencias.
- Cada sprint arranca con sprint contract explícito.
- Cada sprint termina con evaluator PASS + commit.
- El usuario NO es interrumpido para validación sprint a sprint salvo:
  - **Decisiones pendientes (sección 11) que bloqueen ESE sprint en concreto** (ej: UI.1 no puede arrancar sin decidir Next.js vs Streamlit). En ese caso, **se pregunta y se continúa** sin esperar validación global.
  - Evaluator FAIL con issue CRITICAL/HIGH que requiera re-planificación.
  - Cualquier coste >0€ no autorizado.
  - Cualquier acción destructiva (rm -rf, push --force, drop database) o externamente visible (público, emails, PRs).

Las decisiones de sección 11 que **no bloquean** un sprint se resuelven con default razonable documentado (ej: "Next.js refinado" para UI.1 si el usuario no contesta antes de S.2+UI.1).

---

## 13. Anexo: casos Surus anonimizados (extraídos de PDF)

Esta sección se llenará durante el sprint HIDDEN-1 leyendo `docs/raw/surus-dossier.txt`. Cada caso Surus validado se añade como fixture de test.

(Reservado. 0 entradas al cierre de v2.)

---

**Fin PLAN-MAESTRO v2. Pendiente de aprobación del usuario para arrancar sprint S.2.**
