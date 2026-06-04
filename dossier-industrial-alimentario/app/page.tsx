// app/page.tsx — QW-6 Dashboard reorganizado por sector con filtro reactivo.
//
// Brief 2026-06-03 (Juan Carlos): "EL DASHBOARD LA PAGINA PRINCIPAL PORQUE NO ESTAN
// SEPARADOS POR CATEGORIAS, POR SECTOR, PORQUE NO SE PUEDE FILTRAR TAMBIEN???
// DEJAR POR SUPUESTO SIEMPRE ALIMENTACION Y BEBIDAS PRIMERO, LUEGO CONSTRUCCION".
//
// Tabla de contenidos:
//   - Tabs sticky arriba con los 6 sectores en orden fijo (A&B primero, Construcción segundo)
//   - "Todos" opcional para ver el agregado
//   - KPI cards filtradas por sector activo
//   - "Top empresas" filtradas por sector activo
//   - "Distribución por sector" siempre visible en orden fijo
//   - "Distribución por CCAA" filtrada por sector activo
//   - Color de acento por sector (línea vertical 4px en cada card)

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';
import { SECTOR_ORDER, SECTOR_ACCENT } from '@/lib/dashboard/sectors';

interface DashboardData {
  sector: string | null;
  kpis: {
    companies: number;
    operations: number;
    sources: number;
    contacts: number;
    contactsVerified: number;
    inScopeSources: number;
  };
  topEmpresas: Array<{
    id: string;
    slug: string;
    name: string;
    sector: string;
    subsector: string | null;
    hqRegion: string | null;
    ops: number;
    contacts: number;
  }>;
  bySector: Array<{ sector: string; count: number }>;
  byRegion: Array<{ region: string; count: number }>;
}

const SECTOR_COLOR: Record<string, string> = {
  'Alimentos y Bebidas': '#c89b3c',
  Construccion: '#c47b00',
  Industrial: '#134373',
  Farmaceutico: '#1d6f42',
  Energetico: '#b1342b',
  'Otro industrial': '#7d8597',
};

