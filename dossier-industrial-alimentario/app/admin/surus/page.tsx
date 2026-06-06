// app/admin/surus/page.tsx — Panel interno Surus (oculto por URL)
// Sprint HIDDEN-1 — Solo accesible vía trigger discreto. Sin auth: despliegue interno.
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Surus · Panel interno' };

async function loadStats() {
  const [companies, contacts, events, operations] = await Promise.all([
    prisma.company.count({ where: { status: 'active' } }),
    prisma.plantContact.count(),
    prisma.timelineEvent.count(),
    prisma.operation.count(),
  ]);
  return { companies, contacts, events, operations };
}

const ANCLAJES = [
  { name: 'Surus · Comercial', email: 'comercial@surusinversa.es' },
  { name: 'Surus · M&A', email: 'ma@surusinversa.es' },
  { name: 'Surus · Dirección', email: 'direccion@surusinversa.es' },
];

export default async function SurusAdminPage() {
  const stats = await loadStats();
  return (
    <div className="empresa-page">
      <Navbar />
      <main
        id="main"
        style={{
          padding: 'var(--space-5)',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Panel interno Surus</h1>
          <p
            style={{
              color: 'var(--surus-text-soft, #64748b)',
              marginTop: 'var(--space-2)',
            }}
          >
            Herramientas de operación. No enlazado en navegación pública.
          </p>
        </header>

        <section
          aria-label="Resumen base de datos"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <KpiCard label="Empresas activas" value={stats.companies} />
          <KpiCard label="Contactos" value={stats.contacts} />
          <KpiCard label="Eventos" value={stats.events} />
          <KpiCard label="Operaciones" value={stats.operations} />
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <Card title="Anclajes correo Surus" subtitle="R-10 — distribución de leads">
            <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
              {ANCLAJES.map((a) => (
                <li key={a.email} style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>{a.name}</strong>
                  <br />
                  <a
                    href={`mailto:${a.email}`}
                    style={{ color: 'var(--surus-accent, #0ea5e9)' }}
                  >
                    {a.email}
                  </a>
                </li>
              ))}
            </ul>
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--surus-text-soft, #64748b)',
                marginTop: 'var(--space-3)',
              }}
            >
              Regla R-10: cada lead enriquecido reparte copia a estos 3 buzones.
            </p>
          </Card>

          <Card title="Pipeline comercial" subtitle="CRM.1 — Kanban con drag&drop">
            <p style={{ margin: 0, color: 'var(--surus-text-soft, #64748b)' }}>
              Vista Kanban de leads por estado (nuevo → cualificado → propuesta → negociación → cerrado).
              Arrastra tarjetas entre columnas.
            </p>
            <a
              href="/admin/surus/pipeline"
              style={{
                display: 'inline-block',
                marginTop: 'var(--space-3)',
                color: 'var(--surus-accent, #0ea5e9)',
              }}
            >
              Ir al pipeline →
            </a>
          </Card>

          <Card title="Listado de empresas" subtitle="Acceso directo">
            <p style={{ margin: 0, color: 'var(--surus-text-soft, #64748b)' }}>
              Vista completa de empresas A&B y resto de sectores con filtros avanzados.
            </p>
            <a
              href="/empresas"
              style={{
                display: 'inline-block',
                marginTop: 'var(--space-3)',
                color: 'var(--surus-accent, #0ea5e9)',
              }}
            >
              Ir a /empresas →
            </a>
          </Card>

          <Card title="Memo rápido" subtitle="Anotaciones internas">
            <p style={{ margin: 0, color: 'var(--surus-text-soft, #64748b)' }}>
              Bloc de notas efímero (no persistido) para que dejes cosas a medias
              durante una sesión de prospecting.
            </p>
            <textarea
              placeholder="Escribe aquí…"
              rows={4}
              style={{
                width: '100%',
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--surus-border, #e2e8f0)',
                borderRadius: 4,
                resize: 'vertical',
              }}
            />
          </Card>
        </div>
      </main>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--surus-surface, #f8fafc)',
        border: '1px solid var(--surus-border, #e2e8f0)',
        borderRadius: 'var(--radius-md, 6px)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--surus-text-soft, #64748b)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          marginTop: 'var(--space-1)',
        }}
      >
        {value.toLocaleString('es-ES')}
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      style={{
        padding: 'var(--space-4)',
        background: 'var(--surus-surface, #f8fafc)',
        border: '1px solid var(--surus-border, #e2e8f0)',
        borderRadius: 'var(--radius-md, 6px)',
      }}
    >
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{title}</h2>
        {subtitle && (
          <p
            style={{
              margin: 'var(--space-1) 0 0',
              fontSize: 'var(--text-xs)',
              color: 'var(--surus-text-soft, #64748b)',
            }}
          >
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </article>
  );
}
