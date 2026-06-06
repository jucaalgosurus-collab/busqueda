// lib/selectors/adaptive.test.ts — Tests del sistema de selectores
// Sprint G.2 — Adaptive selectors
import assert from 'node:assert/strict';
import { probePortal, updateProfile } from './adaptive';
import { loadProfile, saveProfile, listProfiles } from './store';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STORE_PATH = join(process.cwd(), 'data', 'selectors', 'profiles.json');

function cleanup() {
  if (existsSync(STORE_PATH)) rmSync(STORE_PATH);
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
  {
    name: 'probePortal returns drift=true when no profile',
    async fn() {
      cleanup();
      const result = await probePortal('test-portal', '<html></html>', 0);
      assert.equal(result.driftDetected, true);
    },
  },
  {
    name: 'updateProfile increments version',
    async fn() {
      cleanup();
      const html = '<div class="article">test</div>';
      const profile = await updateProfile('test-portal', html, [
        { portalSlug: 'test-portal', selector: '.article', matches: 1, expected: 1, passed: true },
      ]);
      assert.equal(profile.version, 1);
      assert.equal(profile.successRate, 1);
    },
  },
  {
    name: 'saveProfile + loadProfile roundtrip',
    async fn() {
      cleanup();
      const profile = await updateProfile('rt-portal', '<html></html>', [
        { portalSlug: 'rt-portal', selector: 'h1', matches: 1, expected: 1, passed: true },
      ]);
      const loaded = await loadProfile('rt-portal');
      assert.ok(loaded);
      assert.equal(loaded.portalSlug, profile.portalSlug);
      assert.equal(loaded.version, profile.version);
    },
  },
  {
    name: 'listProfiles returns all saved',
    async fn() {
      cleanup();
      await updateProfile('p1', '<html/>', [
        { portalSlug: 'p1', selector: 'a', matches: 1, expected: 1, passed: true },
      ]);
      await updateProfile('p2', '<html/>', [
        { portalSlug: 'p2', selector: 'b', matches: 1, expected: 1, passed: true },
      ]);
      const all = await listProfiles();
      assert.ok(all.length >= 2);
    },
  },
  {
    name: 'successRate calculated correctly',
    async fn() {
      cleanup();
      const profile = await updateProfile('mixed', '<html/>', [
        { portalSlug: 'mixed', selector: 'a', matches: 1, expected: 1, passed: true },
        { portalSlug: 'mixed', selector: 'b', matches: 0, expected: 1, passed: false },
      ]);
      assert.equal(profile.successRate, 0.5);
    },
  },
  {
    name: 'loadProfile returns null for unknown',
    async fn() {
      cleanup();
      const result = await loadProfile('nonexistent');
      assert.equal(result, null);
    },
  },
];

async function main() {
  cleanup();
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
  cleanup();
  console.log(`\n${passed}/${tests.length} passed`);
  if (failed > 0) process.exit(1);
}

main();
