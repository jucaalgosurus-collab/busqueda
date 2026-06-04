// scripts/backfill-source-plant.ts — QW-10
//
// Asigna `Source.plantId` heurísticamente para Sources existentes.
// Heurística (en orden):
//   1. Match exacto del nombre de planta (case-insensitive, sin acentos) en title+contentText
//   2. Match de city+companyId
//   3. Si no hay match, dejar plantId = NULL
//
// Reglas:
//   - Idempotente: si plantId ya está asignado, NO lo modifica.
//   - Batch: procesa 200 Sources a la vez con take/skip para no agotar memoria.
//   - Log final: total procesados, asignados, sin match.

import { prisma } from '../lib/db/prisma';

const BATCH = 200;
const NORMALIZE_RE = /[̀-ͯ]/g; // diacritics

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(NORMALIZE_RE, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const allPlants = await prisma.plant.findMany({
    select: { id: true, companyId: true, name: true, city: true, province: true, ccaa: true },
  });
  if (allPlants.length === 0) {
    console.log('[backfill-source-plant] No hay plantas registradas. Abort.');
    return;
  }

  // Indexar por companyId → plantas
  const byCompany = new Map<string, typeof allPlants>();
  for (const p of allPlants) {
    if (!p.companyId) continue;
    const arr = byCompany.get(p.companyId) ?? [];
    arr.push(p);
    byCompany.set(p.companyId, arr);
  }

  let total = 0, assigned = 0, skipped = 0, noMatch = 0;
  let cursor: string | undefined = undefined;

  while (true) {
    const sources = await prisma.source.findMany({
      where: { plantId: null },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, title: true, contentText: true, companyId: true },
    });
    if (sources.length === 0) break;

    for (const s of sources) {
      total++;
      cursor = s.id;
      if (!s.companyId) { skipped++; continue; }
      const plants = byCompany.get(s.companyId);
      if (!plants || plants.length === 0) { noMatch++; continue; }

      const blob = normalize(`${s.title} ${s.contentText ?? ''}`);
      let best: { id: string; score: number } | null = null;

      for (const p of plants) {
        const nameN = normalize(p.name);
        if (!nameN) continue;
        // 1) Match por nombre de planta (palabra completa en el blob)
        const regex = new RegExp(`\\b${nameN.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (regex.test(blob)) {
          const score = nameN.length;
          if (!best || score > best.score) best = { id: p.id, score };
          continue;
        }
        // 2) Match por city+province (más débil)
        const cityN = p.city ? normalize(p.city) : '';
        const provN = p.province ? normalize(p.province) : '';
        if (cityN && cityN.length > 3 && blob.includes(cityN)) {
          const score = cityN.length * 0.5;
          if (!best || score > best.score) best = { id: p.id, score };
        } else if (provN && provN.length > 3 && blob.includes(provN)) {
          const score = provN.length * 0.3;
          if (!best || score > best.score) best = { id: p.id, score };
        }
      }

      if (best) {
        await prisma.source.update({ where: { id: s.id }, data: { plantId: best.id } });
        assigned++;
      } else {
        noMatch++;
      }
    }

    if (sources.length < BATCH) break;
  }

  const pct = total > 0 ? ((assigned / total) * 100).toFixed(1) : '0.0';
  console.log(`[backfill-source-plant] Procesados=${total} Asignados=${assigned} (${pct}%) NoMatch=${noMatch} SinCompany=${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
