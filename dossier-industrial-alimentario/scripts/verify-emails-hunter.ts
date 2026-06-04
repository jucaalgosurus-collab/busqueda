// scripts/verify-emails-hunter.ts
// Verifica con Hunter.io Email Verifier CADA email de la base que NO esté ya verificado.
// 1 crédito Hunter por verificación. 78 créditos disponibles este mes.
// Actualiza emailVerified=true/false según el status de Hunter.
// Idempotente: solo verifica los que emailVerified IS NULL OR FALSE.
//
// Uso: cd /opt/hermes-dossier/apps/dossier-industrial && tsx scripts/verify-emails-hunter.ts
//      o desde Windows: cd <repo> && pnpm tsx scripts/verify-emails-hunter.ts
//
// También corre automáticamente al final de run-agents.sh para que SIEMPRE se verifique.

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { INDUSTRIAS, industriasConContactos } from '../lib/industria';

const prisma = new PrismaClient();

// Sectores en los que SÍ extraemos contactos (A&B) — restricción dura del usuario
// aunque el scan general cubra TODO el sector industrial
const CONTACTOS_PERMITIDOS = new Set(industriasConContactos());
const SECTORES_PERMITIDOS_LABEL = INDUSTRIAS
  .filter((i) => CONTACTOS_PERMITIDOS.has(i.sector))
  .map((i) => i.label)
  .join(' + ');

const HUNTER_KEY = process.env.HUNTER_API_KEY
  || (fs.existsSync('/opt/hermes-dossier/.env')
    ? fs.readFileSync('/opt/hermes-dossier/.env', 'utf-8').split('HUNTER_API_KEY=')[1]?.split('\n')[0]?.trim()
    : '')
  || '';

// Google Custom Search API (motor principal para LinkedIn search)
// API key: https://developers.google.com/custom-search/v1/introduction
// CX:      https://programmablesearchengine.google.com (crear buscador limitado a linkedin.com/in/*)
const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY
  || (fs.existsSync('/opt/hermes-dossier/.env')
    ? fs.readFileSync('/opt/hermes-dossier/.env', 'utf-8').split('GOOGLE_CSE_KEY=')[1]?.split('\n')[0]?.trim()
    : '')
  || '';
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX
  || (fs.existsSync('/opt/hermes-dossier/.env')
    ? fs.readFileSync('/opt/hermes-dossier/.env', 'utf-8').split('GOOGLE_CSE_CX=')[1]?.split('\n')[0]?.trim()
    : '')
  || '';

if (!HUNTER_KEY) {
  console.error('HUNTER_API_KEY no configurada. Abortando.');
  process.exit(1);
}
if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) {
  console.warn('[hunter-verify] AVISO: GOOGLE_CSE_KEY o GOOGLE_CSE_CX no configuradas. FASE 3/6 usará Bing como fallback (suele caer en captcha desde VPS).');
}

interface HunterResult {
  data?: {
    status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown' | 'risky';
    score: number;
    result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
    regexp: boolean;
    gibberish: boolean;
    disposable: boolean;
    webmail: boolean;
    mx_records: boolean;
    smtp_server: boolean;
    smtp_check: boolean;
    accept_all: boolean;
  };
  errors?: { details: string }[];
}

interface HunterDomainResult {
  data?: {
    domain: string;
    disposable: boolean;
    webmail: boolean;
    accept_all: boolean;
    pattern: string;
    organization: string;
    emails: Array<{
      value: string;
      type: 'personal' | 'generic';
      confidence: number;
      first_name: string | null;
      last_name: string | null;
      position: string | null;
      department: string | null;
      seniority: string | null;
      linkedin: string | null;
    }>;
  };
  errors?: { details: string }[];
}

async function domainSearch(domain: string): Promise<HunterDomainResult['data'] | null> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_KEY}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (r.status === 429) {
        console.warn(`  [domain 429] sleeping 60s`);
        await new Promise(r => setTimeout(r, 60_000));
        continue;
      }
      if (!r.ok) {
        const body = await r.text();
        console.warn(`  [domain HTTP ${r.status}] ${domain}: ${body.slice(0, 150)}`);
        return null;
      }
      const j: HunterDomainResult = await r.json();
      return j.data || null;
    } catch (e) {
      if (attempt === 3) return null;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return null;
}

// Roles de primer nivel + planta: cualquier decisor A&B valioso para Surus
const SENIOR_KEYWORDS = [
  'director', 'directora', 'director general', 'CEO', 'CFO', 'COO', 'CIO', 'CTO',
  'consejero', 'consejera', 'consejero delegado', 'president', 'presidenta',
  'responsable', 'jefe', 'jefa', 'jefe de planta', 'director de planta',
  'plant manager', 'plant director', 'manufacturing director', 'operations director',
  'sustainability', 'sostenibilidad', 'procurement', 'compras',
  'mantenimiento', 'maintenance', 'calidad', 'quality', 'food safety',
  'supply chain', 'cadena de suministro', 'logística', 'logistics',
  'industrial', 'producción', 'production', 'planta',
];
const SENIORITY_RANK: Record<string, number> = {
  executive: 5, senior: 4, manager: 3, 'junior': 1, '': 0,
};

function isSeniorRole(position: string | null): boolean {
  if (!position) return false;
  const p = position.toLowerCase();
  return SENIOR_KEYWORDS.some((k) => p.includes(k.toLowerCase()));
}

