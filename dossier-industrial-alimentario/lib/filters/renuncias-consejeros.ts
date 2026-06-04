// lib/filters/renuncias-consejeros.ts — Sprint B.3
//
// Detecta renuncias masivas de consejeros (≥3 ceses en 90d en una A&B).
// Reutiliza los Source rows de BORME que ya están scrapeados (B.1).
// Señal amarilla media: el consejo se vacía, governance en transición.
//
// Patrón de cargos de consejo aceptados:
//   - "Cons." (cualquier cargo del consejo: Pres., Secr., Vocal, Mie.)
//   - "Consejero"
//   - "Mie. Cons.", "Pres. Cons.", "Secr. Cons.", "Vocal Cons."
//   - "M.Cons.Liq", "Pr.Cons.Liq" (miembros consejo liquidador — relevante en disoluciones)
//
// Cargos EXCLUIDOS (administración simple, no consejo):
//   - "Adm. Solid.", "Adm. Único", "Adm. Mancomunado"
//   - "Liquidador", "LiquiSoli"

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CesEntry {
  name: string;
  cargo: string;
  sourceId: string;
  publishedAt: Date;
}

export interface RenunciasMatch {
  companyId: string;
  companyName: string;
  ceses: CesEntry[];
  count: number;
  periodStart: Date;
  periodEnd: Date;
}

// Regex: cargo de consejo
const CONSEJERO_CARGO_RE = /\b(M(?:ie)?\.?\s*Cons|Consejero|Pres(?:idente)?\.?\s*Cons|Secr(?:etario)?\.?\s*Cons|Vocal\.?\s*Cons|C\.?D\.?S?\.?Cons)/i;
// Excluir cargos NO consejero (administración simple)
const EXCLUDE_CARGO_RE = /\b(Adm(?:in(?:istrador)?)?\.?\s*(?:Solid|Único|Unico|Mancomun)|Liquidador|LiquiSoli|Apoderado)/i;

export function isConsejeroCargo(cargo: string): boolean {
  if (EXCLUDE_CARGO_RE.test(cargo)) return false;
  return CONSEJERO_CARGO_RE.test(cargo);
}

/**
 * Extrae los nombres dimitidos del bloque "Ceses/Dimisiones." en un texto BORME.
 * El formato típico es: "Ceses/Dimisiones. Adm. Solid.: NAME1;NAME2. M.Cons.Liq: NAME3. Secr.Cons.Li: NAME4"
 *
 * Estrategia: split por '.', cada segmento es "Cargo: nombres", nombres separados por ';'.
 * Filtramos cargos que son de consejo (Cargo.match(CONSEJERO_CARGO_RE)).
 */
export function extractCeses(text: string): Array<{ name: string; cargo: string }> {
  if (!text) return [];
  // Aislar el bloque "Ceses/Dimisiones." hasta el siguiente "Nombramientos." o "Disolución." o fin
  const m = text.match(/Ceses\/Dimisiones\.?\s*([\s\S]*?)(?=Nombramientos\.|Disoluci[oó]n\.|Extinci[oó]n\.|Transformaci[oó]n\.|Fusi[oó]n\.|Escisi[oó]n\.|Constituci[oó]n\.|Ampliaci[oó]n\.|Reducci[oó]n\.|Modificaci[oó]n\s+de\s+estatutos\.|Otros\s+conceptos|$)/i);
  if (!m) return [];

  const block = m[1];
  const ceses: Array<{ name: string; cargo: string }> = [];

  // Split por '.' que no estén seguidos de dígito (para no romper "S.A.")
  const segments = block.split(/\.\s+(?=[A-Z])/);
  for (const seg of segments) {
    // Cada segmento es "Cargo: nombres" o solo "Cargo: nombre"
    const segMatch = seg.match(/^([^:]+?):\s*(.+)$/);
    if (!segMatch) continue;
    const cargo = segMatch[1].trim();
    const nombresRaw = segMatch[2].trim();
    if (!isConsejeroCargo(cargo)) continue;
    // Split nombres por ';'
    const nombres = nombresRaw
      .split(/[;]/)
      .map((n) => n.trim().replace(/\s+/g, ' ').replace(/[.,]+$/, ''))
      .filter((n) => n.length >= 5 && /[A-Za-zÀ-ÿ]/.test(n));
    for (const name of nombres) {
      ceses.push({ name, cargo });
    }
  }
  return ceses;
}

