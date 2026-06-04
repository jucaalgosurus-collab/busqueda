// lib/scrapers/anti-detect/user-agent-rotator.ts
// Pool of 50+ realistic User-Agent strings (Chrome, Firefox, Safari, Edge)
// with weighted random pick. Refreshed monthly against actual current versions.
//
// Pool construction strategy: for each browser family, we keep 3-4 realistic
// recent versions. The rotator is intentionally a STATIC list — auto-fetching
// live UAs would add a network dependency and could be MITM-poisoned.

export interface UserAgentDescriptor {
  readonly ua: string;
  readonly browser: 'chrome' | 'firefox' | 'safari' | 'edge';
  readonly os: 'windows' | 'macos' | 'linux' | 'android' | 'ios';
  readonly weight: number;
}

// Weights tuned to match global browser share (Chrome 65%, Safari 19%,
// Firefox 3%, Edge 5%, others 8%).
export const UA_POOL: readonly UserAgentDescriptor[] = [
  // Chrome on Windows (most common)
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', browser: 'chrome', os: 'windows', weight: 12 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', browser: 'chrome', os: 'windows', weight: 10 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', browser: 'chrome', os: 'windows', weight: 8 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', browser: 'chrome', os: 'windows', weight: 6 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36', browser: 'chrome', os: 'windows', weight: 4 },
  // Chrome on macOS
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', browser: 'chrome', os: 'macos', weight: 6 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', browser: 'chrome', os: 'macos', weight: 5 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', browser: 'chrome', os: 'macos', weight: 3 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', browser: 'chrome', os: 'macos', weight: 2 },
  // Chrome on Linux
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', browser: 'chrome', os: 'linux', weight: 3 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', browser: 'chrome', os: 'linux', weight: 2 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', browser: 'chrome', os: 'linux', weight: 1 },
  // Chrome on Android
  { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 4 },
  { ua: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 3 },
  { ua: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 3 },
  { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 2 },
  { ua: 'Mozilla/5.0 (Linux; Android 12; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 2 },
  { ua: 'Mozilla/5.0 (Linux; Android 13; OnePlus 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 1 },
  // Firefox on Windows
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0', browser: 'firefox', os: 'windows', weight: 2 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', browser: 'firefox', os: 'windows', weight: 2 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0', browser: 'firefox', os: 'windows', weight: 1 },
  // Firefox on macOS
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0', browser: 'firefox', os: 'macos', weight: 1 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0', browser: 'firefox', os: 'macos', weight: 1 },
  // Firefox on Linux
  { ua: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', browser: 'firefox', os: 'linux', weight: 1 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', browser: 'firefox', os: 'linux', weight: 1 },
  // Safari on macOS
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', browser: 'safari', os: 'macos', weight: 7 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15', browser: 'safari', os: 'macos', weight: 6 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', browser: 'safari', os: 'macos', weight: 4 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15', browser: 'safari', os: 'macos', weight: 3 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15', browser: 'safari', os: 'macos', weight: 2 },
  // Safari on iOS
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', browser: 'safari', os: 'ios', weight: 5 },
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1', browser: 'safari', os: 'ios', weight: 4 },
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', browser: 'safari', os: 'ios', weight: 3 },
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', browser: 'safari', os: 'ios', weight: 2 },
  { ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', browser: 'safari', os: 'ios', weight: 2 },
  { ua: 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1', browser: 'safari', os: 'ios', weight: 1 },
  // Edge on Windows
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', browser: 'edge', os: 'windows', weight: 4 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', browser: 'edge', os: 'windows', weight: 3 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', browser: 'edge', os: 'windows', weight: 2 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0', browser: 'edge', os: 'windows', weight: 1 },
  // Edge on macOS
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', browser: 'edge', os: 'macos', weight: 2 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', browser: 'edge', os: 'macos', weight: 1 },
  // Opera on Windows
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0', browser: 'chrome', os: 'windows', weight: 1 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0', browser: 'chrome', os: 'windows', weight: 1 },
  // Brave on Windows
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Brave/131', browser: 'chrome', os: 'windows', weight: 1 },
  // Vivaldi on macOS
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/7.0.3495.21', browser: 'chrome', os: 'macos', weight: 1 },
  // Samsung Internet on Android
  { ua: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/130.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 1 },
  { ua: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/130.0.0.0 Mobile Safari/537.36', browser: 'chrome', os: 'android', weight: 1 },
  // Chrome on ChromeOS
  { ua: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', browser: 'chrome', os: 'linux', weight: 1 },
  // iPad Safari 16
  { ua: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1', browser: 'safari', os: 'ios', weight: 1 },
  // Chrome 126 (older but still in the wild)
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', browser: 'chrome', os: 'windows', weight: 1 },
  // Firefox 128 ESR
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0', browser: 'firefox', os: 'windows', weight: 1 },
  // Edge 127
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0', browser: 'edge', os: 'windows', weight: 1 },
  // Yandex on Windows
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 YaBrowser/24.1.0.0', browser: 'chrome', os: 'windows', weight: 1 },
];

const TOTAL_WEIGHT = UA_POOL.reduce((acc, d) => acc + d.weight, 0);

/**
 * Singleton rotator instance. Lazily constructed.
 * The constructor pre-computes a cumulative weight table so each pick is O(log n).
 */
export class UserAgentRotator {
  private readonly pool: readonly UserAgentDescriptor[];
  private readonly cumulative: readonly number[];
  private readonly rng: () => number;

  constructor(pool: readonly UserAgentDescriptor[] = UA_POOL, rng: () => number = Math.random) {
    if (pool.length === 0) throw new Error('UA_POOL cannot be empty');
    this.pool = pool;
    let acc = 0;
    const cum: number[] = [];
    for (const d of pool) {
      acc += d.weight;
      cum.push(acc);
    }
    this.cumulative = cum;
    this.rng = rng;
  }

  /** Pick a single UA based on weighted distribution. */
  pick(): string {
    const r = this.rng() * (this.cumulative[this.cumulative.length - 1] ?? TOTAL_WEIGHT);
    // binary search for the first cumulative >= r
    let lo = 0;
    let hi = this.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((this.cumulative[mid] ?? 0) < r) lo = mid + 1;
      else hi = mid;
    }
    return this.pool[lo]?.ua ?? this.pool[0]!.ua;
  }

  /** Pick `n` distinct UAs. Useful for batch jobs. */
  pickN(n: number): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    let attempts = 0;
    const maxAttempts = n * 10;
    while (out.length < n && attempts < maxAttempts) {
      const ua = this.pick();
      if (!seen.has(ua)) {
        seen.add(ua);
        out.push(ua);
      }
      attempts += 1;
    }
    return out;
  }

  /** Total number of distinct UAs in the pool. */
  get size(): number {
    return this.pool.length;
  }
}

let singleton: UserAgentRotator | null = null;

/** Get the singleton rotator (suitable for most use cases). */
export function getUserAgentRotator(): UserAgentRotator {
  if (!singleton) singleton = new UserAgentRotator();
  return singleton;
}

/** Test helper: reset the singleton (used by smoke tests). */
export function __resetUserAgentRotator(): void {
  singleton = null;
}
