// lib/agents/linkedin-playwright-runner.ts — Plan B: navegador headless con sesión real LinkedIn
//
// Sustituye/augmenta al Google CSE cuando LINKEDIN_PLAYWRIGHT_ENABLED=true.
// Usa chromium.launchPersistentContext() para mantener li_at entre runs.
// Detección de captcha: input[name="pin"] o texto "security check" → abort + fallback.
//
// Reutiliza:
//   - applyStealthToContext de lib/scrapers/anti-detect/stealth.ts (9 parches)
//   - getRateLimiter de lib/scrapers/anti-detect/rate-limiter.ts (1 req / 8s)
//   - inferRoleRelevance + upsert shape del runner Google CSE

import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { chromium, type BrowserContext, type Page } from 'playwright';
import linkedinQueries from '@/lib/data/linkedin-queries.json' with { type: 'json' };
import newsroomList from '@/lib/data/newsroom-list.json' with { type: 'json' };
import { applyStealthToContext, getRateLimiter } from '@/lib/scrapers/anti-detect/index';
import type { LinkedInAgentResult } from './linkedin-runner';

const prisma = new PrismaClient();

const PROFILE_DIR = process.env.LINKEDIN_PROFILE_DIR ?? '/opt/hermes-dossier/.linkedin-profile/linkedin-storage';
const RATE_LIMITER = getRateLimiter('linkedin-playwright', { requestsPerSecond: 0.125, burst: 1 }); // 1 req / 8s
const TOP_COMPANIES = (newsroomList as Array<{ slug: string; name: string; subsector: string }>).slice(0, 60);

interface LinkedInQuery {
  role: string;
  subsector: string;
  company_hint: string;
}

type CaptchaHit = { hit: boolean; reason?: string; screenshotPath?: string };

async function detectCaptcha(page: Page): Promise<CaptchaHit> {
  // 1. input[name="pin"] es el campo del "verification challenge" de LinkedIn
  const pinInput = await page.locator('input[name="pin"]').count();
  if (pinInput > 0) return { hit: true, reason: 'input[name="pin"] present' };

  // 2. Texto "security check" o "captcha"
  const securityText = await page.getByText(/security check/i).count();
  if (securityText > 0) return { hit: true, reason: 'security check text' };

  const captchaText = await page.getByText(/captcha/i).count();
  if (captchaText > 0) return { hit: true, reason: 'captcha text' };

  // 3. URL de checkpoint de LinkedIn
  const url = page.url();
  if (/checkpoint|challenge|captcha/i.test(url)) {
    return { hit: true, reason: `URL matched: ${url.slice(0, 80)}` };
  }
  return { hit: false };
}

