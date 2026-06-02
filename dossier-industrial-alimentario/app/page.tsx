// app/page.tsx — Dashboard principal
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';

export const dynamic = 'force-dynamic';

async function getKPIs() {
  const [companies, operations, sources, contacts, contactsVerified, inScopeSources] = await Promise.all([
    prisma.company.count(),
    prisma.operation.count(),
    prisma.source.count(),
    prisma.contact.count(),
    prisma.contact.count({ where: { emailVerified: true } }),
    prisma.source.count({ where: { deimplantationSignal: true } }),
  ]);

  // Top empresas con más operaciones
  const topEmpresas = await prisma.company.findMany({
    include: {
      _count: { select: { operations: true, contacts: true, sources: true } },
    },
    orderBy: { operations: { _count: 'desc' } },
    take: 5,
  });

  // Por sector
  const bySector = await prisma.company.groupBy({
    by: ['sector'],
    _count: true,
  });

  // Por CCAA
  const byRegion = await prisma.company.groupBy({
    by: ['region'],
    _count: true,
    orderBy: { _count: { region: 'desc' } },
  });

  return {
    companies, operations, sources, contacts, contactsVerified, inScopeSources,
    topEmpresas, bySector, byRegion,
  };
}

export default async function DashboardPage() {
  const kpis = await getKPIs();
  const base = basePath();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-6)' }}>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            Motor de inteligencia OSINT sobre desimplantaciones en grandes empresas A&amp;B en España.
            {kpis.inScopeSources} hallazgos de desimplantación detectados.
          </p>
        </header>

        {/* KPI Cards */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <KPI label="Empresas A&B" value={kpis.companies} accent="primary" hint="Grandes (top ES)" />
          <KPI label="Operaciones" value={kpis.operations} accent="warning" hint="Desimplantaciones detectadas" />
          <KPI label="Fuentes" value={kpis.sources} accent="info" hint="RSS / newsrooms / BOE" />
          <KPI label="Contactos" value={kpis.contacts} accent="success" hint={`${kpis.contactsVerified} verificados`} />
          <KPI label="En alcance" value={kpis.inScopeSources} accent="accent" hint="Marcados desimplantación" />
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-5)' }}>
          {/* Top empresas */}
          <section className="surus-card">
            <h2 className="surus-card-title">Top empresas con más movimiento</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surus-border)' }}>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Empresa</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Sector</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>CCAA</th>
                  <th style={{ textAlign: 'right', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Ops</th>
                  <th style={{ textAlign: 'right', padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Contactos</th>
                </tr>
              </thead>
              <tbody>
                {kpis.topEmpresas.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <a href={`${base}/empresas/${c.slug}`} style={{ fontWeight: 500 }}>
                        {c.name}
                      </a>
                    </td>
                    <td style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>
                      {c.subsector || c.sector}
                    </td>
                    <td style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{c.region || '—'}</td>
                    <td style={{ padding: 'var(--space-2)', textAlign: 'right' }}>{c._count.operations}</td>
                    <td style={{ padding: 'var(--space-2)', textAlign: 'right' }}>{c._count.contacts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Distribución */}
          <section className="surus-card">
            <h2 className="surus-card-title">Distribución</h2>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', marginBottom: 'var(--space-2)' }}>
                Por sector
              </h4>
              {kpis.bySector.map((s) => (
                <div
                  key={s.sector}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-1) 0' }}
                >
                  <span>{s.sector}</span>
                  <span className="surus-pill surus-pill-info">{s._count}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', marginBottom: 'var(--space-2)' }}>
                Por CCAA
              </h4>
              {kpis.byRegion.map((r) => (
                <div
                  key={r.region || 'unknown'}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-1) 0' }}
                >
                  <span style={{ fontSize: 'var(--text-sm)' }}>{r.region || '—'}</span>
                  <span className="surus-pill">{r._count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Status note */}
        <section
          className="surus-card"
          style={{ marginTop: 'var(--space-6)', background: 'var(--surus-bg)', borderStyle: 'dashed' }}
        >
          <h3 style={{ fontSize: 'var(--text-lg)', color: 'var(--surus-primary)' }}>
            Estado de Sprints
          </h3>
          <ul style={{ marginTop: 'var(--space-3)', paddingLeft: 'var(--space-5)', color: 'var(--surus-text-soft)' }}>
            <li>✅ <strong>Sprint 1</strong> — Cimientos VPS HERMES (activo): DB seed + dashboard mínimo + legacy preservado</li>
            <li>⏳ <strong>Sprint 2</strong> — Agente Newsrooms corporativos + Prensa sectorial</li>
            <li>⏳ <strong>Sprint 3</strong> — Agente Prensa general + regional/local</li>
            <li>⏳ <strong>Sprint 4</strong> — Agente BOE/BOP/sindicatos + LinkedIn OSINT + enrichment</li>
            <li>⏳ <strong>Sprint 5</strong> — Agente MOCR + UI investigativa full-text + orquestador</li>
          </ul>
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
    <div
      className="surus-card"
      style={{ borderTop: `3px solid ${colorMap[accent]}` }}
    >
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: colorMap[accent], marginTop: 'var(--space-1)' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', marginTop: 'var(--space-1)' }}>{hint}</div>}
    </div>
  );
}
