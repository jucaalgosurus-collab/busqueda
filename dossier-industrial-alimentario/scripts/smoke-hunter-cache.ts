// scripts/smoke-hunter-cache.ts — Sprint D.1.6 (Cache verificación Hunter 30d)
// 6 asserts:
//   1. Cache hit: 2ª llamada con mismo email → cached=true, 1 solo HTTP call
//   2. Cache miss: 1ª llamada email nuevo → cached=false
//   3. Expirado: email con expiresAt < now → trata como cache miss
//   4. Rate limit: simular 429 → throws, NO persiste nada
//   5. Auth fail: simular 401 → throws
//   6. Purga: tras purgeExpired, los expirados desaparecen
//
// Mocking: axios se sustituye con un mock inline (no se instala nock).
// Prisma: como en local NO hay DB (P1001), usamos un fake PrismaClient en
// memoria con la API mínima que el helper consume.

import axios from 'axios';

// ─── In-memory PrismaClient (mínimo viable para el helper) ───────────────────
interface EVRow {
  id: string;
  email: string;
  status: string;
  score: number | null;
  verifiedAt: Date;
  expiresAt: Date;
  raw: unknown;
}

function makeFakePrisma() {
  const rows: EVRow[] = [];
  const model = {
    findUnique: async ({ where }: { where: { email: string } }) => {
      return rows.find((r) => r.email === where.email) ?? null;
    },
    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { email: string };
      update: Partial<EVRow>;
      create: EVRow;
    }) => {
      const existing = rows.find((r) => r.email === where.email);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      rows.push({ ...create });
      return rows[rows.length - 1];
    },
    deleteMany: async ({ where }: { where?: { expiresAt?: { lt: Date } } }) => {
      const before = rows.length;
      if (!where?.expiresAt) {
        rows.length = 0;
        return { count: before };
      }
      const kept = rows.filter((r) => r.expiresAt >= where.expiresAt!.lt!);
      const removed = before - kept.length;
      rows.length = 0;
      rows.push(...kept);
      return { count: removed };
    },
  };
  return {
    emailVerification: model,
    _rows: rows,
  };
}

type FakePrisma = ReturnType<typeof makeFakePrisma>;

// ─── Axios mock infrastructure ───────────────────────────────────────────────
let mockQueue: Array<() => Promise<unknown>> = [];
let callCount = 0;
const recordedCalls: Array<{ url: string; params: Record<string, unknown> }> = [];

function enqueueOk(status: string, score: number) {
  mockQueue.push(async () => ({
    status: 200,
    data: { data: { status, score, result: 'deliverable' } },
  }));
}
function enqueueBadRequest() {
  mockQueue.push(async () => {
    const err = new Error('Request failed with status code 400') as Error & {
      response: { status: number; data: unknown };
      isAxiosError: boolean;
    };
    err.isAxiosError = true;
    err.response = { status: 400, data: { errors: [{ details: 'Bad email' }] } };
    throw err;
  });
}
function enqueueUnauthorized() {
  mockQueue.push(async () => {
    const err = new Error('Request failed with status code 401') as Error & {
      response: { status: number; data: unknown };
      isAxiosError: boolean;
    };
    err.isAxiosError = true;
    err.response = { status: 401, data: { errors: [{ details: 'Invalid API key' }] } };
    throw err;
  });
}
function enqueueRateLimit() {
  mockQueue.push(async () => {
    const err = new Error('Request failed with status code 429') as Error & {
      response: { status: number; data: unknown };
      isAxiosError: boolean;
    };
    err.isAxiosError = true;
    err.response = { status: 429, data: { errors: [{ details: 'Too many requests' }] } };
    throw err;
  });
}

// Sustituimos axios.get por un mock que consume la cola
const originalGet = axios.get;
(axios as unknown as { get: typeof axios.get }).get = (async (
  url: string,
  cfg: { params?: Record<string, unknown> } = {},
) => {
  callCount++;
  recordedCalls.push({ url, params: cfg.params ?? {} });
  if (mockQueue.length === 0) {
    throw new Error('Mock queue exhausted — enqueue more responses');
  }
  const next = mockQueue.shift()!;
  return next();
}) as typeof axios.get;

