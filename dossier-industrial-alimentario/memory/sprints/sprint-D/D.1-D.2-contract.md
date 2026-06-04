# Sprint Contract D.1+D.2 — Fixes y mejoras plataforma

**Fecha**: 2026-06-04
**Origen**: Orden explícita del usuario "tienes que aplicarlos todos" tras 7 fixes D.1 ya completados

## Reglas innegociables

1. **NO** tocar configuraciones de servicio (`*.service`, `*.timer`, nginx, systemd) sin OK explícito
2. **NO** cambiar el orden de los unit files sin preservar original con `.bak-<ts>`
3. **NO** ejecutar `pnpm build` o `prisma migrate` sin commit previo
4. Cada fix tiene su **commit individual** con conventional commits
5. Cada fix tiene **smoke test propio** que pasa local antes de deployar a VPS
6. Memoria preservada en cada sprint (no pisar active-state.md)
7. Restricción R1: re-correr lectura de medios al expandir sectores (NO se hace en este sprint, queda para D.2)
8. Restricción R2: TODO lo ejecuta el VPS, yo audito, no ejecuto scrapers localmente

## Sprints a ejecutar (4 en paralelo)

### S1 — D.1.2b: Mover OPENAI_API_KEY de hermes-gateway a env-file
- **Tipo**: OPS+SECRET
- **Agente**: general-purpose
- **Output esperado**:
  1. `/etc/hermes/hermes.env` extendido con `OPENAI_API_KEY=sk-...` y `OPENAI_BASE_URL=https://api.deepseek.com/v1`
  2. `/etc/systemd/system/hermes-gateway.service` reescrito: quitar las 2 líneas `Environment=OPENAI*` inline, verificar que `EnvironmentFile=/root/.hermes/.env` siga presente (es OTRO env-file distinto a /etc/hermes/hermes.env)
  3. Backup del unit file con `.bak-<ts>`
  4. `systemctl restart hermes-gateway.service` validar que arranca sin error
  5. Verificar que el gateway responde (curl a su endpoint)
- **Criterio PASS**:
  - `grep -c "OPENAI_API_KEY=sk-" /etc/systemd/system/hermes-gateway.service` → 0
  - `systemctl is-active hermes-gateway.service` → active
  - `journalctl -u hermes-gateway.service -n 5` → sin errores

### S2 — D.1.6: Cache verificación Hunter.io (regla 10208)
- **Tipo**: CODE+SCHEMA
- **Agente**: general-purpose
- **Output esperado**:
  1. Nuevo modelo Prisma `EmailVerification { email UNIQUE, status enum, verifiedAt DateTime, expiresAt DateTime }` con TTL 30d
  2. `prisma migrate dev` con migración `add_email_verification`
  3. Helper `lib/agents/email-verifier.ts` con función `verifyEmail(email, hunterKey)` que:
     - Lee cache primero; si `expiresAt > now`, devuelve status cacheado
     - Si no, llama a Hunter, persiste resultado con `expiresAt = now + 30d`
     - Si Hunter devuelve 429 (rate limit), NO cachea y propaga el error
  4. Smoke test `scripts/smoke-hunter-cache.ts` con 4+ asserts (cache hit, cache miss, expirado, rate limit)
  5. Integración mínima: revisar si hay algún lugar en el código que YA verifica emails con Hunter para enchufar el helper
- **Criterio PASS**:
  - `npx tsx scripts/smoke-hunter-cache.ts` → 4+/4 PASS
  - DB migration aplicada en VPS
  - Email verificado 2 veces en <30d solo consume 1 crédito Hunter

### S3 — D.1.8: Fix query builder C.3 patentes (0 in-scope)
- **Tipo**: CODE+DEBUG
- **Agente**: general-purpose
- **Output esperado**:
  1. Análisis de `lib/agents/patentes-runner.ts` y `lib/filters/patentes.ts` para entender el query builder
  2. Comparar con `scripts/patentes-backfill.ts` (que SÍ cargó 5 patentes) — encontrar la diferencia
  3. Logs de los 3 runs del timer: `journalctl -u surus-agente-patentes --since "30 days ago"`
  4. Hipótesis inicial probable: el query builder usa `companyName` con match exacto, pero OEPM devuelve nombres con "S.A." / "SA" / "," etc. que no matchean con los slugs
  5. Fix propuesto: normalizar nombres (lowercase, quitar S.A./SA, quitar comas) antes del match
  6. Smoke test `scripts/smoke-patentes-match.ts` con 5+ casos de matching
  7. Correr 1 vez el agente manualmente en VPS con logs y validar que ahora SÍ devuelve in-scope
- **Criterio PASS**:
  - En 1 corrida manual, `itemsInScope >= 1` (vs 0 actual)
  - 5 patentes Pascual siguen persistidas, no se duplican
  - Smoke test pasa

### S4 — D.2 sectorización: filtro CNAE en /empresas + cargar companies reales
- **Tipo**: CODE+DATA
- **Agente**: general-purpose
- **Output esperado**:
  1. Listado mínimo de 8-12 empresas reales A&B desde CNAE_INE (CNAE 10+11) — Pascual, Mahou, Damm, Danone, Nestlé, Pescanova, Lactalis, Bimbo, Ibersnacks, ElPozo, Campofrío, Vivesoy
  2. Añadir sector CNAE a cada empresa en DB (campo `cnaeCode: string` en `Company` o relación con `Sector`)
  3. UI `/empresas` con filtro por sector (dropdown: Alimentos CNAE 10 / Bebidas CNAE 11 / Todos)
  4. `app/empresas/page.tsx` con búsqueda simple por nombre
  5. Smoke test `scripts/smoke-sectorizacion.ts` con 3+ asserts
  6. NO re-correr lectura de medios (R1) — se hace en D.3 aparte
- **Criterio PASS**:
  - Lista de empresas visibles en `/empresas` con su CNAE
  - Filtro por sector funciona
  - DB tiene al menos 12 empresas reales con CNAE asignado

## Plan de ejecución

1. **Plazo**: cada sprint ≤ 30 min de trabajo real
2. **Concurrencia**: 4 agentes en paralelo (S1, S2, S3, S4)
3. **Sin colisiones**: S1 toca VPS ops, S2+3+4 tocan código local
4. **Verificación final**: yo (orquestador) leo el output de cada agente, valido commits, y reporto al usuario con `evaluator` si hay duda

## Riesgos identificados

- S1: si `hermes-gateway.service` no arranca tras el fix, el messaging se cae → tener backup listo para rollback inmediato
- S2: Prisma migration puede fallar en VPS si hay drift entre schema local y remoto → usar `prisma migrate deploy` (no `dev`) en VPS
- S3: si el query builder tiene 3+ bugs, el fix puede no entrar en este sprint → en tal caso, dejar fix parcial + abrir S3.1
- S4: cargar 12 empresas sin re-correr medios significa que las `Source` históricas quedan asignadas a las 8 viejas → documentar el desfase en active-state.md

## Memoria

- Actualizar `memory/state/active-state.md` al final con resultados reales
- Commit por sprint (no commit monolítico)
