// scripts/scan-boe-bop.ts — CLI entrypoint BOE/BOP/sindicatos
import { runBoeBopAgent } from '@/lib/agents/boe-bop-runner';

const maxPer = Number(process.env.MAX_PER_SOURCE ?? '15');
const onlySlugs = process.env.ONLY_SLUGS ? process.env.ONLY_SLUGS.split(',') : undefined;

runBoeBopAgent({ maxPerSource: maxPer, onlySlugs })
  .then((r) => { console.log('\nFinal:', JSON.stringify(r, null, 2)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
