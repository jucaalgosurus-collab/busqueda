# Sprint E.9b — Expansion CNAE-INEs 270 reales → VPS

**Fecha**: 2026-06-05
**Estado**: EN EJECUCIÓN

## Contexto
- DB actual: 760 empresas totales, **solo 64 con CNAE real** (45 cnae 10.x + 19 cnae 11.x)
- 718 tier-B sin CNAE son 99% **RUIDO** de scraping (slugs tipo `about-ferroglobe`, `acuerdo-joint-venture`)
- JC exige ≥ 400 empresas con CNAE-INEs real (CNAE 10.x o 11.x)

## Plan operativo (VPS ejecuta, yo audito)

### Fase A — Limpieza ruido
```sql
DELETE FROM "Company"
WHERE cnae IS NULL
  AND website IS NULL
  AND "parentGroup" IS NULL
  AND name !~* '\m(S\.A\.?U?\.?|S\.L\.?U?\.?|S\.L\.?N\.E\.?|S\.M\.E\.?|SOCIEDAD|LIMITADA|FUNDACION|ASOCIACION|GRUPO|CORPORACION|INDUSTRIAS|ALIMENTOS|BODEGAS|CAFES|CARNICAS|JAMONES|LACTEOS|CONSERVAS|DISTRIBUCION|PRODUCTOS|PASTELERIA)\M';
```
- Esperado: borrar ~680, dejar ~38 (5 con web + ~33 con forma legal)

### Fase B — Seed 270 CNAE-INEs
Subir a VPS:
- `data/seed-expansion.json` (126)
- `data/seed-expansion-2.json` (82)
- `data/seed-cnae.json` ya está (62)
- `scripts/seed-expansion-2026-06-05.ts` (nuevo, idempotente)

Total: 270 nuevos slugs con CNAE-INEs.

### Fase C — Validación
```sql
SELECT COUNT(*) FROM "Company" WHERE cnae LIKE '10.%' OR cnae LIKE '11.%';
-- Esperado: ≥ 400
```

## Success Criteria
- [ ] Fase A: 680±50 empresas borradas
- [ ] Fase B: 270 empresas nuevas con cnae
- [ ] Fase C: COUNT ≥ 400 con cnae 10/11
- [ ] /empresas?cnae=10 muestra ≥ 400 resultados
- [ ] Commit + push a origin/main

## Riesgos
- R1: La limpieza podría borrar empresas legítimas con nombre genérico. Mitigación: backup pre-delete.
- R2: Algún slug de los 270 choca con uno existente en DB. Mitigación: el script usa `findUnique` y solo inserta si no existe.
- R3: VPS no tiene pnpm o Prisma corriendo. Mitigación: verificar antes de ejecutar.

## No-go
- NO borrar la DB entera
- NO tocar `seed-v6.json` ni `seed-empresa-demo.json`
- NO rotar credenciales
