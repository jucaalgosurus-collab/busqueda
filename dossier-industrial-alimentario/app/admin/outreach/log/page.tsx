// app/admin/outreach/log/page.tsx — QW-9: visor de audit log del panel outreach.
//
// Muestra los últimos OutreachLog con filtros: empresa, canal, estado, fecha.
// NO se muestra en el Navbar — solo accesible por URL directa.

import { Navbar } from '@/components/Navbar';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Outreach · Log',
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  generated: 'Generado',
  copied: 'Copiado al portapapeles',
  sent_external: 'Enviado externamente',
  discarded: 'Descartado',
};

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  linkedin_dm_short: 'LinkedIn DM corto',
  linkedin_dm_long: 'LinkedIn DM largo',
  preview_only: 'Solo preview',
};

const STATUS_COLOR: Record<string, string> = {
  generated: 'var(--surus-warning)',
  copied: 'var(--surus-success)',
  sent_external: 'var(--surus-primary-500)',
  discarded: 'var(--surus-text-muted)',
};

export default async function OutreachLogPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; channel?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.companyId) where.companyId = sp.companyId;
  if (sp.channel) where.channel = sp.channel;
  if (sp.status) where.status = sp.status;

  const [logs, totalByStatus, companies] = await Promise.all([
    prisma.outreachLog.findMany({
      where,
      include: {
        company: { select: { slug: true, name: true, sector: true } },
        contact: { select: { fullName: true, role: true, plant: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.outreachLog.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.company.findMany({
      select: { id: true, name: true, slug: true },
      where: { outreachLogs: { some: {} } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of totalByStatus) counts[row.status] = row._count._all;

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--surus-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span
              style={{
                background: 'var(--surus-danger)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                marginRight: 'var(--space-2)',
              }}
            >
              OCULTO
            </span>
            Audit log
          </div>
          <h1 style={{ fontSize: 'var(--text-display-md)', marginBottom: 'var(--space-2)' }}>
            Outreach — registro de auditoría
          </h1>
          <p style={{ color: 'var(--surus-text-soft)', maxWidth: '80ch' }}>
            Cada borrador generado o copiado al portapapeles queda registrado. Trazabilidad
            legal completa: subject, body, hash SHA-256, seed determinista, modelo IA,
            decisor y empresa.
          </p>
        </header>

        <section
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-5)',
          }}
        >
          {Object.entries(counts).map(([status, n]) => (
            <div
              key={status}
              className="surus-card"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                minWidth: 180,
                borderTop: `3px solid ${STATUS_COLOR[status] ?? 'var(--surus-border)'}`,
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-soft)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {STATUS_LABEL[status] ?? status}
              </div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--surus-primary)' }}>
                {n}
              </div>
            </div>
          ))}
        </section>

        <section className="surus-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <form
            method="GET"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
              alignItems: 'end',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-soft)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Empresa
              </label>
              <select
                name="companyId"
                defaultValue={sp.companyId ?? ''}
                style={{
                  width: '100%',
                  padding: 'var(--space-1) var(--space-2)',
                  border: '1px solid var(--surus-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surus-bg)',
                }}
              >
                <option value="">Todas</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-soft)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Canal
              </label>
              <select
                name="channel"
                defaultValue={sp.channel ?? ''}
                style={{
                  width: '100%',
                  padding: 'var(--space-1) var(--space-2)',
                  border: '1px solid var(--surus-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surus-bg)',
                }}
              >
                <option value="">Todos</option>
                <option value="email">Email</option>
                <option value="linkedin_dm_short">LinkedIn DM corto</option>
                <option value="linkedin_dm_long">LinkedIn DM largo</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-soft)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Estado
              </label>
              <select
                name="status"
                defaultValue={sp.status ?? ''}
                style={{
                  width: '100%',
                  padding: 'var(--space-1) var(--space-2)',
                  border: '1px solid var(--surus-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surus-bg)',
                }}
              >
                <option value="">Todos</option>
                <option value="generated">Generado</option>
                <option value="copied">Copiado</option>
                <option value="sent_external">Enviado externamente</option>
                <option value="discarded">Descartado</option>
              </select>
            </div>
            <button
              type="submit"
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--surus-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
              }}
            >
              Filtrar
            </button>
          </form>
        </section>

        <section className="surus-card" style={{ padding: 0, overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <p
              style={{
                padding: 'var(--space-5)',
                textAlign: 'center',
                color: 'var(--surus-text-soft)',
              }}
            >
              Sin registros. Genera borradores desde /admin/outreach para empezar.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ background: 'var(--surus-bg)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-2)' }}>Fecha</th>
                    <th style={{ padding: 'var(--space-2)' }}>Empresa</th>
                    <th style={{ padding: 'var(--space-2)' }}>Decisor</th>
                    <th style={{ padding: 'var(--space-2)' }}>Canal</th>
                    <th style={{ padding: 'var(--space-2)' }}>Estado</th>
                    <th style={{ padding: 'var(--space-2)' }}>Asunto</th>
                    <th style={{ padding: 'var(--space-2)' }}>Palabras</th>
                    <th style={{ padding: 'var(--space-2)' }}>Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderTop: '1px solid var(--surus-border)' }}>
                      <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        {log.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>{log.company.name}</td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        {log.contact.fullName}
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)' }}>
                          {log.contact.role}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        {CHANNEL_LABEL[log.channel] ?? log.channel}
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: STATUS_COLOR[log.status] ?? 'var(--surus-bg)',
                            color: 'white',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                          }}
                        >
                          {STATUS_LABEL[log.status] ?? log.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-2)',
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={log.subject}
                      >
                        {log.subject || <em style={{ color: 'var(--surus-text-muted)' }}>—</em>}
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-2)',
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {log.wordCount}
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-2)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--surus-text-muted)',
                        }}
                      >
                        {log.hash.slice(0, 8)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer
          style={{
            marginTop: 'var(--space-5)',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-muted)',
            textAlign: 'center',
          }}
        >
          Mostrando últimos {logs.length} registros ·{' '}
          <a href="/admin/outreach" style={{ color: 'var(--surus-primary-500)' }}>
            Volver al panel
          </a>
        </footer>
      </main>
    </>
  );
}
