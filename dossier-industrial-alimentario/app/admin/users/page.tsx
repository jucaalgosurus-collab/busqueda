// app/admin/users/page.tsx — E.10: lista + creación de usuarios (admin only).
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { UsersClient } from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (me === null || me === undefined) {
    redirect('/admin-public/login?next=/admin/users');
  }
  if (me && me.role !== 'admin') {
    redirect('/admin');
  }
  const safeMe = me as NonNullable<typeof me>;

  const usersRaw = await prisma.user.findMany({
    select: {
      id: true, username: true, displayName: true, role: true, isActive: true,
      mustChangePassword: true, lastLoginAt: true, lastLoginIp: true, createdAt: true,
      _count: { select: { sessions: true } },
    },
    orderBy: [{ isActive: 'desc' }, { username: 'asc' }],
  });
  // Serializar a tipos planos (string ISO) para que pasen al client component
  const users = usersRaw.map((u) => ({
    ...u,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));
  return <UsersClient initial={users} me={{ id: safeMe.id, username: safeMe.username, role: safeMe.role }} />;
}
