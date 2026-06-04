// app/api/admin/outreach/copied/route.ts — QW-9: tracking de copia al portapapeles.
//
// Cuando el operador pulsa "Copiar" en un borrador, registramos el evento
// para trazabilidad: el OutreachLog más reciente con ese hash pasa a
// status='copied' (sin envío SMTP — solo auditoría).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { hash?: string };
    if (!body.hash) {
      return NextResponse.json({ error: 'hash requerido' }, { status: 400 });
    }
    // Buscar el log más reciente con ese hash y marcarlo como copied.
    // best-effort: si no existe, ignorar.
    const log = await prisma.outreachLog.findFirst({
      where: { hash: body.hash },
      orderBy: { createdAt: 'desc' },
    });
    if (log) {
      await prisma.outreachLog.update({
        where: { id: log.id },
        data: { status: 'copied' },
      });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
