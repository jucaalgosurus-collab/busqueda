// app/api/buscar-responsables/route.ts
//
// Búsqueda de responsables A&B cruzando LinkedIn + Hunter.io.
//
// Inputs: company + sede (plant name) + lista de roles a buscar.
// 1. Resuelve companyId y plantId en DB.
// 2. Query PlantContact con WHERE companyId AND plantId AND roleCategory IN (...).
// 3. Para cada contacto con linkedinUrl y emailVerified=false, llama a Hunter
//    /email-finder con full_name + domain extraído de Company.website.
// 4. Persiste el email si Hunter devuelve score >= 70.
// 5. Devuelve la lista con score de calidad y flag de enriquecido.

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/lib/db/prisma';
import { isGrande, REJECT_PYME_MESSAGE } from '@/lib/filters/grande';
import { requireUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const HUNTER_API = 'https://api.hunter.io/v2';
const HUNTER_KEY = process.env.HUNTER_API_KEY ?? '';

const ALLOWED_ROLES = new Set([
  'plant_manager', 'coo', 'cfo', 'ceo',
  'procurement', 'sustainability', 'maintenance', 'ere_responsible', 'other',
]);

interface HunterEmailResponse {
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
    const r = await axios.get<HunterEmailResponse>(`${HUNTER_API}/email-finder`, {
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

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  try { return new URL(website).hostname.replace(/^www\./, ''); }
  catch { return null; }
}

export async function POST(req: NextRequest) {
  // A.11: defensa en profundidad — Hunter cuesta $, gate redundante.
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  let body: { company?: string; sede?: string; roles?: string[] } = {};
  try { body = await req.json(); } catch { /* empty body is OK, default below */ }

  const companyQ = (body.company ?? '').trim();
  const sedeQ = (body.sede ?? '').trim();
  const roles = (body.roles ?? []).filter((r) => ALLOWED_ROLES.has(r));

  if (!companyQ) {
    return NextResponse.json({ success: false, error: 'company is required' }, { status: 400 });
  }
  if (roles.length === 0) {
    return NextResponse.json({ success: false, error: 'roles must be a non-empty subset of the allowed set' }, { status: 400 });
  }

  // 1. Resolver company
  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { slug: companyQ.toLowerCase() },
        { name: { contains: companyQ, mode: 'insensitive' } },
        { cif: companyQ },
      ],
    },
    select: { id: true, slug: true, name: true, website: true, subsector: true, facturacionM: true, empleadosTotal: true, tier: true },
  });
  if (!company) {
    return NextResponse.json({ success: false, error: `company not found: ${companyQ}` }, { status: 404 });
  }

  // E.15 — gate "Solo grandes" (Regla 3, 2026-06-04). PYMES fuera de cobertura.
  if (!isGrande(company)) {
    return NextResponse.json(
      { success: false, error: REJECT_PYME_MESSAGE, code: 'pyme_not_in_scope' },
      { status: 403 },
    );
  }

  // 2. Resolver plant (sede)
  const plant = sedeQ
    ? await prisma.plant.findFirst({
        where: {
          companyId: company.id,
          OR: [
            { name: { contains: sedeQ, mode: 'insensitive' } },
            { city: { contains: sedeQ, mode: 'insensitive' } },
            { province: { contains: sedeQ, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, ccaa: true, city: true, province: true },
      })
    : await prisma.plant.findFirst({
        where: { companyId: company.id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, ccaa: true, city: true, province: true },
      });

  // 3. Buscar contactos existentes
  const where: Record<string, unknown> = {
    companyId: company.id,
    roleCategory: { in: roles },
  };
  if (plant) where.plantId = plant.id;

  const contacts = await prisma.plantContact.findMany({
    where,
    include: {
      plant: { select: { id: true, name: true, ccaa: true, city: true, province: true } },
    },
    orderBy: [{ fullName: 'asc' }, { roleCategory: 'asc' }],
    take: 200,
  });

  const domain = domainFromWebsite(company.website);
  const hunterAvailable = !!HUNTER_KEY && !!domain;

  // 4. Cruzar con Hunter.io para los que tienen linkedinUrl pero no email verificado
  let hunterAttempts = 0, hunterEnriched = 0, hunterNotFound = 0;
  const enrichedContacts = await Promise.all(contacts.map(async (c) => {
    const base = {
      id: c.id,
      fullName: c.fullName,
      role: c.role,
      roleCategory: c.roleCategory,
      linkedinUrl: c.linkedinUrl,
      email: c.email,
      emailVerified: c.emailVerified,
      phone: c.phone,
      via: c.via,
      sourceOutlet: c.sourceOutlet,
      lastEnrichedAt: c.lastEnrichedAt,
      plant: c.plant,
      hunterChecked: false as boolean,
      hunterScore: null as number | null,
    };
    if (c.emailVerified) return { ...base, rankScore: c.confidence + 0.2 };
    if (!c.linkedinUrl || !hunterAvailable) return { ...base, rankScore: c.confidence };

    hunterAttempts++;
    const res = await findEmailByNameAndDomain({ fullName: c.fullName, domain: domain! });
    if (res) {
      hunterEnriched++;
      await prisma.plantContact.update({
        where: { id: c.id },
        data: { email: res.email, emailVerified: true, lastEnrichedAt: new Date() },
      });
      return { ...base, email: res.email, emailVerified: true, hunterChecked: true, hunterScore: res.score, rankScore: c.confidence + 0.15 + (res.score / 100) * 0.1 };
    }
    hunterNotFound++;
    return { ...base, hunterChecked: true, rankScore: c.confidence };
  }));

  // 5. Ordenar por calidad
  enrichedContacts.sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0));

  return NextResponse.json({
    success: true,
    data: {
      company: { id: company.id, name: company.name, slug: company.slug, website: company.website, subsector: company.subsector },
      plant: plant ?? null,
      rolesSearched: roles,
      domain,
      hunterAvailable,
      contacts: enrichedContacts,
      summary: {
        total: enrichedContacts.length,
        alreadyVerified: enrichedContacts.filter((c) => c.emailVerified && !c.hunterChecked).length,
        hunterEnriched,
        hunterNotFound,
        hunterAttempts,
      },
    },
  });
}

// GET: previsualizar (sin enrichment activo) para cargar la tabla rápido
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const companyQ = (sp.get('company') ?? '').trim();
  const sedeQ = (sp.get('sede') ?? '').trim();
  const roles = (sp.get('roles') ?? '').split(',').filter((r) => ALLOWED_ROLES.has(r));
  if (!companyQ || roles.length === 0) {
    return NextResponse.json({ success: false, error: 'company and roles are required' }, { status: 400 });
  }
  return POST(new NextRequest(req.nextUrl, { method: 'POST', body: JSON.stringify({ company: companyQ, sede: sedeQ, roles }) }));
}
