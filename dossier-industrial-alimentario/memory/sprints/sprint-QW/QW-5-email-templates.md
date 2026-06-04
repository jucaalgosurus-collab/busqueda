# Sprint Contract: QW-5 — Templates email por sector + cargo

## Objetivo

8 plantillas de email (4 sectores × 2 cargos) listas para que el comercial Surus copie y pegue. Sin tracking, sin automatización, sin envío desde la herramienta. 100% copy-paste.

## Sectores × Cargos

| Sector \ Cargo | CFO / Director Financiero | Director de Planta |
|---|---|---|
| **Alimentación y Bebidas** | QW-5-AB-CFO-01 | QW-5-AB-PLANT-01 |
| **Industrial** | QW-5-IND-CFO-01 | QW-5-IND-PLANT-01 |
| **Farmacéutico** | QW-5-PHARM-CFO-01 | QW-5-PHARM-PLANT-01 |
| **Construcción** | QW-5-CONST-CFO-01 | QW-5-CONST-PLANT-01 |

(4 sectores × 2 cargos = 8 plantillas)

## Estructura de cada plantilla

- **Asunto** (1 línea, personalizado por sector)
- **Bloque 1 — Presentación** (3-4 líneas): quién soy, qué hace Surus Inversa
- **Bloque 2 — Contexto / Dolor** (3-5 frases): por qué contactamos a este decisor
- **Bloque 3 — Cierre** (2 líneas): pregunta de 1 línea + firma
- **Campos variables**: `{{empresa}}`, `{{planta}}`, `{{ciudad}}`, `{{nombre}}`, `{{cargo}}`, `{{sector}}`, `{{tono}}`

## Reglas duras (ya alineadas con Sprint L)

1. **Sin "Estimado/a", "no dude en", "quedo a su disposición"** — copy directo, no parecer de IA.
2. **Sin superlativos vacíos** ("excelente", "líder", "innovador", "puntero").
3. **Cierre con pregunta de 1 línea**, no coletilla.
4. **≤120 palabras total**.
5. **Sin emojis**.
6. **Tono profesional B2B**, no marketing.

## Agente

- Generator (Sonnet 4.6)

## Entregables

1. `memory/sprints/sprint-QW/QW-5-email-templates.md` — este contrato
2. `lib/data/email-templates.json` — array de 8 templates con `{id, sector, cargo, subject, body}`
3. `lib/email/render.ts` (~50 líneas) — `renderTemplate(tpl, vars): { subject, body }` con sustitución `{{var}}`
4. `app/templates/page.tsx` — página `/templates` con selector sector + cargo + render en vivo
5. `scripts/smoke-qw-5.ts` (~100 líneas, 6 asserts):
   - QW-5-A 8 templates en `lib/data/email-templates.json`
   - QW-5-B Cada template tiene `id, sector, cargo, subject, body`
   - QW-5-C `renderTemplate` sustituye `{{vars}}` correctamente
   - QW-5-D Sin frases IA prohibidas ("estimado/a", "no dude", "quedo a su disposición")
   - QW-5-E Sin emojis, ≤120 palabras
   - QW-5-F Cobertura 4×2 (4 sectores × 2 cargos)
6. `package.json` — script `smoke:qw-5`
7. `memory/state/active-state.md` — actualizar a "QW-5 Templates email: completed"

## Success criteria

- 6/6 asserts verdes
- 8 plantillas usables sin edición (el operador solo cambia `{{vars}}`)
- Cero frases IA prohibidas en cualquier plantilla

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Plantilla parece de IA | checklist automática en smoke: regex de frases prohibidas |
| Operador olvida variables | `renderTemplate` falla claro si falta `{{var}}` |
| Sector no contemplado | por ahora 4 sectores top, sprint futuro ampliar |

## Siguiente paso en el orden

QW-5 → QW-3 Dark mode → B.2..B.8
