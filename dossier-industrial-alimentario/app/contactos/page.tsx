// app/contactos/page.tsx — Decisores A&B para que el depto. comercial los contacte
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';

export const dynamic = 'force-dynamic';

export default async function ContactosPage() {
  const contacts = await prisma.contact.findMany({
    include: { currentCompany: true },
    orderBy: { fullName: 'asc' },
  });
  const base = basePath();

  // CSV export via API
  const exportUrl = `${base}/api/contactos/export.csv`;

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Contactos</h1>
            <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
              {contacts.length} decisores A&amp;B. La herramienta NO contacta — el depto. comercial Surus les escribe/llama.
            </p>
          </div>
          <a href={exportUrl} className="surus-button">Exportar CSV</a>
        </header>

        <section className="surus-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--surus-border)' }}>
                <th style={th}>Nombre</th>
                <th style={th}>Cargo</th>
                <th style={th}>Empresa</th>
                <th style={th}>Rol Surus</th>
                <th style={th}>Email</th>
                <th style={th}>LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                  <td style={td}>{c.fullName}</td>
                  <td style={td}>{c.currentRole || '—'}</td>
                  <td style={td}>
                    {c.currentCompany && (
                      <a href={`${base}/empresas/${c.currentCompany.slug}`}>{c.currentCompany.name}</a>
                    )}
                  </td>
                  <td style={td}>
                    {c.roleRelevance && <span className="surus-pill surus-pill-info">{c.roleRelevance}</span>}
                  </td>
                  <td style={td}>
                    {c.email ? (
                      <span>
                        {c.email} {c.emailVerified && <span style={{ color: 'var(--surus-success)' }}>✓</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={td}>
                    {c.linkedinUrl ? (
                      <a href={c.linkedinUrl} target="_blank" rel="noreferrer">Ver</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' };
const td: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' };
