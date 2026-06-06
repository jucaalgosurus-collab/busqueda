// app/api/empresas/[slug]/deep-dive/route.ts — Genera análisis IA de empresa
// Sprint UI.2 — Deep Dive con DeepSeek primary → Gemini fallback
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getOrchestrator } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Eres un analista OSINT industrial especializado en desimplantaciones empresariales en España.
Genera un resumen ejecutivo de la empresa en 4 secciones:
1. TRAYECTORIA: hitos relevantes (cierres, ERE, compras)
2. PLANTAS: estado y número de sedes operativas
3. RIESGO: señales tempranas de desimplantación
4. CONTACTO: relevancia para Surus Inversa (asesoría desimplantación circular)

Tono: profesional, conciso, basado solo en datos. Sin especulación.`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      plants: { select: { name: true, ccaa: true, status: true } },
      operations: {
        orderBy: { announcedAt: 'desc' },
        take: 10,
        select: { type: true, announcedAt: true, description: true, title: true },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'company not found' }, { status: 404 });
  }

  const prompt = `Analiza esta empresa española:

Nombre: ${company.name}
CIF: ${company.cif ?? 'N/D'}
CNAE: ${company.cnae ?? 'N/D'}
Subsector: ${company.subsector ?? 'N/D'}
Plantas (${company.plants.length}): ${company.plants.map((p) => `${p.name} (${p.ccaa ?? 'sin CCAA'}, ${p.status ?? 'sin estado'})`).join('; ')}
Operaciones recientes (${company.operations.length}): ${company.operations.map((o) => `${o.type} - ${o.title} (${o.announcedAt?.toISOString().slice(0, 10) ?? 'sin fecha'}): ${o.description?.slice(0, 120) ?? ''}`).join(' | ')}`;

  try {
    const orch = getOrchestrator();
    const result = await orch.complete({
      prompt,
      systemContext: SYSTEM_PROMPT,
      maxTokens: 800,
      temperature: 0.3,
      grounding: true,
    });
    return NextResponse.json({
      company: { slug: company.slug, name: company.name },
      analysis: result.text,
      provider: result.provider,
      model: result.model,
      grounded: result.grounded,
      sources: result.sources ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'analysis failed', detail: message },
      { status: 502 }
    );
  }
}
