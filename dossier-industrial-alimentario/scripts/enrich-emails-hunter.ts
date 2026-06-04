// scripts/enrich-emails-hunter.ts
// Enriquece emails de decisores A&B vía Hunter.io.
// 1 Domain Search por empresa (7 total, dentro del free tier 50/mes).
// Matching: nombre+apellido en común, fallback: roles ejecutivos/operations de la empresa
// se persisten como `notes` para futura verificación manual.
//
// Uso:  pnpm tsx scripts/enrich-emails-hunter.ts

import { PrismaClient } from '@prisma/client';

const HUNTER_KEY = process.env.HUNTER_API_KEY;
if (!HUNTER_KEY) throw new Error('HUNTER_API_KEY not set');

const prisma = new PrismaClient();

interface HunterEmail {
  value: string;
  type: string;
  confidence: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string | null;
  seniority: string | null;
  linkedin: string | null;
}

interface HunterResponse {
  data?: { domain: string; organization: string; emails: HunterEmail[] };
  errors?: Array<{ id: string; details: string }>;
}

function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match: al menos 1 token del first_name Y 1 token del last_name coinciden
function matchByName(contactFullName: string, hunter: HunterEmail): number {
  if (!hunter.first_name && !hunter.last_name) return 0;
  const cTokens = new Set(norm(contactFullName).split(' ').filter((t) => t.length > 1));
  const hFirst = norm(hunter.first_name ?? '').split(' ').filter((t) => t.length > 1);
  const hLast = norm(hunter.last_name ?? '').split(' ').filter((t) => t.length > 1);
  let score = 0;
  for (const t of hFirst) if (cTokens.has(t)) score += 1;
  for (const t of hLast) if (cTokens.has(t)) score += 2; // apellido pesa más
  return score;
}

async function hunterDomainSearch(domain: string): Promise<HunterEmail[]> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_KEY}&limit=10`;
  const res = await fetch(url);
  const json = (await res.json()) as HunterResponse;
  if (json.errors) {
    console.error(`  ✗ Hunter error: ${json.errors[0]?.details ?? json.errors[0]?.id}`);
    return [];
  }
  return json.data?.emails ?? [];
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EMAIL ENRICHMENT — Hunter.io Domain Search');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const companies = await prisma.company.findMany({
    select: { id: true, slug: true, name: true, website: true },
    orderBy: { name: 'asc' },
  });

  let totalSearches = 0;
  let totalEnriched = 0;
  let totalCandidates = 0;
  let totalErrors = 0;

  for (const company of companies) {
    const domain = extractDomain(company.website);
    if (!domain) {
      console.log(`⊘ ${company.name}: no website`);
      continue;
    }

    const contacts = await prisma.plantContact.findMany({
      where: { companyId: company.id, OR: [{ email: null }, { email: '' }] },
      select: { id: true, fullName: true, role: true, roleCategory: true, notes: true },
    });
    if (contacts.length === 0) {
      console.log(`✓ ${company.name}: ya todos con email`);
      continue;
    }

    process.stdout.write(`▶ ${company.name} (${domain}) — ${contacts.length} sin email… `);
    const emails = await hunterDomainSearch(domain);
    totalSearches++;
    if (emails.length === 0) {
      console.log('sin emails en Hunter');
      continue;
    }
    console.log(`${emails.length} emails en Hunter`);

    for (const c of contacts) {
      // Buscar mejor match por nombre
      let best: HunterEmail | null = null;
      let bestScore = 0;
      for (const e of emails) {
        const s = matchByName(c.fullName, e);
        if (s > bestScore) {
          bestScore = s;
          best = e;
        }
      }

      if (best && bestScore >= 2) {
        // Match real: persistir
        try {
          await prisma.plantContact.update({
            where: { id: c.id },
            data: {
              email: best.value,
              emailVerified: best.confidence >= 90,
              hunterId: `${best.value}|${domain}`,
              lastEnrichedAt: new Date(),
            },
          });
          totalEnriched++;
          console.log(
            `  ✓ ${c.fullName} (${c.role}) ← ${best.value} (${best.position ?? '?'}, conf ${best.confidence})`,
          );
        } catch (e) {
          totalErrors++;
          console.log(`  ✗ ${c.fullName}: ${(e as Error).message}`);
        }
      } else {
        // No match: guardar candidatos como notes
        const execs = emails
          .filter((e) => e.seniority === 'executive' || e.department === 'operations' || e.department === 'finance')
          .slice(0, 5);
        if (execs.length > 0) {
          const candidates = execs
            .map((e) => `${e.value} (${e.position ?? '?'}, conf ${e.confidence})`)
            .join(' | ');
          try {
            const prevNotes = c.notes ?? '';
            const newNotes = prevNotes
              ? `${prevNotes}\n[Hunter candidates 2026-06-03]: ${candidates}`
              : `[Hunter candidates 2026-06-03]: ${candidates}`;
            await prisma.plantContact.update({
              where: { id: c.id },
              data: { notes: newNotes, lastEnrichedAt: new Date() },
            });
            totalCandidates++;
            console.log(`  ↳ ${c.fullName}: ${execs.length} candidatos guardados en notes`);
          } catch (e) {
            totalErrors++;
            console.log(`  ✗ ${c.fullName} notes: ${(e as Error).message}`);
          }
        } else {
          console.log(`  ⊘ ${c.fullName}: sin match ni candidatos ejecutivos`);
        }
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✓ ENRICHMENT COMPLETADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Hunter searches consumidos: ${totalSearches}/50 disponibles`);
  console.log(`  Emails persistidos: ${totalEnriched}`);
  console.log(`  Candidatos guardados en notes: ${totalCandidates}`);
  console.log(`  Errores: ${totalErrors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
