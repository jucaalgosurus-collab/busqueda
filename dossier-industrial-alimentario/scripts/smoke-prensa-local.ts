// scripts/smoke-prensa-local.ts — Sprint E.5
//
// Smoke test mínimo del agente prensa-local:
//   1. Lista 10 medios válidos
//   2. Cada medio tiene RSS público
//   3. Cada medio tiene ccaa + provincia + kind='local'
//   4. Agente existe con agentName y cadenceDays
//   5. Si DB arriba: corre runPrensaLocalAgent({ maxPerSource: 2, daysBack: 7 })
//
// Uso: npx tsx scripts/smoke-prensa-local.ts
//      MOCK=1 npx tsx scripts/smoke-prensa-local.ts  (skip live scrape)

import prensaLocalList from '@/lib/data/prensa-local-list.json' with { type: 'json' };
import type { PrensaListEntry } from '@/lib/scrapers/types';

const list = prensaLocalList as PrensaListEntry[];

let passed = 0;
let failed = 0;
const fails: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== SMOKE E.5: PRENSA LOCAL ===\n');

// 1. Lista tiene ≥10 medios
check('lista tiene ≥10 medios', list.length >= 10, `actual=${list.length}`);

// 2. Cada medio tiene RSS
const noRss = list.filter((e) => !e.rss);
check('todos los medios tienen RSS', noRss.length === 0, `sin RSS: ${noRss.map((e) => e.slug).join(', ')}`);

// 3. Cada medio es kind='local' y tiene ccaa+provincia
const invalid = list.filter((e) => e.kind !== 'local' || !e.ccaa || !e.provincia);
check('todos los medios son kind=local con ccaa+provincia', invalid.length === 0, `inválidos: ${invalid.map((e) => e.slug).join(', ')}`);

// 4. Slugs únicos
const slugs = list.map((e) => e.slug);
check('slugs únicos', new Set(slugs).size === slugs.length, `duplicados: ${slugs.length - new Set(slugs).size}`);

// 5. Keywords definidos en todos
const noKeywords = list.filter((e) => !e.keywords || e.keywords.length === 0);
check('todos los medios tienen keywords', noKeywords.length === 0, `sin keywords: ${noKeywords.map((e) => e.slug).join(', ')}`);

// 6. Cobertura de CCAA distintas
const ccaas = new Set(list.map((e) => e.ccaa));
check('cubre ≥8 CCAA distintas', ccaas.size >= 8, `actual=${ccaas.size}: ${[...ccaas].join(', ')}`);

// 7. Provincias distintas
const provincias = new Set(list.map((e) => e.provincia));
check('cubre ≥8 provincias distintas', provincias.size >= 8, `actual=${provincias.size}`);

// 8. Agente exporta constantes correctas
import {
  PRENSA_LOCAL_AGENT_NAME,
  PRENSA_LOCAL_CADENCE_DAYS,
  runPrensaLocalAgent,
} from '@/lib/agents/prensa-local-runner';

check('agentName es surus-agente-prensa-local', PRENSA_LOCAL_AGENT_NAME === 'surus-agente-prensa-local');
check('cadenceDays=3', PRENSA_LOCAL_CADENCE_DAYS === 3);
check('runPrensaLocalAgent es función', typeof runPrensaLocalAgent === 'function');

// 9. Live test opcional (skip si MOCK=1 o DB caída)
if (process.env.MOCK !== '1' && process.env.PRUEBA_SKIP_LIVE !== '1') {
  console.log('\n  → Live test: corremos runPrensaLocalAgent({ maxPerSource: 2, daysBack: 7 })');
  try {
    const t0 = Date.now();
    const result = await runPrensaLocalAgent({ maxPerSource: 2, daysBack: 7 });
    const elapsed = Date.now() - t0;
    console.log(`\n  resultado: scanned=${result.scanned} found=${result.found} inScope=${result.inScope} errors=${result.errors} elapsed=${elapsed}ms`);
    console.log(`  byCcaa: ${JSON.stringify(result.byCcaa)}`);
    check('live run completes', result.errors < result.scanned, `${result.errors} errors de ${result.scanned} medios`);
  } catch (e) {
    failed++;
    fails.push(`live run failed: ${(e as Error).message}`);
    console.log(`  ✗ live run failed: ${(e as Error).message}`);
  }
} else {
  console.log('\n  → Live test SKIPPED (MOCK=1 o PRUEBA_SKIP_LIVE=1)');
}

console.log(`\n=== ${passed} PASS, ${failed} FAIL ===`);
if (failed > 0) {
  console.log('\nFALLAS:');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
