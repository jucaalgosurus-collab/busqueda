# Sprint Contract B — Cableado HERMES Gateway → 5 Scrapers Dossier

- **Agente**: Generator (HJC v2)
- **Sprint B** (continuación de Sprint 1 — VPS Cimientos)
- **Fecha**: 2026-06-02
- **VPS**: 88.198.93.52
- **Scope**: Cablear 5 scrapers del dossier app al HERMES Agent gateway vía cron jobs (no-agent + script pattern)
- **Restricción crítica**: NO romper `hermes-gateway.service`. NO tocar `/opt/hermes-v2/`.

## Success Criteria (PASS/FAIL)

### D1 — 5 SKILL.md creados
- [ ] `/root/.hermes/skills/surus/surus-agente-newsrooms/SKILL.md`
- [ ] `/root/.hermes/skills/surus/surus-agente-sectorial/SKILL.md`
- [ ] `/root/.hermes/skills/surus/surus-agente-prensa/SKILL.md`
- [ ] `/root/.hermes/skills/surus/surus-agente-boe-bop/SKILL.md`
- [ ] `/root/.hermes/skills/surus/surus-agente-linkedin/SKILL.md`
- [ ] Cada uno con YAML frontmatter válido (name, description, triggers, version)
- [ ] Documentan: scope desimplantación, filtros positivos/negativos, comando de run, cadence

### D2 — 5 cron jobs registrados en HERMES
- [ ] Watchdog pattern: `--no-agent --script ~/.hermes/scripts/scan-<name>.sh`
- [ ] Cadencia: cada 2 días, desfasados entre sí
- [ ] Retry: 3 reintentos, backoff 60s/300s/900s
- [ ] Logging: `/root/.hermes/logs/scan-<name>-YYYYMMDD.log`
- [ ] `hermes cron list` muestra los 5 jobs nuevos

### D3 — Systemd timers antiguos desactivados
- [ ] Backup en `/etc/systemd/system/.bak-hermes-dossier-2026-06-02/`
- [ ] 5 timers `disable --now`
- [ ] Services mantenidos (rollback)

### D4 — Smoke test
- [ ] Script `/opt/hermes-dossier/apps/dossier-industrial/scripts/smoke-gateway-cableado.sh`
- [ ] 7 asserts PASS
- [ ] Report JSON en `smoke-gateway-cableado-report.json`

### D5 — Reporte de prueba
- [ ] `hermes cron run surus-agente-newsrooms` ejecuta sin error
- [ ] Nuevas sources en DB con `outletType='corporate_newsroom'`
- [ ] Logs del scan en `/root/.hermes/logs/`

## Context Budget
~25k tokens (foco de trabajo: 5 archivos SKILL, 5 scripts bash, 5 cron jobs, 1 smoke, 1 ejecución)

## Dependencies
- HERMES Agent ya instalado y `hermes-gateway.service` activo
- 5 runners TS ya implementados en `/opt/hermes-dossier/apps/dossier-industrial/lib/agents/`
- DB `hermes_dossier` con schema Prisma aplicado (tablas: Company, Source, Operation, etc.)
- `.env` con DATABASE_URL, GEMINI_API_KEY, HUNTER_API_KEY

## Rollback
- Reactivar timers: `systemctl enable --now hermes-scan-*.timer`
- Remover jobs: `hermes cron rm <name>` × 5
