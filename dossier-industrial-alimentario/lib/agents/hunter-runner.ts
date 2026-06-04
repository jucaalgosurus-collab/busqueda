// lib/agents/hunter-runner.ts — Enriquecedor de emails con Hunter.io + Verifier
// Sprint E.1b: cierra la cadena LinkedIn→Hunter→Verifier.
// Paso 1: /email-finder busca email por nombre+dominio (score>=70)
// Paso 2: /email-verifier CONFIRMA que el buzón existe (con cache 30d)
//
// API key en .env (HUNTER_API_KEY). Rate: 1 req/3s para no agotar free tier.
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { verifyEmailWithCache } from './email-verifier';

const defaultPrisma = new PrismaClient();

const HUNTER_API = 'https://api.hunter.io/v2';
const HUNTER_KEY = process.env.HUNTER_API_KEY ?? '';

/** Dependencias inyectables (sólo para tests). En producción se usan las defaults. */
export interface HunterDeps {
  prisma?: PrismaClient;
  hunterKey?: string;
}

export interface HunterResult {
  agentName: string;
  attempted: number;
  enriched: number;
  notFound: number;
  rejectedByVerifier: number;
  acceptedUnknown: number;
  errors: number;
  costEur: number;
  durationMs: number;
}

interface HunterFinderResponse {
  data?: {
    email: string;
    score: number;
    position: string | null;
    department: string | null;
  };
  errors?: Array<{ details: string }>;
}

async function findEmailByNameAndDomain(opts: { fullName: string; domain: string; apiKey: string }): Promise<{ email: string; score: number } | null> {
  if (!opts.apiKey) return null;
  try {
    const r = await axios.get<HunterFinderResponse>(`${HUNTER_API}/email-finder`, {
      params: { full_name: opts.fullName, domain: opts.domain, api_key: opts.apiKey },
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

export async function runHunterEnricher(opts: { maxContacts?: number; onlyCompanyIds?: string[]; deps?: HunterDeps } = {}): Promise<HunterResult> {
  const startedAt = new Date();
  const prisma = opts.deps?.prisma ?? defaultPrisma;
  const hunterKey = opts.deps?.hunterKey ?? HUNTER_KEY;
  const max = opts.maxContacts ?? 20;
  const only = new Set(opts.onlyCompanyIds ?? []);

  // Buscar Contacts sin email verificado y que tengan linkedinUrl (señal de calidad)
  const candidates = await prisma.plantContact.findMany({
    where: {
      emailVerified: false,
      linkedinUrl: { not: null },
      ...(only.size > 0 ? { companyId: { in: [...only] } } : {}),
    },
    include: { company: true },
    take: max,
    orderBy: { lastEnrichedAt: 'asc' },
  });

  let enriched = 0, notFound = 0, rejectedByVerifier = 0, acceptedUnknown = 0, errors = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.company?.website) { notFound++; continue; }
    let domain: string;
    try { domain = new URL(c.company.website).hostname.replace(/^www\./, ''); }
    catch { notFound++; continue; }

    // Paso 1: /email-finder
    const found = await findEmailByNameAndDomain({ fullName: c.fullName, domain, apiKey: hunterKey });
    if (!found) {
      notFound++;
      if (!opts.deps) await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    // Paso 2: /email-verifier (E.1b) — confirma que el buzón existe
    try {
      const verification = await verifyEmailWithCache(found.email, hunterKey, prisma);
      if (verification.status === 'invalid') {
        // El buzón NO existe → no persistimos el email
        rejectedByVerifier++;
        console.log(`[hunter] ${c.fullName} -> ${found.email} rejected by verifier (invalid)`);
      } else if (verification.status === 'valid') {
        await prisma.plantContact.update({
          where: { id: c.id },
          data: { email: found.email, emailVerified: true, lastEnrichedAt: new Date() },
        });
        enriched++;
      } else {
        // accept_all | unknown | disposable | webmail | error → aceptamos
        // (regla 10208: ya está cacheado, no re-verificar 30d)
        await prisma.plantContact.update({
          where: { id: c.id },
          data: { email: found.email, emailVerified: true, lastEnrichedAt: new Date() },
        });
        enriched++;
        if (verification.status === 'accept_all' || verification.status === 'unknown') {
          acceptedUnknown++;
        }
      }
    } catch (e) {
      // Verifier threw (auth fail, rate limit, 5xx) — no persistimos
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[hunter] verifier error for ${found.email}: ${msg}`);
      errors++;
    }

    // Throttle 3s entre contactos (1 finder + 1 verifier = 2 calls Hunter, 3s c/u).
    // Skip cuando hay deps inyectadas (modo test).
    if (!opts.deps) {
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (i % 5 === 0) console.log(`[hunter] progress: ${i + 1}/${candidates.length}, enriched=${enriched} rejected=${rejectedByVerifier}`);
  }

  return {
    agentName: 'hunter-enricher',
    attempted: candidates.length,
    enriched,
    notFound,
    rejectedByVerifier,
    acceptedUnknown,
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
    finally { await defaultPrisma.$disconnect(); }
  })();
}
