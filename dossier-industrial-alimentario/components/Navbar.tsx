// components/Navbar.tsx — Top navigation for HERMES Dossier
import Link from 'next/link';
import { basePath } from '@/lib/utils/base-path';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/hallazgos', label: 'Hallazgos' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/contactos', label: 'Contactos' },
  { href: '/mocr', label: 'MOCR' },
  { href: '/agentes', label: 'Agentes' },
  { href: '/legacy', label: 'Legacy' },
];

export function Navbar() {
  const base = basePath();
  return (
    <nav
      style={{
        background: 'var(--surus-primary)',
        color: 'white',
        padding: 'var(--space-3) 0',
        boxShadow: 'var(--surus-shadow-md)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        className="surus-container"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-5)' }}
      >
        <Link
          href={`${base}/`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'white',
            fontWeight: 700,
            fontSize: 'var(--text-lg)',
          }}
        >
          <span style={{ fontSize: 'var(--text-xl)' }}>🛰️</span>
          HERMES <span style={{ color: 'var(--surus-accent)' }}>Dossier</span>
          <span
            style={{
              marginLeft: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              opacity: 0.7,
              fontWeight: 400,
            }}
          >
            A&amp;B OSINT · v{process.env.HERMES_DOSSIER_VERSION || '0.1.0'}
          </span>
        </Link>

        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={`${base}${l.href}`}
              style={{
                color: 'rgba(255,255,255,0.85)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
