// app/admin/surus/pipeline/page.tsx — Vista Kanban del pipeline comercial
// Sprint CRM.1 — Server Component carga empresas, Client Component gestiona DnD
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { PipelineBoard } from './_components/PipelineBoard';
import { PIPELINE_STAGES } from './_lib/pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Surus · Pipeline comercial' };

export default async function PipelinePage() {
  const companies = await prisma.company.findMany({
    where: { pipelineStage: { not: null } },
    select: {
      id: true,
      slug: true,
      name: true,
      sector: true,
      subsector: true,
      hqCity: true,
      hqRegion: true,
      pipelineStage: true,
      tier: true,
      facturacionM: true,
      empleadosTotal: true,
    },
    orderBy: { name: 'asc' },
  });

  // Agrupa por etapa
  const byStage = PIPELINE_STAGES.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    companies: companies
      .filter((c) => c.pipelineStage === s.id)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        sector: c.sector,
        subsector: c.subsector,
        hqCity: c.hqCity,
        tier: c.tier,
        facturacionM: c.facturacionM,
        empleadosTotal: c.empleadosTotal,
      })),
  }));

  return (
    <div className="empresa-page">
      <Navbar />
      <main
        id="main"
        style={{
          padding: 'var(--space-4) var(--space-5)',
          maxWidth: 1600,
          margin: '0 auto',
        }}
      >
        <header style={{ marginBottom: 'var(--space-4)' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>
            Pipeline comercial
          </h1>
          <p
            style={{
              color: 'var(--surus-text-soft, #64748b)',
              margin: 'var(--space-1) 0 0',
              fontSize: 'var(--text-sm)',
            }}
          >
            Arrastra tarjetas entre columnas para actualizar la etapa. Total:{' '}
            <strong>{companies.length}</strong> empresas clasificadas.
          </p>
        </header>
        <PipelineBoard initialStages={byStage} />
      </main>
    </div>
  );
}
