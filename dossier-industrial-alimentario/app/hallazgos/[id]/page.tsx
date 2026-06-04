// app/hallazgos/[id]/page.tsx
// QW-10: detalle de un hallazgo. Muestra la noticia + los responsables de LA SEDE donde ocurrió.
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const s = await prisma.source.findUnique({ where: { id }, select: { title: true } });
  return { title: s ? `${s.title} — Hallazgo` : 'Hallazgo' };
}

export default async function HallazgoPage({ params }: Props) {
  const { id } = await params;
  const source = await prisma.source.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, slug: true } },
      plant: { select: { id: true, name: true, city: true, province: true, ccaa: true } },
    },
  });
  if (!source) notFound();

  // Responsables de la sede del hallazgo (si hay)
  const contacts = source.plantId
    ? await prisma.plantContact.findMany({
        where: { plantId: source.plantId, companyId: source.companyId ?? undefined },
        orderBy: [{ roleCategory: 'asc' }, { fullName: 'asc' }],
        take: 100,
        select: {
          id: true, fullName: true, role: true, roleCategory: true,
          linkedinUrl: true, email: true, emailVerified: true, phone: true,
          sourceOutlet: true, confidence: true,
        },
      })
    : [];

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)', display: 'grid', gap: 'var(--space-5)' }}>
        <header>
          <a href="javascript:history.back()" style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-muted)' }}>
            ← Volver
          </a>
          <h1 style={{ fontSize: 'var(--text-display-sm)', margin: 'var(--space-2) 0' }}>
            {source.title}
          </h1>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', flexWrap: 'wrap' }}>
            <span><strong>{source.outlet}</strong></span>
            {source.publishedAt && <span>{new Date(source.publishedAt).toLocaleDateString('es-ES')}</span>}
            {source.company && <span>· {source.company.name}</span>}
            {source.plant && <span>· <strong style={{ color: 'var(--surus-accent)' }}>{source.plant.name}</strong> ({source.plant.city ?? source.plant.province})</span>}
          </div>
        </header>

        <article style={{
          background: 'var(--surus-surface)',
          border: '1px solid var(--surus-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}>
          {source.contentText ? (
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 'var(--text-base)' }}>
              {source.contentText.slice(0, 2000)}{source.contentText.length > 2000 ? '…' : ''}
            </p>
          ) : (
            <p style={{ color: 'var(--surus-text-muted)', fontStyle: 'italic' }}>Sin contenido extraído.</p>
          )}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--surus-accent)' }}>
              Fuente original →
            </a>
          </div>
        </article>

        <section style={{
          background: 'var(--surus-surface)',
          border: '1px solid var(--surus-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 var(--space-3)' }}>
            Responsables de {source.plant ? `la sede de ${source.plant.name}` : 'esta empresa'}
          </h2>

          {!source.plantId ? (
            <p style={{ color: 'var(--surus-text-muted)', fontSize: 'var(--text-sm)' }}>
              El hallazgo aún no está asociado a una sede concreta.
              {source.company && (
                <>
                  {' '}
                  <a
                    href={`/buscar-responsables?company=${source.company.slug ?? source.company.name}`}
                    style={{ color: 'var(--surus-accent)' }}
                  >
                    Buscar responsables por sede →
                  </a>
                </>
              )}
            </p>
          ) : contacts.length === 0 ? (
            <p style={{ color: 'var(--surus-text-muted)', fontSize: 'var(--text-sm)' }}>
              La sede está identificada pero aún no tiene contactos asignados.
              {source.company && (
                <>
                  {' '}
                  <a
                    href={`/buscar-responsables?company=${source.company.slug ?? source.company.name}&sede=${source.plant?.name ?? ''}`}
                    style={{ color: 'var(--surus-accent)' }}
                  >
                    Buscar ahora →
                  </a>
                </>
              )}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
              {contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--surus-bg-elev)',
                    border: '1px solid var(--surus-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{c.fullName}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>{c.role}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: c.emailVerified ? '#1b5e20' : 'var(--surus-text-muted)',
                          background: 'var(--surus-bg)',
                          border: '1px solid var(--surus-border)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          textDecoration: 'none',
                        }}
                        title={c.emailVerified ? 'Email verificado' : 'Email sin verificar'}
                      >
                        {c.emailVerified ? '✓ ' : '⚠ '}{c.email}
                      </a>
                    )}
                    {c.linkedinUrl && (
                      <a
                        href={c.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: '#0a66c2',
                          background: 'var(--surus-bg)',
                          border: '1px solid var(--surus-border)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          textDecoration: 'none',
                        }}
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
