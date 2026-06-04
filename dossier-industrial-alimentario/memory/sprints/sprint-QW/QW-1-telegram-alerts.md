# Sprint Contract: QW-1 — Alertas Telegram signal_strength=strong

## Objetivo

Cuando un agente (BORME / Auctions / futuro) detecte un lead con `signalStrength='strong'`, enviar un mensaje al chat de Surus vía Telegram bot.

## Patrón de integración

El bot Python (`/opt/hermes-dossier/scripts/bot.py`) ya tiene la función `send(chat_id, text, parse_mode="HTML")` que habla con la API de Telegram. La estrategia de QW-1 es **reutilizar** ese bot vía subprocess en lugar de duplicar la lógica HTTP en TypeScript.

```
src: agent runner (BORME / Auctions)
  ↓ on signalStrength='strong' Source persistido
  ↓
lib/telegram/notify.ts → spawn('python3', ['/opt/hermes-dossier/scripts/bot.py', 'send', '--chat-id', CHAT_ID, '--text', text])
  ↓
bot.py CLI mode: 'send' arg
  ↓
Telegram API
```

## Reglas duras

1. **No silenciar errores**: si el subprocess falla, loggear pero NO tirar el agente. La persistencia en DB es la verdad, Telegram es notificación best-effort.
2. **Rate limit**: máximo 1 alerta por (empresa, source) por día. Si un agente genera 5 Source con `signalStrength='strong'` para la misma empresa en un día, se envía 1 alerta agregando las 5.
3. **Anti-spam**: máximo 20 alertas/día global. Si excede, log + skip.
4. **Plantilla**: solo información factual: empresa, planta, tipo de señal, URL al Source. Sin emojis, sin marketing.
5. **Opt-out**: la variable `TELEGRAM_ALERTS_ENABLED` (default `true`) en `.env` permite apagar globalmente.

## Agente

- Generator (Sonnet 4.6)

## Entregables

1. `memory/sprints/sprint-QW/QW-1-telegram-alerts.md` — este contrato
2. `lib/telegram/notify.ts` (~80-120 líneas) — wrapper `notifyStrong(source, company, run)`:
   - Lee `TELEGRAM_ALERTS_ENABLED` de process.env
   - Lee `TELEGRAM_CHAT_ID` de process.env
   - Construye texto con formato `parse_mode=HTML`
   - Spawnea `python3 /opt/hermes-dossier/scripts/bot.py send --chat-id X --text Y`
   - Devuelve `{ sent: bool, reason: string }`
3. `lib/telegram/cli-send.py` (~30 líneas) — modo CLI para `bot.py` (subprocess target)
4. `lib/agents/borme-runner.ts` — añadir llamada a `notifyStrong()` después de persistir Source con `signalStrength='strong'`
5. `lib/agents/auctions-runner.ts` — añadir llamada tras persistir `activos_detectados`
6. `scripts/smoke-qw-1.ts` (~150 líneas, 7 asserts):
   - QW-1-A `lib/telegram/notify.ts` existe
   - QW-1-B `notifyStrong` se llama desde borme-runner.ts y auctions-runner.ts
   - QW-1-C `notify.ts` tiene guard para `TELEGRAM_ALERTS_ENABLED=false` (no spawnea)
   - QW-1-D Anti-spam: 5 hits para misma empresa+día → 1 alerta
   - QW-1-E Anti-spam global: 21 hits → solo 20 enviados
   - QW-1-F Texto contiene empresa + URL
   - QW-1-G Plantilla sin emojis (regex `[\u{1F300}-\u{1FAFF}]` → 0 matches)
7. `package.json` — añadir script `notify:strong` (test manual)
8. `memory/state/active-state.md` — actualizar a "QW-1 Telegram alerts: completed"

## Success criteria

- 7/7 asserts verdes en smoke
- `lib/telegram/notify.ts` testeable sin red (modo `MOCK=1`)
- 0 envíos en smoke real (sólo se prueba la lógica de plantilla + guard)

## Cron / despliegue

- Sin cron dedicado. Se dispara desde los runners cuando persisten hits strong.
- En VPS: añadir `TELEGRAM_ALERTS_ENABLED=true` y `TELEGRAM_CHAT_ID=<id>` a `/opt/hermes-dossier/.env`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| bot.py no ejecutable en local | `notify.ts` tiene `MOCK=1` mode para testing |
| Subprocess cuelga | timeout 5s en spawn + SIGTERM |
| Múltiples alerts duplicadas | guard por (sourceId, day) en `NotifyDedup` table (en memoria del proceso) |
| Variable env no definida | guard explícito: si falta `TELEGRAM_CHAT_ID`, log warn + skip |
| Race condition entre agentes | el rate limit + dedup en memoria basta para este sprint |

## Siguiente paso en el orden

QW-1 → QW-4 briefing diario → QW-2 geocoding → QW-5 templates → QW-3 dark mode → B.2..B.8.
