// lib/clusters/event-cluster.test.ts — Tests del agrupador de eventos
// Sprint M.1
import assert from 'node:assert/strict';
import { clusterEvents } from './event-cluster';
import type { RawEvent } from './types';

function ev(over: Partial<RawEvent>): RawEvent {
  return {
    id: over.id ?? `id-${Math.random()}`,
    source: over.source ?? 'default',
    companyCif: over.companyCif ?? 'A12345678',
    companyName: over.companyName ?? 'Acme SA',
    publishedAt: over.publishedAt ?? '2026-06-01T10:00:00Z',
    title: over.title ?? 'Title',
    url: over.url ?? 'https://example.com',
    kind: over.kind ?? 'cierre',
    excerpt: over.excerpt ?? '',
    cnae: over.cnae,
    region: over.region,
  };
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
  {
    name: 'single event produces single-event cluster with low confidence',
    async fn() {
      const clusters = clusterEvents([ev({ id: '1' })]);
      assert.equal(clusters.length, 1);
      assert.equal(clusters[0].eventCount, 1);
      assert.equal(clusters[0].isCrossSource, false);
      assert.ok(clusters[0].confidence < 0.5);
    },
  },
  {
    name: 'two events same company+kind+window from different sources = cross-source cluster',
    async fn() {
      const clusters = clusterEvents([
        ev({ id: '1', source: 'elEconomista', publishedAt: '2026-06-01T10:00:00Z' }),
        ev({ id: '2', source: 'Alimarket', publishedAt: '2026-06-03T10:00:00Z' }),
      ]);
      assert.equal(clusters.length, 1);
      assert.equal(clusters[0].isCrossSource, true);
      assert.equal(clusters[0].eventCount, 2);
      assert.equal(clusters[0].sources.length, 2);
    },
  },
  {
    name: 'events outside windowDays remain separate',
    async fn() {
      const clusters = clusterEvents([
        ev({ id: '1', source: 'elEconomista', publishedAt: '2026-01-01T10:00:00Z' }),
        ev({ id: '2', source: 'Alimarket', publishedAt: '2026-06-01T10:00:00Z' }),
      ], { windowDays: 14 });
      assert.equal(clusters.length, 2, 'events far apart in time stay separate');
    },
  },
  {
    name: 'different kind does not cluster together',
    async fn() {
      const clusters = clusterEvents([
        ev({ id: '1', source: 'elEconomista', kind: 'cierre' }),
        ev({ id: '2', source: 'Alimarket', kind: 'compra' }),
      ]);
      assert.equal(clusters.length, 2);
    },
  },
  {
    name: 'different CIF does not cluster together',
    async fn() {
      const clusters = clusterEvents([
        ev({ id: '1', source: 'elEconomista', companyCif: 'A11111111' }),
        ev({ id: '2', source: 'Alimarket', companyCif: 'B22222222' }),
      ]);
      assert.equal(clusters.length, 2);
    },
  },
  {
    name: 'clusters sorted by confidence descending',
    async fn() {
      const clusters = clusterEvents([
        ev({ id: '1', source: 'a', companyCif: 'C1' }),
        ev({ id: '2', source: 'a', companyCif: 'C2' }),
        ev({ id: '3', source: 'b', companyCif: 'C1' }),
        ev({ id: '4', source: 'c', companyCif: 'C1' }),
        ev({ id: '5', source: 'd', companyCif: 'C1' }),
      ]);
      const cf = clusters.map((c) => c.confidence);
      for (let i = 1; i < cf.length; i++) {
        assert.ok(cf[i - 1] >= cf[i], `confidence must be descending: ${cf}`);
      }
    },
  },
  {
    name: 'duplicate source events do not inflate cross-source',
    async fn() {
      const clusters = clusterEvents([
        ev({ id: '1', source: 'elEconomista' }),
        ev({ id: '2', source: 'elEconomista' }),
        ev({ id: '3', source: 'elEconomista' }),
      ]);
      assert.equal(clusters.length, 1);
      assert.equal(clusters[0].sources.length, 1);
      assert.equal(clusters[0].isCrossSource, false);
    },
  },
  {
    name: 'eventCount reflects total events including duplicates',
    async fn() {
      const clusters = clusterEvents([
        ev({ id: '1', source: 'a' }),
        ev({ id: '2', source: 'b' }),
        ev({ id: '3', source: 'c' }),
      ]);
      assert.equal(clusters[0].eventCount, 3);
    },
  },
  {
    name: 'empty input returns empty array',
    async fn() {
      const clusters = clusterEvents([]);
      assert.equal(clusters.length, 0);
    },
  },
];

async function main() {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${t.name}`);
      console.error(`    ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${tests.length} passed`);
  if (failed > 0) process.exit(1);
}

main();
