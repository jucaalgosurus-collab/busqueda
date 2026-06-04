# Sprint C.3 — Patentes OEPM/EPO — Contrato

**Fecha**: 2026-06-04
**Sprint**: C.3
**Estado**: ⏳ EN EJECUCIÓN
**Agente asignado**: Generator (Sonnet 4.6)

## 1. Objetivo

Enriquecer la ficha de cada empresa A&B con su **cartera de patentes/marcas publicadas en la OEPM (Oficina Española de Patentes y Marcas)** y, si hay credenciales EPO OPS, complementar con la familia internacional (EPO).

El runner `surus-agente-patentes` corre semanalmente, scrapea OEPM Invenes (público, sin auth) por titular de la empresa, persiste cada patente encontrada y muestra un resumen en `/empresas/[slug]`.

## 2. Por qué ahora

Sprint C cubre enriquecimiento 360º de empresas. Ya están C.1 (BORME histórico) y C.2 (financiero Wikipedia). C.3 es el siguiente paso natural:

- Una empresa A&B con cartera de patentes activa **es señal de I+D viva** (no desimplantación).
- Una empresa A&B cuya cartera caduca o se abandona **puede ser** señal de desimplantación.
- Aporta dato "duro" y público (OEPM es BOE) — barato de obtener.

## 3. Decisiones de diseño

### 3.1 Fuente: OEPM Invenes (sin auth) + EPO OPS (opcional)

| Fuente | Tipo | Auth | Coste | URL |
|---|---|---|---|---|
| **OEPM Invenes** | Web HTML + búsqueda | NO | Gratis | `https://invenes.oepm.es/buscador/` |
| OEPM Open Data (WIPO ST.36) | XML bulk | NO | Gratis | `https://sede.oepm.gob.es/...` |
| **EPO OPS** | REST OAuth | Sí (key) | Gratis con registro | `https://ops.epo.org/3.2/` |

**Decisión**: C.3 arranca con OEPM Invenes (sin credenciales). EPO OPS se prepara la integración en el código (función `fetchEpoPatent()`), pero queda desactivada si `EPO_OPS_CONSUMER_KEY` no está en `.env`. Sprint futuro (C.3.1) la activará con credenciales.

### 3.2 Búsqueda por titular

OEPM Invenes permite buscar por:
- Titular (nombre empresa o NIF)
- Inventor
- Número de publicación
- Título

**Decisión**: búsqueda por **nombre empresa** (slug + variantes) + opcional por **CIF** si la empresa tiene uno en DB.

### 3.3 Modelo nuevo `Patent`

`Patent` modela cada patente individual (no un agregado). Esto permite:
- Filtrar por status (granted / pending / expired).
- Filtrar por año.
- Mostrar lista completa en UI.

### 3.4 No es señal de desimplantación

A diferencia de otros agentes (B.2 AESAN, B.5 seguros, etc.), C.3 **NO marca** `Source.deimplantationSignal=true`. Las patentes son enriquecimiento neutro. Una patente GRANTED es positivo (la empresa invierte en I+D). Una patente ABANDONED podría ser señal, pero eso requiere análisis de caducas vs activas — fuera de scope C.3.

### 3.5 Idempotencia

`Patent.matchHash = sha256(companyId + publicationNumber + titleLower)[0..32]`

- Si la misma patente aparece en 2 corridas: upsert, sin duplicar.
- Si OEPM añade un nuevo status: update del campo `legalStatus`.
- El runner es seguro de ejecutar N veces.

### 3.6 Cadencia

- **backfill_all** (1ª ejecución): TODAS las A&B.
- **incremental_30d** (cadencia 7d): solo A&B con `lastScannedAt` > 30 días o sin patentes en DB.
- Systemd `OnCalendar=weekly` (lunes 02:00 UTC) para que no coincida con financials (lunes 00:00).

## 4. Schema v6 — modelo `Patent`

```prisma
model Patent {
  id              String   @id @default(uuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  matchHash       String   @unique // sha256(companyId+pubNumber+title)[:32]

  publicationNumber String  // 'ES1234567A1', 'EP3456789B1', etc.
  title           String   // título de la patente
  applicant       String?  // 'PASCUAL, S.A.U.' o 'GRUPO DAMM, S.L.'
  inventors       String?  // nombres separados por coma

  filingDate      DateTime? // fecha de solicitud
  publicationDate DateTime? // fecha de publicación
  grantDate       DateTime? // fecha de concesión (null si pending)

  legalStatus     String   // 'granted' | 'pending' | 'expired' | 'withdrawn' | 'unknown'
  cnae            String?  // clasificación CIP si aparece
  source          String   // 'OEPM Invenes' | 'EPO OPS'
  sourceUrl       String   // URL al detalle OEPM
  language        String   @default("es")

  scrapedAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([companyId, publicationDate])
  @@index([legalStatus])
  @@index([filingDate])
}
```

**No requiere migration** del modelo: se añade al schema, `prisma db push` lo crea.

**OutletType**: añadir `'patent'` al union en `lib/scrapers/types.ts`. El campo `Source.outletType` es `String` libre, no migration.

## 5. Archivos a entregar

