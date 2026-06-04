# Auditoría Forense DEFINITIVA — 3 agentes en paralelo (VPS + Local + Vercel)

**Fecha**: 2026-06-04
**Origen**: Juan Carlos eligió opción 1 ("auditoría primero" — msg final "1")
**Método**: 3 agentes paralelos sin auto-alabanza, cada uno con SSH/git/curl real

---

## 🔴 HALLAZGO #0 — VERCEL NO TIENE EL DOSSIER (cambia la estrategia de deploy)

**Agente C — curl real a `https://alimentos-ten.vercel.app`**:
- `/dossier/empresas/pascual` → **HTTP 404**
- `/dossier` → **HTTP 404**
- `/` → 200, 3240 bytes (landing estática "Alimentos & Bebidas")
- **El dossier (Next.js App Router) NO está desplegado en Vercel**
- VPS `88.198.93.52:3002` no es alcanzable desde fuera (firewall)
- **Implicación**: "Subir a Vercel con nombre surusclientes" (msg 5189) es trabajo virgen, no continuidad

**Decisión táctica**: o se despliega el dossier en Vercel (con env vars de DB apuntando al VPS o DB serverless) o se abre el puerto 3002 con TLS en el VPS. Las dos rutas son viables, pero hay que elegir una.

---

## 🔴 HALLAZGO #1 — TELEGRAM TOKEN EXPUESTO + PASSWORD HARDCODEADO

**Agente A — SSH real al VPS**:
- `/opt/hermes-dossier/.env.telegram`: `TELEGRAM_BOT_TOKEN=8430000566:AAH...` (mode 600, PERO contenido visible en logs/journal)
- `daily-report.sh` línea 47: `curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"` con token en línea de comando (queda en `journalctl`)
- `bot.py` y `daily-report.sh` contienen `Surus2024!` hardcoded como password DB
- **Telegram API responde 401 Unauthorized** al test → token muerto o placeholder
- **Acción obligatoria**:
  1. Regenerar token con `@BotFather` (acción manual de Juan Carlos)
  2. Mover `Surus2024!` a `/etc/hermes/hermes.env` chmod 600, leer con `source` en shell scripts
  3. Rotar password DB en VPS (ya está expuesta en chat history también)

---

## 🟠 HALLAZGO #2 — 4 PROCESOS `aionui`/`aioncore` CONSUMIENDO 5 PUERTOS

**Agente A — `ss -tlnp` + `ps auxf`**:
- 4 procesos `aionui` o `aioncore` corriendo,绑定 a 5 puertos
- Origen: desconocido, no parte del stack documentado HERMES
- `tor` y `cups` activos innecesariamente
- **Acción**: identificar origen (¿instalación previa?, ¿intrusión?). Si no son tuyos, kill + investigar.

---

## 🟠 HALLAZGO #3 — SPRINT C.3 PATENTES DEVUELVE 0 IN-SCOPE

**Agente A — logs de `surus-agente-patentes.service`**:
- 3 ejecuciones del timer
- 0 resultados "in-scope" en todas
- Query builder está filtrando demasiado o la capa de matching no funciona
- 5 patentes Pascual persistidas en DB fueron **cargadas vía backfill** (`scripts/patentes-backfill.ts`), no por el agente programado
- **Implicación**: el systemd timer existe pero no está produciendo valor real. El "✅ funcionando" era parcial.

---

## 🟠 HALLAZGO #4 — `linkedin-osint`: 18 ERRORES, COOKIE MUERTA

**Agente A — `journalctl -u surus-agente-linkedin`**:
- 18 errores consecutivos
- Cookie de sesión `li_at` expirada (LinkedIn las rota cada ~30 días)
- 0 contactos enriquecidos en últimos 7 días
- **Acción**: regenerar cookie (manual) o migrar a RapidAPI/Proxycurl (pago, ~$50/mes)

---

## 🟠 HALLAZGO #5 — 0 BACKUPS, 121 SOURCES PRE-2025, 8 EMPRESAS

**Agente A — DB inspection**:
- `/opt/hermes-dossier/backups/` → **directorio vacío** (0 archivos)
- DB: 121 entries en `Source` con `firstSeenAt < 2025-01-01` (3.2% de ruido pre-2025)
- 8 empresas hardcoded (no se cargó el lote CNAE_INE de 50-200)
- 49 `SearchRun` totales, ~16/día promedio
- 5 patentes Pascual, 4 histórico

---

## 🟡 HALLAZGO #6 — PANEL ADMIN EXISTE PERO NO ESTÁ OCULTO

