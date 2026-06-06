// app/api/admin/surus/pipeline/[companyId]/route.ts — Actualiza pipelineStage
// Sprint CRM.1 — PATCH endpoint con validación de etapa
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { PIPELINE_STAGES } from '@/app/admin/surus/pipeline/_lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STAGES = new Set(PIPELINE_STAGES.map((s) => s.id));

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const stage = (body as { stage?: unknown })?.stage;
  if (typeof stage !== 'string' || !VALID_STAGES.has(stage as never)) {
    return NextResponse.json(
      { error: 'invalid stage', allowed: [...VALID_STAGES] },
      { status: 400 }
    );
  }
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { pipelineStage: stage },
    select: { id: true, pipelineStage: true },
  });
  return NextResponse.json({ ok: true, company: updated });
}
