// app/hallazgos/page.tsx — Tabla viva de hallazgos con búsqueda + filtros + export
// E.6 — columnas: Fecha · Link · Empresa · Sede · Outlet · Tipo · Industria · CCAA · Estado
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';
import { labelDeIndustria } from '@/lib/industria';
import { HallazgosFilters } from './HallazgosFilters';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  ccaa?: string;
  signal?: string;
  stale?: string;
  industria?: string;
  sede?: string;
  sort?: string; // E.6: 'fecha_desc' (default) | 'fecha_asc' | 'empresa' | 'sede'
}

async function getHallazgos(params: SearchParams) {
  const where: Record<string, unknown> = {};
  if (params.signal === 'in') where.deimplantationSignal = true;
  if (params.signal === 'out') where.deimplantationSignal = false;
  if (params.stale === '1') where.isStale = true;
  if (params.stale === '0') where.isStale = false;
  const companyFilter: Record<string, unknown> = {};
  if (params.ccaa) companyFilter.hqRegion = params.ccaa;
  if (params.industria) companyFilter.sector = params.industria;
  if (Object.keys(companyFilter).length > 0) where.company = companyFilter;
  if (params.sede) {
    // Filtro por nombre de sede (plant.name). Relación Source.plant.
    where.plant = { name: { contains: params.sede, mode: 'insensitive' } };
  }
  if (params.q && params.q.trim().length > 0) {
    where.OR = [
      { title: { contains: params.q, mode: 'insensitive' } },
      { outlet: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  // E.6: orden configurable. Default fecha desc (lo más reciente arriba).
  const orderBy: { publishedAt: 'asc' | 'desc' } | { company: { name: 'asc' } } | { plant: { name: 'asc' } } = (() => {
    if (params.sort === 'fecha_asc') return { publishedAt: 'asc' };
    if (params.sort === 'empresa') return { company: { name: 'asc' } };
    if (params.sort === 'sede') return { plant: { name: 'asc' } };
    return { publishedAt: 'desc' };
  })();

  return prisma.source.findMany({
    where,
    include: {
      company: { select: { id: true, slug: true, name: true, hqRegion: true, sector: true } },
      plant: { select: { id: true, slug: true, name: true, city: true, ccaa: true } },
    },
    orderBy,
    take: 200,
  });
}

async function getCcaaList() {
  const rows = await prisma.company.findMany({
    where: { hqRegion: { not: null } },
    select: { hqRegion: true },
    distinct: ['hqRegion'],
  });
  return rows
    .map((r) => r.hqRegion)
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
    if (sp.industria) qs.set('industria', sp.industria);
    if (sp.sede) qs.set('sede', sp.sede);
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
                <th style={th}>
                  <a href={sortHref(sp, 'fecha_desc', base)} style={thLink}>Fecha ↓</a>
                </th>
                <th style={th}>Link</th>
                <th style={th}>
                  <a href={sortHref(sp, 'empresa', base)} style={thLink}>Empresa</a>
                </th>
                <th style={th}>
                  <a href={sortHref(sp, 'sede', base)} style={thLink}>Sede</a>
                </th>
                <th style={th}>Outlet</th>
                <th style={th}>Tipo</th>
                <th style={th}>Industria</th>
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
                  <td style={td}>
                    {h.company ? (
                      <a
                        href={`${base}/empresas/${h.company.slug}`}
                        style={{ marginRight: 6 }}
                      >
                        {h.company.name}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={td}>
                    {h.plant ? (
                      <span title={`${h.plant.city ?? ''} · ${h.plant.ccaa ?? ''}`}>
                        {h.plant.name}
                      </span>
                    ) : (
                      '—'
                    )}
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
                    {h.company?.sector ? (
                      <span className="surus-pill surus-pill-accent">
                        {labelDeIndustria(h.company.sector)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={td}>{h.company?.hqRegion || h.plant?.ccaa || '—'}</td>
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
                  <td colSpan={9} style={{ ...td, textAlign: 'center', padding: 'var(--space-6)' }}>
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

function sortHref(sp: SearchParams, sort: string, base: string): string {
  const qs = new URLSearchParams();
  if (sp.q) qs.set('q', sp.q);
  if (sp.ccaa) qs.set('ccaa', sp.ccaa);
  if (sp.signal) qs.set('signal', sp.signal);
  if (sp.stale) qs.set('stale', sp.stale);
  if (sp.industria) qs.set('industria', sp.industria);
  if (sp.sede) qs.set('sede', sp.sede);
  qs.set('sort', sort);
  return `${base}/hallazgos?${qs.toString()}`;
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  color: 'var(--surus-text-soft)',
};
const thLink: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
  fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
};
