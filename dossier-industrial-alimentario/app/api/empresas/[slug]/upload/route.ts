// app/api/empresas/[slug]/upload/route.ts — POST multipart (PDFs/images)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
  if (!company) return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'file missing' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: 'File too large (>25MB)' }, { status: 413 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ success: false, error: `Unsupported type: ${file.type}` }, { status: 415 });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'upload.bin';
  const dir = join(process.cwd(), 'data', 'uploads', slug);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const ts = Date.now();
  const storedName = `${ts}-${safeName}`;
  const fullPath = join(dir, storedName);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const kind = file.type === 'application/pdf' ? 'pdf' : 'photo';
  const fileUrl = `/data/uploads/${slug}/${storedName}`;
  try {
    const doc = await prisma.document.create({
      data: {
        companyId: company.id,
        kind,
        fileUrl,
        fileName: safeName,
        fileSize: file.size,
        mimeType: file.type || null,
        uploadedBy: 'anon',
      },
    });
    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'DB failed' },
      { status: 500 }
    );
  }
}
