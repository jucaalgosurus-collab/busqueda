// lib/orch/subagent.test.ts — Tests del subagente paralelo
// Sprint Orch.1 — 5 tests: parallel, timeout, retry, partial failure, all-fail
import { describe, it, expect } from 'vitest';
import { runParallel } from './subagent';
import type { Task } from './types';

describe('runParallel', () => {
  it('runs tasks in parallel and returns all results', async () => {
    const start = Date.now();
    const tasks: Task<number>[] = [
      { name: 'a', run: () => new Promise((r) => setTimeout(() => r(1), 100)) },
      { name: 'b', run: () => new Promise((r) => setTimeout(() => r(2), 100)) },
      { name: 'c', run: () => new Promise((r) => setTimeout(() => r(3), 100)) },
    ];
    const results = await runParallel(tasks);
    const elapsed = Date.now() - start;
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'ok')).toBe(true);
    expect(results.map((r) => r.value).sort()).toEqual([1, 2, 3]);
    // Parallel should take ~100ms, sequential would be ~300ms
    expect(elapsed).toBeLessThan(250);
  });

  it('returns status=timeout when a task exceeds timeoutMs', async () => {
    const tasks: Task<unknown>[] = [
      {
        name: 'slow',
        run: () => new Promise((r) => setTimeout(() => r('late'), 500)),
      },
    ];
    const results = await runParallel(tasks, { timeoutMs: 50 });
    expect(results[0]?.status).toBe('timeout');
    expect(results[0]?.attempts).toBe(1);
  });

  it('retries on retryable errors with backoff and eventually succeeds', async () => {
    let calls = 0;
    const tasks: Task<string>[] = [
      {
        name: 'flaky',
        run: () => {
          calls++;
          if (calls < 3) throw new Error('transient');
          return Promise.resolve('ok');
        },
      },
    ];
    const results = await runParallel(tasks, {
      maxAttempts: 3,
      backoffMs: 10,
      backoffMultiplier: 2,
    });
    expect(results[0]?.status).toBe('ok');
    expect(results[0]?.value).toBe('ok');
    expect(results[0]?.attempts).toBe(3);
  });

  it('marks individual tasks as fail while others succeed (partial failure)', async () => {
    const tasks: Task<unknown>[] = [
      { name: 'good', run: () => Promise.resolve(42) },
      {
        name: 'bad',
        run: () => Promise.reject(new Error('boom')),
        // Mark as not retryable so it fails fast
      } as Task<unknown>,
    ];
    const results = await runParallel(tasks, {
      maxAttempts: 1,
      isRetryable: () => false,
    });
    expect(results[0]?.status).toBe('ok');
    expect(results[0]?.value).toBe(42);
    expect(results[1]?.status).toBe('fail');
    expect(results[1]?.error).toBe('boom');
  });

  it('handles all-fail without throwing', async () => {
    const tasks: Task<unknown>[] = [
      {
        name: 'a',
        run: () => Promise.reject(new Error('e1')),
      } as Task<unknown>,
      {
        name: 'b',
        run: () => Promise.reject(new Error('e2')),
      } as Task<unknown>,
    ];
    const results = await runParallel(tasks, {
      maxAttempts: 1,
      isRetryable: () => false,
    });
    expect(results.every((r) => r.status === 'fail')).toBe(true);
    expect(results[0]?.error).toBe('e1');
    expect(results[1]?.error).toBe('e2');
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const mk = (): Task<number> => ({
      name: 't',
      run: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 30));
        active--;
        return peak;
      },
    });
    await runParallel([mk(), mk(), mk(), mk()], { concurrency: 2 });
    expect(peak).toBeLessThanOrEqual(2);
  });
});
