// app/admin/_components/AdminShell.tsx — E.10: layout con sub-nav del panel admin.
//
// Si recibe `me` del padre (server component), lo usa. Si no, lo carga con
// useEffect desde /api/auth/me (modo tolerante). El layout ya redirige si
// no hay sesión, así que aquí solo se renderiza.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { basePath } from '@/lib/utils/base-path';

interface MeData {
  id: string;
  username: string;
  displayName: string | null;
  role: 'admin' | 'user';
}

const SUBNAV_BASE = [
  { href: '/admin', label: 'Empresas' },
  { href: '/admin/outreach', label: 'Outreach' },
  { href: '/admin/outreach/log', label: 'Log Outreach' },
];

const SUBNAV_ADMIN = [
  ...SUBNAV_BASE,
  { href: '/admin/users', label: 'Usuarios' },
  { href: '/admin/sessions', label: 'Sesiones' },
];

export function AdminShell({ children, me: meProp }: { children: React.ReactNode; me?: MeData }) {
  const [me, setMe] = useState<MeData | null>(meProp ?? null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (me) return;
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.success) return;
        setMe(j.data as MeData);
      })
      .catch(() => {/* silent */});
    return () => {
      cancelled = true;
    };
  }, [me]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(`${basePath()}/admin-public/login`);
    router.refresh();
  }

  const subnav = me && me.role === 'admin' ? SUBNAV_ADMIN : SUBNAV_BASE;

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--surus-primary) 0%, #1a3458 100%)',
          color: 'white',
          padding: 'var(--space-4) 0',
          borderBottom: '2px solid var(--surus-accent)',
        }}
      >
        <div className="surus-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-xl)' }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Panel de control</div>
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.75 }}>
                {me ? <>Hola {me.displayName || me.username}{me.role === 'admin' ? ' · admin' : ''}</> : 'Cargando…'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/admin-public/account" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
              Mi cuenta
            </Link>
            <button type="button" onClick={logout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      <div className="surus-container" style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--surus-border)', background: 'var(--surus-bg-elev)', overflowX: 'auto' }}>
        {subnav.map((l) => {
          const active = pathname === l.href || (l.href !== '/admin' && pathname?.startsWith(l.href));
          return (
            <Link key={l.href} href={l.href} style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', background: active ? 'var(--surus-primary)' : 'transparent', color: active ? 'white' : 'var(--surus-text)', fontSize: 'var(--text-sm)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {l.label}
            </Link>
          );
        })}
      </div>

      <main className="surus-container" style={{ padding: 'var(--space-5)' }}>
        {children}
      </main>
    </div>
  );
}
