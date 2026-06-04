// app/empresas/page.tsx — Listado de empresas industriales (sector ampliable)
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';
import { INDUSTRIAS, labelDeIndustria } from '@/lib/industria';
import { EmpresasFilters } from './EmpresasFilters';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  industria?: string;
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.industria) where.sector = sp.industria;
  if (sp.q && sp.q.trim().length > 0) {
    where.OR = [
      { name: { contains: sp.q, mode: 'insensitive' } },
      { subsector: { contains: sp.q, mode: 'insensitive' } },
    ];
  }

  const [companies, sectorCounts, totalEmpresas] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        _count: { select: { operations: true, plantContacts: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.company.groupBy({
      by: ['sector'],
      _count: { _all: true },
    }),
    prisma.company.count(),
  ]);
  const base = basePath();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1>Empresas</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            {companies.length} de {totalEmpresas} empresas industriales en cobertura.
            {sp.industria && (
              <>
                {' '}
                Filtro activo: <strong>{labelDeIndustria(sp.industria)}</strong>.
              </>
            )}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
              marginTop: 'var(--space-3)',
            }}
          >
            <SectorChip
              base={base}
              label="Todas"
              count={totalEmpresas}
              active={!sp.industria}
            />
            {INDUSTRIAS.map((i) => {
              const count =
                sectorCounts.find((s) => s.sector === i.sector)?._count._all ?? 0;
              if (count === 0) return null;
              return (
                <SectorChip
                  key={i.sector}
                  base={base}
                  label={i.label}
                  count={count}
                  active={sp.industria === i.sector}
                  sector={i.sector}
                />
              );
            })}
          </div>
        </header>

        <EmpresasFilters base={base} initial={sp} />

        {companies.length === 0 ? (
          <div
            className="surus-card"
            style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--surus-text-soft)' }}
          >
            No hay empresas con esos filtros. Prueba otra industria o limpia la búsqueda.
          </div>
        ) : (
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
                  {labelDeIndustria(c.sector)}{c.subsector ? ` · ${c.subsector}` : ''} · {c.hqRegion || '—'} · CNAE {c.cnae || '—'}
                </div>
                <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span className="surus-pill">{c._count.operations} ops</span>
                  <span className="surus-pill">{c._count.plantContacts} contactos</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function SectorChip({
  base,
  label,
  count,
  active,
  sector,
}: {
  base: string;
  label: string;
  count: number;
  active: boolean;
  sector?: string;
}) {
  const qs = new URLSearchParams();
  if (sector) qs.set('industria', sector);
  const href = qs.toString() ? `${base}/empresas?${qs.toString()}` : `${base}/empresas`;
  return (
    <a
      href={href}
      className={`surus-pill ${active ? 'surus-pill-accent' : ''}`}
      style={{ textDecoration: 'none', cursor: 'pointer' }}
    >
      {label} · {count}
    </a>
  );
}
