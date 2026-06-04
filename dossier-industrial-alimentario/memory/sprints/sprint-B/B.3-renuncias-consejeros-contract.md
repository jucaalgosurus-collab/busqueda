# Sprint Contract: B.3 — Renuncias masivas de consejeros (señal amarilla media)

**Sprint**: B.3
**Agente**: generator (Sonnet)
**Evaluador**: evaluator (Opus, adversarial)
**Orquestador**: HJC
**Fecha**: 2026-06-04
**Stack**: Next.js 15.5.4 · Prisma 5 · PostgreSQL 16 · VPS 88.198.93.52
**Estado**: Pendiente

## Contexto

BORME (B.1) ya scrapea 1715+ actos societarios. Muchos contienen "Ceses/Dimisiones"
de administradores/consejeros. Cuando una empresa A&B tiene **≥3 ceses en 90 días
en cargos de consejo** (no simples administradores solidarios), es **señal amarilla
media** de desimplantación: el consejo se vacía, no hay governance, la empresa
puede estar en transición (venta, cierre, concurso silencioso).

El usuario aprobó el sprint B (señales débiles) el 2026-06-03. B.1 + B.2 + B.9 ya
completados. B.3 cubre el patrón de renuncias masivas.

## Scope

### SÍ
- Filtro sobre `Source.contentText` que extrae nombres dimitidos
- Detector "masivo": ≥3 ceses distintos en ventana 90d por `companyId`
- Solo cargos de consejo: `Cons.`, `Consejero`, `Mie. Cons.`, `Pres. Cons.`, `Secr. Cons.`, `Vocal Cons.`
- NO simples administradores solidarios (`Adm. Solid.`, `Adm. Único`, `Adm. Mancomunado`)
- Persistencia: nuevo `Source` row con `outletType='bofficial_borme'`, `signalStrength='medium'`
  (vía `deimplantationSignal=true`), `contentText` que resume los ceses detectados
- Runner diario, cadencia 1d (porque BORME es diario y las dimisiones hay que
  detectarlas rápido para que Surus pueda actuar)
- 1ª corrida: analizar los 1715 actos BORME pre-existentes + backfill
- Smoke automatizado (12 asserts)

### NO
- B.4..B.n
- Tocar `lib/agents/borme-runner.ts` (reutiliza datos ya scrapeados)
- M&A, concursos, subastas, email/LinkedIn automático
- `/opt/hermes-v2/` o `hermes-gateway.service`
- UI
- Empresas que NO tengan `companyId` (no se puede agrupar)

## Archivos

### Crear
- `lib/filters/renuncias-consejeros.ts` (90-130 líneas): `extractCeses(text): string[]`,
  `isConsejeroCargo(cargo): boolean`, `groupCesesByCompany(companyId, daysBack): Promise<CesGroup[]>`,
  `detectMasiveRenuncias(companyId, daysBack=90, minCeses=3): Promise<RenunciasMatch | null>`
- `lib/agents/renuncias-runner.ts` (100-140 líneas): runner que para cada
  A&B con `companyId` filtra sus Source rows, agrupa, y persiste Source nuevos
  cuando `count >= 3` en 90d
- `scripts/smoke-qw-b3.ts` (140-180 líneas, 12 asserts)
- `memory/sprints/sprint-B/B.3-renuncias-consejeros-report.md`

### Modificar (delta mínimo)
- `package.json`: añadir `scan:renuncias` + `smoke:qw-b3`
- `deploy/run-agents.sh`: añadir paso B.3 (renuncias) tras borme
- `memory/state/active-state.md`: actualizar

### NO TOCAR
- B.1, B.2, B.9 código
- UI
- `/opt/hermes-v2/`
- `hermes-gateway.service`

## Success criteria (PASS = 12/12 asserts verdes)

