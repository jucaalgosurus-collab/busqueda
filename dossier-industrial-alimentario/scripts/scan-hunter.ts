// scripts/scan-hunter.ts — CLI entrypoint Hunter.io enricher
import { runHunterEnricher } from '@/lib/agents/hunter-runner';

const max = Number(process.env.MAX_CONTACTS ?? '10');
runHunterEnricher({ maxContacts: max })
  .then((r) => { console.log('\nFinal:', JSON.stringify(r, null, 2)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
