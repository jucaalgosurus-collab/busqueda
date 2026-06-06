// lib/selectors/types.ts — Tipos para sistema de selectores auto-adaptables
// Sprint G.2 — Adaptive selectors

export interface SelectorCandidate {
  selector: string;
  type: 'css' | 'xpath' | 'regex';
  attribute?: string;
  weight: number;
}

export interface SelectorProfile {
  portalSlug: string;
  version: number;
  selectors: Record<string, SelectorCandidate>;
  lastUpdated: Date;
  sampleCount: number;
  successRate: number;
}

export interface SelectorTestResult {
  portalSlug: string;
  selector: string;
  matches: number;
  expected: number;
  passed: boolean;
}
