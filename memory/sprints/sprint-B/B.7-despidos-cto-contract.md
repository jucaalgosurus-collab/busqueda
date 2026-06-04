# Sprint Contract: B.7 — Despidos CTO/Director Técnico (LinkedIn)

> **Sprint**: B.7
> **Tipo**: Señal débil (early-warning)
> **Effort**: M (2-3 días)
> **Estado**: 🚧 in_progress (2026-06-04)
> **Agente**: surus-agente-despidos-cto (cadencia 7d)
> **Brief Juan Carlos**: "Detectar cuando una empresa A&B pierde a su CTO, Director Técnico, Director I+D o Director de Operaciones — eso suele indicar problemas estratégicos serios que pueden preceder desimplantación".

---

## Hipótesis de detección

> "Si una empresa A&B grande pierde a 1 decisor técnico senior (CTO, Director Técnico, Director I+D, Director Operaciones) en LinkedIn en los últimos 90 días, es señal amarilla. Si pierde 2+ en 90d, es señal ROJA (la nave se está hundiendo)."

Razones:
- Los CTO/Directores Técnicos rara vez abandonan una empresa saneada.
- Un CTO saliendo suele dejar proyectos industriales en curso sin liderazgo → riesgo de parada/desimplantación.
- Patrón histórico: en muchas quiebras industriales españolas, los CTO salieron 6-12 meses antes del cierre.

## Fuentes

| Fuente | Tipo | Coste | Stealth |
|---|---|---|---|
| LinkedIn Google CSE | `site:linkedin.com "ha dejado" OR "cesado" OR "nuevo CTO" {empresa} {planta}` | 0€ (Google CSE free tier 100/día) | Sin riesgo (es Google) |
| LinkedIn Playwright (Plan B) | Login real + scrape movimientos | 0€ | Cookie `li_at` rotada cada 5h |
| LinkedIn vía press | Notas de prensa confirmando el cese | 0€ | RSS feeds prensa ya ingestados |

En este sprint, **Plan A (Google CSE) primario** + **cross-check con press/sectorial**.

## Success Criteria (13 asserts)

### Bloque A: Scraping Plan A (3 asserts)
- [ ] B.7-A: `lib/data/linkedin-despidos-queries.json` con 5-10 queries de búsqueda (CTO, Dir Técnico, Dir I+D, Dir Operaciones, Director Industrial) × 7 empresas top A&B.
- [ ] B.7-B: `lib/scrapers/despidos-cto.ts` ejecuta Google CSE + parsea resultados → `RawDespidoCto[]`.
- [ ] B.7-C: `scrapeDespidosCto({daysBack:90, maxItems:50})` no throw, devuelve array.

### Bloque B: Filtro de decisión (4 asserts)
- [ ] B.7-D: `applyDespidosCtoFilter` con 1 despido CTO de empresa A&B → inScope=true, `despido_unico_cto`, signalStrength='medium'.
- [ ] B.7-E: `applyDespidosCtoFilter` con 2+ despidos en 90d → inScope=true, `despidos_masivos_cto`, signalStrength='strong'.
- [ ] B.7-F: `applyDespidosCtoFilter` con 0 despidos (empresa sana) → inScope=false, `sin_despidos_cto`.
- [ ] B.7-G: `applyDespidosCtoFilter` con empresa no A&B → inScope=false, `not_ab`.

### Bloque C: Persistencia + cron (3 asserts)
- [ ] B.7-H: `Source.outletType='despido_cto'` persiste.
- [ ] B.7-I: `ScanConfig` con `agentName='surus-agente-despidos-cto', cadenceDays=7, isActive=true`.
- [ ] B.7-J: `matchHash` determinista `b7-{companyId}-{linkedinSlug}-{fechaPublicacion-day}`.

### Bloque D: QW regresión (5 asserts — preexistentes)
- [ ] QW-1: 6 sectores amplios visibles en /empresas
- [ ] QW-2: ≥1 empresa por sector en DB
- [ ] QW-3: Navbar contiene "Juan Carlos Alvarado para Surus"
- [ ] QW-4: Footer contiene "Juan Carlos Alvarado" + "Surus Inversa"
- [ ] QW-5: Header del dashboard contiene "Juan Carlos Alvarado" + "Surus Inversa"

