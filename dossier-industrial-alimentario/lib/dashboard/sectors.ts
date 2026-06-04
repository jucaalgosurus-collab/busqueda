// lib/dashboard/sectors.ts — QW-6: orden fijo de sectores en dashboard.
//
// Brief 2026-06-03 (Juan Carlos): "DEJAR POR SUPUESTO SIEMPRE ALIMENTACION Y BEBIDAS
// PRIMERO, LUEGO CONSTRUCCION". Por tanto, el orden de sectores en dashboard
// (tabs, distribución, breakdown) es FIJO y empieza por A&B.

export const SECTOR_ORDER: readonly string[] = [
  'Alimentos y Bebidas',
  'Construccion',
  'Industrial',
  'Farmaceutico',
  'Energetico',
  'Otro industrial',
] as const;

export const SECTOR_ACCENT: Record<string, string> = {
  'Alimentos y Bebidas': 'var(--surus-accent)',
  Construccion: 'var(--surus-warning)',
  Industrial: 'var(--surus-primary-500)',
  Farmaceutico: 'var(--surus-success)',
  Energetico: 'var(--surus-danger)',
  'Otro industrial': 'var(--surus-text-muted)',
};

export interface SectorCount {
  sector: string;
  count: number;
}

export function sortBySectorFixed(items: SectorCount[]): SectorCount[] {
  const idx: Record<string, number> = {};
  SECTOR_ORDER.forEach((s, i) => (idx[s] = i));
  return [...items].sort((a, b) => {
    const ai = idx[a.sector] ?? 999;
    const bi = idx[b.sector] ?? 999;
    if (ai !== bi) return ai - bi;
    return b.count - a.count;
  });
}

export function sectorRank(sector: string): number {
  const i = SECTOR_ORDER.indexOf(sector);
  return i === -1 ? 999 : i;
}

export function isValidSector(sector: string): boolean {
  return SECTOR_ORDER.includes(sector);
}
