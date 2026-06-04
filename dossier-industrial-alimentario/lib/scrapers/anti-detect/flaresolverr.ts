// lib/scrapers/anti-detect/flaresolverr.ts
// HTTP client for the FlareSolverr Docker sidecar (puerto 8191).
//
// FlareSolverr solves Cloudflare IUAM / Turnstile challenges server-side
// and returns the cleared HTML + cookies. Use it as a last-resort fallback
// when playwright-stealth cannot bypass a site's challenge.
//
// API contract (v3):
//   POST http://localhost:8191/v1
//   Body: {"cmd": "request.get", "url": "...", "maxTimeout": 60000, "session": "..."}
//   Response 200: {"status": "ok", "message": "", "solution": {"url", "status", "headers", "response", "cookies", "userAgent"}}
//   Response 200: {"status": "error", "message": "Challenge failed after X tries"}

const DEFAULT_BASE_URL = 'http://localhost:8191';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_TIMEOUT_MS = 60_000;

export interface FlaresolverrResponse {
  readonly status: 'ok' | 'error';
  readonly message: string;
  readonly solution: {
    readonly url: string;
    readonly status: number;
    readonly headers: Record<string, string>;
    readonly response: string;
    readonly cookies: Array<{ name: string; value: string; domain: string }>;
    readonly userAgent: string;
  } | null;
}

export interface FlaresolverrOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly maxTimeoutMs?: number;
  /** Session ID for cookie persistence across requests. */
  readonly session?: string;
}

export class FlaresolverrError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FlaresolverrError';
  }
}

/** Client for the FlareSolverr sidecar. */
export class FlaresolverrClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTimeoutMs: number;
  private sessionId: string | null = null;

  constructor(opts: FlaresolverrOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.FLARESOLVERR_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxTimeoutMs = opts.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS;
  }

  /**
   * Fetch a URL through FlareSolverr. The returned `response` field is the
   * full HTML body after Cloudflare has cleared the challenge.
   */
  async get(url: string, opts: { session?: string } = {}): Promise<FlaresolverrResponse> {
    const session = opts.session ?? this.sessionId;
    const body = {
      cmd: 'request.get',
      url,
      maxTimeout: this.maxTimeoutMs,
      ...(session ? { session } : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      throw new FlaresolverrError(`FlareSolverr request failed: ${e instanceof Error ? e.message : String(e)}`, e);
    }
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new FlaresolverrError(`FlareSolverr HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as FlaresolverrResponse;
    if (json.status === 'error') {
      throw new FlaresolverrError(`FlareSolverr challenge failed: ${json.message}`);
    }
    if (!json.solution) {
      throw new FlaresolverrError('FlareSolverr returned no solution');
    }
    // Track session for cookie persistence
    const setCookie = json.solution.headers['set-cookie'] ?? json.solution.headers['Set-Cookie'];
    if (setCookie && typeof setCookie === 'string' && setCookie.includes('cf_clearance')) {
      // Cookie-based session — caller can pass a stable session id next time
      this.sessionId = session ?? `dossier-${Date.now()}`;
    }
    return json;
  }

  /** Health check — returns true if the sidecar is reachable. */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }
}

let singleton: FlaresolverrClient | null = null;

/** Get the singleton FlareSolverr client. */
export function getFlaresolverr(): FlaresolverrClient {
  if (!singleton) singleton = new FlaresolverrClient();
  return singleton;
}

/** Test helper. */
export function __resetFlaresolverr(): void {
  singleton = null;
}
