// lib/auth/session.ts — E.10: sesiones cookie-based con User de Prisma.
//
// Flujo:
//   1. POST /api/auth/login valida con scrypt, crea SessionLog, setea cookie.
//   2. Cookie = `auth_uid` (userId) + `auth_sid` (sessionId), ambas httpOnly.
//   3. Cada request: getCurrentUser(req) lee cookies y consulta User+SessionLog.
//   4. Logout: cierra SessionLog con logoutAt + durationSec, limpia cookies.
//
// Por qué dos cookies y no una firmada con JWT: para no depender de jose/jsonwebtoken
// y poder revocar sesiones (logout invalida el sessionId en DB, no solo en cliente).
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { isAdminAuthorized } from './admin';

const COOKIE_UID = 'auth_uid';
const COOKIE_SID = 'auth_sid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string | null;
  role: 'admin' | 'user';
  mustChangePassword: boolean;
  sessionId: string;
}

export interface CurrentUserSafe extends CurrentUser {
  isAdmin: boolean;
  isLegacyAdmin: boolean; // true si entró por x-admin-secret (dev mode)
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const uid = jar.get(COOKIE_UID)?.value;
  const sid = jar.get(COOKIE_SID)?.value;
  if (!uid || !sid) return null;
  const session = await prisma.sessionLog.findFirst({
    where: { id: sid, userId: uid, logoutAt: null },
    include: { user: true },
  });
  if (!session || !session.user.isActive) return null;
  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role === 'admin' ? 'admin' : 'user',
    mustChangePassword: session.user.mustChangePassword,
    sessionId: session.id,
  };
}

export async function getCurrentUserSafe(): Promise<CurrentUserSafe | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return { ...u, isAdmin: u.role === 'admin', isLegacyAdmin: false };
}

/**
 * Para Server Components que aún no migran a cookies: acepta también
 * el header `x-admin-secret` como fallback de "dev mode" mientras conviven
 * ambos sistemas. Devuelve un usuario "admin sintético" sin persistencia.
 */
export function getLegacyAdminFromRequest(req: Request): CurrentUserSafe | null {
  // NextRequest no está tipado por header; usamos Request genérico.
  // isAdminAuthorized acepta NextRequest, así que adaptamos.
  if (!isAdminAuthorized(req as unknown as import('next/server').NextRequest)) return null;
  return {
    id: 'legacy-admin',
    username: 'legacy-secret',
    displayName: 'Admin (dev mode)',
    role: 'admin',
    mustChangePassword: false,
    sessionId: 'legacy',
    isAdmin: true,
    isLegacyAdmin: true,
  };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u || u.role !== 'admin') {
    throw new AuthError('unauthorized', 401);
  }
  return u;
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError('unauthorized', 401);
  return u;
}

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
  }
}

export const SESSION_COOKIES = { COOKIE_UID, COOKIE_SID, COOKIE_MAX_AGE };
