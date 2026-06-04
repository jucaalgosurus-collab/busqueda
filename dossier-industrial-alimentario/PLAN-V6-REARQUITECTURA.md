# HERMES Dossier — Plan de Acción v6 (Re-arquitectura desde cero)

**Fecha**: 2 de junio de 2026
**Estado**: PROPUESTA — pendiente aprobación del usuario
**Autor**: HJC Generator (Juan Carlos Alvarado | Grupo Surus)

---

## 0. Contexto y feedback del usuario (verbatim)

> "estan trabajando en esto todas las habilidades y el harnes director??? es una puta basura lo que hiciste. 1 mira el otro dash que habias creado cuanta informacion tiene, todos los links funcionan, mira todo lo que buscaste https://surusclientes.vercel.app/ te doy ejemplos para que lo mires. otra cosa cuando buscas contactos tienes que hacerlo mejor, como se es el representante de esa planta en especifico?? realmente una puta basura de trabajo. de que te sirve buscar tanto si luego lo que vas a hacer el esto. Para la primera corrida del programa vas a buscar noticias de hace 15 dias, luego vas a buscar de solo dos dias. Si hay alguna planta que ya tiene alguna noticia debes ir actualizandola. Debo poder editar, poner notas, eliminar datos. Debes colocar imagenes, los links de la fuente, pdf si hubiese. La verdad decepcionante tu trabajo."

> "por cierto en el dossier toma toda la informacion del que tienes, pero amplia la investigacion de los contactos en redes sociales buscando los correos. RECUERDA estas copañias tienen muchas plantas y la busqueda de los contactos debe ser totalmente precisa en cuanto a persona y instalacion"

> "genera el plan de accion"

### Decisiones confirmadas (AskUserQuestion)

1. **Dirección**: Re-arquitecturar de cero.
2. **Auth**: Sin auth, todo abierto.
3. **Backfill**: 15 días solo en la primera ejecución.
4. **Template**: Replicar estructura legacy 1:1.

### Lo que el usuario quiere (decodificado)

- **Información rica por empresa** (legacy 1:1): KPIs, mapa de plantas, inventario técnico con modelos+specs, cronología, desglose financiero, verificación de subastas, fuentes verificables con links, contactos con LinkedIn+email+teléfono+notas, PDFs.
- **Contactos precisos por planta concreta, no solo por empresa**: cuando se busca "Director de planta de Gurb (Pascual)" debe devolver la persona que ES director de ESA planta, no cualquier director de Pascual.
- **Investigación de contactos ampliada en redes sociales + correos**: usar LinkedIn (con Google site:) + Hunter.io + scrapers específicos por planta.
- **Primera corrida**: backfill 15 días. Siguientes: 2 días.
- **Plantas con noticias previas**: actualizar incrementalmente, no duplicar.
- **CRUD abierto**: editar/poner notas/eliminar datos, todo sin auth.
- **Assets visuales**: imágenes, links a fuentes, PDFs.

---

## 1. Producto final (lo que el usuario va a ver)

Una **plataforma web** en `https://88-198-93-52.nip.io/dossier/` con 7 vistas + el legacy preservado:

| Vista | Función | Estado v6 |
|---|---|---|
| `/` Dashboard | KPIs globales, top empresas con más movimiento, calendario de eventos | **Reconstruido** |
| `/empresas` | Listado con logo + KPIs + estado | **Reconstruido** |
| `/empresas/[slug]` ⭐ | Réplica 1:1 del legacy: hero, KPIs, plantas, inventario, cronología, finanzas, subastas, fuentes, contactos por planta, documentos, notas editables | **Reconstruido desde cero** |
| `/hallazgos` | Búsqueda FTS + filtros + export CSV | Mantenido (mejoras) |
| `/eventos` | Calendario | Mantenido |
| `/contactos` ⭐ | Listado de decisores con filtros por planta+rol+empresa, export CSV | **Reconstruido** |
| `/mocr` | Upload de placas/certificados | Mantenido (Sprint 5) |
| `/agentes` | Estado de los 5 agentes + cadencia configurable | **Mejorado** con cadencia 2-tier |
| `/legacy` | Presentación interactiva | Mantenido |

