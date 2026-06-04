// lib/audit/sessions.ts — E.10: gestión de SessionLog (login/logout/duración).
//
// Crea un SessionLog en cada login con IP+UA, y lo cierra en logout con
// durationSec. Usado por /api/auth/login, /api/auth/logout y por el dashboard
// de sesiones del admin.
import { prisma } from '@/lib/db/prisma';

export interface CreateSessionInput {
  userId: string;
  username: string;
  ip?: string | null;
  userAgent?: string | null;
  country?: string | null;
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const session = await prisma.sessionLog.create({
    data: {
      userId: input.userId,
      username: input.username,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      country: input.country ?? null,
    },
  });
  await prisma.user.update({
    where: { id: input.userId },
    data: { lastLoginAt: new Date(), lastLoginIp: input.ip ?? null },
  });
  return session.id;
}

export async function closeSession(sessionId: string): Promise<void> {
  if (sessionId === 'legacy') return; // sesiones sintéticas dev mode
  const session = await prisma.sessionLog.findUnique({ where: { id: sessionId } });
  if (!session || session.logoutAt) return;
  const logoutAt = new Date();
  const durationSec = Math.max(
    0,
    Math.round((logoutAt.getTime() - session.loginAt.getTime()) / 1000),
  );
  await prisma.sessionLog.update({
    where: { id: sessionId },
    data: { logoutAt, durationSec },
  });
}

export interface SessionWithUser {
  id: string;
  userId: string;
  username: string;
  loginAt: Date;
  logoutAt: Date | null;
  durationSec: number | null;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  user: { id: string; username: string; displayName: string | null; role: string };
}

export async function listSessions(opts: { limit?: number; activeOnly?: boolean } = {}): Promise<SessionWithUser[]> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  return prisma.sessionLog.findMany({
    where: opts.activeOnly ? { logoutAt: null } : {},
    orderBy: { loginAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, username: true, displayName: true, role: true } },
    },
  });
}
