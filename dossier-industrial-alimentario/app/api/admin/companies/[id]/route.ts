// app/api/admin/companies/[id]/route.ts — E.10: GET/PATCH/DELETE una company
//
// GET    /api/admin/companies/:id    ficha completa para el panel
// PATCH  /api/admin/companies/:id    editar cualquier campo editable
// DELETE /api/admin/companies/:id    soft-delete (status='inactive')
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { assertAdmin } from '@/lib/auth/admin';
import { validateCompanyPatch, diffPatch } from '@/lib/validators/admin';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      plants: {
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, ccaa: true, province: true, city: true, address: true,
          lat: true, lng: true, status: true, specialty: true, employees: true,
          parcelaM2: true, naveM2: true, openedAt: true, closedAt: true,
          closureYear: true, investmentMEur: true, notes: true,
          isStale: true, staleReason: true, staleAt: true,
        },
      },
      _count: { select: { plants: true, sources: true, operations: true, plantContacts: true, financials: true, notes: true, patents: true } },
    },
  });
  if (!company) return NextResponse.json({ success: false, error: 'No existe' }, { status: 404 });
  return NextResponse.json({ success: true, data: company });
}

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const v = validateCompanyPatch(raw);
  if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });

  const before = await prisma.company.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ success: false, error: 'No existe' }, { status: 404 });

  // Si reactivamos, restaurar prioridad si era 0
  const patch: Record<string, unknown> = { ...v.value };
  if (v.value.status === 'active' && before.status === 'inactive' && !('priority' in v.value)) {
    patch.priority = Math.max(before.priority, 1);
  }

  const updated = await prisma.company.update({
    where: { id },
    data: patch,
    select: { id: true, slug: true, name: true, status: true, tier: true, updatedAt: true },
  });

  const changes = diffPatch(before as unknown as Record<string, unknown>, v.value as unknown as Record<string, unknown>);
  await logAdminAction({
    action: v.value.status === 'active' && before.status === 'inactive' ? 'company.reactivate' : 'company.update',
    companyId: id,
    changes,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const before = await prisma.company.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ success: false, error: 'No existe' }, { status: 404 });
  if (before.status === 'inactive') {
    return NextResponse.json({ success: false, error: 'La empresa ya está inactiva' }, { status: 409 });
  }
  const updated = await prisma.company.update({
    where: { id },
    data: { status: 'inactive', priority: 0 },
    select: { id: true, slug: true, name: true, status: true },
  });
  await logAdminAction({
    action: 'company.soft_delete',
    companyId: id,
    meta: { from: 'active', to: 'inactive' },
  });
  return NextResponse.json({ success: true, data: updated });
}
