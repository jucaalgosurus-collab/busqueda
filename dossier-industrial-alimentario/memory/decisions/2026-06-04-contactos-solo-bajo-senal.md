# Decisión 2026-06-04 — Contactos SOLO bajo señal (sin enriquecimiento proactivo) + SOLO GRANDES EMPRESAS + EJECUCIÓN EN VPS

> **Sprint**: E.6+ (gate sobre E.1b) + E.14 (auto-ampliación con filtro tamaño) + regla de despliegue
> **Tipo**: REGLAS DE NEGOCIO + REGLA DE DESPLIEGUE DURADERAS
> **Estado**: ✅ APLICABLES (gates aún no codificados, pero las reglas mandan desde ya)

## Regla 3 — EJECUCIÓN EN EL VPS (TÚ ERES EL PROFESOR) — ADENDA 2026-06-04

**Mandato del usuario (crítico, no negociable)**: *"RECUERDA TODO LO DEBE HACER EL VPS TU ERES EL PROFESOR"*.

**Significado**:
- Yo (en local) **solo escribo código y lo testeo con smoke tests** que NO tocan la base de datos real.
- **El código se ejecuta en el VPS** (88.198.93.52). Los timers systemd, las migraciones Prisma, los seeds, los backfills, los runs de agentes, los `npm run scan:*` — todo eso lo lanza el VPS, no yo.
- Yo **NO** corro `prisma migrate deploy`, **NO** instalo `systemd` units, **NO** toco nginx, **NO** edito `/etc/hermes/`, **NO** modifico `/var/log/`. Solo entrego el código y las instrucciones que el VPS debe ejecutar.
- **Diagnóstico remoto**: si algo falla, te digo qué log mirar, qué comando correr para verificar, qué fix aplicar. No lo aplico yo desde aquí.

**Por qué**:
- La BD está en el VPS (Postgres). Mi sandbox local no tiene acceso.
- Los secrets (`Surus2024!`, tokens Telegram, API keys) viven en `/etc/hermes/hermes.env` (mode 600) en el VPS. No deben estar en mi entorno.
- Los timers (`surus-agente-*.timer`) están en `/etc/systemd/system/` del VPS.
- Cualquier cambio destructivo (migración, drop, reset) requiere que tú lo apruebes y lo lances desde el VPS con tu sesión SSH.

**Formato de entrega mío hacia VPS**:
1. Commit con código en `main`.
2. Sprint contract en `memory/sprints/sprint-X/Y.md` con:
   - Archivos tocados.
   - Comando(s) que el VPS debe correr.
   - Logs a monitorizar.
   - Criterio de éxito verificable.
3. Si requiere migración Prisma: indico el SQL exacto que correr (no solo `prisma migrate deploy`).
4. Si requiere systemd: entrego el `.service` + `.timer` como archivos, indico ruta destino, indico `systemctl daemon-reload && systemctl enable --now`.

## Regla 1 — Resumen

## Regla 1 — Resumen

El sistema carga la base completa de **empresas con sus sedes** (Company + Plant). El **enriquecimiento de contactos** (búsquedas LinkedIn, Hunter, verificación de emails) **NO se ejecuta de forma automática ni proactiva**. Se hace **únicamente a demanda del usuario**, sobre una empresa y sede concretas, y solo cuando hay una operación comercial en curso que lo justifique.

## Regla 2 — SOLO GRANDES EMPRESAS (NO PYMES) — ADENDA 2026-06-04

**Mandato del usuario (crítico, no negociable)**: *"NO VAS A MIRAR NOTICIAS DE PYMES, ESAS NO NOS INTERESAN SOLO VAS A MIRAR NOTICIAS DE GRANDES CUENTAS EMPRESAS GRANDES"*.

**Criterios de GRANDE cuenta (cualquiera basta para cualificar)**:
- **Facturación ≥ 50M€** (`Company.facturacionM >= 50`)
- **Empleados ≥ 250** (`Company.empleadosTotal >= 250`, umbral UE de "gran empresa")
- **Tier A o B** en `Company` (existente). Tier C o D → IGNORAR.

**Aplicación por componente**:

| Componente | Comportamiento |
|---|---|
| `findOrCreateCompanyByName` (E.14) | Solo auto-crea `Company` si la empresa detectada cumple ≥1 criterio. Si no se puede verificar tamaño, NO crea — la señal queda como `Source` huérfano en buzón `/hallazgos?pending=true` para revisión manual. |
| Detectores (E.1 LinkedIn, E.5 prensa, AESAN, BORME, etc.) | Si matchedSource.companyId es de un `Company` con `facturacionM < 50` y `empleadosTotal < 250` (o desconocido) → descartar como pyme. El `Source` se guarda como constancia, pero `deimplantationSignal` se evalúa solo si es gran cuenta. |
| `/buscar-responsables` | Solo permite buscar si la `Company` cumple criterios. Pyme → 403 "Surus solo opera con grandes cuentas". |
| `/empresas` lista | Filtro UI: tier A/B + facturación ≥50M€ o empleados ≥250. Pymes ocultas por defecto, botón "mostrar pymes" para auditoría. |
| Outreach (QW-9) | Gate duro: no se genera borrador si la empresa no es gran cuenta. |

**Detección de tamaño cuando se auto-crea (E.14)**:
1. Intentar match con CNAE_INE por nombre normalizado → si match, heredar `facturacionM` / `empleadosTotal` de la ficha INE.
2. Si no match, intentar con BORME histórico por CIF → si el CIF aparece, heredar de la ficha.
3. Si no match, `facturacionM=null, empleadosTotal=null` → empresa queda como "tamaño por verificar". NO entra al pipeline hasta que se verifique.

## Regla 1 — Por qué (sin cambios)

