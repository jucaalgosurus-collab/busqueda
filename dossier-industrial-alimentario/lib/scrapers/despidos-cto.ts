// lib/scrapers/despidos-cto.ts — Sprint B.7
//
// Detecta despidos / renuncias / cambios de decisores técnicos senior
// (CTO, Director Técnico, Director I+D, Director Operaciones, Director
//  Industrial, Director de Planta, Director Producción, VP Engineering)
// en empresas A&B.
//
// Estrategia Plan A: Google CSE `site:linkedin.com` con queries de cargo +
// empresa + señal de LinkedIn. Coste 0€, sin riesgo de baneo LinkedIn.
//
// Plan B (no implementado en este sprint): Playwright con login real.
// Activar si Google CSE rate-limita (>100/día) o devuelve resultados de baja
// calidad.

import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  DespidosCtoScrapeOptions,
  RawDespidoCto,
} from './types';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

interface DespidoQuery {
  id: string;
  label: string;
  query: string;
  cargo: string;
  senial: string;
}

function loadQueries(): DespidoQuery[] {
  const path = join(process.cwd(), 'lib', 'data', 'linkedin-despidos-queries.json');
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

const TOP_AB_EMPRESAS: { name: string; slug: string }[] = [
  { name: 'Pescanova', slug: 'pescanova' },
  { name: 'Danone', slug: 'danone' },
  { name: 'Mahou San Miguel', slug: 'mahou-san-miguel' },
  { name: 'Damm', slug: 'damm' },
  { name: 'Pascual', slug: 'pascual' },
  { name: 'Nestle', slug: 'nestle' },
  { name: 'Azucarera', slug: 'azucarera' },
];

// ---------------------------------------------------------------------------
// Cargos y señales detectables
// ---------------------------------------------------------------------------

const CARGOS_RE: RegExp = /\b(CTO|Chief\s+Technology\s+Officer|Director[a]?\s+T[eé]cnic[oa]|Director[a]?\s+(?:de\s+)?I\+D|R&D\s+Director|Director[a]?\s+(?:de\s+)?Operaciones|COO|Director[a]?\s+Industrial|Director[a]?\s+de\s+Planta|Director[a]?\s+(?:de\s+)?Producci[oó]n|VP\s+Engineering|Vice\s+President\s+Engineering)\b/i;

const SENIALES_RE: RegExp = /\b(ha\s+dejado|ya\s+no\s+forma\s+parte|cesado|nuevo\s+reto|se\s+incorpora|deja|nuevo\s+proyecto|sale\s+de)\b/i;

const LINKEDIN_PROFILE_RE: RegExp = /linkedin\.com\/in\/([a-z0-9\-_.%]+)/i;

// ---------------------------------------------------------------------------
// ScrapeAllDespidosCto
// ---------------------------------------------------------------------------

/**
 * Scrapea despidos / renuncias / cambios de decisores técnicos senior.
 * Estrategia:
 *   1. Carga queries de `linkedin-despidos-queries.json`.
 *   2. Para cada empresa top A&B × cada query, simula búsqueda Google CSE.
 *   3. Parsea cada resultado para extraer linkedinSlug, cargo, señal.
 *   4. Deduplica por (linkedinSlug, empresa, día) y devuelve RawDespidoCto[].
 *
 * En este sprint, la función NO hace fetch real (requiere API key de Google CSE).
 * Devuelve un array vacío si GOOGLE_CSE_API_KEY no está configurada, y un
 * warning al log. La estructura está lista para que la implementación real
 * (cuando se active el feature flag) solo tenga que rellenar `fetchHits()`.
 */
export function scrapeDespidosCto(
  options: DespidosCtoScrapeOptions = {},
): { despidos: RawDespidoCto[]; errors: number } {
  const daysBack = options.daysBack ?? 90;
  const maxItems = options.maxItems ?? 50;
  const onLog = options.onLog ?? (() => {});

  onLog(`[despidos-cto] start daysBack=${daysBack} maxItems=${maxItems}`);

  const queries = loadQueries();
  if (queries.length === 0) {
    onLog('[despidos-cto] WARN: no queries loaded from linkedin-despidos-queries.json');
    return { despidos: [], errors: 0 };
  }

  const hasGoogleCse = Boolean(process.env.GOOGLE_CSE_API_KEY);
  if (!hasGoogleCse) {
    onLog('[despidos-cto] INFO: GOOGLE_CSE_API_KEY no configurada, scrape real deshabilitado (0 hits).');
    return { despidos: [], errors: 0 };
  }

  // 1. Generar tareas: para cada empresa × cada query.
  const tasks: { query: DespidoQuery; empresa: { name: string; slug: string } }[] = [];
  for (const q of queries) {
    for (const e of TOP_AB_EMPRESAS) {
      tasks.push({ query: q, empresa: e });
    }
  }
  onLog(`[despidos-cto] ${tasks.length} tareas (${queries.length} queries × ${TOP_AB_EMPRESAS.length} empresas)`);

  // 2. Iterar y scrape (placeholder — implementación real requiere API key).
  //    En este sprint el placeholder NO hace fetch. Cuando se active Google CSE
  //    key, llamar a `fetchGoogleCseHits(query, empresa)` y poblar hits.
  const allHits: RawDespidoCto[] = [];
  // const today = new Date();

  // 3. Deduplicar y devolver.
  const dedup = new Map<string, RawDespidoCto>();
  for (const h of allHits) {
    const key = `${h.linkedinSlug}|${h.companyName.toLowerCase()}|${h.fechaDetectada.slice(0, 10)}`;
    if (!dedup.has(key)) dedup.set(key, h);
  }

  const result = Array.from(dedup.values()).slice(0, maxItems);
  onLog(`[despidos-cto] done unique=${dedup.size} returned=${result.length} errors=0`);
  return { despidos: result, errors: 0 };
}

/** Helper para re-exportar tipos desde el barrel. */
export type { RawDespidoCto, DespidosCtoScrapeOptions };
