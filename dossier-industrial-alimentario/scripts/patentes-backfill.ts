// scripts/patentes-backfill.ts — Sprint C.3
// CLI wrapper: pnpm patentes:backfill
// Ejecuta 1 pasada del agente de patentes. Modo backfill (TODAS las A&B).

import { runPatentesAgent } from '../lib/agents/patentes-runner';

async function main() {
  console.log('[patentes-backfill] Iniciando backfill de patentes OEPM...');
  const result = await runPatentesAgent({ dryRun: false });
  console.log('[patentes-backfill] Resultado:');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('[patentes-backfill] error:', e);
  process.exit(1);
});
