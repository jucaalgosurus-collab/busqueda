// app/api/contactos/by-company/route.ts — QW-9: contactos agrupados por empresa.
//
// Devuelve todos los PlantContact de una Company (con su planta) para alimentar
// el multiselect del panel outreach. Usado por OutreachClient.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }
    const contacts = await prisma.plantContact.findMany({
      where: { companyId },
      include: {
        plant: { select: { id: true, name: true, city: true } },
        company: { select: { id: true, name: true, sector: true } },
      },
      orderBy: [{ fullName: 'asc' }],
      take: 500,
    });
    return NextResponse.json({ contacts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