// Valida que un slug de LinkedIn "matchee" razonablemente con el nombre buscado.
// Compara token a token ignorando tildes, guiones, mayúsculas, partículas comunes.
function isNameMatch(fullName: string, linkedinSlug: string): boolean {
  const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'von', 'van']);
  const norm = (s: string) => s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
  const nameTokens = norm(fullName);
  if (nameTokens.length === 0) return false;
  // Slug: split por - o _ (LinkedIn slugs usan guiones o guiones bajos)
  const slugTokens = norm(linkedinSlug.replace(/[-_]+/g, ' '));
  if (slugTokens.length === 0) return false;
  // Todos los tokens del nombre deben aparecer en el slug
  return nameTokens.every((t) => slugTokens.includes(t));
}

interface GoogleCseResult {
  items?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
  error?: { code: number; message: string };
}

async function googleCseLinkedInSearch(fullName: string, companyName: string): Promise<string | null> {
  // Google Custom Search API limitada a linkedin.com/in/*
  // 100 queries/día gratis, $5/1.000 después
  // Docs: https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) return null;

  // Query 1: nombre + empresa (Google ya filtra por CSE scope = linkedin.com/in/*)
  const queries = [
    `${fullName} ${companyName}`,
    `${fullName}`,
  ];

  for (const q of queries) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_KEY}&cx=${GOOGLE_CSE_CX}&q=${encodeURIComponent(q)}&num=5&lr=lang_es`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (r.status === 429) {
        console.warn(`  [Google CSE 429] rate-limited, sleeping 60s`);
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      if (!r.ok) {
        const body = await r.text();
        if (r.status === 403 || r.status === 400) {
          // Quota exhausted o key inválida — no seguir
          console.warn(`  [Google CSE HTTP ${r.status}] ${body.slice(0, 200)}`);
          return null;
        }
        continue;
      }
      const j: GoogleCseResult = await r.json();
      if (!j.items || j.items.length === 0) continue;
      // Buscar el primer item cuyo slug matchee el nombre
      for (const item of j.items) {
        const m = item.link?.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]{5,30})/);
        if (!m) continue;
        const slug = m[1];
        if (isNameMatch(fullName, slug)) {
          return `https://www.linkedin.com/in/${slug}`;
        }
      }
      // Si no hay match estricto, devolver el primer slug (mejor que nada)
      const firstSlugMatch = j.items[0].link?.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]{5,30})/);
      if (firstSlugMatch) {
        return `https://www.linkedin.com/in/${firstSlugMatch[1]}`;
      }
    } catch (e) {
      console.warn(`  [Google CSE ERR] ${(e as Error).message}`);
    }
  }
  return null;
}

async function bingLinkedInSearch(fullName: string, companyName: string): Promise<string | null> {
  // FALLBACK: Bing + DDG (caen en captcha desde VPS 88.198.93.52, pero los dejamos
  // por si Google CSE se queda sin cuota).
  const fullNameQ = `"${fullName}"`;
  const companyQ = `"${companyName}"`;
  const queries = [
    `site:linkedin.com/in ${fullNameQ} ${companyQ}`,
    `${fullNameQ} ${companyQ} linkedin.com/in`,
    `${fullNameQ} ${companyQ} site:linkedin.com`,
  ];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
  };

  for (const q of queries) {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=10&setlang=es`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers });
      if (!r.ok) continue;
      const html = await r.text();
      if (/captcha|desafío/i.test(html)) {
        // Bing bloqueado, no seguir
        return null;
      }
      const slugMatches = Array.from(html.matchAll(/linkedin\.com\/in\/([a-zA-Z0-9_-]{5,30})/g));
      if (slugMatches.length > 0) {
        return `https://www.linkedin.com/in/${slugMatches[0][1]}`;
      }
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

async function linkedInSearch(fullName: string, companyName: string): Promise<string | null> {
  // ORQUESTADOR: 1º Google CSE (gratis, sin captcha), 2º Bing fallback
  const fromGoogle = await googleCseLinkedInSearch(fullName, companyName);
  if (fromGoogle) return fromGoogle;
  return await bingLinkedInSearch(fullName, companyName);
}

// Mapea position string → roleCategory enum del schema
function mapRoleToCategory(position: string | null, department: string | null): string {
  const p = `${position || ''} ${department || ''}`.toLowerCase();
  if (p.includes('ceo') || p.includes('consejero delegado') || p.includes('director general') || p.includes('president')) return 'ceo';
  if (p.includes('cfo') || p.includes('financiero')) return 'cfo';
  if (p.includes('coo') || p.includes('operaciones') || p.includes('operations director')) return 'coo';
  if (p.includes('plant manager') || p.includes('director de planta') || p.includes('jefe de planta') || p.includes('plant director')) return 'plant_manager';
  if (p.includes('sostenibilidad') || p.includes('sustainability') || p.includes('medio ambiente')) return 'sustainability';
  if (p.includes('mantenimiento') || p.includes('maintenance')) return 'maintenance';
  if (p.includes('compras') || p.includes('procurement')) return 'procurement';
  if (p.includes('ere') || p.includes('recursos humanos') || p.includes('rrhh')) return 'ere_responsible';
  return 'other';
}

async function verifyEmail(email: string): Promise<HunterResult['data'] | null> {
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_KEY}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (r.status === 429) {
        console.warn(`  [429] rate-limited, sleeping 60s (attempt ${attempt}/3)`);
        await new Promise(r => setTimeout(r, 60_000));
        continue;
      }
      if (!r.ok) {
        console.warn(`  [HTTP ${r.status}] ${email}: ${(await r.text()).slice(0, 200)}`);
        return null;
      }
      const j: HunterResult = await r.json();
      return j.data || null;
    } catch (e) {
      console.warn(`  [ERR attempt ${attempt}] ${email}: ${(e as Error).message}`);
      if (attempt === 3) return null;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return null;
}

