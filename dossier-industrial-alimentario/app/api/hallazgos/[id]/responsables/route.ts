// app/api/hallazgos/[id]/responsables/route.ts
//
// QW-10: dado un Source (hallazgo), devuelve los responsables asignados a SU SEDE.
// Si el Source no tiene plantId, devuelve 404 con sugerencia.
//
// Regla de negocio: "siempre las noticias vayan con los responsables de la sede".

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const source = await prisma.source.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      url: true,
      companyId: true,
      plantId: true,
      company: { select: { id: true, name: true, slug: true } },
      plant: { select: { id: true, name: true, city: true, province: true, ccaa: true } },
    },
  });
  if (!source) {
    return NextResponse.json({ success: false, error: 'source not found' }, { status: 404 });
  }
  if (!source.plantId) {
    return NextResponse.json({
      success: true,
      data: {
        source: { id: source.id, title: source.title, url: source.url, company: source.company },
        plant: null,
        contacts: [],
        summary: { total: 0, verified: 0, pending: 0 },
        note: 'El hallazgo aún no está asociado a una sede concreta. Use /buscar-responsables con la sede del hallazgo para asignar contactos.',
      },
    });
  }

  const contacts = await prisma.plantContact.findMany({
    where: { plantId: source.plantId, companyId: source.companyId ?? undefined },
    orderBy: [{ roleCategory: 'asc' }, { fullName: 'asc' }],
    take: 200,
    select: {
      id: true,
      fullName: true,
      role: true,
      roleCategory: true,
      linkedinUrl: true,
      email: true,
      emailVerified: true,
      phone: true,
      via: true,
      sourceOutlet: true,
      lastEnrichedAt: true,
      confidence: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      source: { id: source.id, title: source.title, url: source.url, company: source.company },
      plant: source.plant,
      contacts,
      summary: {
        total: contacts.length,
        verified: contacts.filter((c) => c.emailVerified).length,
        pending: contacts.filter((c) => !c.emailVerified).length,
      },
    },
  });
}