export default function DashboardPage() {
  const base = basePath();
  const [sector, setSector] = useState<string>('Alimentos y Bebidas');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (s: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = s === '__all__' ? '/api/dashboard' : `/api/dashboard?sector=${encodeURIComponent(s)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(sector);
  }, [sector, fetchData]);

  const accent = SECTOR_COLOR[sector] ?? SECTOR_COLOR['Alimentos y Bebidas'];

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            Motor de inteligencia OSINT sobre desimplantaciones en grandes empresas en España.
          </p>
        </header>

        {/* Tabs sticky de sectores — orden fijo, A&B primero */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--surus-bg-elev)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--surus-border)',
            padding: 'var(--space-2)',
            marginBottom: 'var(--space-5)',
            boxShadow: 'var(--surus-shadow-sm)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-1)',
          }}
        >
          {SECTOR_ORDER.map((s) => {
            const isActive = sector === s;
            const color = SECTOR_COLOR[s] ?? SECTOR_COLOR['Alimentos y Bebidas'];
            return (
              <button
                key={s}
                onClick={() => setSector(s)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? color : 'transparent',
                  color: isActive ? 'white' : 'var(--surus-text)',
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? undefined : `3px solid ${color}`,
                }}
              >
                {s}
              </button>
            );
          })}
          <button
            onClick={() => setSector('__all__')}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surus-border)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: sector === '__all__' ? 600 : 500,
              background: sector === '__all__' ? 'var(--surus-primary)' : 'transparent',
              color: sector === '__all__' ? 'white' : 'var(--surus-text-soft)',
              marginLeft: 'auto',
            }}
          >
            Todos los sectores
          </button>
        </div>

        {error && (
          <div
            className="surus-card"
            style={{ borderLeft: '4px solid var(--surus-danger)', marginBottom: 'var(--space-4)' }}
          >
            <strong>Error cargando datos:</strong> {error}
          </div>
        )}

        {/* KPI Cards filtradas */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
            borderLeft: `4px solid ${accent}`,
            paddingLeft: 'var(--space-3)',
          }}
        >
          {loading || !data ? (
            <SkeletonKPI count={5} />
          ) : data.kpis.companies === 0 ? (
            <EmptyState sector={sector} />
          ) : (
            <>
              <KPI label="Empresas" value={data.kpis.companies} accent="primary" hint={`Sector: ${sector === '__all__' ? 'Todos' : sector}`} />
              <KPI label="Operaciones" value={data.kpis.operations} accent="warning" hint="Desimplantaciones detectadas" />
              <KPI label="Fuentes" value={data.kpis.sources} accent="info" hint="RSS / newsrooms / BOE" />
              <KPI label="Contactos" value={data.kpis.contacts} accent="success" hint={`${data.kpis.contactsVerified} verificados`} />
              <KPI label="En alcance" value={data.kpis.inScopeSources} accent="accent" hint="Marcados desimplantación" />
            </>
          )}
        </section>

        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-5)' }}>
            {/* Top empresas filtradas */}
            <section
              className="surus-card"
              style={{ borderLeft: `4px solid ${accent}` }}
            >
              <h2 className="surus-card-title">
                Top empresas con más movimiento
                <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', fontWeight: 400 }}>
                  ({sector === '__all__' ? 'Todos los sectores' : sector})
                </span>
              </h2>
              {data.topEmpresas.length === 0 ? (
                <p style={{ color: 'var(--surus-text-soft)', fontSize: 'var(--text-sm)' }}>
                  Sin empresas registradas en este sector.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--surus-border)' }}>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Empresa</th>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Subsector</th>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>CCAA</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Ops</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Contactos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topEmpresas.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <a href={`${base}/empresas/${c.slug}`} style={{ fontWeight: 500 }}>
                            {c.name}
                          </a>
                        </td>
                        <td style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>
                          {c.subsector ?? c.sector}
                        </td>
                        <td style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{c.hqRegion ?? '—'}</td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'right' }}>{c.ops}</td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'right' }}>{c.contacts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Distribución */}
            <section className="surus-card">
              <h2 className="surus-card-title">Distribución</h2>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', marginBottom: 'var(--space-2)' }}>
                  Por sector (orden fijo)
                </h4>
                {data.bySector.map((s) => {
                  const color = SECTOR_COLOR[s.sector] ?? SECTOR_COLOR['Alimentos y Bebidas'];
                  return (
                    <button
                      key={s.sector}
                      onClick={() => setSector(s.sector)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-1) var(--space-2)',
                        width: '100%',
                        cursor: 'pointer',
                        background: sector === s.sector ? 'var(--surus-bg)' : 'transparent',
                        borderLeft: `3px solid ${color}`,
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '2px',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-sm)' }}>{s.sector}</span>
                      <span className="surus-pill surus-pill-info">{s.count}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', marginBottom: 'var(--space-2)' }}>
                  Por CCAA
                </h4>
                {data.byRegion.length === 0 ? (
                  <p style={{ color: 'var(--surus-text-soft)', fontSize: 'var(--text-sm)' }}>—</p>
                ) : (
                  data.byRegion.map((r) => (
                    <div
                      key={r.region}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-1) 0' }}
                    >
                      <span style={{ fontSize: 'var(--text-sm)' }}>{r.region}</span>
                      <span className="surus-pill">{r.count}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        <section
          className="surus-card"
          style={{
            marginTop: 'var(--space-6)',
            background: 'var(--surus-bg)',
            borderStyle: 'dashed',
            borderLeft: `4px solid ${accent}`,
          }}
        >
          <h3 style={{ fontSize: 'var(--text-lg)', color: 'var(--surus-primary)' }}>
            Sector activo: <span style={{ color: accent }}>{sector === '__all__' ? 'Todos los sectores' : sector}</span>
          </h3>
          <p style={{ marginTop: 'var(--space-2)', color: 'var(--surus-text-soft)', fontSize: 'var(--text-sm)' }}>
            Tabs en orden fijo: Alimentos y Bebidas (1º), Construcción (2º), Industrial, Farmacéutico, Energético, Otro industrial.
            Click en cualquier sector de la distribución para cambiar el filtro.
          </p>
        </section>
      </main>
    </>
  );
}

function KPI({
  label, value, accent, hint,
}: { label: string; value: number; accent: 'primary' | 'success' | 'warning' | 'info' | 'accent'; hint?: string }) {
  const colorMap = {
    primary: 'var(--surus-primary)',
    success: 'var(--surus-success)',
    warning: 'var(--surus-warning)',
    info: 'var(--surus-primary-500)',
    accent: 'var(--surus-accent-700)',
  };
  return (
    <div className="surus-card" style={{ borderTop: `3px solid ${colorMap[accent]}` }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: colorMap[accent], marginTop: 'var(--space-1)' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', marginTop: 'var(--space-1)' }}>{hint}</div>}
    </div>
  );
}

function SkeletonKPI({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surus-card" style={{ opacity: 0.4 }}>
          <div style={{ height: 'var(--text-sm)', width: '60%', background: 'var(--surus-bg)', borderRadius: 'var(--radius-sm)' }} />
          <div style={{ height: 'var(--text-3xl)', width: '40%', background: 'var(--surus-bg)', borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)' }} />
        </div>
      ))}
    </>
  );
}

function EmptyState({ sector }: { sector: string }) {
  return (
    <div className="surus-card" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
      <p style={{ color: 'var(--surus-text-soft)' }}>
        Sin datos en el sector <strong>{sector === '__all__' ? 'Todos' : sector}</strong>. Prueba con otro filtro.
      </p>
    </div>
  );
}
