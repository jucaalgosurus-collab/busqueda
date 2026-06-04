// app/admin/companies/[id]/page.tsx — E.10: ficha editable de empresa
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { AdminShell } from '../../_components/AdminShell';
import { CompanyEditor, type CompanyFull } from './_components/CompanyEditor';
import { PlantsEditor, type PlantRow } from './_components/PlantsEditor';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar empresa · Admin · HERMES Dossier',
  robots: { index: false, follow: false },
};

type Ctx = { params: Promise<{ id: string }> };

export default async function AdminCompanyEditPage({ params }: Ctx) {
  const { id } = await params;
  const row = await prisma.company.findUnique({
    where: { id },
    include: {
      plants: {
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, ccaa: true, province: true, city: true, address: true,
          lat: true, lng: true, status: true, specialty: true, employees: true,
          parcelaM2: true, naveM2: true, openedAt: true, closedAt: true,
          closureYear: true, investmentMEur: true, notes: true,
          isStale: true, staleReason: true,
        },
      },
      _count: { select: { plants: true, sources: true, operations: true, plantContacts: true, financials: true, notes: true, patents: true } },
    },
  });
  if (!row) {
    notFound();
    return null;
  }
  // r es row no-null. TS no propaga el narrow de notFound() en este contexto.
  const r = row;

  const company: CompanyFull = {
    id: r.id,
    slug: r.slug,
    name: r.name,
    cif: r.cif,
    sector: r.sector,
    subsector: r.subsector,
    cnae: r.cnae,
    parentGroup: r.parentGroup,
    hqCity: r.hqCity,
    hqRegion: r.hqRegion,
    website: r.website,
    logoUrl: r.logoUrl,
    heroImageUrl: r.heroImageUrl,
    facturacionM: r.facturacionM,
    facturacionYear: r.facturacionYear,
    ebitdaM: r.ebitdaM,
    beneficioNetoM: r.beneficioNetoM,
    deudaNetaM: r.deudaNetaM,
    empleadosTotal: r.empleadosTotal,
    tier: r.tier,
    status: r.status,
    priority: r.priority,
    _count: { ...r._count, contacts: r._count.plantContacts },
  };

  const plants: PlantRow[] = r.plants.map((p) => ({
    ...p,
    openedAt: p.openedAt?.toISOString() ?? null,
    closedAt: p.closedAt?.toISOString() ?? null,
  }));

  return (
    <AdminShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <CompanyEditor company={company} />
        <div className="surus-card">
          <PlantsEditor companyId={company.id} plants={plants} />
        </div>
      </div>
    </AdminShell>
  );
}
