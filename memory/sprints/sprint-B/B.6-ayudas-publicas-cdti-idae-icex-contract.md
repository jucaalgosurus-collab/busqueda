# Sprint Contract: B.6 — Ayudas Públicas CDTI/IDAE/ICEX

> **Sprint**: B.6
> **Tipo**: Señal débil (early-warning)
> **Effort**: M (2-3 días)
> **Estado**: ✅ completed (2026-06-04)
> **Agente**: surus-agente-ayudas (cadencia 14d)
> **Brief Juan Carlos**: "Detectar empresas A&B que recibieron ayuda pública CDTI/IDAE/ICEX recientemente y que NO tienen actividad operativa normal → señal de desimplantación en marcha + ayuda pública sin retorno industrial".

---

## Hipótesis de detección

> "Si una empresa A&B grande recibe una ayuda pública CDTI/IDAE/ICEX en los últimos 12 meses y NO tiene actividad operativa reciente (sin newsroom, sin prensa, sin BOE con señales normales), es probable que el dinero público se haya destinado a mantener capacidad ociosa o a una transición hacia cierre/desimplantación."

Reglas:
- `ayuda_sin_actividad` → medium signal (inScope=true)
- `ayuda_previa_a_concurso` → medium signal (inScope=true, cronología típica)
- `ayuda_con_actividad_normal` → out of scope (empresa sigue activa, no nos interesa)
- `unknown_company` → out of scope (no matchea DB)
- `not_ab` → out of scope (no es A&B)

## Fuentes

| Órgano | Tipo | URL base | Frecuencia | Coste |
|---|---|---|---|---|
| CDTI | I+D+i | https://www.cdti.es/ayudas/proyectos | Mensual | 0€ |
| IDAE | Eficiencia energética | https://www.idae.es/ayudas-y-financiacion | Trimestral | 0€ |
| ICEX | Internacionalización | https://www.icex.es/icex/es/navegacion-principal/ayudas | Mensual | 0€ |
| BDNS (futuro) | TODAS las ayudas desde 2016 | https://www.pap.hacienda.gob.es/bdnstrans/ | Diaria | 0€ |

En este sprint, **dataset estático seed** (8 ayudas reales conocidas) + `fetchLiveBDNS()` placeholder.

## Success Criteria

### Bloque A: Dataset (1 assert)
- [x] B.6-A: `lib/data/ayudas-list.json` con 6-10 ayudas CDTI/IDAE/ICEX con todos los campos requeridos (`id`, `convocatoriaId`, `organo`, `beneficiario`, `cif`, `importe`, `fechaConcesion`, `proyecto`, `plantaCcaa`, `sourceUrl`).

### Bloque B: Filtro (4 asserts)
- [x] B.6-B: `applyAyudasFilter` con ayuda + sin actividad 90d → inScope=true, outOfScopeReason='ayuda_sin_actividad'.
- [x] B.6-C: `applyAyudasFilter` con ayuda + Source de concurso posterior → inScope=true, outOfScopeReason='ayuda_previa_a_concurso'.
- [x] B.6-D: `applyAyudasFilter` con ayuda + actividad normal reciente → inScope=false, outOfScopeReason='ayuda_con_actividad_normal'.
- [x] B.6-E: `applyAyudasFilter` con CIF X99999999 (no existe) → inScope=false, outOfScopeReason='unknown_company'.

### Bloque C: Persistencia + helpers (6 asserts)
- [x] B.6-F1: `Source.outletType='ayuda_publica'` persiste.
- [x] B.6-F2: `ScanConfig` con `agentName='surus-agente-ayudas', cadenceDays=14, isActive=true`.
- [x] B.6-F3: `SearchRun` con `agentName='surus-agente-ayudas'` registrado.
- [x] B.6-F4: `normalizeCif('A-28.078.202')` === 'A28078202' (mayúsculas + sin guiones/espacios/puntos).
- [x] B.6-F5: `matchHash({cif:'A28078202', convocatoriaId:'CDTI-2024-ID-001', proyecto:'Test Proyecto!'})` === 'b6-A28078202-CDTI-2024-ID-001-test-proyecto'.
- [x] B.6-F6: `scrapeAllAyudatories({daysBack:365, maxItems:50})` ejecuta sin throw, devuelve array.

### Bloque D: QW regresión (5 asserts)
- [x] QW-1: 6 sectores amplios visibles en /empresas
- [x] QW-2: ≥1 empresa por sector en DB
- [x] QW-3: Navbar contiene "Juan Carlos Alvarado para Surus"
- [x] QW-4: Footer contiene "Juan Carlos Alvarado" + "Surus Inversa"
- [x] QW-5: Header del dashboard contiene "Juan Carlos Alvarado" + "Surus Inversa"

### Bloque E: Estado (2 asserts)
- [x] EST-1: `memory/state/active-state.md` actualizado a "Sprint B.6 Ayudas: completed".
- [x] EST-2: `memory/sprints/sprint-B/B.6-ayudas-publicas-cdti-idae-icex-report.md` existe.

## Deliverables (12/12)

1. `lib/data/ayudas-list.json` — 8 ayudas reales (Pescanova, Danone, Mahou, Damm, Nestlé, Azucarera, Pascual, Acerinox).
2. `lib/scrapers/ayudas-publicas.ts` — `loadAyudasFromFile`, `scrapeAllAyudatories`, `fetchLiveBDNS` (placeholder).
3. `lib/scrapers/types.ts` — +'ayuda_publica' al union `OutletType`, +`RawAyudaPublica`, +`AyudasScrapeOptions`.
4. `lib/filters/ayudas.ts` — `applyAyudasFilter`, `normalizeCif`, `matchHash`.
5. `lib/agents/ayudas-runner.ts` — `runAyudasAgent` idempotente, backfill_180d 1ª vez, incremental_14d después.
6. `scripts/smoke-qw-b6.ts` — 13 asserts (5 QW + 8 B.6).
7. `scripts/probe-b6.ts` — diagnóstico del data gap.
8. `package.json` — +`scan:ayudas`, +`smoke:qw-b6`.
9. `deploy/run-agents.sh` — +B.6 step tras B.5.
10. `memory/sprints/sprint-B/B.6-ayudas-publicas-cdti-idae-icex-contract.md` — este sprint contract.
11. `memory/sprints/sprint-B/B.6-ayudas-publicas-cdti-idae-icex-report.md` — post-implementación.
12. `memory/state/active-state.md` — actualización a "B.6 completed".

## Limitaciones / Mejoras futuras

1. **Dataset estático**: 8 ayudas hardcoded. Migrar a BDNS en sprint B+.x.
2. **CIFs no poblados**: 7/7 seed Companies con `cif: null`. Sprint C enrichment resolverá.
3. **No detección "ayuda sin ejecutar"**: requiere cruzar con BDNS ejecución (no concesión).
4. **Telegram alert NO implementado**: B.6 genera `medium` signal, no `strong` (decisión consciente).

## Cron

Cuelga de `hermes-scan.timer` (semanal Lun 04:00 UTC), paso 6e. Cadencia efectiva 7d, en línea con la periodicidad real de concesiones CDTI/IDAE/ICEX.
