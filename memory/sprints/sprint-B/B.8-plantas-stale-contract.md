# Sprint Contract: B.8 — Plantas stale 3 escaneos

> **Tipo**: Señal débil operacional
> **Estado**: 🚧 **in_progress**
> **Fecha**: 2026-06-04
> **Agente**: `surus-agente-plantas-stale` (cadencia diaria, nocturno)
> **Brief Juan Carlos**: "Detectar plantas A&B que no han aparecido en ningún Source en las últimas 3 corridas consecutivas. Es una señal de que la sede está 'apagada' operativamente, no necesariamente cerrada, pero es un indicio para el equipo de Surus."

---

## 1. Hipótesis de detección

> "Si una `Plant` con `status='operativa'` o `status='en_inversion'` NO ha sido referenciada en ningún `Source.plantId` en los últimos 21 días (≈3 escaneos semanales) Y la planta no tiene `closureYear`, marcar como `isStale=true` con `staleReason='sin_novedad_21d'`. Si vuelve a aparecer un Source, restaurar `isStale=false` automáticamente."

Razones operativas:
- Una planta operativa con 50-200 empleados SIEMPRE genera ruido: notas de prensa locales, BOE/BOP con sanciones, LinkedIn movimientos, subcontratas locales.
- Si deja de generar ruido en 3 semanas, es una de estas 3 causas (en orden):
  1. **Cierre silencioso** (más común de lo que parece en A&B).
  2. **Vacío informativo real** (planta en parada técnica).
  3. **Sesgo del propio OSINT** (la planta nunca tuvo buen coverage).

Las plantas stale son **señal amarilla** para Surus: candidato a investigar.

## 2. Scoring

| Escenario | isStale | staleReason | Notas |
|---|---|---|---|
| Planta operativa, 0 sources 21d, sin closureYear | **true** | `sin_novedad_21d` | candidata a investigar |
| Planta operativa, ≥1 source 21d | false | null | normal |
| Planta con `closureYear` definido (cerrada) | false | `cerrada_registrada` | no se considera stale |
| Planta `status='cerrada'` o `status='vendida'` o `status='en_desmantelamiento'` | false | `estado_terminal` | no se considera stale |
| Planta recién creada (<21d) | false | `planta_recien_creada` | excluir del cálculo hasta cumplir 21d |
| Empresa sin plantas registradas | n/a | n/a | no aplica |

## 3. Definición de "novedad"

**`Source.plantId` = la FK explícita** entre noticia y sede (introducida en QW-10).

Query SQL base:
```sql
SELECT plantId, COUNT(DISTINCT id) AS sourceCount
FROM "Source"
WHERE plantId IS NOT NULL
  AND scrapedAt >= NOW() - INTERVAL '21 days'
GROUP BY plantId
HAVING COUNT(DISTINCT id) >= 1;
```

Si una planta NO aparece en este resultado → candidata a stale.

## 4. Arquitectura

```
┌─────────────────────────────────┐
│ lib/filters/                    │
│   plantas-stale.ts              │  ← applyPlantasStaleFilter
│     - findStalePlants           │     + isStaleReasonFrom
│     - restoreActivePlants       │
│     - reactivationRules         │
└──────────┬──────────────────────┘
           ▼
┌─────────────────────────────────┐
│ lib/agents/                     │
│   plantas-stale-runner.ts       │  ← runPlantasStaleAgent (idempotente)
│     - 1ª vez: backfill_30d      │     (marca TODAS las stale en 1 pasada)
│     - después: incremental_1d   │
└──────────┬──────────────────────┘
           ▼
  Plant.isStale=true|false (con update atómico)
  Plant.staleReason, staleAt
  SearchRun persistido
```

## 5. Schema (3 campos nuevos en Plant)

```prisma
model Plant {
  // ... existentes ...
  isStale     Boolean   @default(false)
  staleReason String?   // 'sin_novedad_21d' | 'cerrada_registrada' | 'estado_terminal' | 'planta_recien_creada' | null
  staleAt     DateTime? // última vez que se marcó stale (para auditoría)
  staleCheckedAt DateTime? // última vez que se evaluó (para idempotencia)
  @@index([isStale])
  @@index([staleCheckedAt])
}
```

