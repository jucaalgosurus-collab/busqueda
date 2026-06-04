// lib/agents/email-verifier.ts — Cache verificación Hunter.io 30d
// Sprint D.1.6 — Regla 10208: "Si una sede/contacto YA está verificado,
// NO lo tienes que volver a comprobar ni buscar." Cada crédito Hunter
// es dinero, así que persistimos el resultado en EmailVerification
// durante 30 días. Rate-limit (429) NO se persiste (no queremos grabar
// un fallo transitorio como si fuera definitivo).
//
// Uso típico:
//   import { verifyEmailWithCache, purgeExpired } from '@/lib/agents/email-verifier';
//   const key = process.env.HUNTER_API_KEY!;
//   const result = await verifyEmailWithCache(email, key, prisma);

import type { PrismaClient } from '@prisma/client';
import axios, { AxiosError } from 'axios';

const HUNTER_API = 'https://api.hunter.io/v2';
const HUNTER_TIMEOUT_MS = 8_000;
const HUNTER_RETRIES = 1; // total = 1 intento + 1 retry
const CACHE_TTL_DAYS = 30;

export type EmailStatus =
  | 'valid'
  | 'invalid'
  | 'accept_all'
  | 'unknown'
  | 'disposable'
  | 'webmail'
  | 'error';

export interface EmailVerificationResult {
  email: string;
  status: EmailStatus;
  score: number | null;
  cached: boolean;
  verifiedAt: Date;
}

/** Respuesta Hunter.io v2 — sólo los campos que necesitamos. */
interface HunterVerifyResponse {
  data?: {
    status?: EmailStatus;
    score?: number;
    result?: string;
    _deprecation_notice?: string;
  };
  errors?: Array<{ id?: string; code?: string; details?: string }>;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Una llamada HTTP a Hunter con 1 retry + backoff exponencial (1s, 2s).
 * Devuelve el objeto axios response en éxito, o null si agotó reintentos.
 */
async function callHunter(
  email: string,
  apiKey: string,
): Promise<{ status: number; body: HunterVerifyResponse } | null> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= HUNTER_RETRIES; attempt++) {
    try {
      const res = await axios.get<HunterVerifyResponse>(
        `${HUNTER_API}/email-verifier`,
        {
          params: { email, api_key: apiKey },
          timeout: HUNTER_TIMEOUT_MS,
        },
      );
      return { status: res.status, body: res.data };
    } catch (e) {
      lastErr = e;
      const ax = e as AxiosError;
      // Cualquier respuesta HTTP con status conocido NO se reintenta:
      // el cliente (caller) decide qué hacer con 400/401/403/429/5xx.
      const code = ax.response?.status;
      if (code) {
        return { status: code, body: (ax.response?.data ?? {}) as HunterVerifyResponse };
      }
      // Sólo reintentamos errores de red / timeout (sin response).
      if (attempt < HUNTER_RETRIES) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
    }
  }
  // Agotó reintentos sin respuesta
  if (lastErr) {
    const ax = lastErr as AxiosError;
    if (ax.response?.status) {
      return {
        status: ax.response.status,
        body: (ax.response.data ?? {}) as HunterVerifyResponse,
      };
    }
  }
  return null;
}

/**
 * Verifica un email vía Hunter.io. Cachea el resultado 30 días (regla 10208).
 * - Si email YA está en cache y expiresAt > now → devuelve cached=true sin
 *   llamar a Hunter.
 * - Si Hunter devuelve 200 → parsea status/score y persiste.
 * - 400 (email malformado) → status='invalid', persiste.
 * - 401/403 → throw "Hunter auth failed" (key inválida).
 * - 429 → throw "Hunter rate limited" SIN persistir.
 * - 5xx / red tras retries → throw "Hunter 5xx" / "Hunter unreachable" SIN persistir.
 * - status='unknown' / 'accept_all' / 'disposable' / 'webmail' → SÍ persiste
 *   (regla 10208: no reintentar en 30d aunque sea unknown).
 */
export async function verifyEmailWithCache(
  email: string,
  hunterApiKey: string,
  prisma: PrismaClient,
): Promise<EmailVerificationResult> {
  if (!email || !hunterApiKey) {
    throw new Error('verifyEmailWithCache: email y hunterApiKey son obligatorios');
  }

  // 1) Cache lookup (case-insensitive — guardamos lower para que el constraint
  //    @unique no se rompa por "Foo@x.com" vs "foo@x.com")
  const normalized = email.trim().toLowerCase();
  const now = new Date();
  const cached = await prisma.emailVerification.findUnique({
    where: { email: normalized },
  });
  if (cached && cached.expiresAt > now) {
    return {
      email: cached.email,
      status: cached.status as EmailStatus,
      score: cached.score,
      cached: true,
      verifiedAt: cached.verifiedAt,
    };
  }

  // 2) Llamada a Hunter (con 1 retry)
  const res = await callHunter(normalized, hunterApiKey);
  if (!res) {
    // Sin respuesta tras retries (red rota, timeout) → no persistir
    throw new Error('Hunter unreachable (timeout/red)');
  }

  // 3) Mapeo por status code
  if (res.status === 429) {
    throw new Error('Hunter rate limited (429)');
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Hunter auth failed (401/403)');
  }
  if (res.status === 400) {
    // Email malformado — cacheamos como 'invalid' para no reintentar
    const expiresAt = addDays(now, CACHE_TTL_DAYS);
    const saved = await prisma.emailVerification.upsert({
      where: { email: normalized },
      update: { status: 'invalid', score: null, verifiedAt: now, expiresAt, raw: res.body as object },
      create: { email: normalized, status: 'invalid', score: null, verifiedAt: now, expiresAt, raw: res.body as object },
    });
    return { email: saved.email, status: 'invalid', score: null, cached: false, verifiedAt: saved.verifiedAt };
  }
  if (res.status >= 500) {
    throw new Error(`Hunter 5xx (${res.status})`);
  }
  if (res.status !== 200) {
    throw new Error(`Hunter unexpected status (${res.status})`);
  }

  // 4) 200 OK — parsear
  const hunterStatus = res.body.data?.status;
  const status: EmailStatus =
    hunterStatus && ['valid', 'invalid', 'accept_all', 'unknown', 'disposable', 'webmail'].includes(hunterStatus)
      ? (hunterStatus as EmailStatus)
      : 'error';
  const score = typeof res.body.data?.score === 'number' ? res.body.data.score : null;
  const expiresAt = addDays(now, CACHE_TTL_DAYS);

  const saved = await prisma.emailVerification.upsert({
    where: { email: normalized },
    update: { status, score, verifiedAt: now, expiresAt, raw: res.body as object },
    create: { email: normalized, status, score, verifiedAt: now, expiresAt, raw: res.body as object },
  });

  return {
    email: saved.email,
    status: saved.status as EmailStatus,
    score: saved.score,
    cached: false,
    verifiedAt: saved.verifiedAt,
  };
}

/**
 * Borra entradas con expiresAt < now. Pensado para correr en cron diario.
 * Devuelve el número de filas eliminadas.
 */
export async function purgeExpired(prisma: PrismaClient): Promise<number> {
  const result = await prisma.emailVerification.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
