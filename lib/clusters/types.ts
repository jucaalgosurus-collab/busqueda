// lib/clusters/types.ts — Tipos para clustering de eventos
// Sprint M.1 — EventCluster cross-fuente

export type EventKind =
  | 'cierre'
  | 'despidos'
  | 'concurso'
  | 'ERE'
  | 'deslocalizacion'
  | 'compra'
  | 'fusion'
  | 'ampliacion'
  | 'otro';

export interface RawEvent {
  id: string;
  source: string;
  companyCif: string;
  companyName: string;
  publishedAt: string;
  title: string;
  url: string;
  kind: EventKind;
  excerpt: string;
  cnae?: string;
  region?: string;
}

export interface Cluster {
  id: string;
  primaryCif: string;
  primaryCompanyName: string;
  kind: EventKind;
  firstSeen: string;
  lastSeen: string;
  sources: string[];
  eventCount: number;
  confidence: number;
  events: RawEvent[];
  isCrossSource: boolean;
}
