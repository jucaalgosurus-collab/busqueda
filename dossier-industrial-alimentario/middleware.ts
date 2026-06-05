// middleware.ts — A.11 Gate global de /api/* con sesión cookie-based.
//
// Bloquea TODAS las rutas /api/* salvo:
//   - /api/auth/*    (login, logout, me, change-password)
//   - /api/health    (healthcheck para nginx/uptime monitors)
//
// Si no hay cookies auth_uid + auth_sid válidas → 401.
//
// LIMITACIÓN: el middleware corre en Edge runtime (no Prisma). Aquí validamos
// solo PRESENCIA + FORMATO de las cookies. La verificación real (sesión activa
// en DB) la hace cada route.ts con requireUser() — defensa en profundidad.
//
// Si necesitas kill-switch global, rota NODE_MIDDLEWARE_BYPASS en .env.
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_UID = 'auth_uid';
const COOKIE_SID = 'auth_sid';

// Rutas exentas del gate (no requieren sesión)
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/change-password',
  '/api/health',
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isValidUuid(v: string | undefined): boolean {
  if (!v) return false;
  // UUID v4 format (Prisma usa cuids también; dejamos pasar cualquier string de 16+ chars)
  if (v.length < 16 || v.length > 64) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(v);
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Solo gateamos /api/*; las páginas /empresas, /hallazgos etc. las gatea
  // cada layout con su propio redirect.
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Rutas públicas pasan
  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const uid = req.cookies.get(COOKIE_UID)?.value;
  const sid = req.cookies.get(COOKIE_SID)?.value;

  // Sin cookies o con formato inválido → 401
  if (!isValidUuid(uid) || !isValidUuid(sid)) {
    return NextResponse.json(
      { success: false, error: 'unauthorized', code: 'no_session' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Headers para que las routes downstream no re-lean cookies si ya pasaron
  const res = NextResponse.next();
  res.headers.set('x-auth-uid', uid);
  res.headers.set('x-auth-sid', sid);
  return res;
}

export const config = {
  // Aplica a todas las rutas excepto _next/static, _next/image, favicon
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
};