1. **Costo**: cada búsqueda LinkedIn, cada crédito Hunter, cada verificación de email cuesta dinero. Sin una operación en curso, es tirar créditos a la basura.
2. **Riesgo RGPD/proporcionalidad**: tener emails de decisores sin finalidad comercial actual es almacenamiento sin justificación. Surus no quiere una base de datos de correos.
3. **Ruido comercial**: al equipo comercial no le sirve un CRM de emails fríos. Le sirve una lista corta de decisores vinculados a una oportunidad real.
4. **Mandato del usuario** (2026-06-04): *"pues si ibas a hacer eso no tiene ningun sentido, no vamos a escribirle a personas por hacerlo, las busquedas cuestan dinero"*.

## Regla dura

**No existe enrichment automático de contactos.** Ni siquiera cuando hay una señal detectada. La detección (prensa, BORME, LinkedIn despidos, ayudas) es barata y se mantiene; pero la cadena LinkedIn → Hunter → Verifier **NO se ejecuta sin que el usuario lo pida explícitamente** sobre una empresa concreta.

## Flujo correcto

1. La plataforma detecta la señal (Source con `deimplantationSignal=true`, Operation, etc.) y la muestra en `/hallazgos` o en `/empresas/[slug]`.
2. **El usuario ve la señal** y decide si hay una oportunidad real.
3. Si la hay, **el usuario lanza manualmente** el enriquecimiento de contactos para esa empresa/sede (botón "Enriquecer contactos" en `/empresas/[slug]/sedes/[plantId]`).
4. Solo entonces se ejecuta LinkedIn → Hunter → Verifier, y solo para esa empresa/sede.

## Lo que esto cambia en código

| Componente | Acción |
|---|---|
| `lib/agents/linkedin-runner.ts` (E.1) | **No se ejecuta en cron**. Solo invocable manualmente vía script con `--company=<slug>` o vía endpoint admin con auth. |
| `lib/agents/hunter-runner.ts` | **No se ejecuta en cron**. Solo a demanda del usuario sobre una empresa. |
| `lib/agents/hunter-verifier.ts` | **No se ejecuta en cron**. Solo a demanda. |
| E.1b "cerrar cadena LinkedIn→Hunter→Verifier" | Se mantiene el código, pero **sin timer**. Se documenta como "manual bajo demanda". |
| `scripts/backfill-contacts.ts` | **NO se crea**. Backfill masivo de contactos está prohibido por esta regla. |
| `app/api/companies/[slug]/enrich-contacts` (futuro) | Endpoint protegido, requiere acción explícita del usuario. |

## Lo que NO cambia

- **Carga masiva de Company + Plant desde CNAE_INE** (E.9): legítima. La BD de empresas y sedes es el "radar" pasivo; los contactos son el "actuador" y solo se activan a mano.
- **Detección de señales** (prensa, prensa-local, BORME histórico, AESAN, LinkedIn despidos, ayudas, sanciones): se mantiene en cron para todas las Companies. Es barato y es el input de la decisión humana.
- **Patentes** (C.3): se mantiene. Enriquece `Patent` (no `Contact`), es información pública y útil para la ficha de empresa.

## Adenda 2026-06-04 — Auto-ampliación de la lista de empresas

**Mandato del usuario**: 200 empresas NO es techo. Si en prensa/LinkedIn/BORME aparece un nombre de empresa A&B que NO está en `Company`, debe crearse el registro (tier='B', priority baja, sector detectado por CNAE si es posible, sino 'Alimentos y Bebidas' por defecto si la noticia es A&B).

**Por qué**:
- El A&B español tiene >2.000 empresas relevantes. Limitar a 200 condena el sistema a perder señales de los actores medianos.
- El coste de tener un `Company` adicional es trivial (1 fila, 0 contactos, 0 fuentes asociadas). El coste de NO tenerla es perder la señal.
- El usuario ha sido explícito: "esa lista de alguna manera se debe poder ampliar si en prensa salen otros nombres".

**Regla operativa**:
- En cada `persistArticle` de los agentes (prensa, prensa-local, BORME, AESAN, LinkedIn despidos, ayudas, sanciones), después del filtro `isDeimplantation`, intentar `upsertCompanyByNameMentioned(newsContent)`.
- Si el nombre ya existe en `Company` (normalizado): no hacer nada.
- Si NO existe:
  - `slug = slugify(nombre)`
  - `sector = 'Alimentos y Bebidas'` por defecto si el agente es A&B scope, sino `sector` detectado por CNAE
  - `tier = 'B'`
  - `priority = 0`
  - `status = 'active'`
  - `createdBy = agentName` (para auditoría)
- La nueva empresa NO entra al pipeline de contactos hasta que el usuario pulse "Buscar responsables" sobre ella (regla de arriba).

**Pendiente de implementación** (sprint E.14 si lo apruebas):
- `lib/scrapers/company-matcher.ts`: `findOrCreateCompanyByName(rawName, agentName, defaultSector)`.
- Hook en `persistArticle` de cada agente para llamarlo.
- Smoke test: insertar noticia con empresa desconocida → verificar que crea `Company` con `tier='B'`, sin contactos.

## Anti-pattern explícito

> ❌ "Detecté que Pescanova tiene una noticia de cierre. Voy a buscar los emails de su Director de Planta y CFO automáticamente para que el comercial los tenga listos."

Eso es exactamente lo que NO se hace. La detección se guarda, se prioriza, se muestra — y el comercial decide si abre una operación. Si la abre, pide los contactos.

> ✅ "Detecté que Pescanova tiene una noticia de cierre. Aparece en /hallazgos con prioridad alta. El comercial la ve, evalúa si hay interés comercial, y si lo hay, pulsa 'Enriquecer contactos' sobre la sede de Chapela."