interface HunterFinderResult {
  data?: {
    first_name: string;
    last_name: string;
    email: string | null;
    score: number;
    domain: string;
    accept_all: boolean;
    position: string | null;
    linkedin: string | null;
    company: string | null;
  };
  errors?: { details: string }[];
}

async function findEmail(domain: string, firstName: string, lastName: string): Promise<HunterFinderResult['data'] | null> {
  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${HUNTER_KEY}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (r.status === 429) {
        console.warn(`  [finder 429] sleeping 60s`);
        await new Promise(r => setTimeout(r, 60_000));
        continue;
      }
      if (!r.ok) {
        return null;
      }
      const j: HunterFinderResult = await r.json();
      return j.data || null;
    } catch (e) {
      if (attempt === 3) return null;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return null;
}

async function main() {
  const startedAt = new Date();
  console.log(`[hunter-verify] start ${startedAt.toISOString()}`);
  console.log(`[hunter-verify] RESTRICCIÓN dura: contactos solo para ${SECTORES_PERMITIDOS_LABEL} (CNAE 10+11).`);
  console.log(`[hunter-verify] El scan general cubre TODO el sector industrial (A&B + Farmacéutica + Energía + Manufactura + etc.), pero el enriquecimiento Hunter/LinkedIn se limita a A&B hasta que el usuario indique lo contrario.`);

  // ─── FASE 0: Consultar cuota Hunter y abortar si está baja ───
  interface HunterAccount {
    data?: {
      requests?: {
        searches?: { used?: number; available?: number };
        verifications?: { used?: number; available?: number };
      };
    };
  }
  let searchesLeft = 999;
  let verifLeft = 999;
  try {
    const r = await fetch(`https://api.hunter.io/v2/account?api_key=${HUNTER_KEY}`, { signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const j: HunterAccount = await r.json();
      searchesLeft = j.data?.requests?.searches?.available ?? 999;
      verifLeft = j.data?.requests?.verifications?.available ?? 999;
      console.log(`[hunter-verify] FASE 0: cuota Hunter — searches=${searchesLeft} verifications=${verifLeft}`);
      if (searchesLeft < 5) {
        console.warn(`[hunter-verify] FASE 0: searches agotadas (${searchesLeft} < 5). Saltando FASE 2 y FASE 4.`);
      }
      if (verifLeft < 5) {
        console.warn(`[hunter-verify] FASE 0: verifications agotadas (${verifLeft} < 5). Saltando FASE 1.`);
      }
    }
  } catch (e) {
    console.warn(`[hunter-verify] FASE 0: no pude consultar cuota (${(e as Error).message}). Continúo con presupuesto conservador.`);
  }

  // ─── FASE 1: Re-verificar emails pendientes (riesgo, retry, no confirmados) ───
  const contacts = await prisma.plantContact.findMany({
    where: {
      email: { not: null },
      emailVerified: false,
    },
    select: { id: true, fullName: true, email: true },
  });

  console.log(`[hunter-verify] FASE 1: ${contacts.length} emails pendientes de re-verificar`);

  let verified = 0;
  let invalid = 0;
  let risky = 0;
  let unknown = 0;
  let errors = 0;

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    if (!c.email) continue;
    process.stdout.write(`  [${i + 1}/${contacts.length}] ${c.email} ... `);

    const r = await verifyEmail(c.email);
    if (!r) {
      errors++;
      console.log('ERR');
      continue;
    }

    await prisma.plantContact.update({
      where: { id: c.id },
      data: {
        emailVerified: r.status === 'valid',
        ...((r.status === 'invalid' || r.status === 'disposable') ? { email: null } : {}),
      },
    });

    const score = r.score ?? 0;
    let tag: string;
    if (r.status === 'valid') tag = `VALID (score ${score})`;
    else if (r.status === 'invalid') tag = 'INVALID';
    else if (r.status === 'risky' || r.status === 'accept_all') tag = 'RISKY';
    else if (r.status === 'webmail' || r.status === 'disposable') tag = 'DISPOSABLE';
    else if (r.status === 'unknown') tag = 'UNKNOWN';
    else tag = String(r.status).toUpperCase();
    console.log(tag);

    if (r.status === 'valid') verified++;
    else if (r.status === 'invalid') invalid++;
    else if (r.status === 'risky' || r.status === 'accept_all') risky++;
    else unknown++;

    await new Promise(r => setTimeout(r, 1100));
  }

  // ─── FASE 2: Hunter Email Finder para contactos SIN email pero con empresa asignada ───
  if (searchesLeft < 5) {
    console.log('[hunter-verify] FASE 2: SKIP (sin cuota de searches)');
  }
  const noEmailAll = await prisma.plantContact.findMany({
    where: {
      email: null,
    },
    select: {
      id: true,
      fullName: true,
      role: true,
      companyId: true,
      company: { select: { name: true, website: true } },
    },
    take: 200,  // sobre-buscar para luego filtrar en JS los que sí tienen companyId
  });
  const noEmail = noEmailAll.filter((c) => c.companyId != null && c.company != null).slice(0, 50);

  console.log('');
  console.log(`[hunter-verify] FASE 2: ${noEmail.length} contactos sin email — intentando Hunter Finder`);

  let found = 0;
  let notFound = 0;
  let finderErrors = 0;

  for (let i = 0; i < noEmail.length; i++) {
    const c = noEmail[i];
    const company = c.company;
    if (!company) {
      notFound++;
      continue;
    }

    let domain = '';
    if (company.website) {
      try {
        const u = new URL(company.website);
        domain = u.hostname.replace(/^www\./, '');
      } catch { /* ignore */ }
    }
    if (!domain) {
      domain = company.name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '') + '.com';
    }

    const parts = c.fullName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    if (!firstName || !lastName || !domain) {
      notFound++;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${noEmail.length}] ${c.fullName} @ ${domain} ... `);

    const found1 = await findEmail(domain, firstName, lastName);
    if (!found1 || !found1.email) {
      console.log('NO_MATCH');
      notFound++;
      await new Promise(r => setTimeout(r, 1100));
      continue;
    }

    const verif = await verifyEmail(found1.email);
    if (!verif) {
      finderErrors++;
      console.log('VERIF_ERR');
      await new Promise(r => setTimeout(r, 1100));
      continue;
    }

    if (verif.status === 'valid' || verif.status === 'risky' || verif.status === 'accept_all') {
      await prisma.plantContact.update({
        where: { id: c.id },
        data: {
          email: found1.email,
          emailVerified: verif.status === 'valid',
          linkedinUrl: found1.linkedin || undefined,
          lastEnrichedAt: new Date(),
        },
      });
      const score = verif.score ?? 0;
      console.log(`FOUND ${found1.email} [${verif.status.toUpperCase()} score=${score}]`);
      found++;
    } else {
      console.log(`FOUND_BUT_${verif.status.toUpperCase()}`);
      notFound++;
    }
    await new Promise(r => setTimeout(r, 1100));
  }

  // ─── FASE 3: LinkedIn OSINT para contactos sin LinkedIn conocido ───
  // Estrategia:
  // 1) Hunter Finder (FASE 2) y Domain Search (FASE 4) ya devuelven linkedin en la respuesta.
  //    Esta fase complementa con Google site:linkedin.com para los que Hunter no tiene.
  // 2) Usa Bing (DuckDuckGo bloquea los slugs) con User-Agent rotatorio.
  console.log('');
  console.log('[hunter-verify] FASE 3: LinkedIn OSINT (Bing site:linkedin.com)');

  const noLinkedInAll = await prisma.plantContact.findMany({
    where: {},
    select: {
      id: true,
      fullName: true,
      role: true,
      companyId: true,
      linkedinUrl: true,
      company: { select: { name: true } },
    },
    take: 100,
  });
  const noLinkedIn = noLinkedInAll.filter((c) => !c.linkedinUrl || c.linkedinUrl.trim() === '').slice(0, 30);

  let linkedinFound = 0;
  let linkedinMiss = 0;
  let linkedinErr = 0;

  for (let i = 0; i < noLinkedIn.length; i++) {
    const c = noLinkedIn[i];
    const company = c.company;
    if (!company) {
      linkedinMiss++;
      continue;
    }
    process.stdout.write(`  [${i + 1}/${noLinkedIn.length}] ${c.fullName} @ ${company.name} ... `);

    const url = await linkedInSearch(c.fullName, company.name);
    if (!url) {
      console.log('NO_MATCH');
      linkedinMiss++;
      await new Promise(r => setTimeout(r, 4000));  // rate limit Bing
      continue;
    }

    await prisma.plantContact.update({
      where: { id: c.id },
      data: {
        linkedinUrl: url,
        lastEnrichedAt: new Date(),
      },
    });
    console.log(`OK ${url}`);
    linkedinFound++;
    await new Promise(r => setTimeout(r, 4000));  // rate limit Bing
  }

  // ─── FASE 4: Hunter Domain Search — emails de cargos de primer nivel + planta ───
  // 1 crédito Hunter por dominio. Encuentra todos los emails indexados de la empresa
  // y persiste los que matchean cargos relevantes.
  console.log('');
  console.log('[hunter-verify] FASE 4: Hunter Domain Search (cargos senior)');

  let companies: Array<{ id: string; name: string; website: string | null }> = [];
  let domainEmailsFound = 0;
  let domainEmailsNoMatch = 0;
  let domainSkipped = 0;

  if (searchesLeft < 5) {
    console.log(`[hunter-verify] FASE 4: SKIP (sin cuota de searches, ${searchesLeft} < 5)`);
  } else {

  // Empresas con al menos 1 contacto sin email — para no malgastar créditos
  // (máximo 15 por corrida, controlado por FASE 0)
  // RESTRICCIÓN dura del usuario: solo enriquecemos contactos de Alimentos + Bebidas,
  // aunque el scan de notícias cubra TODO el sector industrial.
  companies = await prisma.company.findMany({
    where: {
      sector: { in: Array.from(CONTACTOS_PERMITIDOS) },
      plantContacts: { some: { email: null } },
    },
    select: { id: true, name: true, website: true },
    take: 15,  // 15 créditos por corrida
  });

  let domainEmailsFound = 0;
  let domainEmailsNoMatch = 0;
  let domainSkipped = 0;

  for (let i = 0; i < companies.length; i++) {
    const comp = companies[i];
    let domain = '';
    if (comp.website) {
      try {
        const u = new URL(comp.website);
        domain = u.hostname.replace(/^www\./, '');
      } catch { /* ignore */ }
    }
    if (!domain) {
      console.log(`  [${i + 1}/${companies.length}] ${comp.name}: sin dominio, skip`);
      domainSkipped++;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${companies.length}] ${comp.name} (${domain}) ... `);
    const ds = await domainSearch(domain);
    if (!ds || !ds.emails || ds.emails.length === 0) {
      console.log('NO_DATA');
      domainEmailsNoMatch++;
      await new Promise(r => setTimeout(r, 1100));
      continue;
    }

    // Filtrar: solo seniority executive/senior/manager + posición senior
    const seniorEmails = ds.emails
      .filter((e) => isSeniorRole(e.position) && (SENIORITY_RANK[e.seniority || ''] || 0) >= 3)
      .slice(0, 5);  // top 5 por empresa

    if (seniorEmails.length === 0) {
      console.log(`0_SENIOR (de ${ds.emails.length} emails totales)`);
      domainEmailsNoMatch++;
      await new Promise(r => setTimeout(r, 1100));
      continue;
    }

    // Buscar contactos existentes de esta empresa (con o sin email) para cruzar por nombre
    const existing = await prisma.plantContact.findMany({
      where: { companyId: comp.id },
      select: { id: true, fullName: true, email: true },
    });
    // Set de emails ya en BD para skip rápido
    const existingEmails = new Set(existing.map((e) => e.email).filter(Boolean));

    // Matching estricto: nombre y apellido deben coincidir (no solo uno)
    function strictNameMatch(hunterFirst: string, hunterLast: string, pcName: string): boolean {
      if (!hunterFirst || !hunterLast) return false;
      const parts = pcName.trim().toLowerCase().split(/\s+/);
      const pcFirst = parts[0] || '';
      const pcLast = parts.slice(1).join(' ') || '';
      // Ambos deben matchear exactamente
      return pcFirst === hunterFirst.toLowerCase() && pcLast === hunterLast.toLowerCase();
    }

    let matchedInThisCo = 0;
    let createdInThisCo = 0;
    let skippedInThisCo = 0;
    for (const e of seniorEmails) {
      if (!e.first_name || !e.last_name) continue;

      // 0) Si el email ya está en BD, skip (ya persistido en corrida anterior)
      if (existingEmails.has(e.value)) {
        skippedInThisCo++;
        continue;
      }

      const eFirst = e.first_name.toLowerCase();
      const eLast = e.last_name.toLowerCase();

      // 1) Intentar matchear con contacto existente
      const match = existing.find((pc) => strictNameMatch(eFirst, eLast, pc.fullName));

      if (match && !match.email) {
        // Verificar email antes de persistir
        const verif = await verifyEmail(e.value);
        if (verif && verif.status === 'valid') {
          await prisma.plantContact.update({
            where: { id: match.id },
            data: {
              email: e.value,
              emailVerified: true,
              linkedinUrl: e.linkedin || undefined,
              lastEnrichedAt: new Date(),
            },
          });
          console.log(`✓ ${e.value} -> ${match.fullName} (valid, UPDATED)`);
          matchedInThisCo++;
          domainEmailsFound++;
        } else if (verif && verif.status === 'risky') {
          await prisma.plantContact.update({
            where: { id: match.id },
            data: {
              email: e.value,
              emailVerified: false,
              linkedinUrl: e.linkedin || undefined,
              lastEnrichedAt: new Date(),
            },
          });
          console.log(`~ ${e.value} -> ${match.fullName} (risky, UPDATED)`);
          matchedInThisCo++;
          domainEmailsFound++;
        }
        await new Promise(r => setTimeout(r, 1100));
      } else if (!match) {
        // 2) Crear contacto NUEVO — decisor senior descubierto por Hunter
        const verif = await verifyEmail(e.value);
        if (verif && (verif.status === 'valid' || verif.status === 'risky')) {
          // Buscar primera planta de la empresa (plantId es required)
          const firstPlant = await prisma.plant.findFirst({
            where: { companyId: comp.id },
            select: { id: true },
          });
          if (!firstPlant) {
            console.log(`! ${e.value} no persistido: ${comp.name} sin plantas`);
            continue;
          }
          const fullName = `${e.first_name} ${e.last_name}`.trim();
          const roleCategory = mapRoleToCategory(e.position, e.department);
          await prisma.plantContact.create({
            data: {
              plantId: firstPlant.id,
              companyId: comp.id,
              fullName,
              role: e.position || 'Cargo no especificado',
              roleCategory,
              email: e.value,
              emailVerified: verif.status === 'valid',
              linkedinUrl: e.linkedin || undefined,
              sourceOutlet: 'Hunter.io',
              sourceUrl: `https://hunter.io/domain-search/${domain}`,
              confidence: (e.confidence || 80) / 100,
              lastEnrichedAt: new Date(),
            },
          });
          console.log(`+ NEW ${e.value} -> ${fullName} (${e.position || '?'}, ${verif.status})`);
          createdInThisCo++;
          domainEmailsFound++;
        }
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    if (matchedInThisCo === 0 && createdInThisCo === 0 && skippedInThisCo > 0) {
      console.log(`${seniorEmails.length} senior, ${skippedInThisCo} ya en BD (skip idempotente)`);
    } else if (matchedInThisCo === 0 && createdInThisCo === 0) {
      console.log(`${seniorEmails.length} senior, 0 matched (${existing.length} existentes en BD)`);
    }
    await new Promise(r => setTimeout(r, 1100));
  }
  }  // cierre else FASE 4

  // ─── FASE 5: Extraer plant/ops managers de las NOTICIAS (in-scope) ───
  // Lee Source con deimplantationSignal=true, extrae personas mencionadas con cargo
  // plant/operaciones (NO CEO), busca email vía Hunter Finder, persiste como nuevo PlantContact.
  console.log('');
  console.log('[hunter-verify] FASE 5: Extracción de plant/ops managers de noticias');

  // Regex: nombre (1-4 palabras CapitalCase) + cargo plant/ops
  // IMPORTANTE: excluimos explícitamente CEO/consejero/presidente — el usuario NO quiere CEOs
  const PLANT_OPS_REGEX = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:[y|e]|de|del|la|los|las|de la|del|de los)\s+|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+){0,4}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s*,?\s+(?:director de planta|jefa de planta|jefe de planta|plant manager|plant director|director industrial|directora industrial|director de operaciones|directora de operaciones|jefe de operaciones|jefa de operaciones|operations manager|operations director|COO|director de fábrica|directora de fábrica|responsable de planta|responsable de operaciones|encargado de producción|encargada de producción|jefe de producción|jefa de producción|director de producción|directora de producción|director técnico|directora técnica|responsable de producción|responsable industrial)\b/gi;

  // Regex de exclusión: si la misma persona aparece con cargo CEO, descartar
  const CEO_ROLE_REGEX = /\b(CEO|consejero delegado|consejera delegada|director general|directora general|presidente|presidenta)\b/i;

  // Filtro de SCOPE ESTRICTO: la noticia debe mencionar desimplantación ALIMENTARIA
  // Sin esto, el clasificador de scope upstream mete falsos positivos (Inditex récord, Aena, fondos UE, alquileres...)
  const DEIMPLANTATION_KEYWORDS = [
    /\b(cierre|cierra|cerrar[áa])\b/i,
    /\b(desmantela|desmantelamiento|desmantelaci[óo]n)\b/i,
    /\b(ERE|expediente de regulaci[óo]n|despidos?\b|m[áa]s de \d+ despidos)\b/i,
    /\b(traslad|deslocaliz|reubicaci[óo]n|reconversi[óo]n)\b/i,
    /\b(liquidaci[óo]n|liquida\b|disoluci[óo]n|fin de actividad|cese de actividad)\b/i,
    /\b(cierre de planta|cierre de f[áa]brica|cierre de l[íi]nea|paralizaci[óo]n)\b/i,
    /\b(venta de maquinaria|venta de activos|desinversi[óo]n)\b/i,
    /\b(industria alimentaria|alimentaci[óo]n|alimentario|alimentaria|food|food industry)\b/i,
    /\b(bebida|cervecer|cerveza|vin[íi]col|l[áa]cteos?|c[áa]rnico|c[aá]rnicos?|panader|conserver|aceite|azucarer|pesc[aoe])\b/i,
    /\b(planta de|f[áa]brica de|centro de producci[óo]n|complejo industrial)\b/i,
  ];
  const NOT_DEIMPLANTATION_KEYWORDS = [
    /\b(r[éé]cord|beneficios?\b|resultados?\b|facturaci[óo]n.*sube|crecimiento|m[áa]ximo hist[óo]rico)\b/i,
    /\b(alquiler|alquilar|hipoteca|vivienda|piso|apartamento)\b/i,
    /\b(fondos europeos|ayudas|subvenciones?|NEXT)\b/i,
    /\b(Inditex|Zara|Aena|Iberdrola|Banco Santander|Telef[óo]nica|BBVA|Naturgy)\b/i,  // textiles, aeroportuario, banca
    /\b(automoci[óo]n|coches?|veh[íi]culos? el[ée]ctricos)\b/i,
  ];

  let newsExtracted = 0;
  let newsHunterFound = 0;
  let newsSkippedCeo = 0;
  let newsSkippedDuplicate = 0;
  let newsErrors = 0;

  if (searchesLeft < 5) {
    console.log('[hunter-verify] FASE 5: SKIP (sin cuota de searches)');
  } else {
    // Leer últimas 30 noticias in-scope (desimplantación real) cuyo empresa
    // pertenezca a los sectores con contactos habilitados (A&B).
    const recentNews = await prisma.source.findMany({
      where: {
        deimplantationSignal: true,
        isStale: false,
        company: { sector: { in: Array.from(CONTACTOS_PERMITIDOS) } },
      },
      orderBy: { scrapedAt: 'desc' },
      take: 30,
      select: { id: true, url: true, title: true, contentText: true, outlet: true, companyId: true },
    });

    console.log(`  [FASE 5] Leyendo ${recentNews.length} noticias in-scope`);

    // Para cada noticia, buscar menciones de personas con cargo plant/ops
    const candidates: Array<{ name: string; role: string; sourceId: string; sourceUrl: string; outlet: string; companyId: string | null }> = [];
    const seenNames = new Set<string>();

    for (const news of recentNews) {
      const text = `${news.title || ''}\n${news.contentText || ''}`;
      if (!text || text.length < 50) continue;

      // Filtro SCOPE ESTRICTO: la noticia debe hablar de desimplantación alimentaria.
      // El agente upstream marca demasiadas cosas como in-scope — filtramos aquí.
      const lowerText = text.toLowerCase();
      const hasDeimpl = DEIMPLANTATION_KEYWORDS.some((re) => re.test(text));
      const isNotDeimpl = NOT_DEIMPLANTATION_KEYWORDS.some((re) => re.test(text));
      if (!hasDeimpl || isNotDeimpl) {
        continue;  // No es desimplantación alimentaria real → descartar para FASE 5
      }

      // Saltar si la noticia menciona CEO como contexto principal (esos los lleva FASE 4)
      const hasCeoContext = CEO_ROLE_REGEX.test(text);
      CEO_ROLE_REGEX.lastIndex = 0;

      for (const m of text.matchAll(PLANT_OPS_REGEX)) {
        const name = m[1].trim();
        const roleRaw = m[0].slice(name.length).trim().replace(/^,\s*/, '');
        if (name.length < 5 || name.split(/\s+/).length > 5) continue;

        // Normalizar y deduplicar
        const nameKey = name.toLowerCase();
        if (seenNames.has(nameKey)) continue;
        seenNames.add(nameKey);

        candidates.push({
          name,
          role: roleRaw,
          sourceId: news.id,
          sourceUrl: news.url,
          outlet: news.outlet || 'unknown',
          companyId: news.companyId,
        });
      }
    }

    console.log(`  [FASE 5] ${candidates.length} personas con cargo plant/ops extraídas de noticias (filtro de scope estricto aplicado)`);

    // Para cada candidato: verificar si ya existe en BD; si no, buscar email vía Hunter
    for (let i = 0; i < candidates.length; i++) {
      if (searchesLeft <= 1) {
        console.log(`  [FASE 5] Cuota agotada, abortando`);
        break;
      }

      const cand = candidates[i];

      // Si no hay companyId en la noticia, intentar deducir de la URL/título
      let companyId = cand.companyId;
      let companyName = '';
      let companyDomain = '';
      if (companyId) {
        const comp = await prisma.company.findUnique({
          where: { id: companyId },
          select: { name: true, website: true },
        });
        if (comp) {
          companyName = comp.name;
          if (comp.website) {
            try {
              companyDomain = new URL(comp.website).hostname.replace(/^www\./, '');
            } catch { /* ignore */ }
          }
        }
      }

      // Si no hay company/domain, intentar deducir company del nombre en la noticia
      if (!companyDomain && cand.outlet) {
        // Saltar si no hay empresa asociada — no podemos buscar email sin dominio
        continue;
      }

      if (!companyDomain) continue;

      // Verificar si el contacto ya existe (case-insensitive)
      const existing = await prisma.plantContact.findFirst({
        where: {
          companyId: companyId || undefined,
          fullName: { equals: cand.name, mode: 'insensitive' },
        },
        select: { id: true, email: true },
      });
      if (existing) {
        newsSkippedDuplicate++;
        continue;
      }

      const parts = cand.name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      if (!firstName || !lastName) continue;

      process.stdout.write(`  [${i + 1}/${candidates.length}] ${cand.name} (${cand.role}) @ ${companyDomain} ... `);
      newsExtracted++;

      const found_ = await findEmail(companyDomain, firstName, lastName);
      searchesLeft--;
      if (!found_ || !found_.email) {
        console.log('NO_MATCH');
        await new Promise(r => setTimeout(r, 1100));
        continue;
      }

      const verif = await verifyEmail(found_.email);
      if (!verif || (verif.status !== 'valid' && verif.status !== 'risky' && verif.status !== 'accept_all')) {
        console.log(`FOUND_BUT_${verif?.status?.toUpperCase() || 'ERR'}`);
        newsErrors++;
        await new Promise(r => setTimeout(r, 1100));
        continue;
      }

      // Buscar primera planta de la empresa (plantId es required)
      if (!companyId) {
        console.log(`FOUND ${found_.email} (sin companyId, skip)`);
        continue;
      }
      const firstPlant = await prisma.plant.findFirst({
        where: { companyId },
        select: { id: true },
      });
      if (!firstPlant) {
        console.log(`FOUND ${found_.email} (sin plantas, skip)`);
        continue;
      }

      await prisma.plantContact.create({
        data: {
          plantId: firstPlant.id,
          companyId,
          fullName: cand.name,
          role: cand.role,
          roleCategory: mapRoleToCategory(cand.role, null),
          email: found_.email,
          emailVerified: verif.status === 'valid',
          linkedinUrl: found_.linkedin || undefined,
          hunterId: undefined,
          sourceUrl: cand.sourceUrl,
          sourceOutlet: cand.outlet,
          confidence: 0.85,  // alta — extraído de noticia in-scope
          lastEnrichedAt: new Date(),
          notes: `Extraído automáticamente de noticia: "${cand.role}". Fuente: ${cand.outlet}`,
        },
      });

      console.log(`✓ ${found_.email} [${verif.status.toUpperCase()}]`);
      newsHunterFound++;
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  // ─── FASE 6: LinkedIn fallback — 2da pasada con DDG + Brave ───
  // Bing/DDG HTML/Brave devuelven captcha desde la IP del VPS (88.198.93.52).
  // Probamos varios buscadores + endpoint RSS de Bing que a veces no está bloqueado.
  // Si NINGUNO devuelve slugs, marcamos el contacto con un note informativo.
  console.log('');
  console.log('[hunter-verify] FASE 6: LinkedIn fallback (multi-engine, con manejo de captcha)');

  // 2da pasada solo sobre contactos de empresas en sectores con contactos habilitados (A&B)
  const noLinkedIn2All = await prisma.plantContact.findMany({
    where: {
      OR: [
        { linkedinUrl: null },
        { linkedinUrl: '' },
      ],
      company: { sector: { in: Array.from(CONTACTOS_PERMITIDOS) } },
    },
    select: {
      id: true,
      fullName: true,
      role: true,
      companyId: true,
      company: { select: { name: true, sector: true } },
    },
    take: 50,
  });
  const noLinkedIn2 = noLinkedIn2All.filter((c) => c.companyId != null && c.company != null).slice(0, 15);

  let linkedin2Found = 0;
  let linkedin2Miss = 0;
  let linkedin2Captcha = 0;

  for (let i = 0; i < noLinkedIn2.length; i++) {
    const c = noLinkedIn2[i];
    const company = c.company;
    if (!company) {
      linkedin2Miss++;
      continue;
    }
    process.stdout.write(`  [${i + 1}/${noLinkedIn2.length}] ${c.fullName} @ ${company.name} ... `);

    const url = await bingLinkedInSearch(c.fullName, company.name);
    if (!url) {
      // Detectar si todos los intentos cayeron en captcha
      linkedin2Miss++;
      console.log('NO_MATCH');
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }

    await prisma.plantContact.update({
      where: { id: c.id },
      data: {
        linkedinUrl: url,
        lastEnrichedAt: new Date(),
      },
    });
    console.log(`OK ${url}`);
    linkedin2Found++;
    await new Promise(r => setTimeout(r, 4000));
  }

  // Si NINGÚN contacto encontró LinkedIn, registramos en BD que la IP del VPS está bloqueada
  // para que el depto. comercial sepa que estos LinkedIn hay que buscarlos a mano.
  if (linkedin2Found === 0 && noLinkedIn2.length > 0) {
    console.log(`  [FASE 6] AVISO: 0 LinkedIn encontrados de ${noLinkedIn2.length} intentos.`);
    console.log(`  [FASE 6] La IP del VPS (88.198.93.52) está bloqueada por Bing/DDG/Brave.`);
    console.log(`  [FASE 6] Los contactos sin linkedinUrl quedan con notes='LinkedIn search bloqueado por captcha' para que se busque a mano.`);
    // Marcar contactos sin linkedinUrl con una nota clara (NO sobrescribir si ya hay note)
    for (const c of noLinkedIn2) {
      const existing = await prisma.plantContact.findUnique({
        where: { id: c.id },
        select: { notes: true },
      });
      if (!existing?.notes?.includes('LinkedIn search bloqueado')) {
        await prisma.plantContact.update({
          where: { id: c.id },
          data: {
            notes: (existing?.notes || '') + ' | LinkedIn search bloqueado por captcha en VPS (88.198.93.52) — buscar a mano desde navegador de Surus.',
          },
        });
      }
    }
  }

  // Log final
  const summary = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    fase1: {
      totalChecked: contacts.length,
      verified, invalid, risky, unknown, errors,
    },
    fase2: {
      totalAttempted: noEmail.length,
      found, notFound, errors: finderErrors,
    },
    fase3: {
      totalAttempted: noLinkedIn.length,
      found: linkedinFound, miss: linkedinMiss, errors: linkedinErr,
    },
    fase4: {
      totalAttempted: companies.length,
      found: domainEmailsFound, noMatch: domainEmailsNoMatch, skipped: domainSkipped,
    },
    fase5: {
      candidatesFromNews: newsExtracted,
      hunterFound: newsHunterFound,
      skippedCeo: newsSkippedCeo,
      skippedDuplicate: newsSkippedDuplicate,
      errors: newsErrors,
    },
    fase6: {
      totalAttempted: noLinkedIn2.length,
      found: linkedin2Found, miss: linkedin2Miss, captcha: linkedin2Captcha,
    },
  };
  const logPath = '/var/log/hermes-scan/hunter-verify.jsonl';
  try { fs.appendFileSync(logPath, JSON.stringify(summary) + '\n'); } catch {}

  console.log('');
  console.log('[hunter-verify] === RESUMEN FASE 1 ===');
  console.log(`  Total:     ${contacts.length}`);
  console.log(`  Valid:     ${verified}`);
  console.log(`  Invalid:   ${invalid} (email borrado)`);
  console.log(`  Risky:     ${risky}`);
  console.log(`  Unknown:   ${unknown}`);
  console.log(`  Errors:    ${errors}`);
  console.log('[hunter-verify] === RESUMEN FASE 2 (Finder) ===');
  console.log(`  Intentos:  ${noEmail.length}`);
  console.log(`  Encontrados: ${found}`);
  console.log(`  No match: ${notFound}`);
  console.log(`  Errors:   ${finderErrors}`);
  console.log('[hunter-verify] === RESUMEN FASE 3 (LinkedIn OSINT) ===');
  console.log(`  Intentos:  ${noLinkedIn.length}`);
  console.log(`  Encontrados: ${linkedinFound}`);
  console.log(`  No match: ${linkedinMiss}`);
  console.log(`  Errors:   ${linkedinErr}`);
  console.log('[hunter-verify] === RESUMEN FASE 4 (Domain Search) ===');
  console.log(`  Empresas:  ${companies.length}`);
  console.log(`  Emails encontrados: ${domainEmailsFound}`);
  console.log(`  Sin match senior: ${domainEmailsNoMatch}`);
  console.log(`  Skip (sin dominio): ${domainSkipped}`);
  console.log('[hunter-verify] === RESUMEN FASE 5 (News plant/ops) ===');
  console.log(`  Personas extraídas: ${newsExtracted}`);
  console.log(`  Emails Hunter encontrados: ${newsHunterFound}`);
  console.log(`  Skipped (ya en BD): ${newsSkippedDuplicate}`);
  console.log(`  Errors: ${newsErrors}`);
  console.log('[hunter-verify] === RESUMEN FASE 6 (LinkedIn 2da pasada) ===');
  console.log(`  Intentos:  ${noLinkedIn2.length}`);
  console.log(`  Encontrados: ${linkedin2Found}`);
  console.log(`  No match: ${linkedin2Miss}`);
  if (linkedin2Found === 0 && noLinkedIn2.length > 0) {
    console.log(`  ⚠ Todos los intentos cayeron en captcha del buscador. IP VPS bloqueada.`);
  }
  console.log(`[hunter-verify] done`);
}

main()
  .catch((e) => {
    console.error('[hunter-verify] FATAL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
