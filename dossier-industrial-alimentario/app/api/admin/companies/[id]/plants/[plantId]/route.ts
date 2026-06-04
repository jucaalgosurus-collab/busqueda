// app/api/admin/companies/[id]/plants/[plantId]/route.ts — E.10: PATCH/DELETE una planta
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { assertAdmin } from '@/lib/auth/admin';
import { validatePlantPatch, diffPatch } from '@/lib/validators/admin';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; plantId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const { id, plantId } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const v = validatePlantPatch(raw);
  if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });

  const before = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!before || before.companyId !== id) {
    return NextResponse.json({ success: false, error: 'Sede no existe o no pertenece a la empresa' }, { status: 404 });
  }

  // Si la nueva status es terminal, exigir closedAt (a menos que ya esté)
  const willBeClosed = v.value.status === 'cerrada' || v.value.status === 'vendida';
  if (willBeClosed && !v.value.closedAt && !before.closedAt) {
    return NextResponse.json(
      { success: false, error: `Status '${v.value.status}' requiere closedAt` },
      { status: 400 },
    );
  }
  // Si reabrió (de terminal a operativa), limpiar closedAt salvo que lo setee explícito
  if (before.status === 'cerrada' || before.status === 'vendida') {
    const wasReopening = v.value.status && !willBeClosed;
    if (wasReopening && !('closedAt' in v.value)) {
      (v.value as PlantPatchWorkaround).closedAt = null;
    }
  }

  const updated = await prisma.plant.update({
    where: { id: plantId },
    data: v.value,
    select: { id: true, name: true, status: true, closedAt: true, openedAt: true, updatedAt: true },
  });

  const changes = diffPatch(before as unknown as Record<string, unknown>, v.value as unknown as Record<string, unknown>);
  await logAdminAction({
    action: 'plant.update',
    companyId: id,
    plantId,
    changes,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if (guard) return guard;
  const { id, plantId } = await ctx.params;

  const before = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!before || before.companyId !== id) {
    return NextResponse.json({ success: false, error: 'Sede no existe o no pertenece a la empresa' }, { status: 404 });
  }

  // Soft-delete: NO borramos la planta (rompería sources/operations huérfanas).
  // Marcamos status='cerrada' y closedAt=ahora si no lo tiene.
  if (before.status === 'cerrada') {
    return NextResponse.json({ success: false, error: 'La sede ya estaba cerrada' }, { status: 409 });
  }
  const closedAt = before.closedAt ?? new Date();
  const updated = await prisma.plant.update({
    where: { id: plantId },
    data: { status: 'cerrada', closedAt, isStale: true, staleReason: 'cerrada_registrada', staleAt: new Date() },
    select: { id: true, name: true, status: true, closedAt: true },
  });

  await logAdminAction({
    action: 'plant.soft_delete',
    companyId: id,
    plantId,
    meta: { from: before.status, to: 'cerrada', closedAt: closedAt.toISOString() },
  });

  return NextResponse.json({ success: true, data: updated });
}

// Helper: el validator devuelve PlantPatch (sin readonly), podemos mutar
// closedAt a null para reapertura sin que TS proteste.
type PlantPatchWorkaround = import('@/lib/validators/admin').PlantPatch;
