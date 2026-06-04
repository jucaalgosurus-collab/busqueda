# Sprint Contract: QW-2 — Geocoding Nominatim para plantas

## Objetivo

Poblar `Plant.lat` y `Plant.lng` con coordenadas de OpenStreetMap Nominatim (gratis, sin API key, 1 req/s) para todas las plantas españolas.

## Patrón

```
lib/agents/geocoding-runner.ts
  ↓
1. SELECT * FROM Plant WHERE (lat IS NULL OR lng IS NULL) AND city IS NOT NULL
  ↓
2. Para cada planta: query Nominatim /search?q={city},{province},{ccaa},España
  ↓
3. Parseo JSON → lat, lng
  ↓
4. UPDATE Plant SET lat=..., lng=... WHERE id=...
  ↓
5. Rate limit 1.1s entre requests (Nominatim ToS)
```

## Reglas duras

1. **ToS Nominatim**: User-Agent identificable (`HERMES-Dossier/1.0 (contacto@surusinversa.com)`), 1 req/s máx, atribución "© OpenStreetMap contributors" en la UI.
2. **Idempotente**: si la planta ya tiene `lat` y `lng`, no se reintenta.
3. **No planta sin ciudad**: si `city IS NULL`, skip.
4. **Fallback**: si Nominatim falla o no devuelve resultados, dejar NULL. No inventar coords.
5. **Persistente**: el runner escribe en DB; no usa caché en memoria (entre corridas, la DB es la verdad).

## Agente

- Generator (Sonnet 4.6)

## Entregables

1. `memory/sprints/sprint-QW/QW-2-geocoding.md` — este contrato
2. `lib/agents/geocoding-runner.ts` (~120 líneas):
   - `GEOCODING_AGENT_NAME = 'surus-agente-geocoding'`
   - `runGeocoding({ maxPlants, dryRun })`: query plantas sin coords → Nominatim → update
3. `scripts/smoke-qw-2.ts` (~130 líneas, 7 asserts):
   - QW-2-A `lib/agents/geocoding-runner.ts` existe
   - QW-2-B Runner tiene rate limit ≥1.0s
   - QW-2-C Idempotente: no reintenta plantas con lat/lng set
   - QW-2-D Runner escribe a DB con UPDATE por id
   - QW-2-E Runner con MOCK=1 simula Nominatim y procesa N plantas
   - QW-2-F ToS: User-Agent incluye "HERMES-Dossier" + email de contacto
   - QW-2-G Atribución "OpenStreetMap" presente en código/UI
4. `app/empresas/[slug]/_components/PlantMap.tsx` — componente mapa Leaflet (placeholder OK con texto "Lat: X, Lng: Y")
5. `package.json` — script `geocode:plants`
6. `memory/state/active-state.md` — actualizar a "QW-2 Geocoding: completed"

## Success criteria

- 7/7 asserts verdes en smoke
- ≥1 planta geocodificada en dry-run
- 0 plantas con coords inventadas

## UI (bonus, no bloqueante)

- En `/empresas/[slug]`, mostrar para cada planta: `lat={...} lng={...} (OpenStreetMap)`.
- Mapa interactivo: defer (no crítico para QW-2.0).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Nominatim rate limit | 1.1s entre requests + User-Agent identificable |
| Nominatim no encuentra el CP/ciudad | log + skip, no inventar |
| CORS en browser | el runner corre server-side, no hay CORS |
| Plant con dirección incompleta | fallback solo a `city,province,ccaa,España` |

## Siguiente paso en el orden

QW-2 → QW-5 Templates email → QW-3 Dark mode → B.2..B.8
