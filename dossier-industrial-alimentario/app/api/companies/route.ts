// app/api/companies/route.ts — GET ?q= búsqueda FTS
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) {
    const all = await prisma.company.findMany({
      where: { status: 'active' },
      select: { id: true, slug: true, name: true, sector: true, subsector: true, hqRegion: true, tier: true },
      orderBy: { name: 'asc' },
      take: 50,
    });
    return NextResponse.json({ success: true, data: all, meta: { total: all.length } });
  }
  // Búsqueda con trigram (typo-tolerant) + ILIKE fallback
  const results = await prisma.$queryRaw<{ id: string; slug: string; name: string; sector: string; subsector: string; hq_region: string | null; tier: string; rank: number }[]>`
    SELECT id, slug, name, sector, subsector, "hqRegion" as hq_region, tier,
           similarity(name, ${q}) as rank
    FROM "Company"
    WHERE name % ${q} OR name ILIKE ${`%${q}%`} OR slug ILIKE ${`%${q}%`}
    ORDER BY rank DESC
    LIMIT 25
  `;
  return NextResponse.json({ success: true, data: results, meta: { total: results.length, query: q } });
}
