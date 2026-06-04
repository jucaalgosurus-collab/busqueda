# Decisión 2026-06-04 — Eliminar B.1 BORME scraping

> **Sprint**: E.2
> **Tipo**: REFACTOR + DATA
> **Estado**: ✅ APLICADO

## Resumen

Se elimina el runner diario de scraping BORME (`surus-agente-borme.timer`) porque quedó reemplazado por el pipeline `lib/borme/` (Sprint C.1) que ingiere el histórico oficial una sola vez y lo cruza con Companies vía matchHash idempotente. El histórico ingestado se preserva en la tabla `BormeEvent` y se muestra en `/empresas/[slug]` mediante `RegistroMercantilCard` (sólo lectura).

## Por qué

1. **Doble flujo**: el scraping diario + la ingest histórica generaban rows `Source` con `outletType='bofficial_borme'` duplicadas, contaminando el conteo de hallazgos en `/empresas`.
2. **ROI bajo**: 90 días de backfill arrojaron 2 hits legítimos (Pescanova, Nestlé) — un slot de timer + 1 correa al BOE diaria para ~0.7 hits/trimestre no se justifica.
3. **Costo de mantenimiento**: el BOE datos abiertos cambió el schema 2 veces en 2025; cada cambio requirió patchear el parser.
4. **Mandato del usuario** (brief 2026-06-04): *"Te dije eliminaras B.1 BORME scraping"*.

## Lo que se ELIMINA

| Recurso | Estado |
|---|---|
| `lib/scrapers/borme.ts` | 🗑️ Borrado (grep confirma 0 importers tras la migración) |
| `lib/agents/borme-runner.ts` (cuerpo de scrape) | ⚠️ Degradado a shim: `runBormeAgent()` ahora devuelve 0 items + warning. Conservado como evidencia forense. |
| `scripts/borme-historico-backfill.ts` (cuerpo de scrape) | ⚠️ Degradado a shim: imprime DEPRECATED y `process.exit(0)`. Conservado como evidencia. |
| npm script `scan:borme` | 🗑️ Borrado de `package.json` |
| npm script `scan:borme:backfill` | 🗑️ Borrado de `package.json` |
| npm script `borme:historico` | 🗑️ Borrado de `package.json` (el shim sigue accesible vía `tsx scripts/borme-historico-backfill.ts`) |
| systemd `surus-agente-borme.service` | 🗑️ Pendiente borrado en VPS vía SSH |
| systemd `surus-agente-borme.timer` | 🗑️ Pendiente borrado en VPS vía SSH |
| Smoke QW-1-B (assert borme) | ⚠️ Quitado. QW-1 ahora tiene 6 asserts (era 7) |

## Lo que se PRESERVA

| Recurso | Razón |
|---|---|
| Tabla `BormeEvent` (schema) | Histórico legalmente útil; alimenta `RegistroMercantilCard` |
| `lib/borme/parser.ts` | Enriquece rows de BORME con CNAE regex + jaroWinkler fuzzy match |
| `lib/borme/matcher.ts` | 4 estrategias: cif_exact, cif_prefix, name_province, name_fuzzy |
| `lib/borme/upsert.ts` | `upsertBormeEvent` con matchHash sha256, idempotente |
| `RegistroMercantilCard.tsx` (UI) | Lee de `BormeEvent`, no de Source, no requiere cambio |
| `app/empresas/[slug]/page.tsx` | Importa `BormeEvent` directamente vía Prisma |

## Riesgos & mitigaciones

| Riesgo | Mitigación |
|---|---|
| Reset manual futuro del VPS recrea el timer | El shim de `borme-runner.ts` impide scrape real aunque se reactive. Loguea `DEPRECATED 2026-06-04`. |
| Petición de "re-correr histórico" desde JC | Documentado en el shim: resucitar `lib/scrapers/borme.ts` desde git, ajustar al schema BOE actual, y volver a popular el script. |
| Smoke QW-1 falla en CI por faltar assert borme | Ya actualizado a 6 asserts, sin dependencia de borme-runner. |
| Renuncias-runner sigue leyendo `Source.outletType='bofficial_borme'` | Intencionado: esas rows vienen del histórico C.1 (no del runner diario). Cuando se ejecute `purge-source-sector-stale` o similar, NO debe borrar esas rows. |

## Validación

- ✅ `grep -r "borme-runner" lib/ scripts/ app/ --include="*.ts"` → 0 hits funcionales (sólo strings en `smoke-qw-1.ts` y este doc, esperado)
- ✅ `pnpm build` no incluye `scripts/` (excluido en tsconfig.json) → 0 errores de tipo por shim
- ✅ Smoke QW-1 actualizado, sin asserts obsoletos
- ⏳ Pendiente SSH a VPS: `systemctl stop surus-agente-borme.timer && mv /etc/systemd/system/surus-agente-borme.{service,timer} /etc/systemd/system/surus-agente-borme.{service,timer}.bak-2026-06-04 && systemctl daemon-reload`

## Reversión

Si en el futuro se necesita re-activar el scraping diario:
1. `git revert` este commit
2. `git checkout HEAD~1 -- lib/scrapers/borme.ts`
3. Ajustar el parser al schema actual del BOE datos abiertos
4. Re-crear `surus-agente-borme.service` y `.timer` desde la copia `.bak-2026-06-04`
