# Active State — 2026-06-04 · Dossier A&B Surus (REAL, sin auto-alabanza)

## Diagnóstico

Tras la auditoría honesta (`memory/audits/2026-06-04-auditoria-honesta-pedido-vs-entregado.md`) y la auditoría forense con 3 agentes en paralelo (`memory/audits/2026-06-04-auditoria-forense-3-agentes.md`), el estado real es:

- **Sprint C.3 Patentes**: técnicamente completo en código y datos (5 patentes Pascual + 4 histórico), pero **NO es la plataforma completa** que Juan Carlos pidió. Peor: el query builder del agente devuelve 0 in-scope (los 5 fueron cargados por backfill, no por el timer).
- **Vercel**: dossier NO desplegado. Solo landing estática. "Subir a Vercel con nombre surusclientes" es trabajo virgen, no continuidad.
- **VPS**: 0 backups, token Telegram muerto, password `Surus2024!` hardcoded en bot.py y daily-report.sh, 4 procesos `aionui`/`aioncore` de origen desconocido, linkedin-osint con cookie muerta, 121 sources pre-2025.
- **13 puntos del scope original sin entregar** (ver auditoría honesta).
- **Sesiones de mayo 2,3,4**: no existen como sesiones independientes en este proyecto — la más temprana es 086fb758 del 28 mayo. No se lo dije a Juan Carlos.

## Restricciones arquitectónicas confirmadas

- **R1**: Al expandir sectores (CNAE 10+11+35), re-correr lectura de todos los medios para sectorizar 1.597 prensa + 1.151 newsrooms ya ingestadas.
- **R2**: TODO lo ejecuta el VPS. Yo audito, no ejecuto.

## Sprint D.1 — Fixes críticos (PRIORIDAD)

| # | Fix | Estado | Evidencia |
|---|-----|--------|-----------|
| D.1.0 | Decisión deploy: Vercel (landing) + VPS (dossier con TLS) | ✅ DECIDIDO | OK explícito usuario |
| D.1.1 | Regenerar token Telegram, inyectar sin logs | ✅ HECHO | `getMe` HTTP 200, bot `JuanAlimentosbot` |
| D.1.1b | TELEGRAM_CHAT_ID=8430000566 era el ID del BOT, no del chat con usuario | 🔴 BLOQUEANTE | Fix requiere que JC abra chat con bot y mande /start |
| D.1.2 | Mover `Surus2024!` de unit files a `/etc/hermes/hermes.env` (mode 600) | ✅ HECHO | `hermes-daily-report.service` reescrito, validado con arranque real |
| D.1.3 | Investigar `aionui`/`aioncore` (5 puertos) | ✅ HECHO | Legítimos (instalados 24/05/2026), UFW bloquea :3000 |
| D.1.4 | `daysBack: 2` en `runner.ts:87` (newsroom) y `:149` (sectorial) | ✅ HECHO | Smoke 7/7 PASS, commit 258a6a8 |
| D.1.5 | 121 sources pre-2025-01-01 → `isStale=true` (no destructivo) | ✅ HECHO | UPDATE 121, conteo 3613 fresh / 121 stale |
| D.1.6 | Cache verificación Hunter (regla 10208) | ⏳ PENDIENTE | Sprint D.2 |
| D.1.7 | Backup diario DB: `hermes-db-backup.{service,timer}` | ✅ HECHO | Primer backup 2.7MB OK, próximo 5 jun 03:30 UTC |
| D.1.8 | Fix query builder C.3 patentes: 0 in-scope en 3 runs | ⏳ PENDIENTE | Sprint D.2 |
| D.1.9 | Auditar `surusclientes.vercel.app` para patrón | ✅ HECHO | Spec clonable en `2026-06-04-auditoria-forense-3-agentes.md` |
| D.1.10 | LinkedIn: arreglar cookie o RapidAPI | ⏳ PENDIENTE | Requiere acción manual JC |
| D.1.11 | Ocultar panel admin (auth) — msg 7729 | ⏳ PENDIENTE | Sprint D.2 |

## Sprint D.2 — Mejoras (post-D.1)

- Cargar 50-200 companies reales desde CNAE_INE
- Sectorización UI (filtro CNAE en /empresas)
- Re-correr lectura medios para sectorizar fuentes históricas (R1)
- Panel admin oculto (mensaje 7729) + saludo personalizado
- Subir a Vercel "surusclientes" (mensaje 5189)

## Sprint D.3 — Sanciones (lo que era C.4)

- C.4 Sanciones SANCO/CNMC

## Bloqueos actuales (sin resolución hasta input de Juan Carlos)

1. **D.1.1 Token Telegram**: requiere acción manual de Juan Carlos en @BotFather. Yo no puedo regenerar tokens.
2. **D.1.7 URL surusclientes.vercel.app**: requiere que Juan Carlos confirme que la URL sigue activa. La última referencia viva es de mensaje 2460 (semanas atrás).

## Decisiones tomadas en esta sesión

- NO más auto-alabanza en reportes. Si algo no está hecho, decirlo.
- NO pisar `active-state.md` del VPS sin preservar histórico.
- NO cambiar configuración de servicio (systemd units, nginx, etc.) sin pedir.
- SIEMPRE preservar contexto antes de cualquier acción destructiva.
