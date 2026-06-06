// lib/orch/types.ts — Tipos del subagente paralelo
// Sprint Orch.1 — Ejecución paralela de tareas con timeout/retry

export interface Task<T> {
  name: string;
  run: () => Promise<T>;
}

export type TaskStatus = 'ok' | 'fail' | 'timeout';

export interface TaskResult<T = unknown> {
  name: string;
  status: TaskStatus;
  value?: T;
  error?: string;
  durationMs: number;
  attempts: number;
}

export interface SubagentConfig {
  /** Timeout per task in ms (default 30_000) */
  timeoutMs?: number;
  /** Max attempts including the first (default 1 = no retry) */
  maxAttempts?: number;
  /** Initial backoff in ms (default 200) */
  backoffMs?: number;
  /** Backoff multiplier (default 2) */
  backoffMultiplier?: number;
  /** Max concurrent tasks (default unlimited) */
  concurrency?: number;
  /** Predicate to decide if an error is retryable (default: any error) */
  isRetryable?: (err: unknown) => boolean;
}

export const DEFAULTS = {
  timeoutMs: 30_000,
  maxAttempts: 1,
  backoffMs: 200,
  backoffMultiplier: 2,
  concurrency: Infinity,
} as const satisfies Required<Pick<SubagentConfig,
  'timeoutMs' | 'maxAttempts' | 'backoffMs' | 'backoffMultiplier' | 'concurrency'>>;
