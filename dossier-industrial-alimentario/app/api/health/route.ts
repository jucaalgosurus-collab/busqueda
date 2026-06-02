// app/api/health/route.ts — Healthcheck endpoint
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [companies, operations, sources, contacts] = await Promise.all([
      prisma.company.count(),
      prisma.operation.count(),
      prisma.source.count(),
      prisma.contact.count(),
    ]);
    return NextResponse.json({
      status: 'ok',
      version: process.env.HERMES_DOSSIER_VERSION || '0.1.0',
      timestamp: new Date().toISOString(),
      counts: { companies, operations, sources, contacts },
    });
  } catch (e) {
    return NextResponse.json(
      { status: 'error', error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
