// lib/filters/ejecuciones-singulares.ts
// B.4 — Detecta tensión financiera pre-concursal en BORME/BOE/BOP.
// Señal amarilla fuerte: ejecución hipotecaria + embargo en 90d, sin concurso declarado.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EjecMatch {
  raw: string;
  start: number;
  end: number;
  kind: 'ejecucion_hipotecaria' | 'embargo' | 'subasta_judicial' | 'demanda_civil';
  expediente?: string;
}

export interface TensionMatch {
  companyId: string;
  companyName: string;
  periodStart: Date;
  periodEnd: Date;
  ejecuciones: EjecMatch[];
  embargos: EjecMatch[];
  subastas: EjecMatch[];
  demandas: EjecMatch[];
  countEjecuciones: number;
  countEmbargos: number;
  countTotal: number;
  isTension: boolean;
  reason: string;
}

export interface TensionGroupResult {
  matches: TensionMatch[];
  sourcesScanned: number;
  sourcesWithMatches: number;
  durationMs: number;
}

// Regex robustos para BORME/BOE reales
const EJECUCION_RE = /\bEjec(?:\.|u(?:ci[oó]n))?\s*\.?\s*Hipot(?:\.|ecaria)?\.?\b|Ejecuci[oó]n\s+Hipotecaria\b/gi;
const EMBARGO_RE = /\bEmbargo\b|Anotaci[oó]n\s+preventiva\s+de\s+embargo\b/gi;
const SUBASTA_RE = /\bSubasta\s+(?:judicial|notarial)\b/gi;
const DEMANDA_RE = /\bDemanda\s+(?:de\s+)?(?:juicio\s+)?verbal\b|Reclamaci[oó]n\s+de\s+cantidad\b|Juicio\s+ordinario\b/gi;
const EXPEDIENTE_RE = /\b(\d{1,4}\/\d{4})\b/;

const CONCURSO_KEYWORDS = [
  'concurso de acreedores',
  'concurso voluntario',
  'concurso necesario',
  'liquidaci[oó]n concursal',
  'quita y espera',
  'suspensi[oó]n de pagos',
  'declaraci[oó]n de concurso',
  'auto de concurso',
  'administraci[oó]n concursal',
];

const CONCURSO_RE = new RegExp('\\b(' + CONCURSO_KEYWORDS.join('|') + ')\\b', 'i');