async function screenshotCaptcha(page: Page, label: string): Promise<string | undefined> {
  try {
    const fs = await import('node:fs/promises');
    const dir = '/opt/hermes-dossier/logs';
    await fs.mkdir(dir, { recursive: true });
    const path = `${dir}/linkedin-captcha-${label}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: true });
    return path;
  } catch {
    return undefined;
  }
}

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function inferRoleRelevance(role: string): 'plant_manager' | 'coo' | 'sustainability' | 'maintenance' | 'procurement' | 'cfo' | 'ceo' | 'ere_responsible' | 'other' {
  const r = role.toLowerCase();
  if (/planta|plant manager|f[aá]brica|director industrial|director f[aá]brica/.test(r)) return 'plant_manager';
  if (/coo|director de operaciones|jefe de operaciones|operaciones|chief operating|direcci[oó]n operaciones/.test(r)) return 'coo';
  if (/sostenibilidad|sustainability|rsc|responsabilidad social|jefe de sostenibilidad|direcci[oó]n sostenibilidad/.test(r)) return 'sustainability';
  if (/mantenimiento|maintenance|jefe de mantenimiento|direcci[oó]n mantenimiento/.test(r)) return 'maintenance';
  if (/compras|procurement|compras/.test(r)) return 'procurement';
  if (/cfo|chief financial|director financiero|jefe de finanzas|direcci[oó]n financiera|jefe de contabilidad/.test(r)) return 'cfo';
  if (/ceo|director general|consejero delegado/.test(r)) return 'ceo';
  if (/ere|regulaci[oó]n de empleo|relaciones laborales/.test(r)) return 'ere_responsible';
  if (/ingenier[ií]a|jefe de ingenier[ií]a|direcci[oó]n ingenier[ií]a/.test(r)) return 'other';
  if (/medio ambiente|jefe de medio ambiente|direcci[oó]n medio ambiente/.test(r)) return 'sustainability';
  return 'other';
}

async function notifyTelegram(message: string): Promise<void> {
  // Mismo patrón que otros agentes — Marcela bot (Telegram).
  // Fail-safe: si el token no está, sólo log.
  const token = process.env.TELEGRAM_MARCELA_TOKEN;
  const chatId = process.env.TELEGRAM_MARCELA_CHAT_ID;
  if (!token || !chatId) {
    console.warn(`[linkedin-playwright] telegram no configurado: ${message}`);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (e) {
    console.warn(`[linkedin-playwright] telegram send failed: ${(e as Error).message}`);
  }
}

export async function runLinkedInPlaywrightAgent(
  opts: { maxQueries?: number; onlyRoles?: string[] } = {}
): Promise<LinkedInAgentResult> {
  const startedAt = new Date();
  const maxQ = opts.maxQueries ?? 20;
  const onlyRoles = new Set((opts.onlyRoles ?? []).map((r) => r.toLowerCase()));
  const liAt = process.env.LINKEDIN_LI_AT;

  if (!liAt || liAt.length < 20) {
    throw new Error('LINKEDIN_LI_AT missing or too short — fallback to Google CSE');
  }

  // Construir queries
  const queries: Array<{ role: string; company: string; url: string }> = [];
  const rawQueries = linkedinQueries.queries as LinkedInQuery[];
  for (const q of rawQueries) {
    if (onlyRoles.size > 0 && !onlyRoles.has(q.role.toLowerCase())) continue;
    for (const c of TOP_COMPANIES) {
      if (queries.length >= maxQ) break;
      if (q.subsector !== 'A&B' && !c.subsector.toLowerCase().includes(q.subsector.toLowerCase().split(/\s|-/)[0] ?? '')) {
        continue;
      }
      const keywords = encodeURIComponent(`${q.role} ${c.name}`);
      const url = `https://www.linkedin.com/search/results/people/?keywords=${keywords}&origin=GLOBAL_SEARCH_HEADER`;
      queries.push({ role: q.role, company: c.name, url });
    }
    if (queries.length >= maxQ) break;
  }

  const run = await prisma.searchRun.create({
    data: { agentName: 'linkedin-osint', startedAt, query: { queries: queries.length, maxQ, via: 'playwright' } },
  });

  let profilesFound = 0, newContacts = 0, duplicates = 0, errors = 0;
  let captchaAborted = false;
  let captchaReason: string | undefined;

  // Cache: company name → id, y companyId → plantId (PlantContact requiere plantId no-null)
  const comps = await prisma.company.findMany({ select: { id: true, name: true } });
  const companiesByName = new Map<string, string>();
  for (const c of comps) companiesByName.set(c.name.toLowerCase(), c.id);
  const plantByCompany = new Map<string, string>();
  for (const c of comps) {
    const plant = await prisma.plant.findFirst({
      where: { companyId: c.id }, select: { id: true }, orderBy: { name: 'asc' },
    });
    if (plant) plantByCompany.set(c.id, plant.id);
  }

  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      viewport: { width: 1366, height: 768 },
    });

    // Inyectar li_at si el perfil está vacío
    const cookies = await context.cookies();
    const hasLiAt = cookies.some((c) => c.name === 'li_at');
    if (!hasLiAt) {
      await context.addCookies([{
        name: 'li_at',
        value: liAt,
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      }]);
      console.log('[linkedin-playwright] li_at cookie inyectada al perfil vacío');
    }

    // Aplicar los 9 parches de stealth
    await applyStealthToContext(context);

    for (let i = 0; i < queries.length; i++) {
      if (captchaAborted) break;
      const query = queries[i];

      try {
        await RATE_LIMITER.acquire();
        const page = await context.newPage();
        try {
          await page.goto(query.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          // LinkedIn renderiza con hydration lazy; damos 1.5s para que aparezcan los cards
          await page.waitForTimeout(1500);

          const cap = await detectCaptcha(page);
          if (cap.hit) {
            captchaAborted = true;
            captchaReason = cap.reason ?? 'unknown';
            const shot = await screenshotCaptcha(page, `q${i}`);
            if (shot) console.warn(`[linkedin-playwright] captcha screenshot: ${shot}`);
            await notifyTelegram(`[HERMES] LinkedIn captcha hit (${cap.reason}). Run abortado. Re-login manual: pnpm linkedin:refresh-cookie`);
            break;
          }

          // Extraer profile cards
          const cards = await page.locator('[data-chameleon-result-urn], li.reusable-search__result-container').all();
          for (const card of cards) {
            const nameEl = card.locator('.entity-result__title-text a, span[aria-hidden="true"]').first();
            const headlineEl = card.locator('.entity-result__primary-subtitle, .entity-result__summary').first();
            const linkEl = card.locator('a[href*="linkedin.com/in/"]').first();
            const profileUrl = await linkEl.getAttribute('href').catch(() => null);
            if (!profileUrl) continue;
            const cleanUrl = profileUrl.split('?')[0]?.split('#')[0] ?? profileUrl;
            if (!/\/in\/[A-Za-z0-9_-]+/.test(cleanUrl)) continue;

            const name = (await nameEl.textContent().catch(() => null))?.trim() ?? 'Unknown';
            const headline = (await headlineEl.textContent().catch(() => null))?.trim() ?? '';

            // Buscar companyId por nombre en el headline
            const lower = headline.toLowerCase();
            let companyId: string | null = null;
            for (const c of comps) {
              if (lower.includes(c.name.toLowerCase())) { companyId = c.id; break; }
            }
            if (!companyId) { duplicates++; continue; }
            const plantId = plantByCompany.get(companyId);
            if (!plantId) { duplicates++; continue; }

            profilesFound++;
            const hash = hashUrl(cleanUrl);
            const inferredRole = inferRoleRelevance(query.role);
            await prisma.plantContact.upsert({
              where: { id: `li-${hash}` },
              create: {
                id: `li-${hash}`,
                fullName: name.slice(0, 200),
                role: query.role.slice(0, 200),
                roleCategory: inferredRole,
                linkedinUrl: cleanUrl,
                emailVerified: false,
                companyId,
                plantId,
                sourceUrl: cleanUrl,
                sourceOutlet: 'LinkedIn',
                via: 'playwright',
                confidence: 0.7,
                lastEnrichedAt: new Date(),
              },
              update: {
                role: query.role.slice(0, 200),
                roleCategory: inferredRole,
                companyId,
                plantId,
                lastEnrichedAt: new Date(),
              },
            });
            newContacts++;
          }
        } finally {
          await page.close();
        }
      } catch (e) {
        errors++;
        console.warn(`[linkedin-playwright] query failed "${query.url.slice(0, 80)}": ${(e as Error).message}`);
        if (errors >= 3 && i < 5) {
          // 3 errores tempranos: probablemente la sesión está mal
          throw new Error(`3 early errors, session likely dead: ${(e as Error).message}`);
        }
      }
    }
  } finally {
    if (context) await context.close().catch(() => undefined);
  }

  const finishedAt = new Date();
  await prisma.searchRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      itemsFound: profilesFound,
      itemsInScope: newContacts,
      itemsOutOfScope: duplicates,
      itemsNew: newContacts,
      itemsUpdated: 0,
      errorsCount: captchaAborted ? errors + 1 : errors,
      costEur: 0,
    },
  });
  await prisma.scanConfig.upsert({
    where: { agentName: 'linkedin-osint' },
    create: { agentName: 'linkedin-osint', queryConfig: { keywords: [], sources: [] } as object, cadenceDays: 2, isActive: true, lastRunAt: finishedAt },
    update: { isActive: true, lastRunAt: finishedAt },
  });

  if (captchaAborted) {
    console.warn(`[linkedin-playwright] captcha aborted at ${captchaReason}; partial results persisted (${newContacts} contacts)`);
  }

  return {
    agentName: 'linkedin-osint',
    queriesRun: queries.length,
    profilesFound,
    newContacts,
    duplicates,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}