Migración idempotente:
```sql
ALTER TABLE "Plant"
  ADD COLUMN IF NOT EXISTS "isStale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "staleReason" TEXT,
  ADD COLUMN IF NOT EXISTS "staleAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "staleCheckedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Plant_isStale_idx" ON "Plant"("isStale");
CREATE INDEX IF NOT EXISTS "Plant_staleCheckedAt_idx" ON "Plant"("staleCheckedAt");
```

## 6. UI — Badge amarillo en `/empresas/[slug]`

Cuando ANY planta de la empresa tiene `isStale=true`, mostrar:
```
⚠️ X planta(s) sin novedad en 21+ días
```
En la sección `Plantas` de `/empresas/[slug]`, en la card de cada planta stale:
```
[Alovera] ⚠️ sin_novedad_21d — última actividad: 28 mayo 2026
```

Sin color rojo (no es cierre confirmado), solo amarillo (`#facc15` o similar).

## 7. Cron

`surus-agente-plantas-stale`:
- Cadencia: **diaria**, 04:30 UTC (30 min tras `hermes-scan.timer`).
- Timeout: 60s (es un SQL, no fetch).
- Modo:
  - 1ª ejecución: `backfill_30d` (evalúa todas las plantas una vez).
  - Siguientes: `incremental_1d` (solo re-evalúa plantas stale + plantas nuevas desde ayer).

`deploy/run-agents.sh` (paso 6g tras B.7):
```bash
# 6g. Sprint B.8 Plantas stale — diario 04:30 UTC
echo ""
echo "▶ AGENT B.8: plantas stale (sin novedad 21d, cadencia 1d)" | tee -a "$LOG"
timeout 60 ./node_modules/.bin/tsx lib/agents/plantas-stale-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ plantas-stale falló" | tee -a "$LOG"
```

`/etc/systemd/system/hermes-plantas-stale.service` + `.timer`:
```ini
[Unit]
Description=HERMES Dossier — Plantas stale (B.8)
After=hermes-scan.service

[Service]
Type=oneshot
WorkingDirectory=/opt/hermes-dossier/apps/dossier-industrial
EnvironmentFile=/etc/hermes-dossier.env
ExecStart=/opt/hermes-dossier/apps/dossier-industrial/node_modules/.bin/tsx lib/agents/plantas-stale-runner.ts
TimeoutStartSec=120
User=root
```

```ini
[Unit]
Description=HERMES Dossier — Plantas stale timer (B.8, diario 04:30 UTC)

[Timer]
OnCalendar=*-*-* 04:30:00 UTC
Persistent=true
Unit=hermes-plantas-stale.service

[Install]
WantedBy=timers.target
```

## 8. Smoke asserts (13)

| # | Assert | Tipo |
|---|---|---|
| QW-1..QW-5 | QW regresión: /empresas, /, /hallazgos con Juan Carlos Alvarado para Surus | regresión |
| B.8-A | `lib/filters/plantas-stale.ts` exporta `applyPlantasStaleFilter` | estructural |
| B.8-B | Migración idempotente: `IF NOT EXISTS` en `isStale`, `staleReason`, `staleAt`, `staleCheckedAt` | estructural |
| B.8-C | `applyPlantasStaleFilter`: planta operativa sin sources 21d → isStale=true, sin_novedad_21d | funcional |
| B.8-D | `applyPlantasStaleFilter`: planta operativa con ≥1 source 21d → isStale=false | funcional |
| B.8-E | `applyPlantasStaleFilter`: planta con `closureYear` → isStale=false, cerrada_registrada | funcional |
| B.8-F | `applyPlantasStaleFilter`: planta `status='cerrada'` → isStale=false, estado_terminal | funcional |
| B.8-G | `applyPlantasStaleFilter`: planta recién creada <21d → isStale=false, planta_recien_creada | funcional |
| B.8-H | `applyPlantasStaleFilter`: empresa sin plantas → 0 inScope, 0 outOfScope, no error | funcional |
| B.8-H1 | `Plant.isStale=true` persiste en DB tras apply | persistencia |
| B.8-H2 | `applyPlantasStaleFilter` reactiva `isStale=false` cuando llega source nuevo | reactivation |
| B.8-H3 | Runner 1ª corrida backfill_30d registra SearchRun con `agentName='surus-agente-plantas-stale'` | persistencia |
| B.8-H4 | `matchHash` determinista `b8-{plantId}-{YYYY-MM-DD}` para idempotencia | helper |