// ─── Asserts infra ───────────────────────────────────────────────────────────
interface Assert { name: string; pass: boolean; detail?: string }
const results: Assert[] = [];
function assert(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

// ─── Imports DESPUÉS del mock de axios ────────────────────────────────────────
const { verifyEmailWithCache, purgeExpired } = await import('../lib/agents/email-verifier');

// ─── Tests ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint D.1.6 Hunter cache smoke (6 asserts) ===\n');

  // ─── 1. Cache hit ──────────────────────────────────────────────────────────
  console.log('— Cache hit / miss (2 asserts) —');
  {
    const prisma = makeFakePrisma();
    mockQueue = []; callCount = 0; recordedCalls.length = 0;
    enqueueOk('valid', 92);
    enqueueOk('valid', 92); // redundante: la 2ª llamada NUNCA debería llegar a axios

    const r1 = await verifyEmailWithCache('hit@example.com', 'fake-key', prisma as never);
    const r2 = await verifyEmailWithCache('hit@example.com', 'fake-key', prisma as never);

    assert(
      'D.1.6-1 [cache hit: 2ª llamada cached=true, 1 solo HTTP call]',
      r2.cached === true && callCount === 1,
      `r1.cached=${r1.cached} r2.cached=${r2.cached} httpCalls=${callCount}`,
    );

    // Miss explícito en r1
    assert(
      'D.1.6-2 [cache miss: 1ª llamada cached=false]',
      r1.cached === false,
      `r1.cached=${r1.cached}`,
    );
  }

  // ─── 2. Expirado ───────────────────────────────────────────────────────────
  console.log('\n— Expiración (1 assert) —');
  {
    const prisma = makeFakePrisma();
    mockQueue = []; callCount = 0; recordedCalls.length = 0;
    // Sembramos cache con expiresAt en el pasado
    prisma._rows.push({
      id: 'fake-1',
      email: 'old@example.com',
      status: 'valid',
      score: 80,
      verifiedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 24 * 3600 * 1000), // ayer
      raw: null,
    });
    enqueueOk('valid', 88);

    const r = await verifyEmailWithCache('old@example.com', 'fake-key', prisma as never);
    assert(
      'D.1.6-3 [expirado: trata como miss y vuelve a llamar a Hunter]',
      r.cached === false && callCount === 1,
      `r.cached=${r.cached} httpCalls=${callCount}`,
    );
  }

  // ─── 3. Rate limit NO persiste ─────────────────────────────────────────────
  console.log('\n— Errores Hunter (2 asserts) —');
  {
    const prisma = makeFakePrisma();
    mockQueue = []; callCount = 0; recordedCalls.length = 0;
    enqueueRateLimit();
    let threw = false;
    let errMsg = '';
    try {
      await verifyEmailWithCache('ratelimit@example.com', 'fake-key', prisma as never);
    } catch (e) {
      threw = true;
      errMsg = (e as Error).message;
    }
    assert(
      'D.1.6-4 [rate limit 429 → throws, NO persiste nada]',
      threw && errMsg.includes('rate limited') && prisma._rows.length === 0,
      `threw=${threw} msg="${errMsg}" rows=${prisma._rows.length}`,
    );

    // Auth fail
    mockQueue = []; callCount = 0; prisma._rows.length = 0;
    enqueueUnauthorized();
    threw = false;
    errMsg = '';
    try {
      await verifyEmailWithCache('authfail@example.com', 'bad-key', prisma as never);
    } catch (e) {
      threw = true;
      errMsg = (e as Error).message;
    }
    assert(
      'D.1.6-5 [auth fail 401 → throws, NO persiste nada]',
      threw && errMsg.includes('auth failed') && prisma._rows.length === 0,
      `threw=${threw} msg="${errMsg}" rows=${prisma._rows.length}`,
    );
  }

  // ─── 4. Purga ──────────────────────────────────────────────────────────────
  console.log('\n— Purga (1 assert) —');
  {
    const prisma = makeFakePrisma();
    // 3 filas: 1 viva + 2 expiradas
    prisma._rows.push({
      id: 'a', email: 'alive@example.com', status: 'valid', score: 90,
      verifiedAt: new Date(), expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000), raw: null,
    });
    prisma._rows.push({
      id: 'b', email: 'dead1@example.com', status: 'invalid', score: 10,
      verifiedAt: new Date(Date.now() - 40 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 10 * 24 * 3600 * 1000), raw: null,
    });
    prisma._rows.push({
      id: 'c', email: 'dead2@example.com', status: 'unknown', score: 50,
      verifiedAt: new Date(Date.now() - 40 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 1 * 24 * 3600 * 1000), raw: null,
    });

    const removed = await purgeExpired(prisma as never);
    const remainingEmails = prisma._rows.map((r) => r.email).sort();
    assert(
      'D.1.6-6 [purgeExpired: borra 2 expirados, deja el vivo]',
      removed === 2 && remainingEmails.length === 1 && remainingEmails[0] === 'alive@example.com',
      `removed=${removed} remaining=${JSON.stringify(remainingEmails)}`,
    );
  }

  // ─── Resumen ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== TOTAL: ${passed} pass / ${failed} fail ===`);
  if (failed > 0) {
    console.log('\nFAILED ASSERTS:');
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    }
  }
  // Restaurar axios.get para no contaminar otros procesos (buena práctica)
  (axios as unknown as { get: typeof axios.get }).get = originalGet;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('smoke-hunter-cache fatal:', e);
  (axios as unknown as { get: typeof axios.get }).get = originalGet;
  process.exit(1);
});
