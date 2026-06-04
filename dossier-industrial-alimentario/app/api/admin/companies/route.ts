// app/api/admin/companies/route.ts — E.10: POST crear company + GET listar (panel admin)
//
// GET  /api/admin/companies?q=&limit=         búsqueda con paginación
// POST /api/admin/companies                   crear company manualmente
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { assertAdmin } from '@/lib/auth/admin';
import { validateCompanyCreate } from '@/lib/validators/admin';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 100)));

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q.toLowerCase(), mode: 'insensitive' as const } },
          { cif: { contains: q.toUpperCase(), mode: 'insensitive' as const } },
        ],
      }
    : {};

  const items = await prisma.company.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      cif: true,
      sector: true,
      subsector: true,
      tier: true,
      status: true,
      hqRegion: true,
      facturacionM: true,
      empleadosTotal: true,
      priority: true,
      _count: { select: { plants: true, sources: true, operations: true, plantContacts: true } },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: limit,
  });

  return NextResponse.json({ success: true, data: items, meta: { total: items.length, query: q } });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const v = validateCompanyCreate(raw);
  if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });

  // Idempotencia por slug + cif
  const existingSlug = await prisma.company.findUnique({ where: { slug: v.value.slug } });
  if (existingSlug) {
    return NextResponse.json(
      { success: false, error: `Ya existe una empresa con slug '${v.value.slug}'`, code: 'duplicate_slug' },
      { status: 409 },
    );
  }
  if (v.value.cif) {
    const existingCif = await prisma.company.findUnique({ where: { cif: v.value.cif } });
    if (existingCif) {
      return NextResponse.json(
        { success: false, error: `Ya existe una empresa con CIF '${v.value.cif}'`, code: 'duplicate_cif' },
        { status: 409 },
      );
    }
  }

  const created = await prisma.company.create({
    data: {
      name: v.value.name ?? '',
      slug: v.value.slug ?? '',
      sector: v.value.sector ?? '',
      subsector: v.value.subsector ?? '',
      cif: v.value.cif,
      cnae: v.value.cnae,
      parentGroup: v.value.parentGroup,
      hqCity: v.value.hqCity,
      hqRegion: v.value.hqRegion,
      website: v.value.website,
      logoUrl: v.value.logoUrl,
      heroImageUrl: v.value.heroImageUrl,
      facturacionM: v.value.facturacionM,
      facturacionYear: v.value.facturacionYear,
      ebitdaM: v.value.ebitdaM,
      beneficioNetoM: v.value.beneficioNetoM,
      deudaNetaM: v.value.deudaNetaM,
      empleadosTotal: v.value.empleadosTotal,
      tier: v.value.tier,
      status: v.value.status,
      priority: v.value.priority,
    },
    select: { id: true, slug: true, name: true, sector: true, tier: true, status: true },
  });

  await logAdminAction({
    action: 'company.create',
    companyId: created.id,
    meta: { slug: created.slug, sector: created.sector, tier: created.tier },
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
