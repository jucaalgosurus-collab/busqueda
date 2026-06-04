// scripts/financials-backfill.ts — Sprint C.2
// CLI backfill para el agente de financials (Wikipedia scraper).
// Wrapper sobre `runFinancialsAgent` con logging estructurado.

import { runFinancialsAgent } from '../lib/agents/financials-runner';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`[c2-backfill] start dryRun=${dryRun}`);
  const t0 = Date.now();

  const result = await runFinancialsAgent({ dryRun });

  console.log(`[c2-backfill] mode=${result.mode}`);
  console.log(`[c2-backfill] companiesEvaluated=${result.companiesEvaluated}`);
  console.log(`[c2-backfill] wikipediaFound=${result.wikipediaFound} wikipediaNotFound=${result.wikipediaNotFound} wikipediaErrors=${result.wikipediaErrors}`);
  console.log(`[c2-backfill] fieldsUpdated=${result.fieldsUpdated} sourcesCreated=${result.sourcesCreated} sourcesUpdated=${result.sourcesUpdated}`);
  console.log(`[c2-backfill] errors=${result.errors} durationMs=${result.durationMs}`);

  if (result.topHits.length > 0) {
    console.log(`\n[c2-backfill] top hits (${result.topHits.length}):`);
    for (const h of result.topHits) {
      const factM = h.facturacionM !== null ? `${h.facturacionM}M €` : 'n/d';
      const emp = h.empleados !== null ? h.empleados.toLocaleString('es-ES') : 'n/d';
      console.log(`  - ${h.name.padEnd(30)} fact=${factM.padEnd(12)} emp=${emp.padEnd(10)} src=${h.fuente}`);
    }
  }

  const totalMs = Date.now() - t0;
  console.log(`\n[c2-backfill] DONE totalMs=${totalMs} exitCode=${result.errors > 0 ? 1 : 0}`);

  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[c2-backfill] FATAL:', err);
  process.exit(1);
});
