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

| # | Fix | Tipo | Bloquea |
|---|-----|------|---------|
| D.1.0 | Decisión deploy: Vercel (build Next.js) vs abrir VPS:3002 con TLS — **REQUIERE INPUT** | DECISION | deploy |
| D.1.1 | Regenerar token Telegram (bot JuanAlimentosbot id 8430000566) en `@BotFather`, actualizar `/opt/hermes-dossier/.env.telegram` | OPS manual | Reportes Telegram |
| D.1.2 | Mover `Surus2024!` de `bot.py` y `daily-report.sh` a `/etc/hermes/hermes.env` chmod 600, rotar password DB | OPS+SECRET | credencial expuesta |
| D.1.3 | Investigar 4 procesos `aionui`/`aioncore` (5 puertos) + `tor`/`cups` innecesarios | OPS | superficie sospechosa |
| D.1.4 | Aplicar `daysBack: 2` a `lib/agents/runner.ts:87` (newsroom) | CODE 1 línea | "BASURA" 50% de hallazgos |
| D.1.5 | Purgar 121 sources pre-2025-01-01 de DB | SQL | ruido |
| D.1.6 | Cache de verificación Hunter: tabla `EmailVerification { email UNIQUE, status, verifiedAt }` con TTL 30d. Regla 10208 | CODE+SCHEMA | re-trabajo |
| D.1.7 | Backup diario DB: cron `pg_dump hermes_dossier \| gzip > /opt/hermes-dossier/backups/db-$(date +%F).sql.gz` retain 7d | OPS | disaster recovery |
| D.1.8 | Fix query builder C.3 patentes: 0 in-scope en 3 ejecuciones del timer | CODE | C.3 agente no produce valor |
| D.1.9 | LinkedIn: arreglar cookie (regenerar) o cambiar a RapidAPI alternativo | OPS+CODE | contactos planta |
| D.1.10 | Auditar `surusclientes.vercel.app` para aprender patrón de referencia — **REQUIERE INPUT** | RESEARCH | UI quality |
| D.1.11 | Ocultar panel admin (auth o ruta no-listada) — msg 7729 | CODE | outreach seguro |

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
