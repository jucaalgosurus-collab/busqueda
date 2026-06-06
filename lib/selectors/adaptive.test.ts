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
    name: 'concurrent saveProfile does not lose data',
    async fn() {
      cleanup();
      const promises = Array.from({ length: 20 }, (_, i) =>
        updateProfile(`p-${i}`, '<html/>', [
          { portalSlug: `p-${i}`, selector: 'a', matches: 1, expected: 1, passed: true },
        ])
      );
      await Promise.all(promises);
      const all = await listProfiles();
      assert.equal(all.length, 20, 'expected 20 profiles after concurrent writes');
    },
  },
  {
    name: 'duplicate selectors are merged (not overwritten)',
    async fn() {
      cleanup();
      const profile = await updateProfile('dedup-portal', '<html/>', [
        { portalSlug: 'dedup-portal', selector: 'a', matches: 1, expected: 1, passed: true },
        { portalSlug: 'dedup-portal', selector: 'a', matches: 3, expected: 1, passed: true },
        { portalSlug: 'dedup-portal', selector: 'b', matches: 2, expected: 1, passed: true },
      ]);
      assert.equal(profile.selectors['a'].weight, 4, 'duplicate selector weights must sum');
      assert.equal(profile.selectors['b'].weight, 2);
    },
  },
  {
    name: 'probePortal returns drift=false when html matches profile.htmlHash',
    async fn() {
      cleanup();
      const html = '<div class="article">unchanged</div>';
      await updateProfile('stable-portal', html, [
        { portalSlug: 'stable-portal', selector: '.article', matches: 5, expected: 1, passed: true },
      ]);
      const result = await probePortal('stable-portal', html, 5);
      assert.equal(result.driftDetected, false, 'same HTML should not be drift');
      assert.equal(result.extractedCount, 5);
    },
  },
  {
    name: 'probePortal returns drift=true when html changes',
    async fn() {
      cleanup();
      await updateProfile('changed-portal', '<div class="article">v1</div>', [
        { portalSlug: 'changed-portal', selector: '.article', matches: 1, expected: 1, passed: true },
      ]);
      const result = await probePortal('changed-portal', '<div class="article">v2-totally-different</div>', 1);
      assert.equal(result.driftDetected, true);
      assert.equal(result.extractedCount, 0);
    },
  },
  {
    name: 'lastUpdated is ISO string roundtrip',
    async fn() {
      cleanup();
      const profile = await updateProfile('iso-portal', '<html/>', [
        { portalSlug: 'iso-portal', selector: 'a', matches: 1, expected: 1, passed: true },
      ]);
      assert.equal(typeof profile.lastUpdated, 'string');
      assert.ok(!isNaN(Date.parse(profile.lastUpdated)), 'must be parseable date');
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
