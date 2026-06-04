// scripts/backfill-newsrooms-15d.ts
// Backfill 15 días de newsrooms corporativas.
// Ejecuta el runner de newsrooms y persiste los resultados.
//
// Uso:  pnpm tsx scripts/backfill-newsrooms-15d.ts

import { runNewsroomsAgent } from '../lib/agents/runner';

async function main() {
  const startedAt = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BACKFILL 15 DÍAS — NEWSROOMS CORPORATIVAS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const result = await runNewsroomsAgent({ maxPerSource: 30 });
  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✓ Backfill newsrooms completado en ${duration}s`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Scanned:       ${result.scanned}`);
  console.log(`  Found:         ${result.found}`);
  console.log(`  In scope:      ${result.inScope}`);
  console.log(`  Out of scope:  ${result.outOfScope}`);
  console.log(`  New+updated:   ${result.new + result.updated}`);
  console.log(`  Errors:        ${result.errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