---

## 2. Decisión de stack (sin cambios — todo en VPS HERMES)

```
VPS 88.198.93.52 (Ubuntu 22.04)
├── apps/dossier-industrial/        # Next.js 15 standalone
├── data/postgres/                  # PostgreSQL 18 + pg_trgm + tsvector
├── data/uploads/                   # PDFs + imágenes por empresa
└── deploy/
    ├── nginx.conf
    └── systemd/hermes-scan-*.{service,timer}
```

**Stack**: Next.js 15 + Prisma 5 + PostgreSQL 18 + pnpm 11 + cheerio + rss-parser + Playwright + Gemini Vision + Hunter.io.

---

## 3. Nuevo schema Prisma (modelo rico legacy 1:1)

```prisma
// Empresas: cabecera con KPIs
model Company {
  id            String    @id @default(cuid())
  slug          String    @unique
  name          String
  cif           String?   @unique
  sector        String    // 'Alimentacion' | 'Bebidas'
  subsector     String
  cnae          String
  parentGroup   String?   // Matriz (AB Foods, Grupo Damm, etc.)
  hqCity        String?
  hqRegion      String?
  website       String?
  logoUrl       String?
  heroImageUrl  String?

  // KPIs globales
  facturacionM     Float?
  facturacionYear  Int?
  ebitdaM          Float?
  beneficioNetoM   Float?
  deudaNetaM       Float?
  empleadosTotal   Int?

  // Tier / prioridad
  tier          String    @default('A')  // 'A' | 'B'
  status        String    @default('active')  // 'active' | 'inactive'

  // Audit
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastScannedAt DateTime?

  plants        Plant[]
  sources       Source[]
  operations    Operation[]
  financials    Financial[]
  notes         Note[]
  documents     Document[]

  @@index([sector, subsector])
  @@index([tier, status])
}

// Plantas: ubicación + estado + planta_id FK para contactos
model Plant {
  id            String    @id @default(cuid())
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  name          String    // 'Alovera', 'Aldaia', 'Gurb', 'Sabón', 'Morás', 'La Bañeza', etc.
  ccaa          String    // 'Galicia', 'Madrid', 'Cataluña', etc.
  province      String?
  city          String?
  address       String?
  lat           Float?
  lng           Float?

  status        String    // 'operativa' | 'en_inversion' | 'en_desmantelamiento' | 'cerrada' | 'vendida' | 'en_proyecto' | 'en_conversion'
  specialty     String?   // 'Leche UHT', 'Agua mineral', 'Azúcar', 'Cerveza', 'Pescado congelado'
  employees     Int?
  parcelaM2     Float?
  naveM2        Float?

  closureYear   Int?
  investmentMEur Float?
  notes         String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  inventory     TechnicalInventory[]
  contacts      PlantContact[]
  events        TimelineEvent[]
  documents     Document[]
  operations    Operation[]

  @@unique([companyId, name])
  @@index([status])
  @@index([ccaa])
}

// Contactos ASIGNADOS A PLANTA (no solo a empresa) — esto es lo crítico
model PlantContact {
  id            String    @id @default(cuid())
  plantId       String
  plant         Plant     @relation(fields: [plantId], references: [id], onDelete: Cascade)
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id])

  fullName      String
  role          String    // 'Director de Planta', 'Director de Operaciones', 'CEO', etc.
  roleCategory  String?   // 'plant_manager' | 'coo' | 'cfo' | 'ceo' | 'procurement' | 'sustainability' | 'maintenance' | 'ere_responsible' | 'other'

  // Datos de contacto (enriquecidos)
  linkedinUrl   String?
  email         String?
  emailVerified Boolean   @default(false)
  hunterId      String?
  phone         String?

  // Origen y confianza
  sourceUrl     String?   // URL donde se encontró la persona
  sourceOutlet  String?   // 'LinkedIn', 'El País', 'Hunter.io', 'El Periódico'
  confidence    Float     @default(0.5)  // 0-1
  lastEnrichedAt DateTime?
  notes         String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([plantId])
  @@index([companyId, roleCategory])
  @@index([linkedinUrl])
  @@index([emailVerified])
}

// Inventario técnico: brand + model + specs + estado
model TechnicalInventory {
  id            String    @id @default(cuid())
  plantId       String
  plant         Plant     @relation(fields: [plantId], references: [id], onDelete: Cascade)

  category      String    // 'linea_produccion' | 'caldera' | 'sistema_almacenaje' | 'envasado' | 'refrigeracion' | 'logistica' | 'co_generacion' | 'packaging' | 'molino' | 'horno'
  brand         String?   // 'GEA', 'WEG', 'Krones', 'Linde', 'HoloLens', 'Magnon/Ence'
  model         String?   // 'MSA 90-01-076', 'Dynamics 365', 'Frame 5'
  specs         String?   // '2 calderas 10 MWt', '70 Tm/día', '85K → 120K t/año'
  quantity      Int?
  status        String    // 'operativo' | 'a_sustituir' | 'liberado' | 'desmantelado' | 'vendido' | 'en_uso'

  releaseWindow String?   // 'Q2 2026', '2027', '2do sem 2026'
  estimatedValueEur Float?
  source        String?
  notes         String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([plantId, status])
  @@index([category, brand])
}

// Operaciones: tipo, monto, status, descripción
model Operation {
  id            String    @id @default(cuid())
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  plantId       String?
  plant         Plant?    @relation(fields: [plantId], references: [id])

  type          String    // 'plant_closure' | 'line_closure' | 'ERE' | 'plant_sale' | 'relocation' | 'investment' | 'divestment' | 'biomass_plant' | 'warehouse' | 'decommissioning'
  title         String
  description   String?
  amountMeur    Float?
  announcedAt   DateTime
  status        String    // 'announced' | 'in_negotiation' | 'in_execution' | 'executed' | 'cancelled'
  confidence    Float     @default(0.7)
  sourceUrl     String?
  sourceOutlet  String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  events        TimelineEvent[]

  @@index([companyId, type])
  @@index([plantId])
  @@index([announcedAt])
}

// Cronología: eventos datados
model TimelineEvent {
  id            String    @id @default(cuid())
  plantId       String?
  plant         Plant?    @relation(fields: [plantId], references: [id])
  operationId   String?
  operation     Operation? @relation(fields: [operationId], references: [id])
  companyId     String

  date          DateTime
  title         String
  description   String?
  impact        String?
  sourceUrl     String?

  createdAt     DateTime  @default(now())

  @@index([companyId, date])
  @@index([plantId, date])
}

// Datos financieros: inversiones con desglose
model Financial {
  id            String    @id @default(cuid())
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  year          Int
  concept       String    // 'Almacén automatizado Alovera', 'Planta biomasa', 'Modernización 2022', 'Ampliación capital 283M€'
  amountMeur    Float
  category      String?   // 'investment' | 'divestment' | 'capital_increase' | 'debt_restructuring' | 'impairment'
  plantId       String?
  sourceUrl     String?
  notes         String?

  createdAt     DateTime  @default(now())

  @@index([companyId, year])
}

// Fuentes con URL clickeable y tipo
model Source {
  id            String    @id @default(cuid())
  companyId     String?
  company       Company?  @relation(fields: [companyId], references: [id])

  url           String    @unique
  title         String
  outlet        String
  outletType    String    // 'nacional' | 'regional' | 'local' | 'sector' | 'corporate_newsroom' | 'bofficial' | 'syndicate' | 'linkedin'
  language      String    @default('es')
  publishedAt   DateTime?
  scrapedAt     DateTime  @default(now())
  contentHash   String?

  // Deimplantation filter
  deimplantationSignal Boolean @default(false)
  outOfScopeReason     String?
  isStale              Boolean @default(false)

  // FTS (trigger-based)
  contentText   String?
  contentTsv    Unsupported("tsvector")?

  @@index([companyId, publishedAt])
  @@index([outletType])
  @@index([deimplantationSignal])
}

// Verificación de subastas por plataforma
model AuctionCheck {
  id            String    @id @default(cuid())
  companyId     String
  companyName   String
  platform      String    // 'Escrapalia', 'Surplex', 'Troostwijk', 'GUTINVEST', 'HGP', 'Apex', 'CFT', 'Industrial Auctions', 'Machineryline'
  result        String    // 'sin_activos' | 'activos_detectados' | 'historial' | 'no_verificado'
  details       String?
  checkedAt     DateTime  @default(now())

  @@index([companyId, platform])
}

// Documentos: PDFs (EINF 2025) e imágenes (logo, hero, planta)
model Document {
  id            String    @id @default(cuid())
  companyId     String?
  company       Company?  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  plantId       String?
  plant         Plant?    @relation(fields: [plantId], references: [id], onDelete: Cascade)

  kind          String    // 'pdf' | 'logo' | 'hero' | 'plant_photo' | 'nameplate' | 'certificate' | 'balance_sheet' | 'photo'
  fileUrl       String    // ruta local o URL
  fileName      String
  fileSize      Int?
  mimeType      String?

  // Para MOCR
  ocrText       String?
  ocrProvider   String?   // 'gemini' | 'docling'
  ocrConfidence Float?
  ocrEvaluatedAt DateTime?

  uploadedAt    DateTime  @default(now())
  uploadedBy    String?   // futuro: auth

  @@index([companyId, kind])
  @@index([plantId, kind])
}

// Notas editables (sin auth — abierto)
model Note {
  id            String    @id @default(cuid())
  companyId     String?
  company       Company?  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  plantId       String?
  contactId     String?

  body          String
  author        String    @default('anónimo')
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([companyId])
}

// Configuración del scan (para cadencia 2-tier)
model ScanConfig {
  id            String    @id @default(cuid())
  agentName     String    @unique  // 'newsrooms' | 'sectorial' | 'prensa' | 'boe-bop' | 'linkedin'
  cadenceDays   Int       @default(2)
  firstRunBackfillDays Int  @default(15)
  lastRunAt     DateTime?
  lastBackfillAt DateTime?
  isFirstRun    Boolean   @default(true)
  isActive      Boolean   @default(true)
  queryConfig   Json?
}

// Log de runs
model SearchRun {
  id            String    @id @default(cuid())
  agentName     String
  query         Json?
  startedAt     DateTime  @default(now())
  finishedAt    DateTime?
  itemsFound    Int       @default(0)
  itemsNew      Int       @default(0)
  itemsUpdated  Int       @default(0)
  itemsInScope  Int       @default(0)
  itemsOutOfScope Int     @default(0)
  errorsCount   Int       @default(0)
  costEur       Float     @default(0)
  mode          String?   // 'backfill_15d' | 'incremental_2d'

  @@index([agentName, startedAt])
}
```

