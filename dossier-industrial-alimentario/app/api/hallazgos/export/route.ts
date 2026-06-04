// app/api/hallazgos/export/route.ts — Export hallazgos filtrados a CSV
// E.6: añade columnas sede + city, soporta filtro sede + sort.
import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where: Record<string, unknown> = {};
  if (sp.get('signal') === 'in') where.deimplantationSignal = true;
  if (sp.get('signal') === 'out') where.deimplantationSignal = false;
  if (sp.get('stale') === '1') where.isStale = true;
  if (sp.get('stale') === '0') where.isStale = false;
  const companyFilter: Record<string, unknown> = {};
  if (sp.get('ccaa')) companyFilter.hqRegion = sp.get('ccaa');
  if (sp.get('industria')) companyFilter.sector = sp.get('industria');
  if (sp.get('tamano') === 'grandes') {
    companyFilter.OR = [
      { facturacionM: { gte: 50 } },
      { empleadosTotal: { gte: 250 } },
      { tier: { in: ['A', 'B'] } },
    ];
  }
  if (Object.keys(companyFilter).length > 0) where.company = companyFilter;
  const sede = sp.get('sede');
  if (sede && sede.trim().length > 0) {
    where.plant = { name: { contains: sede, mode: 'insensitive' } };
  }
  const q = sp.get('q');
  if (q && q.trim().length > 0) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { outlet: { contains: q, mode: 'insensitive' } },
    ];
  }

  // E.6: mismo orderBy que la página.
  const sort = sp.get('sort');
  const orderBy: { publishedAt: 'asc' | 'desc' } | { company: { name: 'asc' } } | { plant: { name: 'asc' } } = (() => {
    if (sort === 'fecha_asc') return { publishedAt: 'asc' };
    if (sort === 'empresa') return { company: { name: 'asc' } };
    if (sort === 'sede') return { plant: { name: 'asc' } };
    return { publishedAt: 'desc' };
  })();

  const sources = await prisma.source.findMany({
    where,
    include: {
      company: { select: { name: true, hqRegion: true, hqCity: true, sector: true } },
      plant: { select: { name: true, city: true, ccaa: true } },
    },
    orderBy,
    take: 1000,
  });

  const header = [
    'published_at',
    'title',
    'outlet',
    'outlet_type',
    'url',
    'deimplantation_signal',
    'out_of_scope_reason',
    'sector',
    'hq_region',
    'hq_city',
    'company',
    'plant',
    'plant_city',
    'is_stale',
  ];

  const rows = sources.map((s) => [
    s.publishedAt ? new Date(s.publishedAt).toISOString() : '',
    s.title,
    s.outlet,
    s.outletType,
    s.url,
    s.deimplantationSignal ? '1' : '0',
    s.outOfScopeReason || '',
    s.company?.sector || '',
    s.company?.hqRegion || '',
    s.company?.hqCity || '',
    s.company?.name || '',
    s.plant?.name || '',
    s.plant?.city || '',
    s.isStale ? '1' : '0',
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map(escapeCsv).join(','))
    .join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hallazgos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
