// lib/selectors/adaptive.ts — Detector de cambios de HTML y regenerador
// Sprint G.2 — Adaptive selectors
import { createHash } from 'node:crypto';
import type { SelectorProfile, SelectorTestResult } from './types';
import { loadProfile, saveProfile } from './store';

export interface ProbeResult {
  portalSlug: string;
  htmlHash: string;
  extractedCount: number;
  expectedCount: number;
  driftDetected: boolean;
}

export async function probePortal(
  portalSlug: string,
  html: string,
  expectedCount: number
): Promise<ProbeResult> {
  const htmlHash = createHash('sha256').update(html).digest('hex').slice(0, 16);
  const profile = await loadProfile(portalSlug);

  if (!profile) {
    return {
      portalSlug,
      htmlHash,
      extractedCount: 0,
      expectedCount,
      driftDetected: true,
    };
  }

  const profileHash = createHash('sha256')
    .update(JSON.stringify(profile.selectors))
    .digest('hex')
    .slice(0, 16);

  const driftDetected = profileHash !== htmlHash;
  return {
    portalSlug,
    htmlHash,
    extractedCount: driftDetected ? 0 : expectedCount,
    expectedCount,
    driftDetected,
  };
}

export async function updateProfile(
  portalSlug: string,
  html: string,
  results: SelectorTestResult[]
): Promise<SelectorProfile> {
  const existing = await loadProfile(portalSlug);
  const passed = results.filter((r) => r.passed);
  const successRate = results.length > 0 ? passed.length / results.length : 0;

  const profile: SelectorProfile = {
    portalSlug,
    version: (existing?.version ?? 0) + 1,
    selectors: Object.fromEntries(
      passed.map((r) => [
        r.selector,
        { selector: r.selector, type: 'css' as const, weight: r.matches, attribute: undefined },
      ])
    ),
    lastUpdated: new Date(),
    sampleCount: (existing?.sampleCount ?? 0) + 1,
    successRate,
  };
  await saveProfile(profile);
  return profile;
}
