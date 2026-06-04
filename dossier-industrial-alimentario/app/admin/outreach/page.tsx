// app/admin/outreach/page.tsx — QW-9: panel oculto de generación de correos.
//
// Server component: carga companies + roles + templates, pasa al client.
import { prisma } from '@/lib/db/prisma';
import { SECTOR_ORDER } from '@/lib/dashboard/sectors';
import { listTemplates } from '@/lib/email/render';
import { Navbar } from '@/components/Navbar';
import { OutreachClient } from './OutreachClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Outreach · HERMES Dossier',
  robots: { index: false, follow: false },
};

export default async function OutreachPage() {
  // Empresas: primero A&B, luego Construcción, resto por nombre
  const allCompanies = await prisma.company.findMany({
    select: { id: true, name: true, slug: true, sector: true, subsector: true, hqRegion: true },
    orderBy: { name: 'asc' },
  });
  const companies = allCompanies.sort((a, b) => {
    const ai = SECTOR_ORDER.indexOf(a.sector);
    const bi = SECTOR_ORDER.indexOf(b.sector);
    const an = ai === -1 ? 999 : ai;
    const bn = bi === -1 ? 999 : bi;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name);
  });

  const templates = listTemplates();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <OutreachClient companies={companies} templates={templates} />
      </main>
    </>
  );
}
