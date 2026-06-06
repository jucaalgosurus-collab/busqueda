'use client';
// app/_components/GlobalHeader.tsx — Header con selector de sector y navegación
import Link from 'next/link';
import { SectorSelector } from './SectorSelector';
import { basePath } from '@/lib/utils/base-path';

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/contactos', label: 'Contactos' },
  { href: '/hallazgos', label: 'Hallazgos' },
  { href: '/agentes', label: 'Agentes' },
];

export function GlobalHeader() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-5)',
        borderBottom: '1px solid var(--surus-border, #e2e8f0)',
        background: 'var(--surus-surface, #f8fafc)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Link
        href={basePath() || '/'}
        style={{
          fontWeight: 700,
          color: 'var(--surus-primary, #0f172a)',
          textDecoration: 'none',
          marginRight: 'var(--space-4)',
        }}
      >
        HERMES
      </Link>
      <nav
        aria-label="Navegación principal"
        style={{ display: 'flex', gap: 'var(--space-3)', flex: 1 }}
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={basePath() + item.href}
            style={{
              color: 'var(--surus-text-soft, #475569)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <SectorSelector />
    </header>
  );
}