**Tablas ELIMINADAS (v5 → v6)**:
- `auctions` (no las gestionamos nosotros)
- `Event` (sustituida por `TimelineEvent` con FK a planta)
- `ArticleCompany` (simplificada, sentiment+relevance ya no son críticos)

**Tablas NUEVAS (v6)**:
- `Plant` (con dirección+lat/lng+estado+especialidad+empleados+parcela)
- `PlantContact` (con planta FK + email+linkedin+phone)
- `TechnicalInventory` (con brand+model+specs+status)
- `Operation` (con monto+status+confidence+sourceUrl)
- `TimelineEvent` (cronología datada con impacto)
- `Financial` (inversiones con desglose por año)
- `AuctionCheck` (verificación de subastas por plataforma)
- `Document` (PDFs+imágenes con MOCR)
- `Note` (notas editables)
- `ScanConfig` (cadencia 2-tier configurable)

---

## 4. Sprints de re-arquitectura (formato HJC)

### Sprint 6 — Fundamentos v6 (núcleo legacy 1:1)

**Delivers**:
- Schema Prisma v6 aplicado en PostgreSQL.
- Parser de los 7 MD dossiers + cuadro de mando → seed JSON con ~7 companies, ~30 plants, ~80 contactos, ~50 inventario técnico, ~20 operaciones, ~100 eventos cronológicos, ~80 fuentes, ~10 documentos, ~10 verification subastas.
- Tabla `Note` operativa con UI básica.

