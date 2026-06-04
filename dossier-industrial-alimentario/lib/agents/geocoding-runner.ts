// lib/agents/geocoding-runner.ts — Sprint QW-2: Geocoding Nominatim para plantas.
//
// OpenStreetMap Nominatim (gratis, sin API key, 1 req/s).
// User-Agent identificable: HERMES-Dossier/1.0 (contacto@surusinversa.com)
// ToS: https://operations.osmfoundation.org/policies/nominatim/
//
// Patrón: para cada Plant sin lat/lng, query Nominatim /search?q={city},{province},España,
// parseo JSON, UPDATE DB. Idempotente: si ya tiene coords, skip.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const GEOCODING_AGENT_NAME = 'surus-agente-geocoding';
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const USER_AGENT = 'HERMES-Dossier/1.0 (contacto@surusinversa.com)';
export const MIN_INTERVAL_MS = 1100; // ToS: max 1 req/s

export interface GeocodingResult {
  plantId: string;
  city: string;
  province: string | null;
  ccaa: string;
  lat: number | null;
  lng: number | null;
  found: boolean;
  reason: string;
}

export interface GeocodingRunResult {
  agentName: string;
  scanned: number;
  found: number;
  notFound: number;
  errors: number;
  durationMs: number;
  topResults: GeocodingResult[];
}

function isMock(): boolean {
  return process.env.MOCK === '1' || process.env.GEOCODING_MOCK === '1';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let lastCallMs = 0;
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallMs;
  if (elapsed < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - elapsed);
  }
  lastCallMs = Date.now();
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
}

async function nominatimSearch(query: string): Promise<NominatimHit | null> {
  if (isMock()) {
    // MOCK determinista: para "Aranda de Duero" devuelve (41.6703, -3.6894).
    // Para "Madrid" devuelve (40.4168, -3.7038). Otros: (0, 0) found=false.
    const m = query.toLowerCase();
    if (m.includes('aranda')) return { lat: '41.6703', lon: '-3.6894', display_name: 'Aranda de Duero, Burgos, España' };
    if (m.includes('madrid')) return { lat: '40.4168', lon: '-3.7038', display_name: 'Madrid, España' };
    if (m.includes('barcelona')) return { lat: '41.3874', lon: '2.1686', display_name: 'Barcelona, España' };
    if (m.includes('sevilla')) return { lat: '37.3891', lon: '-5.9845', display_name: 'Sevilla, España' };
    if (m.includes('valencia')) return { lat: '39.4699', lon: '-0.3763', display_name: 'Valencia, España' };
    if (m.includes('gurb')) return { lat: '41.9050', lon: '2.2300', display_name: 'Gurb, Barcelona, Cataluña, España' };
    if (m.includes('miranda')) return { lat: '42.6867', lon: '-2.9473', display_name: 'Miranda de Ebro, Burgos, España' };
    return null;
  }
  await rateLimit();
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=es`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'es-ES,es;q=0.9',
        'Accept': 'application/json',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as NominatimHit[];
    return arr[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function geocodeOnePlant(args: {
  plantId: string;
  city: string;
  province: string | null;
  ccaa: string;
}): Promise<GeocodingResult> {
  const query = [args.city, args.province, args.ccaa, 'España']
    .filter(Boolean)
    .join(', ');
  const hit = await nominatimSearch(query);
  if (hit) {
    return {
      plantId: args.plantId,
      city: args.city,
      province: args.province,
      ccaa: args.ccaa,
      lat: Number.parseFloat(hit.lat),
      lng: Number.parseFloat(hit.lon),
      found: true,
      reason: 'nominatim_hit',
    };
  }
  return {
    plantId: args.plantId,
    city: args.city,
    province: args.province,
    ccaa: args.ccaa,
    lat: null,
    lng: null,
    found: false,
    reason: 'not_found',
  };
}

export async function runGeocoding(opts: {
  maxPlants?: number;
  dryRun?: boolean;
} = {}): Promise<GeocodingRunResult> {
  const startedAt = new Date();
  const maxPlants = opts.maxPlants ?? 200;

  const plants = await prisma.plant.findMany({
    where: {
      city: { not: null },
      OR: [{ lat: null }, { lng: null }],
    },
    take: maxPlants,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, city: true, province: true, ccaa: true, lat: true, lng: true },
  });

  let found = 0;
  let notFound = 0;
  let errors = 0;
  const topResults: GeocodingResult[] = [];

  for (const plant of plants) {
    try {
      const res = await geocodeOnePlant({
        plantId: plant.id,
        city: plant.city as string,
        province: plant.province,
        ccaa: plant.ccaa,
      });
      if (res.found) {
        found++;
        if (!opts.dryRun) {
          await prisma.plant.update({
            where: { id: plant.id },
            data: { lat: res.lat, lng: res.lng },
          });
        }
      } else {
        notFound++;
      }
      topResults.push(res);
    } catch (e) {
      errors++;
      topResults.push({
        plantId: plant.id,
        city: plant.city as string,
        province: plant.province,
        ccaa: plant.ccaa,
        lat: null,
        lng: null,
        found: false,
        reason: `error: ${(e as Error).message}`,
      });
    }
  }

  const finishedAt = new Date();

  return {
    agentName: GEOCODING_AGENT_NAME,
    scanned: plants.length,
    found,
    notFound,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    topResults: topResults.slice(0, 20),
  };
}

// CLI entry
if (process.argv[1]?.endsWith('geocoding-runner.ts') || process.argv[1]?.endsWith('geocoding-runner.js')) {
  (async () => {
    try {
      const r = await runGeocoding();
      console.log('\n=== GEOCODING ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
