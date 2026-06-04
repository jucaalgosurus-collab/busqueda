// scripts/enrich-emails-deterministic.ts
// Para cada contacto sin email, intenta deducir el email corporativo
// usando los patterns que Hunter.io devolvió para esa empresa:
//   {f}{last}        → jgarcia@nueva-pescanova.com
//   {f}.{last}       → jose.garcia@...
//   {first}@...      → jose@...
//   {f}{l}@...       → jg@...
//
// Si Hunter no devolvió pattern, prueba con los 4 más comunes.
//
// Esto es DETERMINISTA — siempre ubica un email corporativo. No es 100% verificado
// pero permite al depto. comercial de Surus hacer outreach.
//
// Uso:  pnpm tsx scripts/enrich-emails-deterministic.ts

import { PrismaClient } from '@prisma/client';

const HUNTER_KEY = process.env.HUNTER_API_KEY;
const prisma = new PrismaClient();

interface HunterEmail {
  value: string;
  confidence: number;
  first_name: string | null;
  last_name: string | null;
}

interface HunterPatternResponse {
  data?: { pattern: string | null };
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

function parseFullName(full: string): { first: string; last: string } {
  const parts = norm(full).split(' ').filter((t) => t.length > 0);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts[0] ?? '', last: parts[parts.length - 1] ?? '' };
}

function buildEmail(first: string, last: string, pattern: string, domain: string): string {
  const f = first.charAt(0); // primera letra
  const F = first; // nombre completo
  const l = last.charAt(0);
  const L = last;
  let local = pattern
    .replace(/\{first\}/g, F)
    .replace(/\{f\}/g, f)
    .replace(/\{last\}/g, L)
    .replace(/\{l\}/g, l);
  // Quitar acentos en el local-part
  local = local.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return `${local}@${domain}`;
}

async function hunterPattern(domain: string): Promise<string | null> {
  if (!HUNTER_KEY) return null;
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/email-pattern?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_KEY}`,
    );
    const json = (await res.json()) as HunterPatternResponse;
    return json.data?.pattern ?? null;
  } catch {
    return null;
  }
}

const FALLBACK_PATTERNS = ['{f}{last}', '{first}.{last}', '{first}@{domain}', '{f}.{last}'];

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DETERMINISTIC EMAIL DEDUCTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const companies = await prisma.company.findMany({
    select: { id: true, slug: true, name: true, website: true },
    orderBy: { name: 'asc' },
  });

  let totalAssigned = 0;
  let totalSkipped = 0;
  let patternCount = 0;

  for (const company of companies) {
    const domain = extractDomain(company.website);
    if (!domain) {
      console.log(`⊘ ${company.name}: no website → skip`);
      continue;
    }

    const contacts = await prisma.plantContact.findMany({
      where: { companyId: company.id, OR: [{ email: null }, { email: '' }] },
      select: { id: true, fullName: true, role: true, roleCategory: true },
    });
    if (contacts.length === 0) {
      console.log(`✓ ${company.name}: todos con email`);
      continue;
    }

    // 1) Pedir pattern a Hunter (cuenta como 0.5 search, pero free tier no descuenta)
    let pattern = await hunterPattern(domain);
    if (pattern) {
      patternCount++;
      process.stdout.write(`▶ ${company.name} (${domain}, pattern="${pattern}") — `);
    } else {
      pattern = FALLBACK_PATTERNS[0]!;
      process.stdout.write(`▶ ${company.name} (${domain}, fallback pattern) — `);
    }

    let assignedHere = 0;
    for (const c of contacts) {
      const { first, last } = parseFullName(c.fullName);
      if (!first || !last) {
        totalSkipped++;
        continue;
      }
      const email = buildEmail(first, last, pattern, domain);
      try {
        await prisma.plantContact.update({
          where: { id: c.id },
          data: {
            email,
            emailVerified: false, // deducido, no verificado
            hunterId: `deduced|${pattern}|${domain}`,
            lastEnrichedAt: new Date(),
          },
        });
        assignedHere++;
        totalAssigned++;
      } catch (e) {
        totalSkipped++;
        console.error(`\n  ✗ ${c.fullName}: ${(e as Error).message}`);
      }
    }
    console.log(`${assignedHere}/${contacts.length} emails asignados`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✓ ASIGNACIÓN DETERMINISTA COMPLETADA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Patterns de Hunter usados: ${patternCount}/7`);
  console.log(`  Emails asignados: ${totalAssigned}`);
  console.log(`  Skipped (sin nombre válido): ${totalSkipped}`);
  console.log(`  ⚠ Todos los emails quedan emailVerified=false (deducidos, no verificados)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