### Bloque E: Estado (2 asserts)
- [ ] EST-1: `memory/state/active-state.md` actualizado a "Sprint B.7 Despidos CTO: completed".
- [ ] EST-2: `memory/sprints/sprint-B/B.7-despidos-cto-report.md` existe.

## Deliverables

1. `lib/data/linkedin-despidos-queries.json` — 5-10 queries de búsqueda.
2. `lib/scrapers/despidos-cto.ts` — `scrapeDespidosCto({daysBack, maxItems})` con Google CSE.
3. `lib/filters/despidos-cto.ts` — `applyDespidosCtoFilter`, `matchHash`.
4. `lib/agents/despidos-cto-runner.ts` — `runDespidosCtoAgent` idempotente, backfill_90d 1ª vez, incremental_7d después.
5. `scripts/smoke-qw-b7.ts` — 13 asserts (5 QW + 8 B.7).
6. `package.json` — +`scan:despidos-cto`, +`smoke:qw-b7`.
7. `deploy/run-agents.sh` — +B.7 step tras B.6.
8. `memory/sprints/sprint-B/B.7-despidos-cto-contract.md` — este sprint contract.
9. `memory/sprints/sprint-B/B.7-despidos-cto-report.md` — post-implementación.
10. `memory/state/active-state.md` — actualización.

## Cargos a detectar (8)

| Cargo | Regex LinkedIn |
|---|---|
| CTO | `\bCTO\b\|\bChief\s+Technology\s+Officer\b` |
| Director Técnico | `Director[a]?\s+T[eé]cnic[oa]` |
| Director I+D | `Director[a]?\s+(?:de\s+)?I\+D\|\bR&D\s+Director\b` |
| Director Operaciones | `Director[a]?\s+(?:de\s+)?Operaciones\|\bCOO\b` |
| Director Industrial | `Director[a]?\s+Industrial` |
| Director de Planta | `Director[a]?\s+de\s+Planta` |
| Director Producción | `Director[a]?\s+(?:de\s+)?Producci[oó]n` |
| VP Engineering | `\bVP\s+Engineering\b\|\bVice\s+President\s+Engineering\b` |

## Señales de LinkedIn de despido (5 keywords)

```
- "ha dejado" + cargo
- "ya no forma parte" + cargo
- "cesado" + cargo
- "nuevo reto" + cargo (eufemismo)
- "se incorpora a" + cargo (cambia de empresa, indirect signal)
```

## Anti-falsos positivos (3 reglas)

1. **Antigüedad mínima LinkedIn**: si el perfil LinkedIn tiene <2 años de experiencia, NO matchear (jóvenes cambian mucho, no es señal).
2. **Movimiento ascendente**: si el siguiente cargo es MÁS relevante (Director Técnico → CTO en otra), NO es señal (es promoción).
3. **Empresa destino conocida**: si la empresa destino es Surus/cliente Surus, NO es señal (es operación normal Surus).

## Cron

Cuelga de `hermes-scan.timer` (semanal Lun 04:00 UTC), paso 6f. Cadencia efectiva 7d.

## Limitaciones / Mejoras futuras

1. **Google CSE free tier**: 100 queries/día. Para 7 empresas × 8 cargos = 56 queries/corrida. OK.
2. **Playwright Plan B no implementado en este sprint**: Google CSE cubre el 80%. Plan B si Google bloquea.
3. **No verifica fecha exacta del despido**: Google CSE da resultados ordenados por relevancia, no por fecha. La fecha se parsea del snippet LinkedIn.
4. **No envía Telegram alert**: B.7 genera medium/strong. Si medium, lo verá Surus en /hallazgos. Si strong, sí dispara (compartido con QW-1).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Google CSE rate limit | Throttle 8s entre queries. Cache resultados 7d. |
| LinkedIn bloquea Google CSE (raro) | Plan B con Playwright. |
| Falsos positivos (cambios normales) | 3 anti-falsos positivos arriba + verificación con press. |
| GDPR/LOPDGDD (datos personales LinkedIn) | Solo almacenamos `linkedinUrl` + `cargo` + `empresa` + `fechaDetectada`. NO nombre real. |