**Success Criteria (smoke v6)**:
1. `prisma db push` aplica schema v6 sin error.
2. `pnpm seed:md` popula 7 companies con datos estructurados.
3. `GET /empresas/pescanova` retorna HTML con: logo, KPIs (facturación 1053.6M€), 3 plantas (Sabón/Morás/Pescamar), inventario técnico, cronología con fechas, desglose financiero (inversión 16M€ + 283M€), 13 fuentes con URLs clickeables, contactos con LinkedIn.

**Effort**: M (3-4 días).

### Sprint 7 — Reconstruir /empresas/[slug] legacy 1:1

**Delivers**:
- Página `/empresas/[slug]` con todas las secciones del legacy:
  - Hero con logo + nombre + tier + status
  - **KPIs** (facturación, EBITDA, plantilla, plantas, deuda)
  - **Operación Principal** (la más reciente, prominent)
  - **Mapa de Plantas** (lista con estado: operativa/en venta/cerrada/en proyecto)
  - **Inventario Técnico** (tabla brand+model+specs+status, agrupado por categoría)
  - **Cronología** (timeline vertical con fechas y eventos)
  - **Desglose Financiero** (inversiones con monto+concepto+timeline)
  - **Verificación de Subastas** (8 plataformas: Escrapalia, Surplex, Troostwijk, GUTINVEST, HGP, Apex, CFT, Industrial Auctions)
  - **Fuentes Verificables** (URLs clickeables con outlet type)
  - **Contactos** (agrupados por planta, con LinkedIn+email+phone, clickables)
  - **Documentos** (PDFs: EINF 2025; imágenes: logos)
  - **Notas** (editables, añadibles, eliminables — sin auth)

