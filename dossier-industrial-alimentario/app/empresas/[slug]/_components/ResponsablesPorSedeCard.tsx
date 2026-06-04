// app/empresas/[slug]/_components/ResponsablesPorSedeCard.tsx
//
// QW-10: card "Responsables por sede" — lista todas las plantas con su responsable principal.
// Visible en /empresas/[slug] para que el comercial Surus vea de un vistazo
// quién manda en cada sede.

import Link from 'next/link';
import type { CSSProperties } from 'react';

type Contact = {
  id: string;
  fullName: string;
  role: string;
  roleCategory: string | null;
  linkedinUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  sourceOutlet: string | null;
};

type PlantBlock = {
  plant: {
    id: string;
    name: string;
    city: string | null;
    province: string | null;
    ccaa: string | null;
    status: string | null;
    specialty: string | null;
    isStale?: boolean;
    staleReason?: string | null;
    staleAt?: Date | string | null;
  };
  primaryResponsable: Contact | null;
  contacts: Contact[];
  summary: { total: number; verified: number; withLinkedin: number };
};

type Props = { companySlug: string; plants: PlantBlock[]; basePath: string };

const cardStyle: CSSProperties = {
  background: 'var(--surus-surface)',
  border: '1px solid var(--surus-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  display: 'grid',
  gap: 'var(--space-4)',
};

const badgeStyle = (variant: 'verified' | 'pending' | 'noEmail'): CSSProperties => {
  const bg = variant === 'verified' ? 'var(--surus-success-soft, #d4edda)' : variant === 'pending' ? 'var(--surus-warning-soft, #fff3cd)' : 'var(--surus-bg-elev)';
  const fg = variant === 'verified' ? '#155724' : variant === 'pending' ? '#856404' : 'var(--surus-text-muted)';
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: bg, color: fg,
    fontSize: 'var(--text-xs)', fontWeight: 600,
    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
  };
};

const statusColor: Record<string, string> = {
  operativa: '#1b5e20',
  en_inversion: '#0d47a1',
  en_desmantelamiento: '#b71c1c',
  cerrada: '#4a148c',
  vendida: '#e65100',
  en_proyecto: '#1565c0',
  en_conversion: '#4527a0',
  en_venta: '#bf360c',
};

export function ResponsablesPorSedeCard({ companySlug, plants, basePath }: Props) {
  if (plants.length === 0) {
    return (
      <section style={cardStyle} aria-labelledby="rps-title">
        <h2 id="rps-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
          Responsables por sede
        </h2>
        <p style={{ color: 'var(--surus-text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
          Esta empresa aún no tiene plantas registradas con responsables.
        </p>
      </section>
    );
  }

  const totalContacts = plants.reduce((acc, b) => acc + b.summary.total, 0);
  const totalVerified = plants.reduce((acc, b) => acc + b.summary.verified, 0);

  return (
    <section style={cardStyle} aria-labelledby="rps-title">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h2 id="rps-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
          Responsables por sede
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>
          <span><strong>{plants.length}</strong> sedes</span>
          <span>·</span>
          <span><strong>{totalContacts}</strong> contactos</span>
          <span>·</span>
          <span><strong style={{ color: totalVerified > 0 ? '#1b5e20' : 'var(--surus-text-muted)' }}>{totalVerified}</strong> emails verificados</span>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
        {plants.map((block) => {
          const p = block.plant;
          const stColor = statusColor[p.status ?? ''] ?? 'var(--surus-text-muted)';
          return (
            <article
              key={p.id}
              style={{
                background: 'var(--surus-bg-elev)',
                border: '1px solid var(--surus-border)',
                borderLeft: `4px solid ${stColor}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-2)',
              }}
            >
              <header>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {p.name}
                  {p.isStale && (
                    <span
                      className="surus-pill surus-pill--warn"
                      title={p.staleAt ? `Marcada stale el ${new Date(p.staleAt).toISOString().slice(0, 10)}` : 'Sin novedad'}
                      aria-label={`Planta sin novedad: ${p.staleReason ?? 'sin_novedad_21d'}`}
                      style={{ fontSize: 'var(--text-xs)' }}
                    >
                      <span aria-hidden="true">⚠</span>
                      <span>{p.staleReason ?? 'sin_novedad_21d'}</span>
                    </span>
                  )}
                </h3>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', marginTop: 4 }}>
                  {p.city && <span>{p.city}</span>}
                  {p.city && p.province && <span> · </span>}
                  {p.province && <span>{p.province}</span>}
                  {p.ccaa && <span> · {p.ccaa}</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {p.status && (
                    <span style={{ ...badgeStyle('pending'), textTransform: 'capitalize' }}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  )}
                  {p.specialty && (
                    <span style={badgeStyle('noEmail')}>{p.specialty}</span>
                  )}
                  <span style={badgeStyle('noEmail')}>
                    {block.summary.total} contacto{block.summary.total === 1 ? '' : 's'}
                  </span>
                </div>
              </header>

              {block.primaryResponsable ? (
                <div style={{ borderTop: '1px solid var(--surus-border)', paddingTop: 'var(--space-2)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Responsable principal
                  </div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                    {block.primaryResponsable.fullName}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>
                    {block.primaryResponsable.role}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {block.primaryResponsable.email && (
                      <a
                        href={`mailto:${block.primaryResponsable.email}`}
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--surus-text)',
                          background: 'var(--surus-bg)',
                          border: '1px solid var(--surus-border)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          textDecoration: 'none',
                        }}
                        title={block.primaryResponsable.emailVerified ? 'Email verificado' : 'Email sin verificar'}
                      >
                        {block.primaryResponsable.emailVerified ? '✓ ' : '⚠ '}
                        {block.primaryResponsable.email}
                      </a>
                    )}
                    {block.primaryResponsable.linkedinUrl && (
                      <a
                        href={block.primaryResponsable.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: '#0a66c2',
                          background: 'var(--surus-bg)',
                          border: '1px solid var(--surus-border)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          textDecoration: 'none',
                        }}
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', fontStyle: 'italic' }}>
                  Sin responsable asignado a esta sede
                </div>
              )}

              {block.contacts.length > 1 && (
                <details>
                  <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                    Ver {block.contacts.length - 1} contacto{block.contacts.length - 1 === 1 ? '' : 's'} más
                  </summary>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-2) 0 0', display: 'grid', gap: 4 }}>
                    {block.contacts
                      .filter((c) => c.id !== block.primaryResponsable?.id)
                      .map((c) => (
                        <li key={c.id} style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)' }}>
                          <strong>{c.fullName}</strong> · {c.role}
                          {c.email && (
                            <span style={{ color: c.emailVerified ? '#1b5e20' : 'var(--surus-text-muted)' }}>
                              {' '}— {c.emailVerified ? '✓' : '⚠'} {c.email}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                </details>
              )}

              <Link
                href={`${basePath}/buscar-responsables?company=${companySlug}&sede=${encodeURIComponent(p.name)}`}
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-accent)',
                  textAlign: 'right',
                  marginTop: 'var(--space-1)',
                }}
              >
                Buscar más responsables de {p.name} →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
