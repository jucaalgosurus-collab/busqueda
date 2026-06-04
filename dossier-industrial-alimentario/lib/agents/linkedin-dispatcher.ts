// lib/agents/linkedin-dispatcher.ts — Decide Plan A (Google CSE) vs Plan B (Playwright + sesión real)
//
// Plan A: el runner clásico basado en Google CSE + cheerio (lib/agents/linkedin-runner.ts).
// Plan B: navegador headless con cookie li_at válida, navegando linkedin.com directamente.
//
// El dispatcher es el ÚNICO punto de entrada público: runLinkedInAgent() delega aquí.
// Si el env flag está apagado, o si Plan B falla en tiempo de ejecución,
// se degrada limpio a Plan A sin pérdida de datos.
//
// Activación: LINKEDIN_PLAYWRIGHT_ENABLED=true en /opt/hermes-dossier/.env
// Cookie: LINKEDIN_LI_AT="..." (chmod 600, fuera de git)
// Respaldo: /opt/hermes-dossier/.linkedin-profile/ (perfil persistente, fuera de git)

import type { LinkedInAgentResult } from './linkedin-runner';

export type LinkedInVia = 'google_cse' | 'playwright';

interface DispatcherDecision {
  via: LinkedInVia;
  reason: string;
  fallbackAvailable: boolean;
}

export function decideLinkedInStrategy(): DispatcherDecision {
  const enabled = process.env.LINKEDIN_PLAYWRIGHT_ENABLED === 'true';
  const hasCookie = !!process.env.LINKEDIN_LI_AT && process.env.LINKEDIN_LI_AT.length > 20;

  if (!enabled) {
    return { via: 'google_cse', reason: 'LINKEDIN_PLAYWRIGHT_ENABLED!=true', fallbackAvailable: false };
  }
  if (!hasCookie) {
    return { via: 'google_cse', reason: 'LINKEDIN_LI_AT missing or too short', fallbackAvailable: true };
  }
  return { via: 'playwright', reason: 'opt-in flag set + cookie present', fallbackAvailable: true };
}

export async function runLinkedInDispatcher(
  opts: { maxQueries?: number; onlyRoles?: string[] } = {}
): Promise<LinkedInAgentResult> {
  const decision = decideLinkedInStrategy();
  const log = (msg: string, extra?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(`[linkedin-dispatcher] ${msg}`, extra !== undefined ? JSON.stringify(extra) : '');
  };

  log('decision', decision);

  if (decision.via === 'google_cse') {
    const { runGoogleCSEAgent } = await import('./linkedin-runner.js');
    return runGoogleCSEAgent(opts);
  }

  // Plan B: intentar Playwright
  try {
    const { runLinkedInPlaywrightAgent } = await import('./linkedin-playwright-runner.js');
    return await runLinkedInPlaywrightAgent(opts);
  } catch (err) {
    log('playwright run threw, falling back to Google CSE', { err: (err as Error).message });
    const { runGoogleCSEAgent } = await import('./linkedin-runner.js');
    return runGoogleCSEAgent(opts);
  }
}
