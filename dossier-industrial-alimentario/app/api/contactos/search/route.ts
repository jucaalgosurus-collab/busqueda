// app/api/contactos/search/route.ts
// Búsqueda precisa de contactos A&B por persona + planta + empresa + rol + CCAA.
// Estrategia: AND escalonado (q libre) con ranking de calidad (emailVerified > linkedin > phone).
// Devuelve JSON con envelope {success, data, meta}.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set([
  'plant_manager', 'coo', 'cfo', 'ceo',
  'procurement', 'sustainability', 'maintenance', 'ere_responsible', 'other',
]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const q = (sp.get('q') ?? '').trim();
  const plantName = (sp.get('plant') ?? '').trim();
  const companySlug = (sp.get('company') ?? '').trim();
  const companyName = (sp.get('companyName') ?? '').trim();
  const ccaa = (sp.get('ccaa') ?? '').trim();
  const role = (sp.get('role') ?? '').trim();
  const verifiedOnly = sp.get('verified') === '1';
  const minConfidence = Number(sp.get('minConfidence') ?? '0');
  const limit = Math.min(Math.max(Number(sp.get('limit') ?? '50'), 1), 200);

  if (role && !ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { success: false, error: `Invalid role. Allowed: ${[...ALLOWED_ROLES].join(', ')}` },
      { status: 400 }
    );
  }
  if (Number.isNaN(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    return NextResponse.json(
      { success: false, error: 'minConfidence must be 0..1' },
      { status: 400 }
    );
  }

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { role: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role) where.roleCategory = role;
  if (verifiedOnly) where.emailVerified = true;
  if (minConfidence > 0) where.confidence = { gte: minConfidence };

  if (plantName) {
    where.plant = { name: { contains: plantName, mode: 'insensitive' } };
  }
  if (ccaa) {
    where.plant = { ...(where.plant as object | undefined), ccaa: { equals: ccaa, mode: 'insensitive' } };
  }

  if (companySlug) {
    where.company = { slug: companySlug };
  } else if (companyName) {
    where.company = { name: { contains: companyName, mode: 'insensitive' } };
  }

  const [total, contacts] = await Promise.all([
    prisma.plantContact.count({ where }),
    prisma.plantContact.findMany({
      where,
      include: {
        company: { select: { slug: true, name: true, subsector: true, sector: true } },
        plant: { select: { id: true, name: true, ccaa: true, province: true, city: true, status: true, specialty: true } },
      },
      orderBy: [
        { emailVerified: 'desc' },
        { confidence: 'desc' },
        { fullName: 'asc' },
      ],
      take: limit,
    }),
  ]);

  // Ranking: bonus por tener email verificado + linkedin + phone + tier
  const data = contacts.map((c) => {
    let score = c.confidence;
    if (c.emailVerified) score += 0.15;
    if (c.email) score += 0.05;
    if (c.linkedinUrl) score += 0.05;
    if (c.phone) score += 0.05;
    return {
      id: c.id,
      fullName: c.fullName,
      role: c.role,
      roleCategory: c.roleCategory,
      email: c.email ?? null,
      emailVerified: c.emailVerified,
      linkedinUrl: c.linkedinUrl ?? null,
      phone: c.phone ?? null,
      sourceOutlet: c.sourceOutlet ?? null,
      lastEnrichedAt: c.lastEnrichedAt,
      company: c.company,
      plant: c.plant,
      rankScore: Math.min(1, Math.round(score * 100) / 100),
    };
  });

  return NextResponse.json({
    success: true,
    data,
    meta: {
      total,
      limit,
      returned: data.length,
      filters: { q, plant: plantName, company: companySlug, companyName, ccaa, role, verifiedOnly, minConfidence },
    },
  });
}
