# Sprint Contract: QW-3 — Modo oscuro (data-theme toggle)

> **Sprint QW**: Quick wins. 1 día por sprint. Sin permisos intermedios.
> **Brief 2026-06-02**: "luz de luna", "se siente premium", preparar el terreno para Sprint G (UX brutal).

## Objetivo

Toggle dark mode en todo el dossier, persistido en `localStorage`, sin flash de tema incorrecto en carga. CSS variables como único switch — sin reescribir componentes.

## Deliverables

1. **`app/globals.css`** — bloque `[data-theme="dark"]` que sobreescribe las CSS variables existentes (`--surus-primary`, `--surus-bg`, `--surus-bg-elev`, `--surus-text`, `--surus-text-soft`, `--surus-text-muted`, `--surus-border`, `--surus-border-strong`, `--surus-shadow-*`).
2. **`app/layout.tsx`** — script inline `<script dangerouslySetInnerHTML>` en `<head>` que lee `localStorage.theme` y aplica `data-theme` antes del primer paint, evitando FOUC.
3. **`components/ThemeToggle.tsx`** — botón client component con icono luna/sol (lucide-react) que alterna `data-theme` y persiste en `localStorage.theme`.
4. **`components/Navbar.tsx`** — insertar `<ThemeToggle />` entre los links y el crédito.
5. **`scripts/smoke-qw-3.ts`** — 8 asserts:
   - `globals.css` contiene bloque `[data-theme="dark"]`
   - `--surus-bg` y `--surus-text` redefinidos en dark
   - `app/layout.tsx` tiene script anti-FOUC
   - `components/ThemeToggle.tsx` existe y exporta `ThemeToggle`
   - Toggle maneja click → setAttribute + localStorage
   - Navbar.tsx importa `ThemeToggle` y lo renderiza
   - Toggle SSR-safe: lee `localStorage` solo en `useEffect`
   - 0 emojis hardcoded; usa lucide-react `Moon`/`Sun`

## Success criteria

- 8/8 asserts verdes.
- Type-check 0 errores.
- Click en toggle → tema cambia en <100ms.
- Recarga página → tema persiste.
- Sin flash blanco en carga con tema dark.
- Componentes existentes (Dashboard, /empresas, /hallazgos, /contactos) funcionan sin cambios gracias a CSS vars.

## No-go

- No librerías nuevas (next-themes descartado — solo necesitamos un toggle).
- No sistema multi-tema (solo light/dark).
- No persistencia en DB (localStorage es suficiente para esta primera versión).

## Riesgos

- Componentes que usen colores hardcoded (no via vars) quedarán mal. Mitigación: globals.css redefine los nombres base; los overrides que escapen a vars se arreglan en sprint G.
- Contraste WCAG: verificar con el evaluador en QA final.
