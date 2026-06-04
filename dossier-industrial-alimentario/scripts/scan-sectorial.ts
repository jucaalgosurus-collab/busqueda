// scripts/scan-sectorial.ts — Entry CLI para prensa-sectorial agent
import { runSectorialAgent } from '../lib/agents/runner';

runSectorialAgent({
  maxPerSource: Number(process.env.MAX_PER_SOURCE ?? 15),
  onlySlugs: process.env.ONLY_SLUGS ? process.env.ONLY_SLUGS.split(',') : undefined,
}).then((r) => {
  console.log('OK sectorial:', JSON.stringify(r));
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
