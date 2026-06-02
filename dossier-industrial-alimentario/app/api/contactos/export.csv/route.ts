// app/api/contactos/export.csv/route.ts — Exporta contactos a CSV
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const contacts = await prisma.contact.findMany({
    include: { currentCompany: true },
    orderBy: { fullName: 'asc' },
  });

  const rows = [
    [
      'full_name', 'current_role', 'company', 'sector', 'region',
      'role_relevance', 'linkedin_url', 'email', 'email_verified',
      'phone', 'last_enriched_at',
    ],
    ...contacts.map((c) => [
      c.fullName, c.currentRole || '', c.currentCompany?.name || '',
      c.currentCompany?.sector || '', c.currentCompany?.region || '',
      c.roleRelevance || '', c.linkedinUrl || '', c.email || '',
      c.emailVerified ? 'true' : 'false', c.phone || '',
      c.lastEnrichedAt ? new Date(c.lastEnrichedAt).toISOString() : '',
    ]),
  ];

  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contactos-hermes-dossier-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
