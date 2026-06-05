# Active State — 2026-06-05 · Dossier A&B Surus

## Sprint E.10 Panel admin — ✅ COMPLETO Y DESPLEGADO

**Fecha cierre**: 2026-06-05
**E2E verificado en VPS**: `https://hermes.surus.es/dossier/admin-public/login`

### Entregables
- Auth real cookie-based: `lib/auth/{password,session}.ts` (scrypt N=2^14, cookies httpOnly+SameSite=Strict 7d)
- SessionLog audit trail: `lib/audit/sessions.ts` (loginAt, logoutAt, durationSec, ip, userAgent, country)
- API auth: `/api/auth/{login,logout,me,change-password}/route.ts`
- API admin: `/api/admin/{users,sessions}/...` (list, create, patch, delete con soft delete)
- Páginas: `/admin-public/{login,account}`, `/admin/{users,sessions}`
- Layout gate: `app/admin/layout.tsx` (server-side redirect a /admin-public/login si no cookie)
- AdminShell migrado de localStorage → cookies
- Seed: `scripts/seed-admin.ts` (jucaalgo, mustChangePassword=true)
- Smoke: `scripts/smoke-e10-auth.ts` 40/40 PASS, `smoke:e10` 32/32 PASS

### Deploy VPS
- Path: `/opt/hermes-dossier/apps/dossier-industrial/`
- Build: `pnpm build` (Next 15.5.7 standalone) + systemd restart
- Password rotado de `13470811` a `Surus2026!` (persistido en .env, mode 600)

### Credenciales (NO en código)
- URL: `https://hermes.surus.es/dossier/admin-public/login`
- Usuario: `jucaalgo`
- Password: `Surus2026!` (en `/opt/hermes-dossier/apps/dossier-industrial/.env`)

### Memoria
- `C:\Users\JUAN CARLOS\.claude\projects\C--Users-JUAN-CARLOS-Documents-ECCSystem\memory\admin-credentials-jucaalgo.md`

## Pendientes (E-serie)

| # | Tarea | Estado |
|---|-------|--------|
| E.11 | Deploy híbrido Vercel + VPS TLS | ⏳ PENDIENTE |
| E.12 | Sanciones SANCO + CNMC | ⏳ PENDIENTE |
| E.13 | Secrets encriptados + limpieza historial Git | ⏳ PENDIENTE |

## Pendientes (D-serie)

| # | Tarea | Estado |
|---|-------|--------|
| D.1.6 | Cache verificación Hunter (regla 10208) | ⏳ PENDIENTE |
| D.1.8 | Fix query builder C.3 patentes: 0 in-scope en 3 runs | ⏳ PENDIENTE |
| D.1.10 | LinkedIn: arreglar cookie o RapidAPI | ⏳ BLOQUEADO (acción manual JC) |

## Sprint D.2-sectorizacion (entregado 2026-06-04)

- 13 empresas reales CNAE 10+11 seedadas
- Filtro `?cnae=10|11` en `/empresas`
- 7/7 smoke PASS (DB skip — sin acceso al Postgres del VPS desde sandbox)

## Restricciones arquitectónicas confirmadas

- **R1**: Re-correr lectura medios para sectorizar 1.597 prensa + 1.151 newsrooms (R1 arquitectónica de CNAE)
- **R2**: TODO lo ejecuta el VPS. Yo audito, no ejecuto.
- **R3 Supreme Order 2026-06-03**: NO direct writes, todo por orchestrator→planner→sprint→generator→evaluator
- **R4**: Compromised credentials NO rotados: `Surus2024!` (DB), `ghp_[REDACTED-77Qv...Bc9D]` (GitHub), GEMINI, HUNTER, DEEPSEEK, TELEGRAM_BOT_TOKEN
- **R5**: "RECUERDA TODO LO DEBE HACER EL VPS TU ERES EL PROFESOR" — Yo audito/instruyo, VPS ejecuta

## Decisiones tomadas en esta sesión

- NO más auto-alabanza en reportes. Si algo no está hecho, decirlo.
- NO pisar `active-state.md` del VPS sin preservar histórico.
- NO cambiar configuración de servicio (systemd units, nginx, etc.) sin pedir.
- SIEMPRE preservar contexto antes de cualquier acción destructiva.
- atomic sprints, output conciso, no auto-alabanza, no re-leer lo ya en memoria

---

## Sprint A.11 + A.12 — Seguridad APIs + .env cifrado — ✅ COMPLETO

**Fecha cierre**: 2026-06-05 (commit f696912, 0fe49cb, 9e1e235)

### Cambios

1. **middleware.ts** (A.11): gate global de `/api/*` salvo `/api/auth/*` y `/api/health`. 
   Verifica cookies `auth_uid`+`auth_sid` con formato válido. 14/14 endpoints 
   anónimos devuelven 401 verificado en VPS.

