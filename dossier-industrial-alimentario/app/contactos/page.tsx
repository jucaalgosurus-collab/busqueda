// app/contactos/page.tsx — Decisores A&B para que el depto. comercial los contacte
// v6 schema — usa PlantContact (planta + empresa) para precisión por persona + instalación
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';
import { ContactosFilter } from './ContactosFilter';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
  role?: string;
  company?: string;
  verified?: string;
  plant?: string;
};

const ROLE_CATEGORIES = [
  { value: '', label: 'Todos los roles' },
  { value: 'plant_manager', label: 'Director de Planta' },
  { value: 'coo', label: 'Director de Operaciones (COO)' },
  { value: 'cfo', label: 'Director Financiero (CFO)' },
  { value: 'ceo', label: 'Consejero Delegado (CEO)' },
  { value: 'procurement', label: 'Compras / Procurement' },
  { value: 'sustainability', label: 'Sostenibilidad' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'ere_responsible', label: 'Responsable ERE' },
  { value: 'other', label: 'Otros' },
];

export default async function ContactosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const base = basePath();

  const where: Record<string, unknown> = {};
  if (sp.q) {
    where.OR = [
      { fullName: { contains: sp.q, mode: 'insensitive' } },
      { role: { contains: sp.q, mode: 'insensitive' } },
      { email: { contains: sp.q, mode: 'insensitive' } },
    ];
  }
  if (sp.role) where.roleCategory = sp.role;
  if (sp.company) where.company = { slug: sp.company };
  if (sp.verified === '1') where.emailVerified = true;
  if (sp.plant) where.plant = { name: { contains: sp.plant, mode: 'insensitive' } };

  const [contacts, companies] = await Promise.all([
    prisma.plantContact.findMany({
      where,
      include: {
        company: { select: { slug: true, name: true, sector: true, subsector: true } },
        plant: { select: { id: true, name: true, ccaa: true, city: true, status: true } },
      },
      orderBy: [{ fullName: 'asc' }, { roleCategory: 'asc' }],
      take: 500,
    }),
    prisma.company.findMany({
      where: { status: 'active' },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalVerified = contacts.filter((c) => c.emailVerified).length;
  const exportUrl = `${base}/api/contactos/export.csv?${new URLSearchParams(sp as Record<string, string>).toString()}`;

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-display-md)', marginBottom: 'var(--space-2)' }}>Contactos</h1>
            <p style={{ color: 'var(--surus-text-soft)', maxWidth: '60ch' }}>
              <strong>{contacts.length}</strong> decisores A&amp;B mapeados · <strong style={{ color: 'var(--surus-success)' }}>{totalVerified}</strong> con email verificado.
              La herramienta NO contacta — el depto. comercial Surus les escribe/llama.
            </p>
          </div>
          <a href={exportUrl} className="surus-button" rel="nofollow">Exportar CSV</a>
        </header>

        <ContactosFilter
          roleCategories={ROLE_CATEGORIES}
          companies={companies}
          currentRole={sp.role ?? ''}
          currentCompany={sp.company ?? ''}
          currentVerified={sp.verified ?? ''}
          currentQ={sp.q ?? ''}
          currentPlant={sp.plant ?? ''}
        />

        <section className="surus-card" style={{ marginTop: 'var(--space-4)' }}>
          {contacts.length === 0 ? (
            <p style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--surus-text-soft)' }}>
              No hay contactos que coincidan con los filtros. Ajusta los criterios o ejecuta los agentes de LinkedIn.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--surus-border)' }}>
                    <th style={th}>Nombre</th>
                    <th style={th}>Cargo</th>
                    <th style={th}>Empresa</th>
                    <th style={th}>Planta</th>
                    <th style={th}>Rol</th>
                    <th style={th}>Email</th>
                    <th style={th}>LinkedIn</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                      <td style={td}>
                        <strong>{c.fullName}</strong>
                      </td>
                      <td style={td}>{c.role}</td>
                      <td style={td}>
                        <a href={`${base}/empresas/${c.company.slug}`}>{c.company.name}</a>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)' }}>{c.company.subsector}</div>
                      </td>
                      <td style={td}>
                        <div>{c.plant.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)' }}>
                          {[c.plant.city, c.plant.ccaa].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td style={td}>
                        {c.roleCategory && <span className="surus-pill surus-pill-info">{c.roleCategory}</span>}
                      </td>
                      <td style={td}>
                        {c.email ? (
                          <span>
                            {c.email}{' '}
                            {c.emailVerified && (
                              <span title="Verificado" style={{ color: 'var(--surus-success)' }}>✓</span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--surus-text-soft)' }}>—</span>
                        )}
                      </td>
                      <td style={td}>
                        {c.linkedinUrl ? (
                          <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">Ver</a>
                        ) : (
                          <span style={{ color: 'var(--surus-text-soft)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--surus-text-soft)',
  fontWeight: 600,
};

const td: React.CSSProperties = { padding: 'var(--space-3)', fontSize: 'var(--text-sm)', verticalAlign: 'top' };
