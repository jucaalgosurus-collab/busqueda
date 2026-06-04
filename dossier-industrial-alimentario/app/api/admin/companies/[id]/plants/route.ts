// app/api/admin/companies/[id]/plants/route.ts — E.10: GET listar + POST crear plantas
//
// GET  /api/admin/companies/:id/plants        lista plantas de la empresa
// POST /api/admin/companies/:id/plants        crea una sede manualmente
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { assertAdmin } from '@/lib/auth/admin';
import { validatePlantCreate } from '@/lib/validators/admin';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const plants = await prisma.plant.findMany({
    where: { companyId: id },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, ccaa: true, province: true, city: true, address: true,
      lat: true, lng: true, status: true, specialty: true, employees: true,
      parcelaM2: true, naveM2: true, openedAt: true, closedAt: true,
      closureYear: true, investmentMEur: true, notes: true,
      isStale: true, staleReason: true,
    },
  });
  return NextResponse.json({ success: true, data: plants, meta: { total: plants.length } });
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const v = validatePlantCreate(raw);
  if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });

  // companyId de la URL manda sobre el del body (defense in depth)
  const company = await prisma.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) return NextResponse.json({ success: false, error: 'Empresa no existe' }, { status: 404 });

  // Idempotencia por (companyId, name) — @unique en schema
  const existing = await prisma.plant.findUnique({
    where: { companyId_name: { companyId: id, name: v.value.name } },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        success: false,
        error: `Ya existe la sede '${v.value.name}' en esta empresa`,
        code: 'duplicate_plant',
        data: existing,
      },
      { status: 409 },
    );
  }

  // Si openedAt vacío, usar hoy por defecto (asumimos sede recién creada)
  const openedAt = v.value.openedAt ?? new Date();
  // Nota: la regla "status cerrada/vendida exige closedAt" se valida en
  // lib/validators/admin.ts. No la duplicamos aquí.

  const created = await prisma.plant.create({
    data: {
      companyId: id,
      name: v.value.name,
      ccaa: v.value.ccaa,
      province: v.value.province,
      city: v.value.city,
      address: v.value.address,
      lat: v.value.lat,
      lng: v.value.lng,
      status: v.value.status,
      specialty: v.value.specialty,
      employees: v.value.employees,
      parcelaM2: v.value.parcelaM2,
      naveM2: v.value.naveM2,
      openedAt,
      closedAt: v.value.closedAt,
      closureYear: v.value.closureYear,
      investmentMEur: v.value.investmentMEur,
      notes: v.value.notes,
    },
    select: { id: true, name: true, ccaa: true, status: true, openedAt: true, closedAt: true },
  });

  await logAdminAction({
    action: 'plant.create',
    companyId: id,
    plantId: created.id,
    meta: { name: created.name, ccaa: created.ccaa, status: created.status },
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
