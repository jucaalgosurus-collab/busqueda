// lib/agents/linkedin-runner.ts — Agente 6: LinkedIn OSINT
// Busca en Google `site:linkedin.com` perfiles de decisores A&B. Extrae URL
// LinkedIn, nombre, cargo inferido, y los persiste como Contact (rol=...).
// No contacta a nadie. Solo enriquece.
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import linkedinQueries from '@/lib/data/linkedin-queries.json' with { type: 'json' };
import newsroomList from '@/lib/data/newsroom-list.json' with { type: 'json' };
import { USER_AGENT } from '@/lib/scrapers/types';

const prisma = new PrismaClient();

interface LinkedInQuery {
  role: string;
  subsector: string;
  company_hint: string;
}
interface QueryTemplate { role: string; subsector: string; company_hint: string; }

const TOP_COMPANIES = (newsroomList as Array<{ slug: string; name: string; subsector: string }>).slice(0, 60);

function googleSiteLinkedin(q: string, page = 0): string {
  const start = page * 10;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}&num=10&start=${start}`;
}

async function fetchGooglePage(url: string): Promise<string> {
  const r = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'es-ES,es;q=0.9',
      Accept: 'text/html',
    },
    timeout: 15_000,
  });
  return r.data as string;
}

function extractLinkedInProfiles(html: string): Array<{ url: string; title: string; snippet: string }> {
  const $ = cheerio.load(html);
  const results: Array<{ url: string; title: string; snippet: string }> = [];
  $('a[href*="linkedin.com/in/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const clean = href.split('?')[0]?.split('#')[0] ?? href;
    if (!/\/in\/[A-Za-z0-9_-]+/.test(clean)) return;
    const text = $(el).text().trim() || $(el).closest('div').text().trim();
    const parentText = $(el).parent().text().trim();
    results.push({ url: clean, title: text.slice(0, 200), snippet: parentText.slice(0, 500) });
  });
  return results;
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

export interface LinkedInAgentResult {
  agentName: string;
  queriesRun: number;
  profilesFound: number;
  newContacts: number;
  duplicates: number;
  errors: number;
  durationMs: number;
}

export async function runGoogleCSEAgent(opts: { maxQueries?: number; onlyRoles?: string[] } = {}): Promise<LinkedInAgentResult> {
  const startedAt = new Date();
  const maxQ = opts.maxQueries ?? 20;
  const onlyRoles = new Set((opts.onlyRoles ?? []).map((r) => r.toLowerCase()));

  // Construir queries: por cada (role, company) hasta maxQ
  const queries: Array<QueryTemplate & { q: string }> = [];
  const rawQueries = linkedinQueries.queries as LinkedInQuery[];
  for (const q of rawQueries) {
    if (onlyRoles.size > 0 && !onlyRoles.has(q.role.toLowerCase())) continue;
    for (const c of TOP_COMPANIES) {
      if (queries.length >= maxQ) break;
      // Filtro: company del top 60 que matchea el subsector
      if (q.subsector !== 'A&B' && !c.subsector.toLowerCase().includes(q.subsector.toLowerCase().split(/\s|-/)[0] ?? '')) {
        continue;
      }
      const queryText = `site:linkedin.com/in "${q.role}" "${c.name}"`;
      queries.push({ ...q, q: queryText, company_hint: c.name });
    }
    if (queries.length >= maxQ) break;
  }

  const run = await prisma.searchRun.create({
    data: { agentName: 'linkedin-osint', startedAt, query: { queries: queries.length, maxQ } },
  });

  let profilesFound = 0, newContacts = 0, duplicates = 0, errors = 0;
  const seen = new Set<string>();
  const companiesByName = new Map<string, string>();
  const comps = await prisma.company.findMany({ select: { id: true, name: true } });
  for (const c of comps) companiesByName.set(c.name.toLowerCase(), c.id);
  // Cache de plantId "placeholder" por company (PlantContact requiere plantId no-null)
  // Estrategia: si la company no tiene plants, creamos una "plant sede" mínima para anclar el contacto.
  const plantByCompany = new Map<string, string>();
  for (const c of comps) {
    const plant = await prisma.plant.findFirst({
      where: { companyId: c.id },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    if (plant) {
      plantByCompany.set(c.id, plant.id);
    }
  }

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    let profiles: Array<{ url: string; title: string; snippet: string }> = [];
    try {
      const html = await fetchGooglePage(googleSiteLinkedin(query.q));
      profiles = extractLinkedInProfiles(html);
    } catch (e) {
      errors++;
      console.warn(`[linkedin] query failed "${query.q}": ${(e as Error).message}`);
      if (i % 5 === 0) console.log(`[linkedin] progress: ${i + 1}/${queries.length} queries, contacts=${newContacts}, errors=${errors}`);
      continue;
    }
    profilesFound += profiles.length;

    for (const p of profiles) {
      if (seen.has(p.url)) { duplicates++; continue; }
      seen.add(p.url);

      // Inferir nombre y empresa desde el snippet
      const nameMatch = p.title.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/);
      const name = nameMatch?.[1] ?? p.title.split(' - ')[0]?.trim() ?? 'Unknown';
      // Empresa: buscar nombre de company en el snippet
      let companyId: string | null = null;
      const lower = (p.snippet + ' ' + p.title).toLowerCase();
      for (const c of comps) {
        if (lower.includes(c.name.toLowerCase())) { companyId = c.id; break; }
      }

      try {
        // v6: PlantContact requiere plantId + companyId no-null. Si la company no tiene
        // plant conocido, saltamos el contacto (no inventamos un plantId).
        if (!companyId) {
          duplicates++; // contamos como duplicado lógico (perfil sin empresa matcheable)
          continue;
        }
        const plantId = plantByCompany.get(companyId);
        if (!plantId) {
          duplicates++;
          continue;
        }
        const hash = createHash('sha256').update(p.url).digest('hex').slice(0, 16);
        const inferredRole = inferRoleRelevance(query.role);
        await prisma.plantContact.upsert({
          where: { id: `li-${hash}` },
          create: {
            id: `li-${hash}`,
            fullName: name.slice(0, 200),
            role: query.role.slice(0, 200),
            roleCategory: inferredRole,
            linkedinUrl: p.url,
            emailVerified: false,
            companyId,
            plantId,
            sourceUrl: p.url,
            sourceOutlet: 'LinkedIn',
            via: 'google_cse',
            confidence: 0.5,
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
      } catch (e) {
        errors++;
      }
    }
    // Throttle: 1 req / 4s
    await new Promise((r) => setTimeout(r, 4000));
    if (i % 5 === 0 || i === queries.length - 1) {
      console.log(`[linkedin] progress: ${i + 1}/${queries.length} queries, profiles=${profilesFound}, contacts=${newContacts}, errors=${errors}`);
    }
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
      errorsCount: errors,
      costEur: 0,
    },
  });
  await prisma.scanConfig.upsert({
    where: { agentName: 'linkedin-osint' },
    create: { agentName: 'linkedin-osint', queryConfig: { keywords: [], sources: [] } as object, cadenceDays: 2, isActive: true, lastRunAt: finishedAt },
    update: { isActive: true, lastRunAt: finishedAt },
  });

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

/**
 * Wrapper público: delega al dispatcher (Plan B Playwright si está habilitado,
 * si no al runner Google CSE clásico). Mantiene compatibilidad con todos los
 * callers existentes (orquestador, panel /agentes, scripts).
 */
export async function runLinkedInAgent(opts: { maxQueries?: number; onlyRoles?: string[] } = {}): Promise<LinkedInAgentResult> {
  const { runLinkedInDispatcher } = await import('./linkedin-dispatcher.js');
  return runLinkedInDispatcher(opts);
}

// CLI entry
if (process.argv[1]?.endsWith('linkedin-runner.ts') || process.argv[1]?.endsWith('linkedin-runner.js')) {
  (async () => {
    try {
      const r = await runLinkedInAgent();
      console.log('\n=== LINKEDIN ===');
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
