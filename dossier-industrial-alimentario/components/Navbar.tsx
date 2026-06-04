// components/Navbar.tsx — Top navigation for HERMES Dossier
// Next.js Link auto-prepends basePath from next.config.ts (set to /dossier).
// Do NOT prepend basePath manually here — that produces /dossier/dossier/...
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/hallazgos', label: 'Hallazgos' },
  { href: '/sala-situacional', label: 'Sala situacional' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/contactos', label: 'Contactos' },
  { href: '/buscar-responsables', label: 'Buscar responsables' },
  { href: '/mocr', label: 'MOCR' },
  { href: '/agentes', label: 'Agentes' },
  { href: '/legacy', label: 'Legacy' },
];

export function Navbar() {
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
          href="/"
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
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
          <GlobalSearch />
          <ThemeToggle />
          <span
            title="HERMES Dossier — creado por Juan Carlos Alvarado para Surus Inversa"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'rgba(255,255,255,0.55)',
              padding: 'var(--space-1) var(--space-2)',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            Creado por <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Juan Carlos Alvarado</strong> para <strong style={{ color: 'var(--surus-accent)' }}>Surus</strong>
          </span>
        </div>
      </div>
    </nav>
  );
}
