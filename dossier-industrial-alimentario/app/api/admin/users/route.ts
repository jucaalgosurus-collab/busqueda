// app/api/admin/users/route.ts — E.10: gestión de usuarios del panel admin.
//
// GET  /api/admin/users?q=&role=&isActive=  lista usuarios
// POST /api/admin/users                    crea usuario (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const role = req.nextUrl.searchParams.get('role');
  const isActiveParam = req.nextUrl.searchParams.get('isActive');

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { username: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role === 'admin' || role === 'user') where.role = role;
  if (isActiveParam === 'true') where.isActive = true;
  if (isActiveParam === 'false') where.isActive = false;

  const items = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
    orderBy: [{ isActive: 'desc' }, { username: 'asc' }],
  });
  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let me;
  try {
    me = await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  let body: { username?: string; password?: string; displayName?: string; role?: string; mustChangePassword?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const username = String(body.username ?? '').trim().toLowerCase();
  if (!username || username.length < 3) {
    return NextResponse.json({ success: false, error: 'Username debe tener ≥3 caracteres' }, { status: 400 });
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return NextResponse.json({ success: false, error: 'Username solo puede tener a-z, 0-9, . _ -' }, { status: 400 });
  }
  const role = body.role === 'admin' ? 'admin' : 'user';
  const password = body.password ?? '';
  if (password.length < 8) {
    return NextResponse.json({ success: false, error: 'Contraseña debe tener ≥8 caracteres' }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ success: false, error: `Ya existe el usuario '${username}'`, code: 'duplicate_username' }, { status: 409 });
  }
  const hash = await hashPassword(password);
  const created = await prisma.user.create({
    data: {
      username,
      displayName: body.displayName ?? null,
      role,
      passwordHash: hash,
      mustChangePassword: body.mustChangePassword ?? true,
      createdBy: me.username,
    },
    select: { id: true, username: true, displayName: true, role: true, isActive: true, mustChangePassword: true, createdAt: true },
  });
  await logAdminAction({
    action: 'company.update',
    companyId: '00000000-0000-0000-0000-000000000000',
    actor: me.username,
    meta: { event: 'user.create', targetUserId: created.id, role: created.role },
  }).catch(() => {/* non-blocking */});
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
