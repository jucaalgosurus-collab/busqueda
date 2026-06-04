// app/empresas/[slug]/_lib/types.ts — Tipos compartidos para la ficha
import type {
  Company, Plant, PlantContact, TechnicalInventory, Operation, TimelineEvent,
  Financial, Source, AuctionCheck, Document, Note,
} from '@prisma/client';

export type CompanyWithRelations = Company & {
  plants: Plant[];
  operations: (Operation & { plant: Plant | null })[];
  financials: Financial[];
  sources: Source[];
  auctionChecks: AuctionCheck[];
  documents: (Document & { evaluations: { skill: string; grade: string | null; score: number | null }[] })[];
  notes: Note[];
  plantContacts: PlantContact[];
};

export type PlantWithRelations = Plant & {
  inventory: TechnicalInventory[];
  contacts: PlantContact[];
  events: TimelineEvent[];
};

export function formatEur(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K M€`;
  }
  return `${n.toFixed(1).replace(/\.0$/, '')} M€`;
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-ES').format(n);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url;
  } catch {
    return null;
  }
  return null;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    operativa: 'Operativa',
    en_inversion: 'En inversión',
    en_desmantelamiento: 'En desmantelamiento',
    cerrada: 'Cerrada',
    vendida: 'Vendida',
    en_proyecto: 'En proyecto',
    en_conversion: 'En conversión',
    en_venta: 'En venta',
  };
  return map[status] ?? status;
}

export function statusColorVar(status: string): string {
  const map: Record<string, string> = {
    operativa: 'var(--success)',
    en_inversion: 'var(--info)',
    en_desmantelamiento: 'var(--danger)',
    cerrada: 'var(--danger)',
    vendida: 'var(--accent)',
    en_proyecto: 'var(--info)',
    en_conversion: 'var(--accent)',
    en_venta: 'var(--warn)',
  };
  return map[status] ?? 'var(--text-muted)';
}