**Success Criteria (smoke v6)**:
1. GET /empresas/pescanova retorna HTML que contiene los 13 textos clave de los datos.
2. Hero muestra logo Surus (`https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png`) cuando se setea.
3. 5 secciones visibles (KPIs, plantas, inventario, cronología, fuentes).
4. Fuentes son `<a href="...">` con target="_blank" rel="noopener noreferrer".
5. Contactos son `<a href="linkedin.com/...">` clickeables.

**Effort**: L (5-6 días).

### Sprint 8 — Plant-specific contact search + emails

**Delivers**:
- Para cada planta detectada en una operación, el agente linkedin-plant-specific genera queries por planta concreta:
  - `"<plantName> <companyName>" site:linkedin.com`
  - `"Director de planta" "<plantName>" site:linkedin.com`
  - `"<plantName>" <companyName> "@<companyDomain>" email`
- Hunter.io Email Finder para cada contacto, score ≥70.
- Tabla `PlantContact` poblada con contactos con planta FK asignada.
- Vista `/contactos` con filtros por planta, rol, empresa, email verificado.
- Export CSV `/contactos/export` con: nombre, rol, empresa, planta, linkedin, email, verificado, fuente, fecha.

**Success Criteria (smoke v6)**:
1. Para Pescanova: ≥3 contactos con `plantId` apuntando a Sabón, Morás, o Pescamar.
2. Para Pascual: ≥1 contacto con `plantId` apuntando a Gurb.
3. ≥1 email verificado (Hunter.io score ≥70) por empresa top-tier.
4. La búsqueda "Director de planta Gurb" devuelve al Director de Fábrica de Gurb (no otro director de Pascual).

**Effort**: L (4-5 días).

### Sprint 9 — Cadencia 2-tier (15d primera / 2d después) + edit/notes/delete

**Delivers**:
- `ScanConfig` con flag `isFirstRun` y `firstRunBackfillDays=15`.
- Modificación de los 5 scan-runners:
  - Si `isFirstRun=true`, ventana de búsqueda = 15 días.
  - Después, `isFirstRun=false`, ventana = 2 días.
- Para plantas con noticias previas (`Source` rows en últimos 6 meses): re-fetch + update incremental, no duplicar.
- API endpoints:
  - `PUT /api/empresas/[slug]` (editar KPIs, status, tier, logo)
  - `PUT /api/plantas/[id]` (editar planta)
  - `PUT /api/contactos/[id]` (editar email, phone, notes)
  - `POST /api/notas` (crear nota)
  - `DELETE /api/notas/[id]`
  - `DELETE /api/empresas/[slug]/sources/[id]`
