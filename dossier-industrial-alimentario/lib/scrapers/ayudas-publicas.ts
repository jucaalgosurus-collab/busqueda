// lib/scrapers/ayudas-publicas.ts — Sprint B.6
//
// Fuente primaria: BDNS (Base de Datos Nacional de Subvenciones)
//   https://www.infosubvenciones.es/bdnstrans/GE/es/index
//
// En este sprint NO se hace scraping en vivo de BDNS (requiere Playwright con
// sesión autenticada o API con IP whitelist del MINHAFP). El scraper carga el
// dataset estático `lib/data/ayudas-list.json` con 8 ayudas CDTI/IDAE/ICEX
// 2024-2026 a empresas A&B del sector.
//
// Futuras iteraciones (sprint de pulido B.6.x):
//   1. fetchLiveBDNS() con Playwright + auth BDNS.
//   2. Cross-check con BOE (reales decretos de concesión).
//   3. Cross-check con SABI / Informa (viabilidad económica del beneficiario).
//
// Sin dependencias nuevas. Throttle 0 (es dataset estático, no red).

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { AyudasScrapeOptions, RawAyudaPublica } from './types';

// Re-exportar tipos para que el runner los pueda importar.
export type { AyudasScrapeOptions, RawAyudaPublica };

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const AYUDAS_LIST_PATH = 'lib/data/ayudas-list.json';

const DEFAULT_DAYS_BACK = 30;

// ---------------------------------------------------------------------------
// Carga de dataset estático
// ---------------------------------------------------------------------------

interface AyudasListFile {
  _meta?: Record<string, unknown>;
  ayudas: RawAyudaPublica[];
}

/**
 * Carga el dataset estático de ayudas. Si el archivo no existe, devuelve [].
 * NO lanza excepción: el runner debe ser resiliente a dataset vacío.
 */
export function loadAyudasFromFile(): RawAyudaPublica[] {
  const filePath = join(process.cwd(), AYUDAS_LIST_PATH);
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as AyudasListFile;
  if (!Array.isArray(parsed.ayudas)) {
    return [];
  }
  return parsed.ayudas;
}

// ---------------------------------------------------------------------------
// Filter por fecha (daysBack)
// ---------------------------------------------------------------------------

function isWithinWindow(fechaConcesion: string, daysBack: number): boolean {
  const fecha = new Date(fechaConcesion);
  if (Number.isNaN(fecha.getTime())) return false;
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  return fecha.getTime() >= cutoff;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Carga las ayudas del dataset estático, filtradas por ventana de días.
 * En este sprint NO hay red; en el futuro, este orquestador combinará
 * `loadAyudasFromFile()` con `fetchLiveBDNS()`.
 */
export function scrapeAllAyudatories(
  options: AyudasScrapeOptions = {},
): { ayudas: RawAyudaPublica[]; errors: number } {
  const daysBack = options.daysBack ?? DEFAULT_DAYS_BACK;
  const maxItems = options.maxItems ?? 100;

  let all = loadAyudasFromFile();
  let errors = 0;

  try {
    all = all.filter((a) => isWithinWindow(a.fechaConcesion, daysBack));
    if (all.length > maxItems) {
      all = all.slice(0, maxItems);
    }
  } catch (e) {
    errors++;
  }

  return { ayudas: all, errors };
}

// ---------------------------------------------------------------------------
// Placeholder para B.6.x
// ---------------------------------------------------------------------------

/**
 * Placeholder documentado para el sprint de pulido B.6.x.
 * La implementación real con Playwright + BDNS auth NO está en este sprint.
 */
export async function fetchLiveBDNS(): Promise<RawAyudaPublica[]> {
  // TODO B.6.x: implementar con Playwright + auth BDNS + dedupe contra dataset estático.
  return [];
}
