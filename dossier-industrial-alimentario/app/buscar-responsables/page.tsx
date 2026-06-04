// app/buscar-responsables/page.tsx — Pestaña dedicada: compañía + sede → responsables
// Cruzando SIEMPRE LinkedIn + Hunter.io para los que tengan linkedinUrl sin email verificado.
import { Navbar } from '@/components/Navbar';
import { prisma } from '@/lib/db/prisma';
import { basePath } from '@/lib/utils/base-path';
import { BuscarResponsablesForm } from './BuscarResponsablesForm';

export const dynamic = 'force-dynamic';

const ALL_ROLES = [
  { value: 'plant_manager', label: 'Director de Planta' },
  { value: 'coo', label: 'Director de Operaciones (COO)' },
  { value: 'cfo', label: 'Director Financiero (CFO)' },
  { value: 'ceo', label: 'Consejero Delegado (CEO)' },
  { value: 'procurement', label: 'Compras / Procurement' },
  { value: 'sustainability', label: 'Sostenibilidad' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'ere_responsible', label: 'Responsable ERE' },
  { value: 'other', label: 'Otros (Ingeniería, Medio Ambiente, etc.)' },
];

export default async function BuscarResponsablesPage({ searchParams }: { searchParams: Promise<{ company?: string; sede?: string; roles?: string }> }) {
  const sp = await searchParams;
  const base = basePath();
  const companies = await prisma.company.findMany({
    where: { status: 'active' },
    select: { slug: true, name: true, subsector: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ fontSize: 'var(--text-display-md)', marginBottom: 'var(--space-2)' }}>
            Buscar responsables
          </h1>
          <p style={{ color: 'var(--surus-text-soft)', maxWidth: '70ch' }}>
            Introduce <strong>compañía</strong> y <strong>sede</strong>; cruza <strong>LinkedIn</strong> con <strong>Hunter.io</strong> para
            cada uno de los 16 perfiles tipo (Mantenimiento, Operaciones, Ingeniería, Contabilidad,
            Finanzas, Sostenibilidad, Medio Ambiente, Direcciones). El depto. comercial Surus recibe
            los emails verificados para outreach.
          </p>
        </header>

        <BuscarResponsablesForm
          companies={companies}
          allRoles={ALL_ROLES}
          defaultCompany={sp.company ?? ''}
          defaultSede={sp.sede ?? ''}
          defaultRoles={sp.roles ? sp.roles.split(',') : ['plant_manager', 'coo', 'cfo', 'maintenance', 'sustainability', 'procurement', 'other']}
          basePath={base}
        />
      </main>
    </>
  );
}
