// app/api/empresas/[slug]/notes/route.ts — POST nota
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const NoteSchema = z.object({
  body: z.string().min(2).max(10_000),
  author: z.string().min(1).max(100).default('anónimo'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = NoteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
  if (!company) return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
  try {
    const note = await prisma.note.create({
      data: {
        companyId: company.id,
        body: parsed.data.body,
        author: parsed.data.author,
      },
    });
    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Create failed' },
      { status: 500 }
    );
  }
}
