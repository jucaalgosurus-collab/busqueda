// app/api/admin/users/[id]/route.ts — E.10: edición/borrado lógico de usuarios.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  let me;
  try {
    me = await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: { displayName?: string | null; role?: string; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ success: false, error: 'Usuario no existe' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if ('displayName' in body) data.displayName = body.displayName ?? null;
  if ('role' in body) {
    if (body.role !== 'admin' && body.role !== 'user') {
      return NextResponse.json({ success: false, error: 'Role inválido (admin|user)' }, { status: 400 });
    }
    data.role = body.role;
  }
  if ('isActive' in body) {
    if (target.id === me.id && body.isActive === false) {
      return NextResponse.json({ success: false, error: 'No puedes desactivarte a ti mismo' }, { status: 400 });
    }
    data.isActive = Boolean(body.isActive);
  }
  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, displayName: true, role: true, isActive: true, mustChangePassword: true },
  });
  await logAdminAction({
    action: 'company.update',
    companyId: '00000000-0000-0000-0000-000000000000',
    actor: me.username,
    meta: { event: 'user.update', targetUserId: id, changes: data },
  }).catch(() => {/* non-blocking */});
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  let me;
  try {
    me = await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ success: false, error: 'Usuario no existe' }, { status: 404 });
  if (target.id === me.id) {
    return NextResponse.json({ success: false, error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
  }
  // Soft delete = desactivar + cerrar todas las sesiones activas
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  await prisma.sessionLog.updateMany({
    where: { userId: id, logoutAt: null },
    data: { logoutAt: new Date() },
  });
  await logAdminAction({
    action: 'company.update',
    companyId: '00000000-0000-0000-0000-000000000000',
    actor: me.username,
    meta: { event: 'user.deactivate', targetUserId: id },
  }).catch(() => {/* non-blocking */});
  return NextResponse.json({ success: true });
}
