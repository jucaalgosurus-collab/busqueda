# LinkedIn Plan B — Operación en VPS HERMES

> Cómo activar y mantener el agente LinkedIn con sesión real de LinkedIn vía Playwright.
> Reemplaza/augmenta al Plan A (Google CSE) sin pérdida de cobertura.

## TL;DR

```bash
# 1. Login manual inicial (1 sola vez, 5 min)
ssh root@88.198.93.52
cd /opt/hermes-dossier/apps/dossier-industrial
xvfb-run -a pnpm linkedin:refresh-cookie

# 2. Copiar el valor sugerido a .env (chmod 600)
cat /opt/hermes-dossier/.env.linkedin-suggestion
# → añadir LINKEDIN_LI_AT="..." al .env

# 3. Activar Plan B
echo 'LINKEDIN_PLAYWRIGHT_ENABLED=true' >> /opt/hermes-dossier/.env

# 4. Smoke test (Plan B real, 1 query)
pnpm scan:linkedin:playwright --max-queries=1

# 5. Si todo OK, dejarlo correr en el systemd timer
systemctl restart hermes-scan-linkedin.timer
```

## Arquitectura

```
runLinkedInAgent()                           ← entry point público (orquestador, /agentes, scripts)
  └─ runLinkedInDispatcher()                 ← decide Plan A vs Plan B
       ├─ decideLinkedInStrategy()           ← LINKEDIN_PLAYWRIGHT_ENABLED + LINKEDIN_LI_AT
       ├─ if Plan A: runGoogleCSEAgent()     ← runner clásico (axios + cheerio)
       └─ if Plan B: runLinkedInPlaywrightAgent()  ← browser headless con li_at
            ├─ chromium.launchPersistentContext(profileDir)
            ├─ applyStealthToContext(ctx)    ← 9 parches de stealth
            ├─ inject li_at si perfil vacío
            └─ para cada (role, company):
                 ├─ rateLimiter 1req/8s
                 ├─ goto linkedin.com/search/results/people/...
                 ├─ detectCaptcha (input[name="pin"], "security check", URL)
                 └─ extract [data-chameleon-result-urn] → PlantContact (via='playwright')
```

## Variables de entorno (en `/opt/hermes-dossier/.env`)

| Variable | Default | Descripción |
|---|---|---|
| `LINKEDIN_PLAYWRIGHT_ENABLED` | `false` | Opt-in. Pasar a `true` solo tras smoke test. |
| `LINKEDIN_LI_AT` | `""` | Cookie `li_at` (≥20 chars). Obtener con `pnpm linkedin:refresh-cookie`. |
| `LINKEDIN_FALLBACK_AFTER_CAPTCHA` | `true` | Tras captcha, usar Google CSE el resto del día. |
| `LINKEDIN_PROFILE_DIR` | `/opt/hermes-dossier/.linkedin-profile/linkedin-storage` | Perfil persistente Playwright. |
| `HERMES_ENV_PATH` | `/opt/hermes-dossier/.env` | Path al .env (usado por refresh-cookie). |
| `TELEGRAM_MARCELA_TOKEN` | (existente) | Bot token para alertas de captcha. |
| `TELEGRAM_MARCELA_CHAT_ID` | (existente) | Chat ID para alertas. |

## Procedimiento: login manual inicial

LinkedIn **no permite** login programático headless sin levantar captcha. El operador Surus
debe hacer login en un browser visible **una sola vez**. La cookie `li_at` se persiste y se
reutiliza en los runs subsiguientes (30-60 días típicamente).

```bash
ssh root@88.198.93.52
cd /opt/hermes-dossier/apps/dossier-industrial
xvfb-run -a pnpm linkedin:refresh-cookie
```

El script:
1. Abre un Chromium con perfil persistente.
2. Carga `linkedin.com/login`.
3. Espera a que el operador haga login (hasta 120s).
4. Detecta `li_at` en las cookies.
5. Vuelca el valor a `/opt/hermes-dossier/.env.linkedin-suggestion` (chmod 600).
6. Imprime el comando para mergear al .env.

## Procedimiento: captcha hit

