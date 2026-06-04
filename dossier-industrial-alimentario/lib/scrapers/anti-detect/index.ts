// lib/scrapers/anti-detect/index.ts
// Public surface of the anti-detect layer.
//
// Importers should use this barrel, not the individual files:
//   import { getStealthBrowser, getRateLimiter, getUserAgentRotator, getProxyRotator, getFlaresolverr } from '@/lib/scrapers/anti-detect';

import { getUserAgentRotator } from './user-agent-rotator';

export {
  getStealthBrowser,
  applyStealthToContext,
  type StealthLaunchOptions,
  type StealthBrowser,
} from './stealth';

export {
  getRateLimiter,
  __resetRateLimiters,
  RateLimiter,
  type RateLimiterOptions,
} from './rate-limiter';

export {
  getUserAgentRotator,
  __resetUserAgentRotator,
  UserAgentRotator,
  UA_POOL,
  type UserAgentDescriptor,
} from './user-agent-rotator';

export {
  getProxyRotator,
  __resetProxyRotator,
  ProxyRotator,
  type ProxyDescriptor,
  type ProxyRotatorOptions,
} from './proxy-rotator';

export {
  getFlaresolverr,
  __resetFlaresolverr,
  FlaresolverrClient,
  FlaresolverrError,
  type FlaresolverrOptions,
  type FlaresolverrResponse,
} from './flaresolverr';

/**
 * Build an axios-compatible headers object using a rotated UA + Spanish locale.
 * Use this for plain HTTP scrapers that don't need a full browser.
 */
export function buildRealisticHeaders(): {
  'User-Agent': string;
  Accept: string;
  'Accept-Language': string;
  'Accept-Encoding': string;
  'Cache-Control': string;
  Pragma: string;
  'Sec-Fetch-Dest': string;
  'Sec-Fetch-Mode': string;
  'Sec-Fetch-Site': string;
  'Upgrade-Insecure-Requests': string;
} {
  const ua = getUserAgentRotator().pick();
  return {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7,ca;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  };
}
