// scripts/smoke-qw-2.ts — Sprint QW-2: Smoke del geocoding runner.
//
// 7 asserts:
//   QW-2-A  lib/agents/geocoding-runner.ts existe con runGeocoding
//   QW-2-B  Runner tiene rate limit ≥1.0s (MIN_INTERVAL_MS)
//   QW-2-C  Idempotente: query filtra plants con lat/lng set
//   QW-2-D  geocodeOnePlant devuelve GeocodingResult estructurado
//   QW-2-E  MOCK=1: Aranda de Duero → (41.6703, -3.6894)
//   QW-2-F  User-Agent incluye "HERMES-Dossier" + email
//   QW-2-G  Atribución "OpenStreetMap" presente en código
//
// Run: pnpm tsx scripts/smoke-qw-2.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint QW-2 Geocoding smoke (7 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);

  // QW-2-A
  const runnerPath = join(process.cwd(), 'lib', 'agents', 'geocoding-runner.ts');
  if (existsSync(runnerPath)) {
    const src = readFileSync(runnerPath, 'utf-8');
    const has = /export\s+async\s+function\s+runGeocoding\b/.test(src) && /GEOCODING_AGENT_NAME/.test(src);
    assert('QW-2-A [geocoding-runner.ts existe con runGeocoding]', has, has ? 'exports ok' : 'faltan exports');
  } else {
    assert('QW-2-A [geocoding-runner.ts existe con runGeocoding]', false, 'no existe');
  }

  // QW-2-B
  const src = readFileSync(runnerPath, 'utf-8');
  const hasRateLimit = /MIN_INTERVAL_MS\s*=\s*1\d{3,}/.test(src) || /rateLimit\s*\(/.test(src);
  assert('QW-2-B [rate limit ≥1.0s]', hasRateLimit, hasRateLimit ? 'ok' : 'sin rate limit');

  // QW-2-C
  const hasIdempotent = /lat:\s*null[^\n]*\n[^\n]*lng:\s*null/.test(src) || /OR:\s*\[\{\s*lat:\s*null\s*\}[\s\S]*?lng:\s*null/.test(src);
  assert('QW-2-C [idempotente: query filtra lat/lng null]', hasIdempotent, hasIdempotent ? 'ok' : 'no filtra');

  // QW-2-D
  const mod = await import('../lib/agents/geocoding-runner.js');
  process.env.MOCK = '1';
  const r1 = await mod.geocodeOnePlant({
    plantId: 'p1',
    city: 'Aranda de Duero',
    province: 'Burgos',
    ccaa: 'Castilla y León',
  });
  const structured = r1.plantId === 'p1' && typeof r1.lat === 'number' && typeof r1.lng === 'number' && typeof r1.found === 'boolean' && typeof r1.reason === 'string';
  assert('QW-2-D [geocodeOnePlant devuelve GeocodingResult estructurado]', structured, structured ? 'campos ok' : 'campos faltantes');

  // QW-2-E: MOCK Aranda de Duero → (41.6703, -3.6894)
  const r2 = await mod.geocodeOnePlant({
    plantId: 'p2',
    city: 'Aranda de Duero',
    province: 'Burgos',
    ccaa: 'Castilla y León',
  });
  const correct = r2.found && Math.abs((r2.lat ?? 0) - 41.6703) < 0.01 && Math.abs((r2.lng ?? 0) - -3.6894) < 0.01;
  assert('QW-2-E [MOCK: Aranda de Duero → (41.6703, -3.6894)]', correct, `lat=${r2.lat} lng=${r2.lng} found=${r2.found}`);

  // QW-2-F: User-Agent
  const hasUA = /HERMES-Dossier/.test(src) && /contacto@surusinversa\.com/.test(src);
  assert('QW-2-F [User-Agent incluye HERMES-Dossier + email]', hasUA, hasUA ? 'ok' : 'falta UA');

  // QW-2-G: Atribución OpenStreetMap
  const hasOsm = /OpenStreetMap/.test(src) || /operations\.osmfoundation\.org/.test(src);
  assert('QW-2-G [Atribución OpenStreetMap presente]', hasOsm, hasOsm ? 'ok' : 'falta atribución');

  console.log(`\n=== TOTAL: ${pass} pass / ${fail} fail ===`);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
