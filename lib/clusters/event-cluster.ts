// lib/clusters/event-cluster.ts — Agrupa eventos por empresa + tipo + ventana temporal
// Sprint M.1 — Detección cross-fuente (Surus: 2+ fuentes = señal fuerte)
export type { RawEvent, Cluster, EventKind } from './types';
import type { RawEvent, Cluster, EventKind } from './types';

export interface ClusterConfig {
  windowDays: number;
  minSources: number;
  minConfidence: number;
}

const DEFAULT_CONFIG: ClusterConfig = {
  windowDays: 14,
  minSources: 2,
  minConfidence: 0.5,
};

function dayDiff(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function makeId(parts: string[]): string {
  return parts.join('::');
}

export function clusterEvents(
  events: RawEvent[],
  cfg: Partial<ClusterConfig> = {}
): Cluster[] {
  const config = { ...DEFAULT_CONFIG, ...cfg };
  const groups = new Map<string, RawEvent[]>();

  for (const ev of events) {
    const key = makeId([ev.companyCif, ev.kind]);
    const arr = groups.get(key) ?? [];
    arr.push(ev);
    groups.set(key, arr);
  }

  const clusters: Cluster[] = [];
  for (const [key, evts] of groups) {
    const sorted = [...evts].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = dayDiff(first.publishedAt, last.publishedAt);
    if (span > config.windowDays) {
      for (const ev of sorted) {
        clusters.push(singleEventCluster(ev));
      }
      continue;
    }

    const sources = Array.from(new Set(sorted.map((e) => e.source)));
    const isCrossSource = sources.length >= config.minSources;

    if (!isCrossSource) {
      const singleConf = 0.3;
      clusters.push({
        id: key,
        primaryCif: first.companyCif,
        primaryCompanyName: first.companyName,
        kind: first.kind,
        firstSeen: first.publishedAt,
        lastSeen: last.publishedAt,
        sources,
        eventCount: sorted.length,
        confidence: singleConf,
        events: sorted,
        isCrossSource: false,
      });
      continue;
    }

    const sourceRatio = sources.length / sorted.length;
    const recencyBoost = Math.max(0, 1 - span / config.windowDays);
    const confidence = Math.min(1, sourceRatio * 0.6 + recencyBoost * 0.4);

    if (confidence < config.minConfidence) {
      for (const ev of sorted) {
        clusters.push(singleEventCluster(ev));
      }
      continue;
    }

    const cluster: Cluster = {
      id: key,
      primaryCif: first.companyCif,
      primaryCompanyName: first.companyName,
      kind: first.kind,
      firstSeen: first.publishedAt,
      lastSeen: last.publishedAt,
      sources,
      eventCount: sorted.length,
      confidence: Math.round(confidence * 100) / 100,
      events: sorted,
      isCrossSource,
    };
    clusters.push(cluster);
  }

  return clusters.sort((a, b) => b.confidence - a.confidence);
}

function singleEventCluster(ev: RawEvent): Cluster {
  return {
    id: makeId([ev.companyCif, ev.kind, ev.id]),
    primaryCif: ev.companyCif,
    primaryCompanyName: ev.companyName,
    kind: ev.kind,
    firstSeen: ev.publishedAt,
    lastSeen: ev.publishedAt,
    sources: [ev.source],
    eventCount: 1,
    confidence: 0.3,
    events: [ev],
    isCrossSource: false,
  };
}