### QW regresión (5 asserts)
- QW-1 [ ] 6 sectores amplios visibles en /empresas
- QW-2 [ ] ≥1 empresa por sector en DB
- QW-3 [ ] Navbar contiene "Juan Carlos Alvarado para Surus"
- QW-4 [ ] Footer contiene "Juan Carlos Alvarado para Surus"
- QW-5 [ ] Header del dashboard contiene "Juan Carlos Alvarado para Surus"

### B.3 (5 asserts)
- B.3-A [ ] Filtro renuncias: extrae ≥3 ceses consejeros de una empresa A&B
  con texto real del DB en ≤100ms
- B.3-B [ ] Filtro descarta cargos NO consejero: `Adm. Solid.`, `Adm. Único` →
  no cuenta
- B.3-C [ ] Detector masivo: ≥3 ceses consejeros en 90d → match, <3 → null
- B.3-D [ ] Idempotente: 2 corridas mismo día no duplican Source rows
  (UNIQUE por `(companyId, periodStart, periodEnd)`)
- B.3-E [ ] Cron/cadencia 1d registrada en ScanConfig

### Estado (2 asserts)
- EST-1 [ ] `memory/state/active-state.md` actualizado a "Sprint B.3 Renuncias: completed"
- EST-2 [ ] `B.3-renuncias-consejeros-report.md` escrito con métricas reales
  (≥1 Source nuevo si hay match real, sino log explicativo)

## Detector — Algoritmo

```
renuncias-runner.ts (runRenunciasAgent):
  1. Carga ScanConfig { agentName: 'surus-agente-renuncias' }, upsert cadenceDays=1
  2. Carga todas las A&B con companyId en Company (top 167)
  3. Para cada empresa:
     a. Query Source WHERE companyId = X AND outletType='bofficial_borme'
        AND publishedAt >= now() - 90d AND contentText ILIKE '%Ceses/Dimisiones%'
     b. Para cada Source:
        - Extrae bloque "Ceses/Dimisiones" del contentText
        - Parsea cargos: split por ';' o '.'
        - Filtra: isConsejeroCargo(cargo) = true
        - Cuenta nombres únicos dimitidos
     c. Si count >= 3 → generar Source nuevo con summary
  4. Persiste Source rows con title="[B.3] Renuncia masiva consejeros — {CompanyName}
     ({count} ceses en 90d)", outletType='bofficial_borme',
     deimplantationSignal=true, contentText con nombres+cargos
  5. Log SearchRun
  6. (futuro) notifyMedium si Telegram quotas disponibles
```

## Reglas de matching (anti-falso-positivo)

| Regla | Cómo se enforce |
|---|---|
| Solo cargos de consejo | Regex `/Cons\.|Consejero|Miembro.*Consejo|Pres\..*Cons\.|Secr\..*Cons\.|Vocal.*Cons\./i` |
| ≥3 ceses distintos | Set de nombres dimitidos, count unique |
| Ventana 90d | `publishedAt >= now() - 90d` |
| Empresa A&B | Filtro sobre `Company` table (excluye empresas disueltas/extinguidas) |
| Idempotencia | `UNIQUE(companyId, contentHash)` vía upsert con hash determinista |
| Anti-concursos | Si en el mismo BORME hay "Disolución" o "Extinción" → outOfScopeReason='contexto_concurso' |
| No cargos solidarios | Excluir `Adm\.\s*Solid\.|Adm\.\s*Único|Adm\.\s*Mancomunado|Liquidador` |

## Seguridad

- Sin nuevos endpoints (es agente batch)
- Sin secretos (usa DB local)
- SQL parametrizado (Prisma)
- Validación de entrada: regex robusto contra Nombres con tildes/ñ/guiones

## Definition of Done

- `pnpm tsc --noEmit` exit 0
- `pnpm tsx scripts/smoke-qw-b3.ts` 12/12 PASS en VPS
- 1ª corrida: 0 errores, duración <60s
- `B.3-renuncias-consejeros-report.md` con timestamp 1ª corrida, items detectados,
  in-scope, out-of-scope, ms totales
- Estado preservado
- Commit pusheado
