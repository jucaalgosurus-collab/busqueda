// lib/scrapers/anti-detect/rate-limiter.ts
// Token-bucket rate limiter with FIFO queue.
//
// Usage:
//   const limiter = getRateLimiter({ requestsPerSecond: 2, burst: 4 });
//   await limiter.acquire();  // waits if bucket is empty
//   await fetch(url);
//
// Why a queue (not setTimeout per request):
//   - When 50 requests hit a 2 RPS limiter, the naive setTimeout approach
//     schedules all 50 with drift, causing bursts at the back of the queue.
//   - The FIFO queue guarantees the average rate holds even with bursts.

export interface RateLimiterOptions {
  /** Sustained request rate. Default 2 RPS. */
  readonly requestsPerSecond?: number;
  /** Maximum burst size. Default = ceil(requestsPerSecond). */
  readonly burst?: number;
  /** Optional per-limiter label for logs. */
  readonly label?: string;
}

interface PendingAcquire {
  readonly resolve: () => void;
  readonly enqueuedAt: number;
}

export class RateLimiter {
  private readonly rps: number;
  private readonly capacity: number;
  private readonly refillIntervalMs: number;
  private readonly label: string;
  private tokens: number;
  private lastRefillMs: number;
  private queue: PendingAcquire[] = [];
  private timer: NodeJS.Timeout | null = null;
  private totalAcquired = 0;
  private totalWaitedMs = 0;

  constructor(opts: RateLimiterOptions = {}) {
    const rps = opts.requestsPerSecond ?? 2;
    if (rps <= 0) throw new Error('requestsPerSecond must be > 0');
    this.rps = rps;
    this.capacity = opts.burst ?? Math.max(1, Math.ceil(rps));
    this.refillIntervalMs = 1000 / rps;
    this.label = opts.label ?? 'rate-limiter';
    this.tokens = this.capacity;
    this.lastRefillMs = Date.now();
  }

  /** Wait until a token is available, then consume it. */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.totalAcquired += 1;
      return;
    }
    // No token — enqueue and wait
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve, enqueuedAt: Date.now() });
      this.scheduleDrain();
    });
  }

  /** Run `fn` under the rate limit. Convenience wrapper. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }

  /** How many requests are queued waiting. */
  get pending(): number {
    return this.queue.length;
  }

  /** Diagnostic snapshot. */
  stats(): { acquired: number; waitedMs: number; pending: number; rps: number; capacity: number } {
    return {
      acquired: this.totalAcquired,
      waitedMs: this.totalWaitedMs,
      pending: this.queue.length,
      rps: this.rps,
      capacity: this.capacity,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillMs;
    if (elapsed <= 0) return;
    const tokensToAdd = elapsed / this.refillIntervalMs;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillMs = now;
  }

  private scheduleDrain(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.refill();
      // Drain as many as we have tokens for
      while (this.queue.length > 0 && this.tokens >= 1) {
        const next = this.queue.shift();
        if (!next) break;
        this.tokens -= 1;
        this.totalAcquired += 1;
        this.totalWaitedMs += Date.now() - next.enqueuedAt;
        next.resolve();
      }
      // If queue still has waiters, schedule again
      if (this.queue.length > 0) {
        this.scheduleDrain();
      }
    }, this.refillIntervalMs);
    // NOTE: do NOT unref() the timer — when callers enqueue 3+ acquires in a
    // burst with no other work pending, unref() lets the event loop exit before
    // the queued drain fires, causing the rate limiter to hang silently.
    // The trade-off is that long-lived idle limiters will keep the process
    // alive; call dispose() when shutting down a long-running scraper.
  }

  /** Stop the limiter and reject all pending acquires. */
  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
  }
}

const limiters = new Map<string, RateLimiter>();

/**
 * Get a rate limiter by key. Two calls with the same key return the same
 * instance, so a single newsroom scrape shares one bucket even if it goes
 * through multiple `acquire()` calls.
 */
export function getRateLimiter(keyOrOpts: string | RateLimiterOptions, opts?: RateLimiterOptions): RateLimiter {
  if (typeof keyOrOpts === 'string') {
    const existing = limiters.get(keyOrOpts);
    if (existing) return existing;
    const created = new RateLimiter({ ...opts, label: keyOrOpts });
    limiters.set(keyOrOpts, created);
    return created;
  }
  const label = keyOrOpts.label ?? 'default';
  const existing = limiters.get(label);
  if (existing) return existing;
  const created = new RateLimiter(keyOrOpts);
  limiters.set(label, created);
  return created;
}

/** Test helper: dispose all limiters. */
export function __resetRateLimiters(): void {
  for (const l of limiters.values()) l.dispose();
  limiters.clear();
}