- UI inline-editable en `/empresas/[slug]` con iconos de edit/delete al lado de cada campo.

**Success Criteria (smoke v6)**:
1. Primera ejecución de cada agente: ventana 15d (assert en SearchRun.mode='backfill_15d').
2. Segunda ejecución: ventana 2d (assert en SearchRun.mode='incremental_2d').
3. Para planta con Source previa, al re-escanear, se actualiza la existente (no se duplica).
4. `PUT /api/empresas/pescanova` con `{facturacionM: 1100}` persiste y se ve en UI.
5. `POST /api/notas` con `{companyId, body}` crea nota visible en UI.

**Effort**: L (5-6 días).

### Sprint 10 — Upload de imágenes y PDFs

**Delivers**:
- `POST /api/upload` endpoint:
  - multipart/form-data con file
  - Valida mime (image/*, application/pdf)
  - Guarda a `/opt/hermes-dossier/data/uploads/{companySlug}/{kind}/{filename}`
  - Persiste en `Document` con fileUrl relativo
- UI en `/empresas/[slug]` con:
  - Upload zone para logo (image/*, máx 5MB)
  - Upload zone para hero image (image/*, máx 10MB)
  - Upload zone para PDFs (application/pdf, máx 50MB)
  - Lista de documentos subidos con preview (imagen) o download link (PDF)
- Sirve estáticos desde `next.config` con `rewrites` para `/dossier/uploads/*` → `/data/uploads/*`.

**Success Criteria (smoke v6)**:
1. POST /api/upload con PNG < 5MB retorna 200 y persiste en Document.
2. GET /empresas/pescanova muestra el logo subido.
3. POST /api/upload con PDF < 50MB retorna 200 y aparece link de descarga.
4. POST /api/upload con .exe retorna 415.

**Effort**: M (2-3 días).

---

## 5. Estimación y orden de ejecución

| Sprint | Effort | Dependencias |
|---|---|---|
| 6 — Schema v6 + seed parser | M (3-4d) | — |
| 7 — /empresas/[slug] legacy 1:1 | L (5-6d) | S6 |
| 8 — Plant-specific contact search | L (4-5d) | S6, S7 |
| 9 — Cadencia 2-tier + edit/notes/delete | L (5-6d) | S6, S7 |
| 10 — Upload imágenes/PDFs | M (2-3d) | S6, S7 |

**Total**: 4-5 sprints, ~3-4 semanas dev full-time.

**Orden de ejecución**: S6 → S7 → (S8 ∥ S9) → S10. S8 y S9 pueden paralelizarse en branches separados.

---

## 6. APIs externas (sin cambios)

- **Gemini 2.5 Vision** (free, 15 RPM): MOCR de placas/certificados.
- **Hunter.io** (free, 25 verif/mes → pay-per-use si escala): Email enrichment de contactos con planta asignada.

---

## 7. Cron cadencia 2-tier (nuevo)

```ini
# /etc/systemd/system/hermes-scan-newsrooms.timer
[Timer]
OnCalendar=*-*-01,03,05,07,09,11,13,15,17,19,21,23,25,27,29,31
Persistent=true

[Service]
Environment=HERMES_AGENT=newsrooms
Environment=HERMES_BASE_WINDOW_DAYS=2
Environment=HERMES_FIRST_RUN=auto  # el script detecta en ScanConfig.isFirstRun
```

Lógica del script (en `lib/agents/runner.ts`):
```typescript
const cfg = await prisma.scanConfig.findUnique({ where: { agentName } });
const windowDays = cfg?.isFirstRun ? cfg.firstRunBackfillDays : cfg?.cadenceDays ?? 2;
const since = new Date(Date.now() - windowDays * 86400_000);
const mode = cfg?.isFirstRun ? 'backfill_15d' : 'incremental_2d';
// ... después del run:
await prisma.scanConfig.update({ where: { agentName }, data: { isFirstRun: false, lastRunAt: new Date() } });
await prisma.searchRun.create({ data: { agentName, mode, ... } });
```

---

## 8. Estrategia de migración del v5 al v6

1. Sprint 6 día 1: backup de la DB actual con `pg_dump`.
2. Crear nuevo schema v6 en DB separada (`hermes_v6`).
3. Aplicar migraciones.
4. Ejecutar parser MD → seed v6.
5. Sprint 6 día 2-3: smoke v6 contra `hermes_v6`.
6. Sprint 7-10: nuevas features contra `hermes_v6`.
7. Cuando todo GO: `pg_dump hermes_v6` → restore a `hermes_dossier` (producción).
8. nginx no cambia (sigue con `location ^~ /dossier`).

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Parser MD pierde estructura | Tests con cada MD, validación de counts mínimos (7 companies, ≥30 plants, ≥80 contactos) |
| LinkedIn rate limit | throttle 4s/req + cache 30d + fallback Hunter.io |
| Hunter.io agota 25 verif/mes | Priorizar emails de decisores top-tier (CEO, Director de Planta); pay-per-use solo si ratio value/cost ≥ 10x |
| Upload de archivos maliciosos | Validar mime + magic bytes, no ejecutar, antivirus clamav en VPS (opcional) |
| Schema migration rompe datos v5 | Backup completo, branch separado, smoke v6 antes de cutover |
| Plant-specific search muy costoso | throttle 4s/req + paralelizar 5 req max |
| PDFs muy grandes llenan disco | Cuota de 100MB/empresa, monitoring disco >80% |

---

## 10. Verificación end-to-end (`pnpm smoke:v6`)

1. Reset DB + aplicar schema v6.
2. Ejecutar `seed:md` → assert 7 companies, ≥30 plants, ≥80 contactos, ≥50 inventario.
3. `GET /empresas/pescanova` → assert contiene 13 textos clave.
4. `GET /empresas/danone` → assert contiene "Aldaia" y "Tres Cantos".
5. `GET /contactos?plant=Gurb` → assert devuelve contactos de Gurb, no otros.
6. `POST /api/upload` PDF → assert persiste en Document.
7. `PUT /api/empresas/pescanova {facturacionM: 1100}` → assert se persiste.
8. `POST /api/notas` → assert nota visible.
9. `DELETE /api/notas/[id]` → assert desaparece.
10. `pnpm scan:newsrooms --first-run` → assert SearchRun.mode='backfill_15d'.
11. `pnpm scan:newsrooms` (segunda vez) → assert SearchRun.mode='incremental_2d'.
12. `GET /empresas/pescanova` → assert fuentes son `<a>` con target="_blank".

**GO/NO-GO**: 11/12 asserts pasan → sprint accepted.

---

## 11. Sprints ya completados (NO se re-hacen)

- **Sprint 1-5**: infraestructura, agentes, MOCR. **Funcional** pero pobre en datos.
- Lo que se preserva: el código de los 5 agentes de scraping (newsroom, sectorial, prensa, boe-bop, linkedin), el MOCR pipeline (Gemini Vision), la búsqueda FTS, la exportación CSV básica, la autenticación nginx TLS, los 5 systemd timers.

Lo que se reescribe: el schema DB, los parsers de seeds, la página /empresas/[slug], la vista /contactos, los agentes linkedin y hunter (para plant-specific).

---

## 12. Próximo paso concreto

**Sprint 6 — Schema v6 + seed parser** (3-4 días):

1. Diseñar `prisma/schema.prisma` v6 con los 11 modelos nuevos.
2. Implementar `scripts/parse-md-dossiers.ts` que lea los 15 ficheros MD y emita `seed-v6.json`.
3. Implementar `scripts/seed-v6.ts` que popule la DB desde `seed-v6.json`.
4. Crear API routes básicas para `GET /api/empresas/[slug]`, `GET /api/plantas/[id]`, `GET /api/contactos`.
5. Smoke v6 con 12 asserts (sección 10).
6. Commit + push.

Cuando el usuario apruebe este plan, abrimos un sprint contract formal con sprint-6-contract.md.