function findMatches(text: string, regex: RegExp, kind: EjecMatch['kind']): EjecMatch[] {
  const out: EjecMatch[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const r = new RegExp(regex.source, regex.flags);
  while ((m = r.exec(text)) !== null) {
    const key = `${m.index}:${m[0].toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const expMatch = text.slice(Math.max(0, m.index - 80), m.index + 200).match(EXPEDIENTE_RE);
    out.push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      kind,
      expediente: expMatch?.[1],
    });
  }
  return out;
}

export function containsConcursoKeyword(text: string): boolean {
  return CONCURSO_RE.test(text);
}

export function extractEjecuciones(text: string): EjecMatch[] {
  return findMatches(text, EJECUCION_RE, 'ejecucion_hipotecaria');
}

export function extractEmbargos(text: string): EjecMatch[] {
  return findMatches(text, EMBARGO_RE, 'embargo');
}

export function extractSubastas(text: string): EjecMatch[] {
  return findMatches(text, SUBASTA_RE, 'subasta_judicial');
}

export function extractDemandas(text: string): EjecMatch[] {
  return findMatches(text, DEMANDA_RE, 'demanda_civil');
}

export interface AnalyzeTextResult {
  ejecuciones: EjecMatch[];
  embargos: EjecMatch[];
  subastas: EjecMatch[];
  demandas: EjecMatch[];
  isOutOfScope: boolean;
  outOfScopeReason: 'concurso' | null;
}

export function analyzeText(text: string): AnalyzeTextResult {
  const isConcurso = containsConcursoKeyword(text);
  return {
    ejecuciones: isConcurso ? [] : extractEjecuciones(text),
    embargos: isConcurso ? [] : extractEmbargos(text),
    subastas: isConcurso ? [] : extractSubastas(text),
    demandas: isConcurso ? [] : extractDemandas(text),
    isOutOfScope: isConcurso,
    outOfScopeReason: isConcurso ? 'concurso' : null,
  };
}

export function isTensionPreConsursal(countEjecuciones: number, countEmbargos: number): { isTension: boolean; reason: string } {
  if (countEjecuciones >= 1 && countEmbargos >= 1) {
    return { isTension: true, reason: `1+ ejecución + 1+ embargo` };
  }
  if (countEmbargos >= 2) {
    return { isTension: true, reason: `≥2 embargos` };
  }
  return { isTension: false, reason: 'umbral no alcanzado' };
}

export function matchHash(match: Pick<TensionMatch, 'companyId' | 'periodStart' | 'countEjecuciones' | 'countEmbargos'>): string {
  const period = match.periodStart.toISOString().slice(0, 10);
  return `b4-${match.companyId}-${period}-${match.countEjecuciones}-${match.countEmbargos}`;
}

export async function findCompanyInBormeText(contentText: string): Promise<{ id: string; name: string } | null> {
  // Formato típico BORME scrapeado por B.1: "NOMBRE EMPRESA SL — Constitución. ..."
  const headerMatch = contentText.match(
    /(?:^|\n)\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .,&'\-]{3,150}?(?:,\s*)?(?:SOCIEDAD\s+(?:LIMITADA|ANONIMA|ANÓNIMA)|S\.?\s*[AUL]\.?|SAD|SAE))\s*[—,.-]/i,
  );
  if (!headerMatch) return null;
  const rawName = headerMatch[1]
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;]+$/, '')
    .replace(/,?\s*(SOCIEDAD\s+(?:LIMITADA|ANONIMA|ANÓNIMA))\.?$/i, '')
    .replace(/,?\s*S\.?\s*A\.?\.?$/i, '')
    .replace(/,?\s*S\.?\s*L\.?\.?$/i, '')
    .replace(/,?\s*S\.?\s*L\.?\s*U\.?\.?$/i, '')
    .replace(/,?\s*SAD\.?$/i, '')
    .replace(/,?\s*SAE\.?$/i, '')
    .replace(/[.,;]+$/, '')
    .trim();
  if (rawName.length < 3) return null;

  const exact = await prisma.company.findFirst({
    where: { name: { equals: rawName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (exact) return exact;

  const slug = rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  if (slug.length < 3) return null;
  const candidates = await prisma.company.findMany({
    where: {
      OR: [
        { slug: { startsWith: slug } },
        { name: { contains: rawName.split(' ')[0] ?? '', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true },
    take: 5,
  });
  for (const c of candidates) {
    const cSlug = c.slug.toLowerCase();
    if (cSlug === slug || cSlug.startsWith(slug + '-') || cSlug.startsWith(slug)) {
      return { id: c.id, name: c.name };
    }
  }
  return null;
}

export interface DetectTensionOptions {
  daysBack?: number;
  minEjecuciones?: number;
  minEmbargos?: number;
}

export interface InMemorySourceHit {
  sourceId: string;
  companyId: string;
  companyName: string;
  publishedAt: Date;
  ejecuciones: EjecMatch[];
  embargos: EjecMatch[];
  subastas: EjecMatch[];
  demandas: EjecMatch[];
}

/**
 * Recorre todos los Source BORME/BOE recientes, extrae señales de tensión
 * financiera y agrupa por empresa resuelta in-memory. Devuelve solo las
 * empresas que ya cumplen el umbral de tensión (1+ ejec + 1+ embargo o ≥2 embargos).
 */
export async function detectTensionForAll(opts: DetectTensionOptions = {}): Promise<TensionGroupResult> {
  const startedAt = Date.now();
  const daysBack = opts.daysBack ?? 90;
  const since = new Date(Date.now() - daysBack * 24 * 3600 * 1000);

  // 1) Traer todos los Source oficiales con texto candidato a tensión financiera
  const sources = await prisma.source.findMany({
    where: {
      outletType: { in: ['bofficial_borme', 'bofficial'] },
      publishedAt: { gte: since },
      OR: [
        { contentText: { contains: 'Ejec' } },
        { contentText: { contains: 'jec. Hipot' } },
        { contentText: { contains: 'Embargo' } },
        { contentText: { contains: 'insolvencia' } },
        { contentText: { contains: 'ubasta' } },
        { contentText: { contains: 'Demanda' } },
      ],
    },
    select: { id: true, contentText: true, publishedAt: true, companyId: true },
    orderBy: { publishedAt: 'desc' },
    take: 1000,
  });

  // 2) Agrupar señales por empresa (resuelta in-memory desde header BORME)
  const companyCache = new Map<string, { id: string; name: string } | null>();
  const byCompany = new Map<
    string,
    { companyName: string; hits: InMemorySourceHit[] }
  >();
  let sourcesWithMatches = 0;

  for (const s of sources) {
    const text = s.contentText || '';
    const analysis = analyzeText(text);
    if (analysis.isOutOfScope) continue;
    if (
      analysis.ejecuciones.length === 0 &&
      analysis.embargos.length === 0 &&
      analysis.subastas.length === 0 &&
      analysis.demandas.length === 0
    ) {
      continue;
    }
    sourcesWithMatches++;

    // Resolver empresa: si B.1 asignó companyId, usarlo; si no, inferir por header BORME
    let companyId = s.companyId;
    let companyName: string | null = null;
    if (companyId && companyCache.has(companyId)) {
      companyName = companyCache.get(companyId)?.name ?? null;
    } else if (companyId) {
      const c = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      if (c) {
        companyName = c.name;
        companyCache.set(companyId, { id: companyId, name: c.name });
      }
    } else {
      const resolved = await findCompanyInBormeText(text);
      companyCache.set(s.id, resolved);
      if (resolved) {
        companyId = resolved.id;
        companyName = resolved.name;
      }
    }
    if (!companyId || !companyName) continue;

    if (!byCompany.has(companyId)) {
      byCompany.set(companyId, { companyName, hits: [] });
    }
    byCompany.get(companyId)!.hits.push({
      sourceId: s.id,
      companyId,
      companyName,
      publishedAt: s.publishedAt ? new Date(s.publishedAt) : new Date(),
      ejecuciones: analysis.ejecuciones,
      embargos: analysis.embargos,
      subastas: analysis.subastas,
      demandas: analysis.demandas,
    });
  }

  // 3) Evaluar umbral de tensión por empresa
  const matches: TensionMatch[] = [];
  for (const [companyId, bucket] of byCompany) {
    let ejecuciones: EjecMatch[] = [];
    let embargos: EjecMatch[] = [];
    let subastas: EjecMatch[] = [];
    let demandas: EjecMatch[] = [];
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    for (const h of bucket.hits) {
      ejecuciones = ejecuciones.concat(h.ejecuciones);
      embargos = embargos.concat(h.embargos);
      subastas = subastas.concat(h.subastas);
      demandas = demandas.concat(h.demandas);
      if (!periodStart || h.publishedAt < periodStart) periodStart = h.publishedAt;
      if (!periodEnd || h.publishedAt > periodEnd) periodEnd = h.publishedAt;
    }
    const tension = isTensionPreConsursal(ejecuciones.length, embargos.length);
    if (!tension.isTension) continue;
    matches.push({
      companyId,
      companyName: bucket.companyName,
      periodStart: periodStart ?? since,
      periodEnd: periodEnd ?? new Date(),
      ejecuciones,
      embargos,
      subastas,
      demandas,
      countEjecuciones: ejecuciones.length,
      countEmbargos: embargos.length,
      countTotal: ejecuciones.length + embargos.length + subastas.length + demandas.length,
      isTension: true,
      reason: tension.reason,
    });
  }

  return {
    matches,
    sourcesScanned: sources.length,
    sourcesWithMatches,
    durationMs: Date.now() - startedAt,
  };
}
