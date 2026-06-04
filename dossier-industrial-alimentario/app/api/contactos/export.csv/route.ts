// app/api/contactos/export.csv/route.ts — Exporta contactos a CSV
// v6 schema — usa PlantContact (persona + planta + empresa) para precisión total
import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where: Record<string, unknown> = {};
  const q = sp.get('q');
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { role: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  const role = sp.get('role');
  if (role) where.roleCategory = role;
  const company = sp.get('company');
  if (company) where.company = { slug: company };
  const verified = sp.get('verified');
  if (verified === '1') where.emailVerified = true;
  const plant = sp.get('plant');
  if (plant) where.plant = { name: { contains: plant, mode: 'insensitive' } };

  const contacts = await prisma.plantContact.findMany({
    where,
    include: {
      company: { select: { name: true, sector: true, subsector: true } },
      plant: { select: { name: true, ccaa: true, city: true, status: true } },
    },
    orderBy: [{ fullName: 'asc' }, { roleCategory: 'asc' }],
    take: 5_000,
  });

  const rows = [
    [
      'full_name', 'role', 'role_category', 'company', 'subsector', 'plant',
      'plant_ccaa', 'plant_city', 'plant_status',
      'email', 'email_verified', 'phone', 'linkedin_url',
      'source_outlet', 'confidence', 'last_enriched_at',
    ],
    ...contacts.map((c) => [
      c.fullName, c.role, c.roleCategory || '',
      c.company.name, c.company.subsector,
      c.plant.name, c.plant.ccaa, c.plant.city || '', c.plant.status,
      c.email || '', c.emailVerified ? 'true' : 'false', c.phone || '',
      c.linkedinUrl || '', c.sourceOutlet || '',
      c.confidence,
      c.lastEnrichedAt ? new Date(c.lastEnrichedAt).toISOString() : '',
    ]),
  ];

  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contactos-hermes-dossier-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
