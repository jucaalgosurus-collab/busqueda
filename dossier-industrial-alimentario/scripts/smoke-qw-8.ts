// scripts/smoke-qw-8.ts — Sprint QW-8: Búsqueda incremental 2d en periódicos
//
// 5 asserts:
//   QW-8-A ScrapeOptions acepta daysBack opcional (type-check OK)
//   QW-8-B applyDaysBackFilter exportado desde newsroom.ts
//   QW-8-C runPrensaAgent acepta daysBack en opts (default 2)
//   QW-8-D applyDaysBackFilter descarta items > daysBack días, conserva null
//   QW-8-E runPrensaAgent persiste mode='incremental_2d' cuando daysBack<=2

import { existsSync } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint QW-8 Incremental 2d smoke (5 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);

  // QW-8-A
  const typesPath = join(process.cwd(), 'lib', 'scrapers', 'types.ts');
  const typesContent = readFileSync(typesPath, 'utf-8');
  const hasDaysBack = /daysBack\?:\s*number/.test(typesContent);
  assert('QW-8-A [ScrapeOptions.daysBack definido en types.ts]', hasDaysBack, `present=${hasDaysBack}`);

  // QW-8-B
  const newsroomPath = join(process.cwd(), 'lib', 'scrapers', 'newsroom.ts');
  const newsroomContent = readFileSync(newsroomPath, 'utf-8');
  const hasFilter = /export\s+function\s+applyDaysBackFilter/.test(newsroomContent);
  assert('QW-8-B [applyDaysBackFilter exportado en newsroom.ts]', hasFilter, `present=${hasFilter}`);

  // QW-8-C
  const runnerPath = join(process.cwd(), 'lib', 'agents', 'prensa-runner.ts');
  const runnerContent = readFileSync(runnerPath, 'utf-8');
  const runnerAccepts = /opts:\s*\{[^}]*daysBack/.test(runnerContent) || /opts:\s*\{[\s\S]*?daysBack\?:\s*number/.test(runnerContent);
  assert('QW-8-C [runPrensaAgent acepta daysBack en opts]', runnerAccepts, `accepts=${runnerAccepts}`);

  // QW-8-D — test runtime de la función pura
  const newsroomMod = await import('../lib/scrapers/newsroom.js');
  const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás
  const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 día atrás
  const noDate = null;
  const items = [
    { url: 'a', title: 'A', publishedAt: oldDate, content: '', contentHash: 'h1', outlet: 'x', outletType: 'nacional' as const, language: 'es' as const, raw: { fetchMs: 0 } },
    { url: 'b', title: 'B', publishedAt: recentDate, content: '', contentHash: 'h2', outlet: 'x', outletType: 'nacional' as const, language: 'es' as const, raw: { fetchMs: 0 } },
    { url: 'c', title: 'C', publishedAt: noDate, content: '', contentHash: 'h3', outlet: 'x', outletType: 'nacional' as const, language: 'es' as const, raw: { fetchMs: 0 } },
  ];
  const filtered = newsroomMod.applyDaysBackFilter(items, 2);
  const filterOk = filtered.length === 2 && filtered.some((i) => i.url === 'b') && filtered.some((i) => i.url === 'c') && !filtered.some((i) => i.url === 'a');
  assert('QW-8-D [applyDaysBackFilter descarta >daysBack, conserva null]', filterOk, `kept=${filtered.map((i) => i.url).join(',')}`);

  // QW-8-E — el runner debe marcar mode='incremental_2d' cuando daysBack<=2
  const modeLogic = /mode:\s*daysBack\s*>\s*2\s*\?\s*['"]backfill_15d['"]\s*:\s*['"]incremental_2d['"]/.test(runnerContent);
  assert('QW-8-E [runPrensaAgent marca mode incremental_2d cuando daysBack<=2]', modeLogic, `modeLogic=${modeLogic}`);

  console.log(`\n=== TOTAL: ${pass} pass / ${fail} fail ===`);
  if (failures.length > 0) { console.log('\n=== FAILURES ==='); for (const f of failures) console.log(`  - ${f}`); }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
