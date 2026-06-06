// lib/orch/subagent.ts — Ejecución paralela de tareas con timeout/retry/backoff
// Sprint Orch.1 — Promise.allSettled + AbortController por tarea
import type { SubagentConfig, Task, TaskResult } from './types';
import { DEFAULTS } from './types';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message));
}

function defaultIsRetryable(): boolean {
  return true;
}

async function runWithTimeout<T>(
  run: () => Promise<T>,
  timeoutMs: number,
  signal: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      const e = new Error(`timeout after ${timeoutMs}ms`);
      e.name = 'AbortError';
      reject(e);
    }, timeoutMs);
    run()
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

async function executeOne<T>(
  task: Task<T>,
  cfg: Required<SubagentConfig>
): Promise<TaskResult<T>> {
  const start = Date.now();
  let lastError: unknown = null;
  let backoff = cfg.backoffMs;
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    const ctrl = new AbortController();
    try {
      const value = await runWithTimeout(task.run, cfg.timeoutMs, ctrl.signal);
      return {
        name: task.name,
        status: 'ok',
        value,
        durationMs: Date.now() - start,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err;
      if (isAbortError(err)) {
        return {
          name: task.name,
          status: 'timeout',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
          attempts: attempt,
        };
      }
      const retryable = cfg.isRetryable(err);
      if (!retryable || attempt === cfg.maxAttempts) {
        return {
          name: task.name,
          status: 'fail',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
          attempts: attempt,
        };
      }
      await delay(backoff);
      backoff *= cfg.backoffMultiplier;
    }
  }
  // Unreachable, but TS wants an exhaustive return
  return {
    name: task.name,
    status: 'fail',
    error: lastError instanceof Error ? lastError.message : String(lastError),
    durationMs: Date.now() - start,
    attempts: cfg.maxAttempts,
  };
}

export async function runParallel<T = unknown>(
  tasks: Task<T>[],
  config: SubagentConfig = {}
): Promise<TaskResult<T>[]> {
  const cfg: Required<SubagentConfig> = {
    ...DEFAULTS,
    ...config,
    isRetryable: config.isRetryable ?? defaultIsRetryable,
  };
  const results: TaskResult<T>[] = new Array(tasks.length);
  let nextIdx = 0;
  const workers = Array.from(
    { length: Math.min(cfg.concurrency, tasks.length) },
    async () => {
      while (true) {
        const i = nextIdx++;
        if (i >= tasks.length) return;
        results[i] = await executeOne(tasks[i]!, cfg);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