**Agente B — `git ls-files | grep admin`**:
- `app/admin/outreach/page.tsx` existe
- NO está protegido (no auth, no ruta oculta)
- Mensaje 7729 pedía "panel admin OCULTO" → literalmente lo que pediste no es lo que hay

---

## 🟡 HALLAZGO #7 — LOCAL GIT TIENE 5 CAMBIOS SIN COMMIT + 5 ARCHIVOS UNTRACKED

**Agente B — `git status`**:
- Modificados sin commit: `app/empresas/[slug]/empresa.css`, `page.tsx`, `lib/scrapers/types.ts`, `next.config.ts`, `package.json`, `prisma/schema.prisma`
- Untracked: `PatentsCard.tsx`, `oepm.ts`, `patentes-runner.ts`, `filtros patentes`, `scripts/patentes-backfill.ts`, `smoke-c3.ts`
- 28+ commits en rama main, todos con conventional commits
- `memory/contracts/` y `memory/instincts/` **vacíos** (la "evolución de memoria" no está activa en realidad)

---

## 🟡 HALLAZGO #8 — INVENTARIO REAL DE INFRA

**Agente B — `find + wc -l`**:
- 806 archivos tracked
- 17 componentes UI en `app/empresas/[slug]/_components/`
- 14 scrapers
- 20 agentes/runners
- 12 filtros
- 32 smoke tests (incluido `smoke-c3.ts` con 18 asserts)
- **QW-6 existe**: home con tabs de sector (`/` tiene `SectorTabs.tsx`)
- "Cuadro de mando" que pediste ya está, pero con look genérico (no estilo surusclientes)

---

## 🟢 LO QUE SÍ FUNCIONA DE VERAS (verificado, no auto-alabanza)

- C.1 BORME scrapeando + persistiendo ✅
- C.2 Financiero scrapeando + persistiendo ✅
- C.3 Patentes **datos** OK (5 Pascual), **timer** configurado pero query rota ⚠️
- 8 sprints B (OSINT base) — código presente, ejecución validada parcialmente
- 17 componentes UI empresa slug — funcionan
- Smoke tests pasan (17/18 en local, 18/18 en VPS con DB real)

---

## 📋 SPRINT D.1 RECOMENDADO (orden de ataque, no lista de deseos)

### Prioridad 0 (deploy y canal)
- **D.1.0**: Decisión deploy Vercel vs abrir VPS:3002
- **D.1.1**: Regenerar token Telegram (acción Juan Carlos)

### Prioridad 1 (roto crítico)
- **D.1.2**: `daysBack=2` en newsroom runner (1 línea, 50% "BASURA")
- **D.1.3**: Mover `Surus2024!` de bot.py a env-file chmod 600
- **D.1.4**: Cache verificación Hunter (regla 10208)
- **D.1.5**: Backup diario DB (cron + retain 7d)

### Prioridad 2 (calidad + cobertura)
- **D.1.6**: Purgar 121 sources pre-2025-01-01
- **D.1.7**: Cargar 50-200 companies reales desde CNAE_INE
- **D.1.8**: Sectorización UI (filtro CNAE en `/empresas`)
- **D.1.9**: Auditar `surusclientes.vercel.app` para aprender patrón
- **D.1.10**: Investigar `aionui`/`aioncore` processes

### Prioridad 3 (mejoras)
- **D.1.11**: Arreglar LinkedIn (cookie o RapidAPI)
- **D.1.12**: Fix query builder C.3 patentes (0 in-scope)
- **D.1.13**: Ocultar panel admin (auth o ruta no-listada)
- **D.1.14**: Saludo personalizado con dolor de la noticia
- **D.1.15**: Re-correr lectura medios para sectorizar 1.597 prensa + 1.151 newsrooms (R1)

---

## 🧭 PREGUNTA A JUAN CARLOS

Tienes 3 entradas necesarias para arrancar D.1:

1. **D.1.0** — ¿Despliegue del dossier: Vercel (build Next.js) o abrir VPS:3002 con TLS?
2. **D.1.1** — ¿Regeneras token Telegram en @BotFather o uso un bot nuevo?
3. **D.1.9** — ¿Audito `surusclientes.vercel.app` AHORA para clonar patrón, o lo dejamos para después?

Mi recomendación: **HÍBRIDO controlado**:
- Yo despacho `architect` (1 agente) → genera sprint contract D.1 con esas 3 decisiones marcadas
- `generator` (1 agente) → ejecuta las 4 Prioridad-1 fixes (las que no requieren decisión tuya)
- `evaluator` (1 agente) → audita el resultado
- Te pregunto las 3 decisiones en paralelo, no en serie
