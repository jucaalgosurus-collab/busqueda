// lib/ingest/index.ts — Registry de adapters
// Sprint G.1 — Scrapling sidecar + 6 adapters

import type { Adapter } from './types';
import { prensaLocalAdapter } from './adapters/prensa-local';
import { boeBopBormeAdapter } from './adapters/boe-bop-borme';
import { osintCorpAdapter } from './adapters/osint-corp';
import { prensaSectorialAdapter } from './adapters/prensa-sectorial';
import { prensaEconomicaAdapter } from './adapters/prensa-economica';
import { subastasVerifyAdapter } from './adapters/subastas-verify';

const registry: Map<string, Adapter> = new Map();

function register(adapter: Adapter): void {
  if (registry.has(adapter.name)) {
    throw new Error(`Adapter already registered: ${adapter.name}`);
  }
  registry.set(adapter.name, adapter);
}

register(prensaLocalAdapter);
register(boeBopBormeAdapter);
register(osintCorpAdapter);
register(prensaSectorialAdapter);
register(prensaEconomicaAdapter);
register(subastasVerifyAdapter);

export function getAdapter(name: string): Adapter | undefined {
  return registry.get(name);
}

export function listAdapters(): Adapter[] {
  return Array.from(registry.values());
}

export async function runAdapter(name: string, config: Parameters<Adapter['run']>[0]) {
  const adapter = getAdapter(name);
  if (!adapter) {
    throw new Error(`Adapter not found: ${name}`);
  }
  return adapter.run(config);
}
