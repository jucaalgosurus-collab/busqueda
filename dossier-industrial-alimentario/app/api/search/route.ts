// app/api/search/route.ts — Sprint E.8
//
// Búsqueda global para el modal ⌘K (empresas + sedes + sectores).
// Devuelve hasta 8 resultados mezclados, rankeados por:
//   - match exacto de slug (peso 100)
//   - prefijo de nombre (peso 50)
//   - contiene término (peso 10)
//   - fuzzy simple: cada palabra del query como substring independiente (peso 5)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { INDUSTRIAS } from '@/lib/industria';

export const dynamic = 'force-dynamic';

interface SearchHit {
  kind: 'empresa' | 'sede' | 'sector';
  slug?: string;
  href: string;
  title: string;
  subtitle?: string;
  score: number;
}

function score(query: string, haystack: string): number {
  const q = query.toLowerCase().trim();
  const h = haystack.toLowerCase();
  if (!q) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 50;
  if (h.includes(q)) return 10;
  // Fuzzy: cada palabra del query presente
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => h.includes(w))) return 5;
  return 0;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ success: true, data: { hits: [], query: q } });
  }

  const hits: SearchHit[] = [];

  // 1) Empresas (top 5)
  const companies = await prisma.company.findMany({
    where: {
      status: 'active',
      OR: [
        { slug: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { subsector: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, slug: true, name: true, subsector: true, sector: true },
    take: 5,
  });
  for (const c of companies) {
    const s = Math.max(score(q, c.name), score(q, c.slug) * 1.2, score(q, c.subsector ?? '') * 0.8);
    hits.push({
      kind: 'empresa',
      slug: c.slug,
      href: `/empresas/${c.slug}`,
      title: c.name,
      subtitle: c.subsector ?? c.sector ?? undefined,
      score: s,
    });
  }

  // 2) Sedes (top 5)
  const plants = await prisma.plant.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { province: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: { company: { select: { slug: true, name: true } } },
    take: 5,
  });
  for (const p of plants) {
    const s = Math.max(score(q, p.name), score(q, p.city ?? '') * 0.7, score(q, p.province ?? '') * 0.5);
    hits.push({
      kind: 'sede',
      href: `/empresas/${p.company.slug}#plant-${p.id}`,
      title: p.name,
      subtitle: `${p.company.name}${p.city ? ` · ${p.city}` : ''}${p.province ? ` · ${p.province}` : ''}`,
      score: s,
    });
  }

  // 3) Sectores (top 3) — match contra el nombre
  for (const sec of INDUSTRIAS) {
    const s = score(q, sec.label) * 1.1;
    if (s > 0) {
      hits.push({
        kind: 'sector',
        href: `/empresas?industria=${encodeURIComponent(sec.sector)}`,
        title: sec.label,
        subtitle: `Sector · ${sec.sector}`,
        score: s,
      });
    }
  }

  // Ordenar y dedup
  const top = hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return NextResponse.json({ success: true, data: { hits: top, query: q } });
}