## 9. Success criteria

- 12/12 B.8 asserts PASS en VPS.
- 1ª corrida backfill_30d: ≥0 plantas marcadas stale (depende de cobertura de news).
- 2ª corrida incremental_1d: 0 cambios (idempotente).
- UI: `/empresas/pescanova` muestra badge amarillo si tiene plantas stale.
- Cron `surus-agente-plantas-stale.timer` activo y `systemctl list-timers` lo muestra.

## 10. Limitaciones conocidas

1. **Depende de cobertura de news**: si los agentes no han scrapeado en 21d, TODAS aparecen stale. El smoke test filtra esto: solo evalúa si los agentes están vivos.
2. **No diferencia A&B vs no A&B**: aplica a TODAS las plantas. Si el usuario quiere solo A&B, añadir filtro `Company.sector IN [...]`.
3. **No considera noticias de empresa sin plantId**: el backfill QW-10 solo asignó plantId al 0.5% de los 3335 sources. Esto puede hacer que plantas activas aparezcan stale falsamente. Mejora futura: B.8.1 reasignar plantId con heurística mejor.
4. **Plantas con status='en_conversion' o 'en_proyecto'** no se evalúan (se asume que están en silencio por diseño).

## 11. Decisiones de diseño

### 11.1 Ventana 21 días (no 3 corridas textuales)

3 corridas textuales varía según cadencia del agente:
- Agentes 2d: 6 días reales
- Agentes 7d: 21 días reales
- Agentes 14d: 42 días reales

**21 días** = cadencia del agente más lento relevante (B.7 despidos-cto) + margen.

### 11.2 Reactiva automática (sin UI de unstash)

El agente marca `isStale=true` cuando evalúa, y `isStale=false` cuando llega un source nuevo. El operador NO necesita un botón "marcar activa" — la realidad se impone.

### 11.3 No reasignar plantId desde cero

B.8 SOLO lee `Source.plantId`. NO intenta reasignar heurísticamente. Esa es una mejora futura (B.8.1).

### 11.4 Sin Telegram alert (señal amarilla, no roja)

`isStale=true` NO dispara Telegram (no es desimplantación confirmada). Aparece como badge en `/empresas/[slug]` y `/hallazgos` cuando se filtra por empresa.

## 12. Entregables (9)

| # | Archivo | Estado | Líneas | Notas |
|---|---|---|---|---|
| 1 | `memory/sprints/sprint-B/B.8-plantas-stale-contract.md` | ✅ | este | sprint contract |
| 2 | `prisma/schema.prisma` | ⏳ | +5 | 4 campos nuevos en Plant + 2 índices |
| 3 | `deploy/plantas-stale-migration.sql` | ⏳ | ~10 | migración idempotente |
| 4 | `lib/filters/plantas-stale.ts` | ⏳ | ~180 | applyPlantasStaleFilter, helpers |
| 5 | `lib/agents/plantas-stale-runner.ts` | ⏳ | ~150 | runPlantasStaleAgent, idempotente |
| 6 | `app/empresas/[slug]/_components/PlantStaleBadge.tsx` | ⏳ | ~80 | badge amarillo en cada planta stale |
| 7 | `scripts/smoke-qw-b8.ts` | ⏳ | ~280 | 13 asserts (5 QW + 8 B.8) |
| 8 | `package.json` | ⏳ | +2 | +scan:plantas-stale, +smoke:qw-b8 |
| 9 | `deploy/run-agents.sh` + systemd | ⏳ | +5 | +B.8 step + .service + .timer |

## 13. Próximo paso (Sprint C)

Tras B.8 → **Sprint C (Enrichment 360º empresa)**: resolver data gap CIF/CNAE, fichas usables para Surus.

- Backfill CIF/CNAE vía Registro Mercantil + SABI/Informa + BORME histórico
- Tabs en `/empresas/[slug]`: Resumen | Consejo | Finanzas | Propiedades | Sanciones | Certificaciones | Histórico | Inventario | Contactos
