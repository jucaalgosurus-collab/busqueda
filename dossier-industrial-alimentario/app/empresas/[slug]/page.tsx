// app/empresas/[slug]/page.tsx — Ficha de empresa
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EmpresaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      operations: { orderBy: { announcedAt: 'desc' } },
      contacts: { orderBy: { fullName: 'asc' } },
      sources: {
        include: { article: true },
        orderBy: { article: { publishedAt: 'desc' } },
      },
    },
  });

  if (!company) notFound();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <a href={`${basePath()}/empresas`} style={{ fontSize: 'var(--text-sm)' }}>← Empresas</a>
          <h1 style={{ marginTop: 'var(--space-2)' }}>{company.name}</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            {company.subsector || company.sector} · {company.region || '—'} · CNAE {company.cnae || '—'}
            {company.cif && <> · CIF {company.cif}</>}
          </p>
          {company.web && (
            <p style={{ marginTop: 'var(--space-1)' }}>
              <a href={company.web} target="_blank" rel="noreferrer">{company.web}</a>
            </p>
          )}
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
          <section className="surus-card">
            <h2 className="surus-card-title">Operaciones ({company.operations.length})</h2>
            {company.operations.map((op) => (
              <div
                key={op.id}
                style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--surus-border)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="surus-pill surus-pill-warning">{op.type}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>
                    {op.announcedAt ? new Date(op.announcedAt).toLocaleDateString('es-ES') : '—'}
                  </span>
                </div>
                <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{op.description}</p>
                {op.jobsAffected && (
                  <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)' }}>
                    Empleos afectados: {op.jobsAffected}
                  </p>
                )}
              </div>
            ))}
            {company.operations.length === 0 && <p style={{ color: 'var(--surus-text-muted)' }}>Sin operaciones registradas.</p>}
          </section>

          <section className="surus-card">
            <h2 className="surus-card-title">Contactos ({company.contacts.length})</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)', marginBottom: 'var(--space-3)' }}>
              Para que el depto. comercial Surus los contacte. NO contactamos directamente.
            </p>
            {company.contacts.map((c) => (
              <div
                key={c.id}
                style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--surus-border)' }}
              >
                <div style={{ fontWeight: 500 }}>{c.fullName}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>{c.currentRole}</div>
                <div style={{ marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {c.roleRelevance && (
                    <span className="surus-pill surus-pill-info">{c.roleRelevance}</span>
                  )}
                  {c.email && (
                    <span className="surus-pill" style={{ fontSize: 'var(--text-xs)' }}>
                      ✉️ {c.email} {c.emailVerified && '✓'}
                    </span>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="surus-pill" style={{ fontSize: 'var(--text-xs)' }}>
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ))}
            {company.contacts.length === 0 && <p style={{ color: 'var(--surus-text-muted)' }}>Sin contactos enriquecidos.</p>}
          </section>
        </div>

        <section className="surus-card" style={{ marginTop: 'var(--space-5)' }}>
          <h2 className="surus-card-title">Fuentes ({company.sources.length})</h2>
          {company.sources.map((ac) => (
            <div key={ac.articleId} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--surus-border)' }}>
              <a href={ac.article.url.startsWith('http') ? ac.article.url : '#'} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>
                {ac.article.title}
              </a>
              <span style={{ marginLeft: 12, fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>
                {ac.article.outlet} · {ac.article.publishedAt ? new Date(ac.article.publishedAt).toLocaleDateString('es-ES') : '—'}
              </span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
