// app/admin/layout.tsx — E.10: gate server-side con cookies para todas las
// páginas /admin/* excepto (public)/login y (public)/account.
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AdminShell } from './_components/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (me === null || me === undefined) {
    redirect('/admin-public/login');
  }
  if (me && me.mustChangePassword) {
    redirect('/admin-public/account');
  }
  // En este punto me es no-null, pero TS no narrowea con redirect().
  const safeMe = me as NonNullable<typeof me>;

  return (
    <AdminShell me={{ id: safeMe.id, username: safeMe.username, displayName: safeMe.displayName, role: safeMe.role }}>
      {children}
    </AdminShell>
  );
}
