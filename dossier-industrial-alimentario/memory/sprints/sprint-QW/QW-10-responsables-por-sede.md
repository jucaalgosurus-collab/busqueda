# Sprint Contract: QW-10 — Responsables por Sede (noticia → planta → contactos)

> **Regla de negocio (verbatim 2026-06-03, Juan Carlos)**: *"aunque son grandes empresas, debes enfocarte en conseguir la informacion de los responsables de cada sede. Puede ocurrir que de repente de la misma compañia salgan noticias de otra sede, en ese caso buscar los responsables de la otra sede. Lo importante es que Siempre las noticias vayan con los responsables de la sede."*

- **Agent**: generator (implementación) + evaluator (verificación)
- **Effort**: S (1-2 días)
- **Delivers**:
  1. `Source.plantId` opcional + relación → `Plant` + índice
  2. Migración Prisma para añadir columna + FK
  3. Endpoint `GET /api/hallazgos/[id]/responsables` → devuelve contactos ASIGNADOS a la planta del hallazgo
  4. Endpoint `GET /api/responsables/por-sede?companySlug=…&plantSlug=…` → para integración con `/empresas/[slug]`
  5. Componente `ResponsablesPorSedeCard` para `/hallazgos/[id]` y `/empresas/[slug]`
  6. En `/empresas/[slug]`: lista de plantas con su responsable de planta destacado + email verificado
  7. Script backfill `scripts/backfill-source-plant.ts` que asigna `plantId` a Sources existentes usando heurística: nombre de planta/city/province en `contentText`/`title`
  8. Smoke `smoke:qw-10` ≥9 asserts

- **Success Criteria**:
  - [ ] Schema: `Source.plantId` opcional añadido, sin perder datos
  - [ ] Migración aplicada local + VPS
  - [ ] Endpoint `/api/hallazgos/[id]/responsables` devuelve contactos de la planta del hallazgo (200 OK con datos, 404 si Source no tiene plantId)
  - [ ] Backfill asigna plantId al ≥40% de Sources existentes con sede identificable
  - [ ] UI: en `/empresas/[slug]` cada planta muestra su responsable principal
  - [ ] UI: en `/hallazgos` (futuro detalle) muestra contactos de la sede del hallazgo
  - [ ] Idempotency: si Source ya tiene plantId, no se re-asigna
  - [ ] Type-check 0 errores
  - [ ] Smoke QW-10: 9/9 PASS
  - [ ] Sync VPS + smoke en VPS: 9/9 PASS

- **Context Budget**: 15k tokens
- **Dependencies**:
  - `prisma/schema.prisma` (modify Source)
  - `app/api/hallazgos/[id]/responsables/route.ts` (create)
  - `app/api/responsables/por-sede/route.ts` (create)
  - `app/empresas/[slug]/_components/ResponsablesPorSedeCard.tsx` (create)
  - `app/empresas/[slug]/page.tsx` (modify to render card)
  - `scripts/backfill-source-plant.ts` (create)
  - `scripts/smoke-qw-10.ts` (create)
  - `package.json` (add `backfill:source-plant` + `smoke:qw-10` scripts)
  - `prisma/migrations/20260604_add_source_plant/migration.sql` (create)

- **Constraints** (reglas duras del usuario):
  - NO auth (decisión usuario)
  - Sin sobreescribir `Source.plantId` si ya existe (idempotente)
  - Backfill: solo si `contentText` o `title` contienen el nombre exacto de una `Plant` registrada
  - Si no hay match, dejar `plantId = NULL` (no inventar)
  - No romper endpoints existentes
  - Sin emojis, sin features no pedidas

- **Verification flow**:
  1. Generator implementa
  2. Smoke local `pnpm smoke:qw-10`
  3. Type-check
  4. Evaluar con `evaluator` agent
  5. Si PASS → sync VPS
  6. VPS: `pnpm prisma migrate deploy` + restart + smoke
  7. Update `memory/state/active-state.md` a "QW-10 completado"

- **Riesgos**:
  - Backfill con muchos Sources (2.853): ejecutar como batch con `take`+`skip`, no cargar todos en memoria
  - Heurística: usar `LIKE` con nombre de planta normalizado (sin acentos, lowercase). Falsos negativos aceptables; falsos positivos NO.
