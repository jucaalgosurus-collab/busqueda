// app/api/empresas/[slug]/route.ts — GET / PUT / DELETE empresa
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  subsector: z.string().min(1).optional(),
  cnae: z.string().optional().nullable(),
  hqCity: z.string().optional().nullable(),
  hqRegion: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  facturacionM: z.number().optional().nullable(),
  ebitdaM: z.number().optional().nullable(),
  beneficioNetoM: z.number().optional().nullable(),
  deudaNetaM: z.number().optional().nullable(),
  empleadosTotal: z.number().int().optional().nullable(),
  tier: z.enum(['A', 'B']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: company });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const updated = await prisma.company.update({ where: { slug }, data: parsed.data });
    return NextResponse.json({ success: true, data: updated });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Update failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  try {
    const updated = await prisma.company.update({ where: { slug }, data: { status: 'inactive' } });
    return NextResponse.json({ success: true, data: { slug: updated.slug, status: updated.status } });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
