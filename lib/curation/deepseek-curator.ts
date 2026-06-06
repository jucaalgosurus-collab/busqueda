// lib/curation/deepseek-curator.ts — Curador DeepSeek para Top-N por sector
// Sprint S.2 — Reemplaza scraping de elEconomista (R-06: 0€ presupuesto)
// Reglas durables: R-07 (DeepSeek primary), R-08 (A&B prioridad)

import type { CnaeEntry, SectorCodigo } from './cnae-catalog';

export interface TopNRow {
  pos: number;
  cnae_4d: string;
  etapa_cadena: 'primaria' | 'transformacion' | 'distribucion' | null;
  nombre: string;
  slug: string;
  facturacion_eur: number;
  facturacion_raw: string;
  provincia: string;
  fuente_url: string;
  signal_score: number; // 0-100
  signal_rationale: string;
  fuente_descripcion: string; // "BORME", "Cuentas anuales 2024", "LinkedIn", etc.
}

export interface CuratorResult {
  sector: SectorCodigo;
  cnae: string;
  rows: TopNRow[];
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_eur: number; // siempre 0 con DeepSeek en esta config
  cached: boolean;
}

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 3;

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  model?: string;
}

const cache = new Map<string, CuratorResult>();

function buildPrompt(cnae: CnaeEntry, topN: number, ventanaAnios: number): string {
  return `Eres un analista de inteligencia de mercado especializado en sector industrial español.

OBJETIVO: Listar las ${topN} mayores empresas españolas activas en el CNAE-4d ${cnae.cnae} ("${cnae.literal}"), con facturación reportada en los últimos ${ventanaAnios} años (2022-2024).

FUENTES VÁLIDAS (en orden de prioridad):
1. BORME (Actos inscritos, cuentas anuales depositadas)
2. Registro Mercantil (cuentas anuales consolidadas)
3. Notas de prensa corporativas
4. LinkedIn corporativo (facturación estimada si no hay cuentas)
5. Prensa económica nacional (Expansión, Cinco Días, El Economista)
6. Anuarios sectoriales (Alimarket, etc.) — solo si accesibles públicamente

REGLAS ESTRICTAS:
- Devuelve EXCLUSIVAMENTE empresas con sede social en España
- No inventes CIFs. Si no conoces el CIF, devuelve cadena vacía
- facturacion_eur = número entero en euros (sin puntos ni comas). Si facturación desconocida, 0
- fuente_url: URL real o "BORME-A-YYYYMMDD" si es referencia BORME
- signal_score (0-100): combina tamaño (40%), antigüedad empresa (20%), y relevancia para desimplantación industrial Surus (40%)
- fuente_descripcion: tipo de fuente ("BORME", "Cuentas anuales 2024", "LinkedIn", "Prensa", "Anuario")

FORMATO DE SALIDA (JSON estricto):
{
  "empresas": [
    {
      "pos": 1,
      "nombre": "Razón social exacta",
      "slug": "nombre-normalizado-slug",
      "facturacion_eur": 12345678,
      "facturacion_raw": "12.345.678 €",
      "provincia": "Madrid",
      "fuente_url": "https://...",
      "fuente_descripcion": "Cuentas anuales 2023",
      "signal_score": 85,
      "signal_rationale": "Facturación alta + planta con >20 años antigüedad"
    }
  ]
}

Devuelve solo el JSON, sin texto adicional.`;
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  // Acepta JSON envuelto en ```json ... ``` o directo
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/);
  const raw = fenced ? fenced[1] : trimmed;
  return JSON.parse(raw);
}

