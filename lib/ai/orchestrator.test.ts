// lib/ai/orchestrator.test.ts — Tests del orquestador con fallback
// Sprint G.3
import assert from 'node:assert/strict';
import type { AIProviderClient, AIRequest, AIResponse, AIError } from './types';
import { AIOrchestrator } from './orchestrator';

function mockClient(
  name: 'deepseek' | 'gemini',
  impl: { available?: boolean; complete?: (req: AIRequest) => Promise<AIResponse> } = {}
): AIProviderClient {
  return {
    name,
    available: async () => impl.available ?? true,
    complete: impl.complete ?? (async () => ({ provider: name, text: '', model: 'm', durationMs: 0, grounded: false })),
  };
}

function retryable(provider: string, msg: string): never {
  throw Object.assign(new Error(msg), { provider, retryable: true, error: msg, statusCode: 503 });
}

function nonRetryable(provider: string, msg: string): never {
  throw Object.assign(new Error(msg), { provider, retryable: false, error: msg });
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
  {
    name: 'returns primary response when primary succeeds',
    async fn() {
      const primary = mockClient('deepseek', {
        complete: async () => ({ provider: 'deepseek', text: 'hello', model: 'm', durationMs: 10, grounded: false }),
      });
      const fallback = mockClient('gemini');
      const orch = new AIOrchestrator({ primary, fallback, maxRetries: 0, retryDelayMs: 0 });
      const res = await orch.complete({ prompt: 'hi' });
      assert.equal(res.provider, 'deepseek');
      assert.equal(res.text, 'hello');
    },
  },
  {
    name: 'falls back to Gemini when primary fails with retryable error',
    async fn() {
      const primary = mockClient('deepseek', { complete: async () => retryable('deepseek', '503') });
      const fallback = mockClient('gemini', {
        complete: async () => ({ provider: 'gemini', text: 'fallback-ok', model: 'g', durationMs: 5, grounded: true }),
      });
      const orch = new AIOrchestrator({ primary, fallback, maxRetries: 0, retryDelayMs: 0 });
      const res = await orch.complete({ prompt: 'hi' });
      assert.equal(res.provider, 'gemini');
      assert.equal(res.text, 'fallback-ok');
    },
  },
  {
    name: 'does not retry on non-retryable error, goes to fallback',
    async fn() {
      let primaryCalls = 0;
      const primary = mockClient('deepseek', {
        complete: async () => {
          primaryCalls++;
          nonRetryable('deepseek', 'bad request');
        },
      });
      const fallback = mockClient('gemini', {
        complete: async () => ({ provider: 'gemini', text: 'fb', model: 'g', durationMs: 0, grounded: false }),
      });
      const orch = new AIOrchestrator({ primary, fallback, maxRetries: 3, retryDelayMs: 0 });
      const res = await orch.complete({ prompt: 'hi' });
      assert.equal(primaryCalls, 1, 'non-retryable should not retry');
      assert.equal(res.provider, 'gemini');
    },
  },
  {
    name: 'retries up to maxRetries before falling back',
    async fn() {
      let primaryCalls = 0;
      const primary = mockClient('deepseek', {
        complete: async () => {
          primaryCalls++;
          retryable('deepseek', '503');
        },
      });
      const fallback = mockClient('gemini', {
        complete: async () => ({ provider: 'gemini', text: 'fb', model: 'g', durationMs: 0, grounded: false }),
      });
      const orch = new AIOrchestrator({ primary, fallback, maxRetries: 2, retryDelayMs: 0 });
      const res = await orch.complete({ prompt: 'hi' });
      assert.equal(primaryCalls, 3, 'should try 1 + maxRetries=2');
      assert.equal(res.provider, 'gemini');
    },
  },
  {
    name: 'throws AggregateError when both primary and fallback fail',
    async fn() {
      const primary = mockClient('deepseek', { complete: async () => nonRetryable('deepseek', 'fail') });
      const fallback = mockClient('gemini', { complete: async () => nonRetryable('gemini', 'fail2') });
      const orch = new AIOrchestrator({ primary, fallback, maxRetries: 0, retryDelayMs: 0 });
      await assert.rejects(() => orch.complete({ prompt: 'hi' }), AggregateError);
    },
  },
  {
    name: 'throws when fallback unavailable after primary failure',
    async fn() {
      const primary = mockClient('deepseek', { complete: async () => nonRetryable('deepseek', 'fail') });
      const fallback = mockClient('gemini', { available: false });
      const orch = new AIOrchestrator({ primary, fallback, maxRetries: 0, retryDelayMs: 0 });
      await assert.rejects(() => orch.complete({ prompt: 'hi' }), AggregateError);
    },
  },
  {
    name: 'forwards grounding request to Gemini',
    async fn() {
      const primary = mockClient('deepseek', { complete: async () => nonRetryable('deepseek', 'fail') });
      const fallback = mockClient('gemini', {
        complete: async (req) => ({
          provider: 'gemini',
          text: 'grounded',
          model: 'g',
          durationMs: 0,
          grounded: req.grounding !== false,
          sources: [{ url: 'https://example.com', title: 'Example' }],
        }),
      });
      const orch = new AIOrchestrator({ primary, fallback, maxRetries: 0, retryDelayMs: 0 });
      const res = await orch.complete({ prompt: 'hi', grounding: true });
      assert.equal(res.grounded, true);
      assert.equal(res.sources?.[0].url, 'https://example.com');
    },
  },
];

async function main() {
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
  console.log(`\n${passed}/${tests.length} passed`);
  if (failed > 0) process.exit(1);
}

main();