/**
 * Detecta si una empresa A&B tiene renuncias masivas de consejeros.
 * Carga los Source BORME de los últimos `daysBack` días y agrupa ceses.
 * Devuelve RenunciasMatch si count >= minCeses, null en caso contrario.
 */
export async function detectMasiveRenuncias(
  companyId: string,
  daysBack = 90,
  minCeses = 3,
): Promise<RenunciasMatch | null> {
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - daysBack);

  const sources = await prisma.source.findMany({
    where: {
      companyId,
      outletType: 'bofficial_borme',
      publishedAt: { gte: periodStart, lte: periodEnd },
      contentText: { contains: 'Ceses/Dimisiones' },
    },
    select: { id: true, contentText: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
  });

  if (sources.length === 0) return null;

  const cesesByName = new Map<string, CesEntry>();
  for (const src of sources) {
    if (!src.contentText || !src.publishedAt) continue;
    const extracted = extractCeses(src.contentText);
    for (const e of extracted) {
      // Dedupe por nombre (case-insensitive)
      const key = e.name.toUpperCase().replace(/\s+/g, ' ').trim();
      if (!cesesByName.has(key)) {
        cesesByName.set(key, {
          name: e.name,
          cargo: e.cargo,
          sourceId: src.id,
          publishedAt: src.publishedAt,
        });
      }
    }
  }

  if (cesesByName.size < minCeses) return null;

  // Cargar nombre empresa
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true },
  });
  if (!company) return null;

  return {
    companyId,
    companyName: company.name,
    ceses: Array.from(cesesByName.values()),
    count: cesesByName.size,
    periodStart,
    periodEnd,
  };
}

/**
 * Resuelve la empresa (Company) a la que pertenece un Source BORME concreto,
 * buscando el nombre del titular en `contentText` (formato BORME: "ID - NOMBRE EMPRESA SOCIEDAD LIMITADA.").
 * Devuelve la Company si matchea, null en caso contrario.
 *
 * B.1 (borme-runner) NO asigna Source.companyId; B.3 resuelve la asociación in-memory.
 * Si en el futuro B.1 fija el companyId, esta función se mantiene como fallback.
 */
export async function resolveCompanyForBormeSource(sourceId: string): Promise<{ id: string; name: string } | null> {
  const src = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { contentText: true, outletType: true },
  });
  if (!src?.contentText || src.outletType !== 'bofficial_borme') return null;
  return findCompanyInBormeText(src.contentText);
}

/**
 * Busca la Company cuyo nombre aparece en el texto BORME.
 * Estrategia: extraer la primera línea con formato "ID - NOMBRE EMPRESA SOCIEDAD LIMITADA"
 * y buscar match por nombre normalizado contra Company.name.
 */
export async function findCompanyInBormeText(contentText: string): Promise<{ id: string; name: string } | null> {
  // El formato típico BORME scrapeado por B.1 es:
  //   "MERCAVITORIA PESCADOS SL — Ceses/Dimisiones. ..."
  //   "KURTOSANDCREAM, SL — Ceses/Dimisiones. ..."
  //   "DANONE IBERIA SA — ..."
  // Aceptar sufijos SL/SA/SAD/SLL/SAU/SAE + SOCIEDAD (LIMITADA|ANONIMA...)
  const headerMatch = contentText.match(/(?:^|\n)\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .,&'\-]{3,150}?(?:,\s*)?(?:SOCIEDAD\s+(?:LIMITADA|ANONIMA|ANÓNIMA)|S\.?\s*[AUL]\.?|SAD|SAE))\s*[—,.-]\s*(?:Ceses\/Dimisiones|Reelecciones|Nombramientos|Constituci[oó]n|Ampliaci[oó]n)/i);
  if (!headerMatch) return null;
  const rawName = headerMatch[1].trim()
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

  // Buscar match exacto (case-insensitive) primero
  const exact = await prisma.company.findFirst({
    where: { name: { equals: rawName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (exact) return exact;

  // Fallback: match por prefijo (slug-like) — útil cuando el nombre BORME no incluye sufijo "SOCIEDAD LIMITADA"
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

/**
 * Hash determinista del match para idempotencia UNIQUE en Source.
 * Input: companyId + periodStart (date) + sorted nombres dimitidos.
 */
export function matchHash(match: Pick<RenunciasMatch, 'companyId' | 'periodStart' | 'ceses'>): string {
  const names = match.ceses.map((c) => c.name).sort();
  const period = match.periodStart.toISOString().slice(0, 10);
  return `b3-${match.companyId}-${period}-${names.join('|')}`;
}
