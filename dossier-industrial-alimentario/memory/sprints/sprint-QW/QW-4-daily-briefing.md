# Sprint Contract: QW-4 — Briefing diario DeepSeek 09:00 Telegram

## Objetivo

Cada día a las 09:00 UTC, generar un briefing automático con los hallazgos del día (Sources con `deimplantationSignal=true` en últimas 24h), resumido por DeepSeek, y enviarlo al chat de Surus por Telegram.

## Patrón

```
cron systemd surus-daily-briefing.service
  OnCalendar=*-*-* 09:00:00 UTC
  ↓
lib/agents/daily-briefing-runner.ts
  ↓
1. Query DB: SELECT * FROM Source WHERE scrapedAt > NOW() - 24h AND deimplantationSignal = true ORDER BY signalStrength DESC LIMIT 50
  ↓
2. Prompt a DeepSeek (sk-2eb664d3bdf64d4687386ce6297c121b)
  ↓
3. Recibe resumen (≤200 palabras, 5 bullets, sin emojis)
  ↓
4. Si hay highlights signalStrength='strong', los destaca al inicio
  ↓
5. Envía vía lib/telegram/notify.ts (reutiliza QW-1)
```

## Reglas duras

1. **Idempotente por día**: si el cron se dispara 2 veces el mismo día, no se duplica el envío. `NotifyDedup` ya cubre (QW-1).
2. **Cero contenido inventado**: el prompt a DeepSeek debe listar EXCLUSIVAMENTE los títulos + URLs de los Sources del día. No se le pide inventar. Si la lista está vacía, mensaje = "Sin actividad relevante en las últimas 24h."
3. **Sin emojis en briefing final** (regla UI).
4. **Tono directo, no marketing**.
5. **Best-effort DeepSeek**: si la API falla, fallback a lista plana de títulos sin resumen.
6. **No más de 200 palabras** en el resumen. Si DeepSeek devuelve más, truncar a la última frase completa antes de 200 palabras.

## Agente

- Generator (Sonnet 4.6)

## Entregables

1. `memory/sprints/sprint-QW/QW-4-daily-briefing.md` — este contrato
2. `lib/agents/daily-briefing-runner.ts` (~150-200 líneas):
   - `runDailyBriefing()`: query DB + call DeepSeek + format texto + notifyStrong (con un "virtual source" que apunta al briefing)
   - `BRIEFING_AGENT_NAME = 'surus-agente-briefing'`
   - `BRIEFING_CRON_TAG = 'daily-09:00'`
3. `lib/ia/deepseek.ts` (~80 líneas) — wrapper minimal de DeepSeek API REST
4. `scripts/smoke-qw-4.ts` (~120 líneas, 6 asserts):
   - QW-4-A `lib/agents/daily-briefing-runner.ts` existe
   - QW-4-B `lib/ia/deepseek.ts` existe con función `summarizeFindings(prompt)`
   - QW-4-C Daily-briefing-runner NO envía si 0 hallazgos
   - QW-4-D Daily-briefing-runner llama a notifyStrong con virtual source
   - QW-4-E MOCK DeepSeek: respuesta pre-canned produce briefing ≤200 palabras
   - QW-4-F Briefing sin emojis, contiene 5 secciones
5. `package.json` — script `briefing:daily` (test manual)
6. `systemd/surus-daily-briefing.service` + `.timer` — cron 09:00 UTC
7. `memory/state/active-state.md` — actualizar a "QW-4 Daily briefing: completed"

## Success criteria

- 6/6 asserts verdes en smoke
- Briefing generado en <10s (incluye DeepSeek API call)
- Fallback funciona si DeepSeek no responde

## Cron

```
[Unit]
Description=Surus Daily Briefing

[Service]
Type=oneshot
WorkingDirectory=/opt/hermes-dossier/apps/dossier-industrial
ExecStart=/usr/bin/pnpm tsx lib/agents/daily-briefing-runner.ts
EnvironmentFile=/opt/hermes-dossier/.env

[Install]
WantedBy=multi-user.target
```

```
[Unit]
Description=Surus Daily Briefing timer

[Timer]
OnCalendar=*-*-* 09:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

## Riesgos

| Riesgo | Mitigación |
|---|---|
| DeepSeek API quota agotada | fallback a lista plana de títulos |
| Cron no se dispara | `Persistent=true` para que corra al boot si se perdió |
| 0 hallazgos en 24h | mensaje "Sin actividad" explícito (no error) |
| Briefing alucina | prompt con lista cerrada de URLs+títulos, sin libertad de inventar |

## Siguiente paso en el orden

QW-4 → QW-2 Geocoding → QW-5 Templates email → QW-3 Dark mode → B.2..B.8