2. **lib/auth/admin.ts** (A.11): `isAdminAuthorized()` cambiado de fail-open a 
   **fail-closed**. Antes: si ADMIN_SECRET no estaba configurado, dejaba pasar 
   todo (dev mode). Ahora: si no hay secret, devuelve 401 a todo. Kill switch real.

3. **app/api/{mocr,buscar-responsables}/route.ts** (A.11): `requireUser()` añadido 
   como defense in depth. MOCR consume Gemini ($$), buscar-responsables consume 
   Hunter ($$).

4. **scripts/crypto-env.sh** (A.12): cifra `/opt/hermes-dossier/.env` con 
   AES-256-CBC + PBKDF2 (100k iter). Genera `/root/.env.master.key` (600 root:root) 
   y `/opt/hermes-dossier/.env.enc`. Round-trip verificado. **NO rota las keys** 
   (decisión JC 2026-06-05).

5. **A.14**: pg_trgm + unaccent habilitados en BD. Migración `20260605000300_pg_trgm_unaccent` 
   creada (scp pendiente a VPS).

### JC debe hacer

1. **Guardar `/root/.env.master.key`** en lugar seguro offline (1Password, KeePassXC).
   Si se pierde, `.env.enc` es ruido irrecuperable.
2. **Opcional**: commitear `/opt/hermes-dossier/.env.enc` al repo o backup offline 
   (es seguro, está cifrado AES-256).
3. **A.13 TLS forzado** sigue pendiente — verificar que nginx fuerza HTTPS en 
   `/dossier/*` (yo no he tocado la config de nginx).

### Auth verificada en VPS

```
Login:       POST /api/auth/login     → 200 + cookies
Anonimo:     GET  /api/*              → 401 (14/14)
Autenticado: GET  /api/search         → 200
             GET  /api/companies      → 200 (pg_trgm OK)
             GET  /api/dashboard      → 200
```

---

## Sprint A.13 + A.14 + A.15 + A.16 — Hardening completo — ✅ CERRADO

**Fecha cierre**: 2026-06-05 (commit aab3989)

### A.13 Nginx TLS + cookies Secure
- TLS forzado: HSTS `max-age=63072000; includeSubDomains; preload` ✓
- HTTP→HTTPS: 301 redirect ✓
- X-Frame-Options: DENY ✓
- X-Content-Type-Options: nosniff ✓
- X-XSS-Protection: 1; mode=block ✓
- Referrer-Policy: strict-origin-when-cross-origin ✓
- X-Robots-Tag: noindex, nofollow ✓
- **CSP añadido** (A.13): default-src 'self', frame-ancestors 'none', base-uri 'self' ✓
- Cookies: `Secure; HttpOnly; SameSite=strict` (verificado en Set-Cookie) ✓

### A.14 Migración pg_trgm
- Pre-existente bug detectado por smoke A.4: similarity() no existía en BD
- Migración `20260605000300_pg_trgm_unaccent` creada y aplicada en VPS
- `/api/companies?q=pascual` ahora 200 (antes 500)

### A.15 Auditoría páginas UI
- 14/14 páginas públicas: 200/308/404 (IDs inexistentes)
- 6/6 páginas admin: 307 redirect a login sin cookie, 200 con cookie
- App es pública por diseño (excepto /admin/*). Sin fugas.

### A.16 Smoke E2E completo
- **19/19 APIs sin login → 401** (middleware)
- **13/13 APIs con login → 200/400/405 esperado**
- **5/5 admin pages con login → 200**
- 51 rutas auditadas en total
- `/robots.txt` y `/sitemap.xml`: deployados (robots.ts + sitemap.ts faltaban en standalone)

### Estado final de la app

```
Sin cookie:    19/19 APIs cerradas, 14/14 páginas públicas OK
Con cookie:    13/13 APIs abiertas, 5/5 admin pages OK
TLS:           HSTS 2 años, CSP estricto, cookies Secure
.env:          cifrado AES-256 con master.key en /root (600)
```


---

## ✅ PUSH DESBLOQUEADO — sincronizado con origin/main

**2026-06-05 09:10**

Commit `dbff1d2` pusheado a `origin/main` (aab3989 → dbff1d2).

Los 3 commits bloqueados (fcb7f44 + 86c2072 + d07dcc5) se consolidaron en un
solo commit limpio con el PAT ya redactado. La reescritura solo afectó los
commits locales no pusheados; el historial de `main` remoto no se tocó.

**Acción JC recomendada** (todavía pendiente, no bloqueante):
1. **Regenerar el PAT en GitHub** (sigue en historial antiguo, no compromete
   el código actual pero el token puede haberse filtrado):
   https://github.com/settings/tokens → Delete `ghp_[REDACTED-77Qv...Bc9D]`
2. Crear PAT nuevo y actualizar credenciales de push.

**Smoke VPS 2026-06-05 09:10**:
- 8/8 endpoints públicos 200 OK
- 5/5 APIs protegidas 401 sin auth (gate A.11 operativo)
- 0 errores en journalctl últimas 2 min
- App operativa en `https://hermes.surus.es/dossier/`

