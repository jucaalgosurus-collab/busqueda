// app/hallazgos/page.tsx — Tabla viva de hallazgos
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';

export const dynamic = 'force-dynamic';

async function getHallazgos() {
  return prisma.source.findMany({
    include: {
      companies: {
        include: { company: true },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
  });
}

export default async function HallazgosPage() {
  const hallazgos = await getHallazgos();
  const base = basePath();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1>Hallazgos</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            {hallazgos.length} fuentes scrapeadas. Solo desimplantación, con filtro semántico automático.
          </p>
        </header>

        <section className="surus-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--surus-border)' }}>
                <th style={th}>Fecha</th>
                <th style={th}>Título</th>
                <th style={th}>Outlet</th>
                <th style={th}>Tipo</th>
                <th style={th}>Empresas</th>
                <th style={th}>CCAA</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {hallazgos.map((h) => (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                  <td style={td}>
                    {h.publishedAt ? new Date(h.publishedAt).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td style={{ ...td, maxWidth: 360 }}>
                    <a href={h.url.startsWith('http') ? h.url : '#'} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>
                      {h.title}
                    </a>
                  </td>
                  <td style={td}>{h.outlet}</td>
                  <td style={td}>
                    <span className={`surus-pill surus-pill-${h.deimplantationSignal ? 'success' : 'info'}`}>
                      {h.deimplantationSignal ? 'EN ALCANCE' : 'FUERA'}
                    </span>
                  </td>
                  <td style={td}>
                    {h.companies.map((ac) => (
                      <a key={ac.companyId} href={`${base}/empresas/${ac.company.slug}`} style={{ marginRight: 6 }}>
                        {ac.company.name}
                      </a>
                    ))}
                  </td>
                  <td style={td}>{h.region || '—'}</td>
                  <td style={td}>
                    {h.isStale ? (
                      <span className="surus-pill surus-pill-warning">stale</span>
                    ) : (
                      <span className="surus-pill surus-pill-success">fresh</span>
                    )}
                  </td>
                </tr>
              ))}
              {hallazgos.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...td, textAlign: 'center', padding: 'var(--space-6)' }}>
                    No hay hallazgos todavía. Activa los agentes en /agentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' };
const td: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' };
