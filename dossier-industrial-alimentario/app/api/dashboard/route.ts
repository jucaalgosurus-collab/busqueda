// app/api/dashboard/route.ts — QW-6: endpoint dashboard con filtro por sector.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SECTOR_ORDER, isValidSector } from '@/lib/dashboard/sectors';

export const dynamic = 'force-dynamic';

interface DashboardResponse {
  sector: string | null;
  kpis: {
    companies: number;
    operations: number;
    sources: number;
    contacts: number;
    contactsVerified: number;
    inScopeSources: number;
  };
  topEmpresas: Array<{
    id: string;
    slug: string;
    name: string;
    sector: string;
    subsector: string | null;
    hqRegion: string | null;
    ops: number;
    contacts: number;
  }>;
  bySector: Array<{ sector: string; count: number }>;
  byRegion: Array<{ region: string; count: number }>;
}

export async function GET(req: NextRequest): Promise<NextResponse<DashboardResponse | { error: string }>> {
  const sector = req.nextUrl.searchParams.get('sector');
  const where = sector && isValidSector(sector) ? { sector } : {};

  const [companies, operations, sources, contacts, contactsVerified, inScopeSources] = await Promise.all([
    prisma.company.count({ where }),
    prisma.operation.count({ where: { company: where } }),
    prisma.source.count({ where: { company: where } }),
    prisma.plantContact.count({ where: { company: where } }),
    prisma.plantContact.count({ where: { ...where, emailVerified: true } }),
    prisma.source.count({ where: { ...where, deimplantationSignal: true } }),
  ]);

  const topEmpresasRaw = await prisma.company.findMany({
    where,
    include: {
      _count: { select: { operations: true, plantContacts: true } },
    },
    orderBy: { operations: { _count: 'desc' } },
    take: 10,
  });

  const topEmpresas = topEmpresasRaw.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    sector: c.sector,
    subsector: c.subsector,
    hqRegion: c.hqRegion,
    ops: c._count.operations,
    contacts: c._count.plantContacts,
  }));

  const bySectorRaw = await prisma.company.groupBy({
    by: ['sector'],
    _count: true,
  });
  const bySector = bySectorRaw
    .map((s) => ({ sector: s.sector, count: s._count }))
    .sort((a, b) => {
      const ai = SECTOR_ORDER.indexOf(a.sector);
      const bi = SECTOR_ORDER.indexOf(b.sector);
      const an = ai === -1 ? 999 : ai;
      const bn = bi === -1 ? 999 : bi;
      if (an !== bn) return an - bn;
      return b.count - a.count;
    });

  const byRegionRaw = await prisma.company.groupBy({
    by: ['hqRegion'],
    _count: true,
    where,
    orderBy: { _count: { hqRegion: 'desc' } },
  });
  const byRegion = byRegionRaw.map((r) => ({ region: r.hqRegion ?? '—', count: r._count }));

  return NextResponse.json({
    sector: sector && isValidSector(sector) ? sector : null,
    kpis: { companies, operations, sources, contacts, contactsVerified, inScopeSources },
    topEmpresas,
    bySector,
    byRegion,
  });
}
