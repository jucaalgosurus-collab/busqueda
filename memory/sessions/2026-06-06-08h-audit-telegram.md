# SESIÓN 2026-06-06 08:00 UTC — Auditoría Telegram + Status v2

## Auditoría Telegram (URGENTE-AUDIT-TELEGRAM-001) ✅

### @JuanAlimentosbot (token 8430000566, TrabajoSurus)
- **Service**: `hermes-bot.service` activo, ejecutando `/opt/hermes-dossier/bot/bot.py`
- **Token válido**: confirmado vía getMe
- **Función**: bot interactivo polling con /stats, /empresas, /contactos, /ultimo, /scan
- **Reportes**: el daily-report.sh (timer 06:00 UTC) envía "HERMES Dossier — Reporte Diario" con Sources/In-scope/Empresas
- **PROBLEMA DETECTADO**: log muestra HTTP 401 en sendMessage (línea 70) — el bot recibe TOKEN válido pero algo en el path falla. Sospecha: `TELEGRAM_CHAT_ID=7564066998` que podría ser el user_id del propio Juan Carlos, no el chat_id correcto. Verificar getUpdates para confirmar el chat_id real.

### @Contactohermesbot (token 8853340588, Contactohermes)
- **Token válido**: confirmado vía getMe
- **Service**: NO HAY service systemd activo
- **Programa escritor**: PROBABLEMENTE el cron job `surus-briefing-8am` en `/root/.hermes/cron/jobs.json` (estado: `enabled:false`, paused_at=2026-05-31). El prompt de ese job genera briefings con "demandas / ofertas / matches" formateo.
- **CONCLUSIÓN**: el job está pausado, pero el mensaje del 8am HOY pudo ser:
  1. Cola residual antes de la pausa (poco probable, fue 14 días)
  2. Re-disparador desde el hermes-agent gateway (puerto 8080 uvicorn activo)
  3. El bot.py de /opt/hermes-dossier/bot/ con chat_id erróneo que escribe al chat equivocado
- **ACCIÓN**: NO borrar. Los 2 bots pueden coexistir (@JuanAlimentosbot = bot oficial HERMES Dossier, @Contactohermesbot = bot personal Marcela). El 8am "Surus 1098..." es de V3 (hermes-agent). Si genera conflictos reales, evaluar pausar hermes-agent gateway.

## Status del PLAN-MAESTRO-v2 (08:00 UTC 2026-06-06)

### % de avance global: ~8%

| Sprint | % | Estado |
|---|---|---|
| S.2 Top-N | 70% | 3/4 archivos, 11/11 tests OK, falta commit+push+informe |
| G.1 Scrapling+6 adapters | 0% | — |
| G.2 Adaptive selectors | 0% | — |
| G.3 Gemini grounding | 0% | — |
| M.1 EventCluster | 0% | — |
| UI.1 Sector selector | 0% | — |
| UI.2 Deep Dive | 0% | — |
| HIDDEN-1 Menú Surus | 0% | — |
| CRM.1 Pipeline | 0% | — |
| Orch.1 Paralelización | 0% | — |

### Estimación restante: 8-12 horas de trabajo

## Decisiones del usuario necesarias
- **D-12**: ¿Apago hermes-agent gateway (Surus V3) completamente? (R-16 permite no tocarlo, pero si el 1098/6672/176 persiste, hay que pausarlo)
- **D-13**: ¿Sigo modo execute-to-completion sin interrupciones, o pides ver cada sprint al cierre?

## Tareas inmediatas
1. Cerrar S.2 (commit+push+informe) — 15 min
2. Auditoría profunda de S.2 con code-reviewer + evaluator — 20 min
3. Iniciar G.1 (Scrapling + 6 adapters) — 2h
4. Continuar cadena G.2 → G.3 → M.1 → UI.1 → UI.2 → HIDDEN-1 → CRM.1 → Orch.1

## Decisión aplicada por defecto
- Modo execute-to-completion, sin pausa (instrucción 2026-06-06)
- D-12 default: NO apagar hermes-agent V3 (R-16), pero si el bot fantasma persiste, ejecutar pausa
- D-13 default: CONTINUAR sin interrupciones

---
**Próxima acción**: cerrar S.2 (commit+push), arrancar G.1 en paralelo con code-reviewer/evaluator de S.2.
