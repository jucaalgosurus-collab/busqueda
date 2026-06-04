// lib/scrapers/anti-detect/proxy-rotator.ts
// Weighted proxy rotator with failure-aware deprioritization.
//
// Source: HERMES_PROXIES env var, format:
//   "http://user:pass@ip1:8080,http://user:pass@ip2:8080,socks5://ip3:1080"
//
// If env is empty, the rotator is a no-op (returns undefined, meaning
// "use direct connection"). This is the safe default — the dossier app
// should NEVER require proxies to work.

import * as fs from 'node:fs';

export interface ProxyDescriptor {
  readonly url: string;
  readonly protocol: 'http' | 'https' | 'socks5';
  initialWeight: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

export interface ProxyRotatorOptions {
  /** Override the proxy list (test helper). */
  readonly proxies?: readonly string[];
  /** Minimum weight — proxies below this are temporarily skipped. */
  readonly minWeight?: number;
  /** After N consecutive failures, halve the weight. */
  readonly failureDecayAfter?: number;
}

const DECAY_FACTOR = 0.5;
const FAILURE_DECAY_AFTER = 3;
const MIN_WEIGHT = 0.05;

export class ProxyRotator {
  private readonly proxies: ProxyDescriptor[];
  private readonly minWeight: number;
  private readonly failureDecayAfter: number;
  private readonly rng: () => number;

  constructor(opts: ProxyRotatorOptions = {}, rng: () => number = Math.random) {
    this.minWeight = opts.minWeight ?? MIN_WEIGHT;
    this.failureDecayAfter = opts.failureDecayAfter ?? FAILURE_DECAY_AFTER;
    this.rng = rng;
    const list = opts.proxies ?? this.loadFromEnv();
    this.proxies = list.map((url) => ({
      url,
      protocol: parseProtocol(url),
      initialWeight: 1,
      consecutiveFailures: 0,
      totalRequests: 0,
      totalFailures: 0,
    }));
  }

  /** True when no proxies are configured. */
  get isEmpty(): boolean {
    return this.proxies.length === 0;
  }

  /** Number of distinct proxies. */
  get size(): number {
    return this.proxies.length;
  }

  /**
   * Pick the next proxy URL. Returns undefined if no proxies configured.
   * Skips proxies with weight < minWeight.
   */
  pick(): string | undefined {
    if (this.proxies.length === 0) return undefined;
    const eligible = this.proxies.filter((p) => p.initialWeight >= this.minWeight);
    if (eligible.length === 0) {
      // All proxies penalized — reset one with fewest failures to give it a chance
      const reset = this.proxies.reduce((best, p) =>
        p.totalFailures < best.totalFailures ? p : best,
      );
      reset.consecutiveFailures = 0;
      reset.initialWeight = 1;
      return reset.url;
    }
    const totalWeight = eligible.reduce((acc, p) => acc + p.initialWeight, 0);
    const r = this.rng() * totalWeight;
    let acc = 0;
    for (const p of eligible) {
      acc += p.initialWeight;
      if (r <= acc) {
        p.totalRequests += 1;
        return p.url;
      }
    }
    // fallback to last
    const fallback = eligible[eligible.length - 1];
    if (fallback) {
      fallback.totalRequests += 1;
      return fallback.url;
    }
    return undefined;
  }

  /** Mark a proxy as having failed; reduces its future selection probability. */
  reportFailure(proxyUrl: string | undefined): void {
    if (!proxyUrl) return;
    const p = this.proxies.find((x) => x.url === proxyUrl);
    if (!p) return;
    p.consecutiveFailures += 1;
    p.totalFailures += 1;
    if (p.consecutiveFailures >= this.failureDecayAfter) {
      p.initialWeight = Math.max(this.minWeight, p.initialWeight * DECAY_FACTOR);
    }
  }

  /** Mark a proxy as having succeeded; restores its weight gradually. */
  reportSuccess(proxyUrl: string | undefined): void {
    if (!proxyUrl) return;
    const p = this.proxies.find((x) => x.url === proxyUrl);
    if (!p) return;
    p.consecutiveFailures = 0;
    p.initialWeight = Math.min(1, p.initialWeight + 0.1);
  }

  /** Diagnostic snapshot. */
  stats(): Array<{ url: string; weight: number; failures: number; requests: number }> {
    return this.proxies.map((p) => ({
      url: redact(p.url),
      weight: Number(p.initialWeight.toFixed(3)),
      failures: p.consecutiveFailures,
      requests: p.totalRequests,
    }));
  }

  private loadFromEnv(): readonly string[] {
    const fromEnv = process.env.HERMES_PROXIES;
    if (fromEnv && fromEnv.trim().length > 0) {
      return fromEnv
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    // Allow a file path as backup (for ops who don't want env in systemd units)
    const fromFile = process.env.HERMES_PROXIES_FILE;
    if (fromFile && fs.existsSync(fromFile)) {
      try {
        const text = fs.readFileSync(fromFile, 'utf-8');
        return text
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('#'));
      } catch {
        return [];
      }
    }
    return [];
  }
}

function parseProtocol(url: string): ProxyDescriptor['protocol'] {
  if (url.startsWith('socks5://')) return 'socks5';
  if (url.startsWith('https://')) return 'https';
  return 'http';
}

function redact(url: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

let singleton: ProxyRotator | null = null;

/** Get the singleton rotator (loads from env on first call). */
export function getProxyRotator(): ProxyRotator {
  if (!singleton) singleton = new ProxyRotator();
  return singleton;
}

/** Test helper. */
export function __resetProxyRotator(): void {
  singleton = null;
}
