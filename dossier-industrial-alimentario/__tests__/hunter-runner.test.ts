// __tests__/hunter-runner.test.ts — Sprint E.1b
// Verifica que hunter-runner enchufa verifyEmailWithCache antes de marcar emailVerified:true.
// Stack: node:test (built-in ESM) + tsx loader. Sin jest, sin deps nuevas.

import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

// ─── In-memory Prisma (inyectado como deps) ─────────────────────────────────

function makeMockPrisma() {
  const mockContacts: any[] = [];
  const mockEmailVerification: any[] = [];
  return {
    mockContacts,
    mockEmailVerification,
    prisma: {
      plantContact: {
        findMany: async (args: any) => mockContacts.slice(0, args.take ?? 20),
        update: async (args: any) => {
          const c = mockContacts.find((x) => x.id === args.where.id);
          if (c) Object.assign(c, args.data);
          return c;
        },
      },
      emailVerification: {
        findUnique: async (args: any) =>
          mockEmailVerification.find((x) => x.email === args.where.email) ?? null,
        upsert: async (args: any) => {
          const existing = mockEmailVerification.find((x) => x.email === args.where.email);
          if (existing) {
            Object.assign(existing, args.update);
            return existing;
          }
          const created = { ...args.create, expiresAt: new Date(Date.now() + 30 * 86400000) };
          mockEmailVerification.push(created);
          return created;
        },
      },
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function installAxiosMock(finderBody: any, verifierBody: any) {
  mock.method(axios, 'get', async (url: any, config: any) => {
    const u = String(url);
    // Devolvemos { data, status } como axios real, para que el verifier
    // (lib/agents/email-verifier.ts) vea status=200 y parsee body.data.
    if (u.includes('/email-finder')) return { data: finderBody, status: 200, statusText: 'OK', headers: {}, config };
    if (u.includes('/email-verifier')) return { data: verifierBody, status: 200, statusText: 'OK', headers: {}, config };
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test('NO persiste email cuando /email-verifier devuelve status=invalid', async () => {
  const { mockContacts, prisma } = makeMockPrisma();
  mockContacts.push({
    id: 'c1',
    fullName: 'Juan Pérez',
    linkedinUrl: 'https://linkedin.com/in/juanperez',
    email: null,
    emailVerified: false,
    lastEnrichedAt: new Date(0),
    company: { website: 'https://pascual.com' },
  });

  installAxiosMock(
    { data: { email: 'juan@pascual.com', score: 90 } },
    { data: { status: 'invalid', score: 0 } },
  );

  const { runHunterEnricher } = await import('../lib/agents/hunter-runner');
  const r = await runHunterEnricher({
    maxContacts: 1,
    deps: { prisma, hunterKey: 'test-key' },
  });

  assert.equal(r.rejectedByVerifier, 1);
  assert.equal(r.enriched, 0);
  assert.equal(mockContacts[0].email, null);
  assert.equal(mockContacts[0].emailVerified, false);
  mock.restoreAll();
});

test('SÍ persiste email cuando /email-verifier devuelve status=valid', async () => {
  const { mockContacts, prisma } = makeMockPrisma();
  mockContacts.push({
    id: 'c2',
    fullName: 'Maria Lopez',
    linkedinUrl: 'https://linkedin.com/in/marialopez',
    email: null,
    emailVerified: false,
    lastEnrichedAt: new Date(0),
    company: { website: 'https://mahou-sanmiguel.com' },
  });

  installAxiosMock(
    { data: { email: 'maria@mahou-sanmiguel.com', score: 95 } },
    { data: { status: 'valid', score: 95 } },
  );

  const { runHunterEnricher } = await import('../lib/agents/hunter-runner');
  const r = await runHunterEnricher({
    maxContacts: 1,
    deps: { prisma, hunterKey: 'test-key' },
  });

  assert.equal(r.enriched, 1);
  assert.equal(r.rejectedByVerifier, 0);
  assert.equal(mockContacts[0].email, 'maria@mahou-sanmiguel.com');
  assert.equal(mockContacts[0].emailVerified, true);
  mock.restoreAll();
});

test('persiste con accept_all cuando /email-verifier devuelve accept_all', async () => {
  const { mockContacts, prisma } = makeMockPrisma();
  mockContacts.push({
    id: 'c3',
    fullName: 'Pedro García',
    linkedinUrl: 'https://linkedin.com/in/pedrogarcia',
    email: null,
    emailVerified: false,
    lastEnrichedAt: new Date(0),
    company: { website: 'https://bimbo.es' },
  });

  installAxiosMock(
    { data: { email: 'pedro@bimbo.es', score: 85 } },
    { data: { status: 'accept_all', score: 60 } },
  );

  const { runHunterEnricher } = await import('../lib/agents/hunter-runner');
  const r = await runHunterEnricher({
    maxContacts: 1,
    deps: { prisma, hunterKey: 'test-key' },
  });

  assert.equal(r.enriched, 1);
  assert.equal(r.acceptedUnknown, 1);
  assert.equal(mockContacts[0].emailVerified, true);
  mock.restoreAll();
});

// Silenciar unused warning de beforeEach si no se usa
void beforeEach;