| Archivo | Tipo | Líneas (estimado) |
|---|---|---|
| `prisma/schema.prisma` | modelo Patent | +28 |
| `lib/scrapers/oepm.ts` | scraper Invenes | ~250 |
| `lib/agents/patentes-runner.ts` | agent runner | ~280 |
| `scripts/patentes-backfill.ts` | CLI wrapper | ~30 |
| `scripts/smoke-c3.ts` | smoke 12 asserts | ~220 |
| `app/empresas/[slug]/_components/PatentsCard.tsx` | UI server component | ~95 |
| `app/empresas/[slug]/page.tsx` (mod) | wire-up PatentsCard | +12 |
| `app/empresas/[slug]/empresa.css` (mod) | estilos | +50 |
| `lib/scrapers/types.ts` (mod) | outletType='patent' | +1 |
| `package.json` (mod) | scripts | +3 |
| `memory/sprints/sprint-C/C.3-patentes-report.md` | reporte post | ~140 |
| `memory/state/active-state.md` (mod) | sprint status | ~25 |

**Total nuevo código**: ~1000 líneas.

## 6. Asserts de smoke (12)

1. **C.3-1**: existe `lib/scrapers/oepm.ts` con export `scrapeOepmPatents(companyName, options)`.
2. **C.3-2**: existe `lib/agents/patentes-runner.ts` con export `runPatentesAgent()`.
3. **C.3-3**: `Patent` model existe en schema y se ha ejecutado `prisma db push` (verificable por `prisma.patent.findFirst()`).
4. **C.3-4**: outletType `'patent'` está en `OutletType` union en `types.ts`.
5. **C.3-5**: `scrapeOepmPatents('Pascual')` devuelve array con al menos 1 patente de prueba (mocks/fixture). Test contra fixture HTML estática en `scripts/fixtures/oepm-pascual.html`.
6. **C.3-6**: `scrapeOepmPatents` con nombre inventado `__empresa_inexistente_xyz_` devuelve array vacío.
7. **C.3-7**: 1ª corrida crea `SearchRun { agentName: 'surus-agente-patentes', mode: 'backfill_all' }` con `itemsFound > 0`.
8. **C.3-8**: Al menos 1 `Patent` con `legalStatus='granted'` persistida para Pascual/Damm/Mahou (3 top A&B).
9. **C.3-9**: `ScanConfig { agentName: 'surus-agente-patentes', cadenceDays: 7, isActive: true }` registrado.
10. **C.3-10**: idempotencia — 2 corridas consecutivas mismo día no duplican `Patent` rows (verifica `matchHash UNIQUE`).
11. **C.3-11**: `Source.outletType='patent'` se persiste para patentes GRANTED en últimos 5 años.
12. **C.3-12**: `PatentsCard` se renderiza en `/empresas/[slug]` con `patentsCount > 0` para Pascual (verificable con curl en producción).

## 7. Filtro matching

```typescript
// lib/filters/patentes.ts
export function isRelevantPatentHit(hit: {applicant: string; title: string}, companyName: string): boolean {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const target = n(companyName).split(/[\s,]+/).filter(w => w.length >= 4);
  const applicant = n(hit.applicant);
  // el applicant debe contener al menos uno de los tokens significativos
  return target.some(t => applicant.includes(t));
}
```

## 8. Quality gates (igual que C.2)

| Gate | Criterio |
|---|---|
| Functionality (12 asserts) | 12/12 PASS |
| TypeScript clean | 0 errores (`./node_modules/.bin/tsc --noEmit`) |
| Build production | ✅ `pnpm build` |
| Idempotencia | ✅ 2 corridas no duplican |
| NO envíos automáticos | ✅ C.3 es backoffice, sin outreach |
| Tono NO-IA | N/A — C.3 es datos |
| Outreach panel hidden | N/A |
| Pain points desde Source | N/A |
| Source outletType='patent' | ✅ persistido |

## 9. Cron systemd

```
surus-agente-patentes.service
surus-agente-patentes.timer (OnCalendar=weekly, lunes 02:00 UTC)
```

Diferente horario que financials (lunes 00:00) para no saturar la VPS.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| OEPM Invenes tiene CAPCHA / WAF | Fallar gracefully, marcar `errors++`, retry en próxima corrida |
| OEPM cambia HTML | Test contra fixture; si cambia, ajustar selectores (smoke detecta) |
| EPO OPS requiere OAuth | Si no hay `EPO_OPS_CONSUMER_KEY`, omitir EPO, seguir con OEPM |
| Búsqueda por nombre devuelve patentes del fundador, no la empresa | Filtro `isRelevantPatentHit` valida applicant con tokens del nombre empresa |
| Cobertura mala en A&B pequeñas | Aceptable: 0 patentes en DB ≠ error. El smoke exige ≥1 hit en Pascual/Damm/Mahou |
| HTML muy pesado | Limitar a 50 resultados por empresa |

## 11. Definition of Done

- [x] Contrato escrito (este doc).
- [x] Schema Patent añadido + prisma db push.
- [x] `lib/scrapers/oepm.ts` implementado.
- [x] `lib/agents/patentes-runner.ts` implementado.
- [x] `scripts/patentes-backfill.ts` + `scripts/smoke-c3.ts`.
- [x] UI `PatentsCard` integrada.
- [x] Smoke 12/12 PASS.
- [x] 1ª corrida real en VPS con hits verificados.
- [x] Reporte C.3-patentes-report.md.
- [x] Cron systemd instalado.
- [x] Commit + push.
- [x] active-state.md actualizado.

## 12. Siguiente sprint

Tras C.3 → **C.4 Sanciones SANCO/CNMC** (siguiente en orden C).
