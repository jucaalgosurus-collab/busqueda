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
  cnae?: string; // '10' | '11' | undefined — Sprint D.2 sectorizacion
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.industria) where.sector = sp.industria;
  if (sp.cnae && /^(10|11)$/.test(sp.cnae)) {
    where.cnae = { startsWith: sp.cnae };
  }
  if (sp.q && sp.q.trim().length > 0) {
    where.OR = [
      { name: { contains: sp.q, mode: 'insensitive' } },
      { subsector: { contains: sp.q, mode: 'insensitive' } },
    ];
  }

  const [companies, sectorCounts, cnaeCounts, totalEmpresas] = await Promise.all([
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
    // Conteo por prefijo CNAE (Sprint D.2). Solo cuentan las que tienen cnae no null.
    Promise.all([
      prisma.company.count({ where: { cnae: { startsWith: '10' } } }),
      prisma.company.count({ where: { cnae: { startsWith: '11' } } }),
    ]),
    prisma.company.count(),
  ]);
  const base = basePath();
  const cnae10Count = cnaeCounts[0];
  const cnae11Count = cnaeCounts[1];

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
                Filtro industria: <strong>{labelDeIndustria(sp.industria)}</strong>.
              </>
            )}
            {sp.cnae && (
              <>
                {' '}
                Filtro CNAE: <strong>{sp.cnae === '10' ? 'Alimentos' : 'Bebidas'}</strong>.
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
              active={!sp.industria && !sp.cnae}
              keepCnae={sp.cnae}
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
                  keepCnae={sp.cnae}
                />
              );
            })}
          </div>
          {/* Sprint D.2 — chips filtro CNAE (Alimentos / Bebidas) */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
              marginTop: 'var(--space-2)',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--surus-text-soft)',
                marginRight: 'var(--space-1)',
              }}
            >
              CNAE:
            </span>
            <CnaeChip
              base={base}
              label="Todos"
              count={cnae10Count + cnae11Count}
              active={!sp.cnae}
              keepIndustria={sp.industria}
              cnae={undefined}
            />
            <CnaeChip
              base={base}
              label="Alimentos (10)"
              count={cnae10Count}
              active={sp.cnae === '10'}
              keepIndustria={sp.industria}
              cnae="10"
            />
            <CnaeChip
              base={base}
              label="Bebidas (11)"
              count={cnae11Count}
              active={sp.cnae === '11'}
              keepIndustria={sp.industria}
              cnae="11"
            />
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
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                    {c.cnae && (
                      <span
                        className="surus-pill"
                        title={cnaeLabelFromCode(c.cnae)}
                        style={{ fontSize: 'var(--text-xs)' }}
                      >
                        CNAE {c.cnae}
                      </span>
                    )}
                    <span className="surus-pill surus-pill-accent">{c.tier}</span>
                  </div>
                </div>
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>
                  {labelDeIndustria(c.sector)}{c.subsector ? ` · ${c.subsector}` : ''} · {c.hqRegion || '—'}
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

function cnaeLabelFromCode(cnae: string): string {
  if (cnae.startsWith('10')) return 'Industria de la alimentación';
  if (cnae.startsWith('11')) return 'Fabricación de bebidas';
  return cnae;
}

function SectorChip({
  base,
  label,
  count,
  active,
  sector,
  keepCnae,
}: {
  base: string;
  label: string;
  count: number;
  active: boolean;
  sector?: string;
  keepCnae?: string;
}) {
  const qs = new URLSearchParams();
  if (sector) qs.set('industria', sector);
  if (keepCnae) qs.set('cnae', keepCnae);
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

function CnaeChip({
  base,
  label,
  count,
  active,
  cnae,
  keepIndustria,
}: {
  base: string;
  label: string;
  count: number;
  active: boolean;
  cnae: string | undefined;
  keepIndustria?: string;
}) {
  const qs = new URLSearchParams();
  if (cnae) qs.set('cnae', cnae);
  if (keepIndustria) qs.set('industria', keepIndustria);
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
