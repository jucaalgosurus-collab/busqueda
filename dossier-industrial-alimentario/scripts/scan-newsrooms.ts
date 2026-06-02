// scripts/scan-newsrooms.ts — Entry CLI para newsrooms-corporativas agent
import { runNewsroomsAgent } from '../lib/agents/runner.js';

runNewsroomsAgent({
  maxPerSource: Number(process.env.MAX_PER_SOURCE ?? 8),
  onlySlugs: process.env.ONLY_SLUGS ? process.env.ONLY_SLUGS.split(',') : undefined,
}).then((r) => {
  console.log('OK newsrooms:', JSON.stringify(r));
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
