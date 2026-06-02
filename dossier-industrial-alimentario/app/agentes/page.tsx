// app/agentes/page.tsx — Estado de los 6 agentes
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export default async function AgentesPage() {
  const configs = await prisma.scanConfig.findMany({
    orderBy: { agentName: 'asc' },
  });
  const recentRuns = await prisma.searchRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
  });

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1>Agentes</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            6 agentes OSINT para detectar desimplantaciones A&amp;B. Cadencia: cada 2 días (systemd timer).
          </p>
        </header>

        <section className="surus-card" style={{ marginBottom: 'var(--space-5)' }}>
          <h2 className="surus-card-title">Configuraciones</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--surus-border)' }}>
                <th style={th}>Agente</th>
                <th style={th}>Región</th>
                <th style={th}>Cadencia</th>
                <th style={th}>Activo</th>
                <th style={th}>Última ejecución</th>
                <th style={th}>Próxima</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                  <td style={td}>
                    <code style={{ fontSize: 'var(--text-xs)' }}>{c.agentName}</code>
                  </td>
                  <td style={td}>{c.region || '—'}</td>
                  <td style={td}>cada {c.cadenceDays} días</td>
                  <td style={td}>
                    {c.isActive ? (
                      <span className="surus-pill surus-pill-success">activo</span>
                    ) : (
                      <span className="surus-pill surus-pill-warning">inactivo</span>
                    )}
                  </td>
                  <td style={td}>{c.lastRunAt ? new Date(c.lastRunAt).toLocaleString('es-ES') : '—'}</td>
                  <td style={td}>{c.nextRunAt ? new Date(c.nextRunAt).toLocaleString('es-ES') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="surus-card">
          <h2 className="surus-card-title">Últimas ejecuciones</h2>
          {recentRuns.length === 0 ? (
            <p style={{ color: 'var(--surus-text-muted)' }}>
              Sin ejecuciones todavía. Los agentes se activan en Sprints 2-4.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surus-border)' }}>
                  <th style={th}>Agente</th>
                  <th style={th}>Inicio</th>
                  <th style={th}>Found</th>
                  <th style={th}>In scope</th>
                  <th style={th}>Out of scope</th>
                  <th style={th}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                    <td style={td}><code>{r.agentName}</code></td>
                    <td style={td}>{new Date(r.startedAt).toLocaleString('es-ES')}</td>
                    <td style={td}>{r.itemsFound}</td>
                    <td style={td}>{r.itemsInScope}</td>
                    <td style={td}>{r.itemsOutOfScope}</td>
                    <td style={td}>${r.costEur.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' };
const td: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' };
