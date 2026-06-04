// scripts/scan-linkedin.ts — CLI entrypoint LinkedIn OSINT
// Uso:
//   npx tsx scripts/scan-linkedin.ts --max-queries=3
//   npx tsx scripts/scan-linkedin.ts --max-queries=3 --only-roles=plant_manager
//   npx tsx scripts/scan-linkedin.ts --via=playwright  (respeta env flag LINKEDIN_PLAYWRIGHT_ENABLED)
// Variables de entorno equivalentes: MAX_QUERIES, ONLY_ROLES.
import { runLinkedInAgent } from '@/lib/agents/linkedin-runner';

function parseArgs(): { maxQueries?: number; onlyRoles?: string[]; via?: string } {
  const args = process.argv.slice(2);
  const out: { maxQueries?: number; onlyRoles?: string[]; via?: string } = {};
  for (const arg of args) {
    if (arg.startsWith('--max-queries=')) out.maxQueries = parseInt(arg.split('=')[1] ?? '', 10);
    else if (arg.startsWith('--only-roles=')) out.onlyRoles = (arg.split('=')[1] ?? '').split(',').filter(Boolean);
    else if (arg.startsWith('--via=')) out.via = arg.split('=')[1];
  }
  return out;
}

const args = parseArgs();
const maxQueries = args.maxQueries ?? Number(process.env.MAX_QUERIES ?? '20');
const onlyRoles = args.onlyRoles ?? (process.env.ONLY_ROLES ? process.env.ONLY_ROLES.split(',') : undefined);

if (args.via === 'playwright') {
  process.env.LINKEDIN_PLAYWRIGHT_ENABLED = 'true';
}

runLinkedInAgent({ maxQueries, onlyRoles })
  .then((r) => { console.log('\nFinal:', JSON.stringify(r, null, 2)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
