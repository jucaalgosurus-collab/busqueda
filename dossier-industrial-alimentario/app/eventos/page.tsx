// app/eventos/page.tsx — Calendario de eventos próximos
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export default async function EventosPage() {
  const events = await prisma.timelineEvent.findMany({
    orderBy: { date: 'asc' },
  });

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1>Eventos</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            Huelgas, EREs, audiencias, anuncios de cierre, plazos regulatorios.
          </p>
        </header>

        <section className="surus-card">
          {events.length === 0 ? (
            <p style={{ color: 'var(--surus-text-muted)' }}>
              Sin eventos próximos. Los eventos se generan automáticamente al detectar un ERE / cierre / audiencia con fecha.
            </p>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {events.map((e) => (
                <li
                  key={e.id}
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--surus-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{e.title}</strong>
                    <span className="surus-pill surus-pill-info">{e.operationId ? 'operación' : 'evento'}</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', marginTop: 'var(--space-1)' }}>
                    {new Date(e.date).toLocaleString('es-ES')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