Si LinkedIn detecta el headless y muestra captcha:
- El runner aborta inmediatamente.
- Screenshot a `/opt/hermes-dossier/logs/linkedin-captcha-<timestamp>.png`.
- Mensaje a Telegram (bot Marcela).
- `searchRun.errorsCount++` con detalle.
- **Automático**: el dispatcher cae al Google CSE para el resto del run.

**Recuperación manual** (cuando el operador lo note):
```bash
pnpm linkedin:refresh-cookie   # re-login desde cero
```

## Procedimiento: cambiar cookie expirada

Si tras 30-60 días LinkedIn invalida `li_at`:
1. Los runs del Plan B fallarán con error de auth en el primer goto.
2. El dispatcher los marcará como `errors` y caerá al Google CSE.
3. El operador ejecuta `pnpm linkedin:refresh-cookie` y actualiza `.env`.

## Procedimiento: desactivar Plan B de emergencia

```bash
# En /opt/hermes-dossier/.env, poner:
LINKEDIN_PLAYWRIGHT_ENABLED=false

# O vía SSH:
ssh root@88.198.93.52 "sed -i 's/^LINKEDIN_PLAYWRIGHT_ENABLED=true/LINKEDIN_PLAYWRIGHT_ENABLED=false/' /opt/hermes-dossier/.env"
systemctl restart hermes-scan-linkedin.timer
```

El comportamiento vuelve al Google CSE sin pérdida de datos. Los `PlantContact.via='playwright'`
previos siguen en DB — son consultables y re-enrichables.

## systemd timer

El timer `hermes-scan-linkedin.timer` ya existe (creado en Sprint 4).
Tras activar Plan B, simplemente reiniciarlo:

```bash
systemctl restart hermes-scan-linkedin.timer
systemctl list-timers hermes-scan-linkedin.timer
```

El servicio `hermes-scan-linkedin.service` ejecuta `pnpm scan:linkedin` (que pasa por el dispatcher).

## Monitoring 48h

Revisar tras activar Plan B:

```bash
# 1. Ver runs recientes
pnpm tsx -e "import('./lib/db.js').then(async ({prisma}) => { const runs = await prisma.searchRun.findMany({ where: { agentName: 'linkedin-osint' }, orderBy: { startedAt: 'desc' }, take: 10 }); console.log(JSON.stringify(runs, null, 2)); })"

# 2. Contar contactos por método de captura
pnpm tsx -e "import('./lib/db.js').then(async ({prisma}) => { const c = await prisma.plantContact.groupBy({ by: ['via'], _count: { _all: true } }); console.log(JSON.stringify(c, null, 2)); })"

# 3. Health check del perfil persistente
du -sh /opt/hermes-dossier/.linkedin-profile/

# 4. Verificar no hay captcha reciente
ls -lt /opt/hermes-dossier/logs/linkedin-captcha-*.png 2>/dev/null | head -5
```

**Alertas rojas** (actuar):
- `errorsCount > 3` en 2 runs consecutivos → sesión probablemente caducada.
- Captcha screenshot nuevo en las últimas 24h → LinkedIn detectó headless, re-login.
- Disco de perfil > 500 MB → limpiar `Cache/Code Cache/`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| LinkedIn rota `li_at` (30-60 días) | Perfil persistente + `refresh-cookie`; fallback automático a Google CSE |
| LinkedIn detecta headless / captcha | Screenshot + Telegram + fallback automático |
| ToS de LinkedIn | Surus asume el riesgo como operador comercial; opt-in via env flag |
| Disco: perfil persistente crece | Limpieza manual; alerta healthcheck |
| VPS caído durante run | `--no-sandbox` + timeout 5 min por query + `AbortController` |
| Operador no disponible para re-login | El fallback Google CSE mantiene cobertura mínima |

## Garantías

- **0 pérdida de datos**: `PlantContact.upsert` con id determinista `li-${hash(url)}`. Plan A → Plan B es transición atómica.
- **0 impacto en otros agentes**: el dispatcher solo afecta al agente LinkedIn.
- **0 impacto en `/opt/hermes-v2/`**: la app Surus V3 no toca este código.
- **0 impacto en Surus V3**: la capa dispatcher es puramente aditiva.
