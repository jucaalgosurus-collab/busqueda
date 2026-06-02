// app/empresas/page.tsx — Listado de empresas A&B
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';

export const dynamic = 'force-dynamic';

export default async function EmpresasPage() {
  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { operations: true, contacts: true } },
    },
    orderBy: { name: 'asc' },
  });
  const base = basePath();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1>Empresas</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            {companies.length} grandes empresas A&amp;B en cobertura (CNAE 10+11).
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {companies.map((c) => (
            <a
              key={c.id}
              href={`${base}/empresas/${c.slug}`}
              className="surus-card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 'var(--space-2)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)' }}>{c.name}</h3>
                <span className="surus-pill surus-pill-accent">{c.tier}</span>
              </div>
              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>
                {c.subsector || c.sector} · {c.region || '—'} · CNAE {c.cnae || '—'}
              </div>
              <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
                <span className="surus-pill">{c._count.operations} ops</span>
                <span className="surus-pill">{c._count.contacts} contactos</span>
              </div>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
