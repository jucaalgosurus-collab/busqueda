// app/api/auth/change-password/route.ts — E.10: cambio de contraseña.
//
// POST { currentPassword, newPassword }
// - Usuario normal: solo puede cambiar la SUYA; debe pasar currentPassword.
// - Admin: puede cambiar la de OTRO usuario pasando { targetUserId } sin currentPassword.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { getCurrentUser } from '@/lib/auth/session';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string; targetUserId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const newPassword = String(body.newPassword ?? '');
  if (newPassword.length < 8) {
    return NextResponse.json({ success: false, error: 'La nueva contraseña debe tener ≥8 caracteres' }, { status: 400 });
  }

  let targetId = me.id;
  if (body.targetUserId && body.targetUserId !== me.id) {
    if (me.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo admin puede cambiar la contraseña de otros' }, { status: 403 });
    }
    targetId = body.targetUserId;
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return NextResponse.json({ success: false, error: 'Usuario destino no existe' }, { status: 404 });
  } else {
    // Cambia la suya: exigir currentPassword salvo que sea admin forzando reset
    if (!body.currentPassword) {
      return NextResponse.json({ success: false, error: 'Contraseña actual requerida' }, { status: 400 });
    }
    const me2 = await prisma.user.findUnique({ where: { id: me.id } });
    if (!me2) return NextResponse.json({ success: false, error: 'Usuario no existe' }, { status: 404 });
    const ok = await verifyPassword(body.currentPassword, me2.passwordHash);
    if (!ok) return NextResponse.json({ success: false, error: 'Contraseña actual incorrecta' }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: targetId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  await logAdminAction({
    action: 'company.update',
    companyId: '00000000-0000-0000-0000-000000000000',
    actor: me.username,
    meta: { event: 'password.change', targetUserId: targetId, byAdmin: me.id !== targetId },
  }).catch(() => {/* non-blocking */});

  return NextResponse.json({ success: true });
}
