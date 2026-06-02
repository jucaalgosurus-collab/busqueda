// lib/agents/hunter-runner.ts — Enriquecedor de emails con Hunter.io
// Para cada Contact sin email_verified, busca email corporativo via Hunter.
// API key en .env (HUNTER_API_KEY). Rate: 1 req/3s para no agotar free tier.
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const HUNTER_API = 'https://api.hunter.io/v2';
const HUNTER_KEY = process.env.HUNTER_API_KEY ?? '';

export interface HunterResult {
  agentName: string;
  attempted: number;
  enriched: number;
  notFound: number;
  errors: number;
  costEur: number;
  durationMs: number;
}

interface HunterResponse {
  data?: {
    email: string;
    score: number;
    position: string | null;
    department: string | null;
  };
  errors?: Array<{ details: string }>;
}

async function findEmailByNameAndDomain(opts: { fullName: string; domain: string }): Promise<{ email: string; score: number } | null> {
  if (!HUNTER_KEY) return null;
  try {
    const r = await axios.get<HunterResponse>(`${HUNTER_API}/email-finder`, {
      params: { full_name: opts.fullName, domain: opts.domain, api_key: HUNTER_KEY },
      timeout: 12_000,
    });
    if (r.data?.data?.email && r.data.data.score >= 70) {
      return { email: r.data.data.email, score: r.data.data.score };
    }
    return null;
  } catch {
    return null;
  }
}

export async function runHunterEnricher(opts: { maxContacts?: number; onlyCompanyIds?: string[] } = {}): Promise<HunterResult> {
  const startedAt = new Date();
  const max = opts.maxContacts ?? 20;
  const only = new Set(opts.onlyCompanyIds ?? []);

  // Buscar Contacts sin email verificado y que tengan linkedinUrl (señal de calidad)
  const candidates = await prisma.contact.findMany({
    where: {
      emailVerified: false,
      linkedinUrl: { not: null },
      ...(only.size > 0 ? { currentCompanyId: { in: [...only] } } : {}),
    },
    include: { currentCompany: true },
    take: max,
    orderBy: { lastEnrichedAt: 'asc' },
  });

  let enriched = 0, notFound = 0, errors = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.currentCompany?.web) { notFound++; continue; }
    let domain: string;
    try { domain = new URL(c.currentCompany.web).hostname.replace(/^www\./, ''); }
    catch { notFound++; continue; }
    const res = await findEmailByNameAndDomain({ fullName: c.fullName, domain });
    if (res) {
      await prisma.contact.update({
        where: { id: c.id },
        data: { email: res.email, emailVerified: true, lastEnrichedAt: new Date() },
      });
      enriched++;
    } else {
      notFound++;
    }
    // Throttle 3s
    await new Promise((r) => setTimeout(r, 3000));
    if (i % 5 === 0) console.log(`[hunter] progress: ${i + 1}/${candidates.length}, enriched=${enriched}`);
  }

  return {
    agentName: 'hunter-enricher',
    attempted: candidates.length,
    enriched,
    notFound,
    errors,
    costEur: 0, // free tier
    durationMs: Date.now() - startedAt.getTime(),
  };
}

if (process.argv[1]?.endsWith('hunter-runner.ts') || process.argv[1]?.endsWith('hunter-runner.js')) {
  (async () => {
    try {
      const r = await runHunterEnricher({ maxContacts: 10 });
      console.log(JSON.stringify(r, null, 2));
    } catch (e) { console.error(e); process.exit(1); }
    finally { await prisma.$disconnect(); }
  })();
}
