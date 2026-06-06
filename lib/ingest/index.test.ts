// lib/ingest/index.test.ts — Tests del registry de adapters
// Sprint G.1 — 6 adapters registrados, cada uno con nombre + tipo único
import assert from 'node:assert/strict';
import { listAdapters, getAdapter, runAdapter } from './index';

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
  {
    name: 'registry has 6 adapters',
    fn: () => {
      assert.equal(listAdapters().length, 6);
    },
  },
  {
    name: 'all adapters have unique name',
    fn: () => {
      const names = listAdapters().map((a) => a.name);
      assert.equal(new Set(names).size, names.length);
    },
  },
  {
    name: 'all adapters have unique type',
    fn: () => {
      const types = listAdapters().map((a) => a.type);
      assert.equal(new Set(types).size, types.length);
    },
  },
  {
    name: 'expected adapters present',
    fn: () => {
      const expected = [
        'prensa-local',
        'boe-bop-borme',
        'osint-corp',
        'prensa-sectorial',
        'prensa-economica',
        'subastas-verify',
      ];
      for (const name of expected) {
        assert.ok(getAdapter(name), `missing adapter: ${name}`);
      }
    },
  },
  {
    name: 'subastas-verify is R-01 compliant (no scraping)',
    fn: async () => {
      const adapter = getAdapter('subastas-verify');
      assert.ok(adapter);
      const result = await runAdapter('subastas-verify', { daysBack: 7, maxPerSource: 0 });
      assert.equal(result.found, 0, 'subastas-verify must NOT scrape (R-01)');
    },
  },
  {
    name: 'getAdapter returns undefined for unknown',
    fn: () => {
      assert.equal(getAdapter('nope'), undefined);
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
