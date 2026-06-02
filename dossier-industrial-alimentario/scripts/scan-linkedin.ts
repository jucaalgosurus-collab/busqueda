// scripts/scan-linkedin.ts — CLI entrypoint LinkedIn OSINT
import { runLinkedInAgent } from '@/lib/agents/linkedin-runner';

const maxQueries = Number(process.env.MAX_QUERIES ?? '20');
const onlyRoles = process.env.ONLY_ROLES ? process.env.ONLY_ROLES.split(',') : undefined;

runLinkedInAgent({ maxQueries, onlyRoles })
  .then((r) => { console.log('\nFinal:', JSON.stringify(r, null, 2)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
