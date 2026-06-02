// app/api/mocr/route.ts — Endpoint POST /dossier/api/mocr
// Sube un documento, lo clasifica con MOCR, devuelve la evaluación.
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { classifyDocument } from '@/lib/mocr/client';

const ALLOWED_KINDS = ['nameplate', 'certificate', 'balance_sheet', 'photo'] as const;
type Kind = typeof ALLOWED_KINDS[number];

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 415 },
      );
    }
    const formData = await req.formData();
    const file = formData.get('file');
    const kind = formData.get('kind') as Kind;
    const companySlug = formData.get('companySlug') as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    if (!ALLOWED_KINDS.includes(kind)) {
      return NextResponse.json({ error: `kind must be one of ${ALLOWED_KINDS.join(',')}` }, { status: 400 });
    }

    // Guardar a /tmp para que Docling/Gemini lo lea
    const id = randomBytes(8).toString('hex');
    const ext = file.name.split('.').pop() ?? 'bin';
    const tmpDir = '/tmp/mocr-uploads';
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, `${id}.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tmpPath, buffer);

    // Resolver company
    let companyId: string | undefined;
    if (companySlug) {
      const { PrismaClient } = await import('@prisma/client');
      const p = new PrismaClient();
      const c = await p.company.findUnique({ where: { slug: companySlug } });
      companyId = c?.id;
      await p.$disconnect();
    }

    const r = await classifyDocument({ filePath: tmpPath, kind, companyId });
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    console.error('MOCR error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
