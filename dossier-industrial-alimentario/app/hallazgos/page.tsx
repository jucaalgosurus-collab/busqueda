// app/hallazgos/page.tsx — Tabla viva de hallazgos con búsqueda + filtros + export
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';
import { HallazgosFilters } from './HallazgosFilters';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  ccaa?: string;
  signal?: string;
  stale?: string;
}

async function getHallazgos(params: SearchParams) {
  const where: Record<string, unknown> = {};
  if (params.signal === 'in') where.deimplantationSignal = true;
  if (params.signal === 'out') where.deimplantationSignal = false;
  if (params.stale === '1') where.isStale = true;
  if (params.stale === '0') where.isStale = false;
  if (params.ccaa) where.region = params.ccaa;
  if (params.q && params.q.trim().length > 0) {
    where.OR = [
      { title: { contains: params.q, mode: 'insensitive' } },
      { content: { contains: params.q, mode: 'insensitive' } },
      { outlet: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  return prisma.source.findMany({
    where,
    include: {
      companies: {
        include: { company: true },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 200,
  });
}

async function getCcaaList() {
  const rows = await prisma.source.findMany({
    where: { region: { not: null } },
    select: { region: true },
    distinct: ['region'],
  });
  return rows
    .map((r) => r.region)
    .filter((r): r is string => Boolean(r))
    .sort();
}

export default async function HallazgosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [hallazgos, ccaas] = await Promise.all([getHallazgos(sp), getCcaaList()]);
  const base = basePath();

  const exportUrl = (() => {
    const qs = new URLSearchParams();
    if (sp.q) qs.set('q', sp.q);
    if (sp.ccaa) qs.set('ccaa', sp.ccaa);
    if (sp.signal) qs.set('signal', sp.signal);
    if (sp.stale) qs.set('stale', sp.stale);
    qs.set('format', 'csv');
    return `${base}/api/hallazgos/export?${qs.toString()}`;
  })();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-5)',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Hallazgos</h1>
            <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
              {hallazgos.length} fuentes (máx 200). Filtro semántico activo, solo desimplantación.
            </p>
          </div>
          <a
            href={exportUrl}
            className="surus-btn surus-btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            ⬇ Exportar CSV
          </a>
        </header>

        <HallazgosFilters ccaas={ccaas} initial={sp} base={base} />

        <section className="surus-card" style={{ overflowX: 'auto' }}>
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
                    <a
                      href={h.url.startsWith('http') ? h.url : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 500 }}
                    >
                      {h.title}
                    </a>
                  </td>
                  <td style={td}>{h.outlet}</td>
                  <td style={td}>
                    <span
                      className={`surus-pill surus-pill-${
                        h.deimplantationSignal ? 'success' : 'info'
                      }`}
                    >
                      {h.deimplantationSignal ? 'EN ALCANCE' : 'FUERA'}
                    </span>
                  </td>
                  <td style={td}>
                    {h.companies.map((ac) => (
                      <a
                        key={ac.companyId}
                        href={`${base}/empresas/${ac.company.slug}`}
                        style={{ marginRight: 6 }}
                      >
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
                    No hay hallazgos con esos filtros.
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

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  color: 'var(--surus-text-soft)',
};
const td: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
};
