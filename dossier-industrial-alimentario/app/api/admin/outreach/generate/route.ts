// app/api/admin/outreach/generate/route.ts — QW-9: endpoint de generación.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateAllVariants, type EmailDraft } from '@/lib/ia/email-generator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      companyId: string;
      contactIds: string[];
      templateId?: string;
      regenerate?: boolean;
    };
    if (!body.companyId || !Array.isArray(body.contactIds) || body.contactIds.length === 0) {
      return NextResponse.json({ error: 'companyId + contactIds requeridos' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY ?? '';

    const company = await prisma.company.findUnique({ where: { id: body.companyId } });
    if (!company) return NextResponse.json({ error: 'company no encontrada' }, { status: 404 });

    const contacts = await prisma.plantContact.findMany({
      where: { id: { in: body.contactIds } },
      include: { plant: { select: { name: true, city: true } } },
    });

    const draftsByContact: Array<{
      contactId: string;
      drafts: EmailDraft[];
      logs: string[];
      painPoints: Array<{ date: string; title: string; outlet: string; signalStrength: string; url: string }>;
    }> = [];

    for (const c of contacts) {
      try {
        const drafts = await generateAllVariants({
          company: { id: company.id, name: company.name, slug: company.slug, sector: company.sector, subsector: company.subsector },
          contact: {
            id: c.id,
            fullName: c.fullName,
            role: c.role,
            roleCategory: c.roleCategory,
            email: c.email,
            linkedinUrl: c.linkedinUrl,
            plant: c.plant ? { name: c.plant.name, city: c.plant.city } : null,
          },
          templateId: body.templateId,
          apiKey,
        });

        // Pain points (mismo set para todas las variantes del mismo decisor)
        const painPoints = drafts[0]?.painPoints ?? [];

        // Persistir OutreachLog (1 row por canal)
        const logIds: string[] = [];
        for (const d of drafts) {
          const log = await prisma.outreachLog.create({
            data: {
              companyId: company.id,
              contactId: c.id,
              channel: d.channel,
              subject: d.subject.slice(0, 500),
              body: d.body,
              status: 'generated',
              hash: d.hash,
              seed: d.seed,
              model: d.model,
              painPointCount: d.painPoints.length,
              wordCount: d.wordCount,
            },
          });
          logIds.push(log.id);
        }
        draftsByContact.push({ contactId: c.id, drafts, logs: logIds, painPoints });
      } catch (e) {
        draftsByContact.push({ contactId: c.id, drafts: [], logs: [], painPoints: [] });
        console.warn(`[outreach] contact ${c.id} failed: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ success: true, drafts: draftsByContact });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
