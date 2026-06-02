// scripts/scan-prensa.ts — CLI entrypoint agente prensa general + regional
import { runPrensaAgent } from '@/lib/agents/prensa-runner';

const maxPer = Number(process.env.MAX_PER_SOURCE ?? '12');
const onlySlugs = process.env.ONLY_SLUGS ? process.env.ONLY_SLUGS.split(',') : undefined;

runPrensaAgent({ maxPerSource: maxPer, onlySlugs })
  .then((r) => {
    console.log('\nFinal:', JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
