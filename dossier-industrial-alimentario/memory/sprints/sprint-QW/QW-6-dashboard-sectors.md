# Sprint Contract: QW-6 Dashboard Sectors & Filters

> **Pedido verbatim usuario 2026-06-03**: "EL DASHBOARD LA PAGINA PRINCIPAL PORQUE NO ESTAN SEPARADOS POR CATEGORIAS, POR SECTOR, PORQUE NO SE PUEDE FILTRAR TAMBIEN??? DEJAR POR SUPUESTO SIEMPRE ALIMENTACION Y BEBIDAS PRIMERO, LUEGO CONSTRUCCION"

## Objetivo

Reorganizar `app/page.tsx` para que el dashboard se separe claramente por **categoría** y por **sector**, con capacidad de filtrado y un orden de sectores fijo donde **Alimentos y Bebidas** va siempre primero y **Construcción** segundo.

## Entregables

### F1. SectorsFixOrder en `app/lib/dashboard/sectors.ts` (NUEVO)

Constante `SECTOR_ORDER` y helper `sortBySectorFixed()`. Orden obligatorio:

1. **Alimentos y Bebidas** (siempre 1º)
2. **Construcción** (siempre 2º)
3. Industrial
4. Farmacéutico
5. Energético
6. Otro industrial

```ts
export const SECTOR_ORDER: string[] = [
  'Alimentos y Bebidas',
  'Construccion',
  'Industrial',
  'Farmaceutico',
  'Energetico',
  'Otro industrial',
];
```

### F2. `app/api/dashboard/route.ts` (NUEVO) — endpoint JSON

`GET /api/dashboard?sector=<opcional>` devuelve JSON con KPIs + breakdown por sector.

- Sin `sector`: devuelve TODO + `bySector` array
- Con `sector=<x>`: filtra companies/operations/sources a ese sector, omite breakdown

### F3. `app/page.tsx` — REESCRITURA CLIENT COMPONENT

- `"use client"` en línea 1
- `useState` para `sectorFiltro` (default `"Alimentos y Bebidas"`)
- `useEffect` → `fetch('/api/dashboard?sector=...')` al montar y al cambiar filtro
- **Tabs sticky en el top** con los 6 sectores en orden fijo + "Todos" opcional
- **KPI cards filtradas** según sector activo
- **"Top empresas"** filtradas por sector activo
- **"Distribución por sector"** siempre visible (tabla con conteos) — usa `SECTOR_ORDER` para ordenar
- **"Distribución por CCAA"** filtrada por sector activo
- Loading state con skeleton

### F4. Visual: separación clara por sector

- Cada card/section debe mostrar el sector activo como **breadcrumb** o **badge prominente**
- Color de acento por sector:
  - A&B → `--surus-accent` (dorado)
  - Construcción → `--surus-warning` (naranja)
  - Industrial → `--surus-primary-500` (azul medio)
  - Farmacéutico → `--surus-success` (verde)
  - Energético → `--surus-danger` (rojo)
  - Otro → gris
- Línea vertical de 4px con color de sector a la izquierda de cada sección

### F5. Smoke `scripts/smoke-qw-6.ts` (NUEVO)

7 asserts:
- QW-6-A: `lib/dashboard/sectors.ts` existe y exporta `SECTOR_ORDER` con 6 sectores en orden correcto
- QW-6-B: `sortBySectorFixed` ordena correctamente: A&B primero
- QW-6-C: `app/api/dashboard/route.ts` existe y exporta GET
- QW-6-D: `app/page.tsx` ahora es client component (tiene `"use client"`) y tiene `useState` para sector
- QW-6-E: Tabs renderizan los 6 sectores en orden SECTOR_ORDER
- QW-6-F: fetch a `/api/dashboard?sector=Alimentos y Bebidas` filtra correctamente (mocks)
- QW-6-G: empty state graceful cuando sector no existe (devuelve KPI=0 + "Sin datos")

### F6. `package.json` — añadir `smoke:qw-6` script

### F7. `memory/state/active-state.md` — marcar QW-6 completed local

## Success Criteria

- 7/7 asserts verdes en `pnpm tsx scripts/smoke-qw-6.ts`
- Type-check 0 errores tras cambios
- Dashboard carga en <1.5s, tabs funcionales, filtro reactivo
- A&B siempre visible primero en tabs y en Distribución por sector

## Reglas duras

- NO emojis en UI
- Mantener Surus design tokens (no introducir colores nuevos en el root)
- Respetar Server/Client boundary: `app/page.tsx` se convierte en client pero el endpoint `/api/dashboard` debe ser server-side con `prisma`
- NO romper ninguna vista existente (`/empresas`, `/hallazgos`, `/agentes`, etc.)
- Mantener responsive (grid 2fr/1fr → 1fr en <768px)

## Pendiente VPS

Sync queda bloqueado por root pass. Trabajo se valida local con smoke.

## Próximo paso (post QW-6)

Retomar QW-3 Dark mode (interrumpido), luego seguir con B.2..B.8 y resto del MEGAPLAN.
