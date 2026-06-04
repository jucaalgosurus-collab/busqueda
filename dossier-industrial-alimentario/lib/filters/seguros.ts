// lib/filters/seguros.ts — Sprint B.5: Filtro deimplantation para cambios
// sectoriales publicados por aseguradoras de crédito.
//
// Una RawSeguroChange representa un cambio de assessment (downgrade/upgrade)
// de un sector en un país. Se cruza con las Companies activas:
//   - Si el sector downgradeado tiene ≥1 Company A&B con CNAE compatible → inScope
//   - Si el sector upgradeado → inScope=false (señal positiva, no desimplantación)
//   - Si no hay match CNAE → inScope=false con outOfScopeReason='not_relevant_industry'
//
// Cruce CNAE → sector (subset principal):
//   10 (Industria alimentación) → 'alimentacion' / 'food' / 'agrifood' / 'meat' / 'dairy' / 'bakery' / 'seafood' / 'oil'
//   11 (Fabricación bebidas)    → 'bebidas' / 'beverages' / 'brewery'
//   21 (Productos farmacéuticos) → 'farma' / 'pharma'
//   24 (Metalurgia)             → 'metales' / 'metals' / 'metallurgy'
//   35 (Energía)                → 'energia' / 'energy'
//   22 (Caucho/plástico)        → 'chemicals' (proxy)
//   13-18 (Textil)              → 'textil' / 'textile'
//   25-28 (Maquinaria)          → 'construccion' / 'construction' (proxy)
//   41-43 (Construcción)        → 'construccion'
//   46-47 (Comercio)            → 'retail' / 'distribucion'

import type { PrismaClient } from '@prisma/client';
import type { RawSeguroChange } from '@/lib/scrapers/seguros-credito';

export interface CompanyInSectorHit {
  id: string;
  name: string;
  slug: string;
  cnae: string | null;
}

export interface SegurosFilterResult {
  inScope: boolean;
  direction: 'downgrade' | 'upgrade' | 'neutral';
  matchedCompanies: CompanyInSectorHit[];
  cnaeMatched: string[];
  outOfScopeReason: string | null;
}

const CNAE_SECTOR_MAP: Array<{ cnaePrefix: string[]; sectorSlugs: string[] }> = [
  { cnaePrefix: ['10'], sectorSlugs: ['alimentacion', 'food', 'agrifood', 'meat', 'dairy', 'bakery', 'seafood', 'oil', 'conservero', 'aceite', 'lacteos', 'carnico', 'panaderia', 'pescado'] },
  { cnaePrefix: ['11'], sectorSlugs: ['bebidas', 'beverages', 'brewery', 'cerveza'] },
  { cnaePrefix: ['21'], sectorSlugs: ['farma', 'pharma', 'pharmaceuticals', 'farmaceutico'] },
  { cnaePrefix: ['24'], sectorSlugs: ['metales', 'metals', 'metallurgy'] },
  { cnaePrefix: ['35'], sectorSlugs: ['energia', 'energy'] },
  { cnaePrefix: ['22'], sectorSlugs: ['chemicals', 'quimica'] },
  { cnaePrefix: ['13', '14', '15', '16', '17', '18'], sectorSlugs: ['textil', 'textile'] },
  { cnaePrefix: ['41', '42', '43', '25', '26', '27', '28'], sectorSlugs: ['construccion', 'construction'] },
  { cnaePrefix: ['46', '47'], sectorSlugs: ['retail', 'distribucion', 'distribuci'] },
  { cnaePrefix: ['29', '30'], sectorSlugs: ['automotive', 'automocion'] },
];

function cnaeToSectors(cnae: string | null | undefined): string[] {
  if (!cnae) return [];
  const c = cnae.trim();
  const out: string[] = [];
  for (const m of CNAE_SECTOR_MAP) {
    if (m.cnaePrefix.some((p) => c === p || c.startsWith(p))) {
      out.push(...m.sectorSlugs);
    }
  }
  return out;
}

export function sectorMatchesCnae(sector: string | null, cnae: string | null | undefined): boolean {
  if (!sector) return false;
  const sectors = cnaeToSectors(cnae);
  const sectorLower = sector.toLowerCase();
  return sectors.some((s) => sectorLower.includes(s) || s.includes(sectorLower));
}

/**
 * Filtro principal. Carga Companies activas, hace matching de sector downgrade/upgrade.
 * Upgrade NO es desimplantación → inScope=false.
 */
export async function applySegurosFilter(
  prisma: PrismaClient,
  change: RawSeguroChange,
): Promise<SegurosFilterResult> {
  if (change.direction === 'neutral') {
    return { inScope: false, direction: 'neutral', matchedCompanies: [], cnaeMatched: [], outOfScopeReason: 'neutral_direction' };
  }
  if (change.direction === 'upgrade') {
    // Upgrade = buena noticia, no desimplantación. Persistimos como histórico pero sin señal.
    return { inScope: false, direction: 'upgrade', matchedCompanies: [], cnaeMatched: [], outOfScopeReason: 'positive_signal' };
  }

  // direction === 'downgrade' (o sector downgradeado)
  const companies = await prisma.company.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, slug: true, cnae: true },
  });

  const matched: CompanyInSectorHit[] = [];
  const cnaeSet = new Set<string>();
  for (const c of companies) {
    if (sectorMatchesCnae(change.sector, c.cnae)) {
      matched.push({ id: c.id, name: c.name, slug: c.slug, cnae: c.cnae });
      if (c.cnae) cnaeSet.add(c.cnae);
    }
  }

  if (matched.length === 0) {
    return {
      inScope: false,
      direction: 'downgrade',
      matchedCompanies: [],
      cnaeMatched: [],
      outOfScopeReason: change.country === 'ES' ? 'no_ab_in_sector' : 'not_spain',
    };
  }

  return {
    inScope: true,
    direction: 'downgrade',
    matchedCompanies: matched,
    cnaeMatched: Array.from(cnaeSet),
    outOfScopeReason: null,
  };
}
