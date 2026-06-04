// app/api/buscar-responsables/export/route.ts
// Exporta los resultados de la búsqueda de responsables a CSV (mismos criterios que /api/buscar-responsables pero sin enrichment Hunter activo).
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set([
  'plant_manager', 'coo', 'cfo', 'ceo',
  'procurement', 'sustainability', 'maintenance', 'ere_responsible', 'other',
]);

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const companyQ = (sp.get('company') ?? '').trim();
  const sedeQ = (sp.get('sede') ?? '').trim();
  const roles = (sp.get('roles') ?? '').split(',').filter((r) => ALLOWED_ROLES.has(r));
  if (!companyQ || roles.length === 0) {
    return NextResponse.json({ success: false, error: 'company and roles are required' }, { status: 400 });
  }

  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { slug: companyQ.toLowerCase() },
        { name: { contains: companyQ, mode: 'insensitive' } },
        { cif: companyQ },
      ],
    },
    select: { id: true, name: true, slug: true, website: true, subsector: true },
  });
  if (!company) {
    return NextResponse.json({ success: false, error: 'company not found' }, { status: 404 });
  }
  const plant = sedeQ
    ? await prisma.plant.findFirst({
        where: {
          companyId: company.id,
          OR: [
            { name: { contains: sedeQ, mode: 'insensitive' } },
            { city: { contains: sedeQ, mode: 'insensitive' } },
            { province: { contains: sedeQ, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, ccaa: true, city: true, province: true },
      })
    : null;

  const where: Record<string, unknown> = {
    companyId: company.id,
    roleCategory: { in: roles },
  };
  if (plant) where.plantId = plant.id;

  const contacts = await prisma.plantContact.findMany({
    where,
    include: { plant: { select: { name: true, ccaa: true, city: true, province: true } } },
    orderBy: [{ fullName: 'asc' }],
  });

  const header = ['Compañía', 'Sede', 'CCAA', 'Provincia', 'Ciudad', 'Nombre', 'Cargo', 'Categoría', 'LinkedIn', 'Email', 'Email verificado', 'Teléfono', 'Origen', 'Confianza', 'Última actualización'];
  const lines = [header.join(',')];
  for (const c of contacts) {
    lines.push([
      company.name,
      c.plant?.name ?? '',
      c.plant?.ccaa ?? '',
      c.plant?.province ?? '',
      c.plant?.city ?? '',
      c.fullName,
      c.role,
      c.roleCategory ?? '',
      c.linkedinUrl ?? '',
      c.email ?? '',
      c.emailVerified ? 'sí' : 'no',
      c.phone ?? '',
      c.via ?? c.sourceOutlet ?? '',
      c.confidence?.toString() ?? '',
      c.lastEnrichedAt?.toISOString() ?? '',
    ].map(escapeCsv).join(','));
  }
  const csv = lines.join('\n');
  const filename = `responsables-${company.slug}${plant ? `-${plant.name.toLowerCase().replace(/\s+/g, '-')}` : ''}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
