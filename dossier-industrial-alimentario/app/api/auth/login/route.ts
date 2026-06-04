// app/api/auth/login/route.ts — E.10: login con username/password.
//
// POST { username, password } → setea cookies auth_uid+auth_sid, crea SessionLog
// con IP y User-Agent. Si mustChangePassword=true devuelve flag en respuesta.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/audit/sessions';
import { SESSION_COOKIES } from '@/lib/auth/session';
import { logAdminAction } from '@/lib/audit/admin-log';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const username = String(body.username ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!username || !password) {
    return NextResponse.json({ success: false, error: 'Usuario y contraseña requeridos' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return NextResponse.json({ success: false, error: 'Credenciales inválidas' }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Credenciales inválidas' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null;
  const ua = req.headers.get('user-agent') ?? null;
  const sessionId = await createSession({ userId: user.id, username: user.username, ip, userAgent: ua });

  const res = NextResponse.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
  res.cookies.set(SESSION_COOKIES.COOKIE_UID, user.id, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_COOKIES.COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  res.cookies.set(SESSION_COOKIES.COOKIE_SID, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_COOKIES.COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });

  // Audit del login
  await logAdminAction({
    action: 'company.update', // usamos action genérica para login; meta lleva el evento
    companyId: '00000000-0000-0000-0000-000000000000',
    actor: user.username,
    meta: { event: 'login', ip, ua, mustChangePassword: user.mustChangePassword },
  }).catch(() => {/* non-blocking */});

  return res;
}
