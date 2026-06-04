// app/admin/sessions/page.tsx — E.10: dashboard de sesiones (admin only).
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listSessions } from '@/lib/audit/sessions';
import { SessionsClient } from './SessionsClient';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const me = await getCurrentUser();
  if (me === null || me === undefined) {
    redirect('/admin-public/login?next=/admin/sessions');
  }
  if (me && me.role !== 'admin') {
    redirect('/admin');
  }

  const sessionsRaw = await listSessions({ limit: 200 });
  const sessions = sessionsRaw.map((s) => ({
    ...s,
    loginAt: s.loginAt.toISOString(),
    logoutAt: s.logoutAt?.toISOString() ?? null,
  }));
  return <SessionsClient initial={sessions} />;
}