function validateRow(input: unknown, index: number): TopNRow {
  if (!input || typeof input !== 'object') {
    throw new Error(`Fila ${index} no es objeto`);
  }
  const row = input as Record<string, unknown>;
  const requiredStrings = ['nombre', 'slug', 'provincia', 'fuente_url', 'fuente_descripcion'];
  for (const key of requiredStrings) {
    if (typeof row[key] !== 'string') {
      throw new Error(`Fila ${index} campo "${key}" no es string`);
    }
  }
  if (typeof row.facturacion_eur !== 'number' || row.facturacion_eur < 0) {
    throw new Error(`Fila ${index} facturacion_eur inválido`);
  }
  if (typeof row.signal_score !== 'number' || row.signal_score < 0 || row.signal_score > 100) {
    throw new Error(`Fila ${index} signal_score fuera de rango 0-100`);
  }
  return {
    pos: typeof row.pos === 'number' ? row.pos : index + 1,
    cnae_4d: typeof row.cnae_4d === 'string' ? row.cnae_4d : '',
    etapa_cadena: null,
    nombre: (row.nombre as string).trim(),
    slug: (row.slug as string).trim().toLowerCase(),
    facturacion_eur: Math.round(row.facturacion_eur),
    facturacion_raw: typeof row.facturacion_raw === 'string' ? row.facturacion_raw : `${row.facturacion_eur}`,
    provincia: (row.provincia as string).trim(),
    fuente_url: (row.fuente_url as string).trim(),
    signal_score: Math.round(row.signal_score),
    signal_rationale: typeof row.signal_rationale === 'string' ? row.signal_rationale : '',
    fuente_descripcion: (row.fuente_descripcion as string).trim(),
  };
}

export interface CurateOptions {
  topN?: number;
  ventanaAnios?: number;
  useCache?: boolean;
}

export async function curateTopN(
  sector: SectorCodigo,
  cnae: CnaeEntry,
  opts: CurateOptions = {}
): Promise<CuratorResult> {
  const topN = opts.topN ?? 100;
  const ventanaAnios = opts.ventanaAnios ?? 3;
  const useCache = opts.useCache ?? true;

  const cacheKey = `${sector}:${cnae.cnae}:${topN}:${ventanaAnios}`;
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY no configurada en variables de entorno');
  }

  const prompt = buildPrompt(cnae, topN, ventanaAnios);
  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: 'Eres un analista de inteligencia de mercado. Respondes exclusivamente con JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' as const },
    max_tokens: 4096,
  };

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const backoff = 2000 * attempt;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        lastError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        if (attempt < MAX_RETRIES) {
          const backoff = 2000 * attempt;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        break;
      }

      const data = (await res.json()) as DeepSeekResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = 'Respuesta sin contenido';
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        break;
      }

      const parsed = extractJson(content);
      const empresasRaw = (parsed as { empresas?: unknown[] }).empresas;
      if (!Array.isArray(empresasRaw)) {
        lastError = 'JSON sin array "empresas"';
        break;
      }

      const rows: TopNRow[] = [];
      const seenSlugs = new Set<string>();
      for (let i = 0; i < empresasRaw.length; i++) {
        try {
          const row = validateRow(empresasRaw[i], i);
          if (seenSlugs.has(row.slug)) continue;
          seenSlugs.add(row.slug);
          row.cnae_4d = cnae.cnae;
          if (sector === 'a&b' && cnae.etapa) {
            row.etapa_cadena = cnae.etapa;
          }
          row.pos = rows.length + 1;
          rows.push(row);
        } catch {
          // skip fila inválida, continúa
        }
      }

      rows.sort((a, b) => b.signal_score - a.signal_score);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r) r.pos = i + 1;
      }

      const result: CuratorResult = {
        sector,
        cnae: cnae.cnae,
        rows: rows.slice(0, topN),
        model: data.model ?? DEEPSEEK_MODEL,
        tokens_in: data.usage?.prompt_tokens ?? 0,
        tokens_out: data.usage?.completion_tokens ?? 0,
        cost_eur: 0,
        cached: false,
      };

      cache.set(cacheKey, result);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
      lastError = msg;
      if (attempt < MAX_RETRIES) {
        const backoff = 2000 * attempt;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
    }
  }

  throw new Error(`DeepSeek curator falló tras ${MAX_RETRIES} intentos: ${lastError ?? 'unknown'}`);
}

export function clearCache(): void {
  cache.clear();
}

export function cacheSize(): number {
  return cache.size;
}
