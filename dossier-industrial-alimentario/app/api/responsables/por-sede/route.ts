// app/api/responsables/por-sede/route.ts
//
// QW-10: lista TODAS las plantas de una empresa con sus responsables principales.
// Alimenta la vista "Responsables por sede" en /empresas/[slug].
//
// Inputs (query): companySlug=pescanova (o companyId)
// Output: { company, plants: [{ plant, contacts, primaryResponsable }] }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const companySlug = sp.get('companySlug')?.trim() || null;
  const companyId = sp.get('companyId')?.trim() || null;
  const plantId = sp.get('plantId')?.trim() || null;

  if (!companySlug && !companyId && !plantId) {
    return NextResponse.json({ success: false, error: 'companySlug, companyId or plantId required' }, { status: 400 });
  }

  // 1. Resolver empresa
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, slug: true, subsector: true, website: true } })
    : companySlug
      ? await prisma.company.findFirst({
          where: { OR: [{ slug: companySlug }, { name: { contains: companySlug, mode: 'insensitive' } }] },
          select: { id: true, name: true, slug: true, subsector: true, website: true },
        })
      : null;

  if (!company && !plantId) {
    return NextResponse.json({ success: false, error: 'company not found' }, { status: 404 });
  }

  // 2. Cargar plantas
  const plants = await prisma.plant.findMany({
    where: {
      ...(plantId ? { id: plantId } : { companyId: company!.id }),
    },
    orderBy: [{ ccaa: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      city: true,
      province: true,
      ccaa: true,
      status: true,
      specialty: true,
      employees: true,
    },
  });

  // 3. Para cada planta, cargar contactos
  const plantIds = plants.map((p) => p.id);
  const allContacts = plantIds.length
    ? await prisma.plantContact.findMany({
        where: { plantId: { in: plantIds } },
        orderBy: [{ fullName: 'asc' }],
        take: 500,
        select: {
          id: true,
          plantId: true,
          fullName: true,
          role: true,
          roleCategory: true,
          linkedinUrl: true,
          email: true,
          emailVerified: true,
          phone: true,
          via: true,
          sourceOutlet: true,
          confidence: true,
        },
      })
    : [];

  // 4. Agrupar por planta + identificar primaryResponsable (plant_manager verificado, o primero de mayor confianza)
  const result = plants.map((p) => {
    const cts = allContacts.filter((c) => c.plantId === p.id);
    const pm = cts.find((c) => c.roleCategory === 'plant_manager' && c.emailVerified)
      ?? cts.find((c) => c.roleCategory === 'plant_manager')
      ?? cts.sort((a, b) => (b.emailVerified ? 1 : 0) - (a.emailVerified ? 1 : 0) || b.confidence - a.confidence)[0]
      ?? null;
    return {
      plant: p,
      contacts: cts,
      primaryResponsable: pm,
      summary: {
        total: cts.length,
        verified: cts.filter((c) => c.emailVerified).length,
        withLinkedin: cts.filter((c) => c.linkedinUrl).length,
      },
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      company: company ?? null,
      plants: result,
      totals: {
        plants: plants.length,
        contacts: allContacts.length,
        verified: allContacts.filter((c) => c.emailVerified).length,
      },
    },
  });
}
