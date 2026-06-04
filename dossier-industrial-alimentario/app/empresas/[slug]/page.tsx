// app/empresas/[slug]/page.tsx — Ficha de empresa brutalmente atractiva
// v6 schema — Server Component. Una sola query, todo el árbol relacionado.
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { Hero } from './_components/Hero';
import { KpiBento } from './_components/KpiBento';
import { PlantMap } from './_components/PlantMap';
import { InventoryTable } from './_components/InventoryTable';
import { OperationsTimeline } from './_components/OperationsTimeline';
import { FinancialChart } from './_components/FinancialChart';
import { AuctionGrid } from './_components/AuctionGrid';
import { ContactsByPlant } from './_components/ContactsByPlant';
import { ResponsablesPorSedeCard } from './_components/ResponsablesPorSedeCard';
import { SourcesList } from './_components/SourcesList';
import { DocumentsGrid } from './_components/DocumentsGrid';
import { NotesEditor } from './_components/NotesEditor';
import { ActionBar } from './_components/ActionBar';
import './empresa.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const c = await prisma.company.findUnique({
    where: { slug },
    select: { name: true, subsector: true },
  });
  if (!c) return { title: 'Empresa no encontrada' };
  return {
    title: `${c.name} — Dossier Industrial`,
    description: `Dossier OSINT de ${c.name}${c.subsector ? ` (${c.subsector})` : ''}: plantas, desimplantaciones, contactos y subastas verificadas.`,
  };
}

export default async function EmpresaPage({ params }: PageProps) {
  const { slug } = await params;
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      plants: {
        orderBy: { name: 'asc' },
        include: {
          inventory: { orderBy: { category: 'asc' } },
          contacts: { orderBy: { fullName: 'asc' } },
          events: {
            orderBy: { date: 'desc' },
            include: { plant: { select: { name: true, id: true } } },
          },
        },
      },
      operations: {
        orderBy: { announcedAt: 'desc' },
        include: { plant: { select: { name: true, id: true } } },
      },
      financials: { orderBy: { year: 'asc' } },
      sources: { orderBy: { publishedAt: 'desc' } },
      auctionChecks: { orderBy: { checkedAt: 'desc' } },
      notes: { orderBy: { createdAt: 'desc' } },
      documents: {
        orderBy: { uploadedAt: 'desc' },
        include: { evaluations: true },
      },
      plantContacts: true,
    },
  });

  if (!company) notFound();

  // Vecinos para navegación prev/next (alfabético, solo activas)
  const neighbors = await prisma.company.findMany({
    where: { status: 'active' },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  const currentIdx = neighbors.findIndex((c) => c.slug === company.slug);
  const prevSlug = currentIdx > 0 ? neighbors[currentIdx - 1]?.slug : null;
  const nextSlug = currentIdx >= 0 && currentIdx < neighbors.length - 1 ? neighbors[currentIdx + 1]?.slug : null;

  const allEvents = company.plants.flatMap((p) => p.events);

  // QW-10: bloques de responsables por sede con primaryResponsable destacado
  const plantBlocks = company.plants.map((p) => {
    const cts = p.contacts;
    const pm = cts.find((c) => c.roleCategory === 'plant_manager' && c.emailVerified)
      ?? cts.find((c) => c.roleCategory === 'plant_manager')
      ?? cts.sort((a, b) => (b.emailVerified ? 1 : 0) - (a.emailVerified ? 1 : 0) || b.confidence - a.confidence)[0]
      ?? null;
    return {
      plant: {
        id: p.id,
        name: p.name,
        city: p.city,
        province: p.province,
        ccaa: p.ccaa,
        status: p.status,
        specialty: p.specialty,
        // B.8 — planta stale
        isStale: p.isStale,
        staleReason: p.staleReason,
        staleAt: p.staleAt,
      },
      primaryResponsable: pm
        ? {
            id: pm.id,
            fullName: pm.fullName,
            role: pm.role,
            roleCategory: pm.roleCategory,
            linkedinUrl: pm.linkedinUrl,
            email: pm.email,
            emailVerified: pm.emailVerified,
            phone: pm.phone,
            sourceOutlet: pm.sourceOutlet,
          }
        : null,
      contacts: cts.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        role: c.role,
        roleCategory: c.roleCategory,
        linkedinUrl: c.linkedinUrl,
        email: c.email,
        emailVerified: c.emailVerified,
        phone: c.phone,
        sourceOutlet: c.sourceOutlet,
      })),
      summary: {
        total: cts.length,
        verified: cts.filter((c) => c.emailVerified).length,
        withLinkedin: cts.filter((c) => c.linkedinUrl).length,
      },
    };
  });

  return (
    <div className="empresa-page">
      <Navbar />
      <Hero
        company={company}
        plantCount={company.plants.length}
        contactCount={company.plantContacts.length}
        operationCount={company.operations.length}
      />
      <ActionBar
        slug={company.slug}
        companyName={company.name}
        prevSlug={prevSlug}
        nextSlug={nextSlug}
        contactCount={company.plantContacts.length}
        sourceCount={company.sources.length}
        operationCount={company.operations.length}
      />
      <main id="main">
        <KpiBento company={company} />
        <PlantMap plants={company.plants} slug={company.slug} />
        <InventoryTable plants={company.plants} />
        <OperationsTimeline operations={company.operations} events={allEvents} />
        <FinancialChart financials={company.financials} />
        <AuctionGrid checks={company.auctionChecks} />
        <ResponsablesPorSedeCard companySlug={company.slug} plants={plantBlocks} basePath={''} />
        <ContactsByPlant plants={company.plants} />
        <SourcesList sources={company.sources} />
        <DocumentsGrid documents={company.documents} />
        <NotesEditor slug={company.slug} notes={company.notes} />
      </main>
    </div>
  );
}
