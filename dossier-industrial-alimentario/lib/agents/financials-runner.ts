// lib/agents/financials-runner.ts — Sprint C.2
//
// Enriquecer Company.facturacionM / ebitdaM / beneficioNetoM / empleadosTotal
// desde Wikipedia (gratis, sin API key, sin auth).
//
// Pipeline:
//   1) Carga las Companies A&B con `facturacionM IS NULL OR ebitdaM IS NULL OR empleadosTotal IS NULL`.
//   2) Para cada Company, llama a `scrapeWikipediaFinancials(company.name)`.
//   3) Si `found: true`, hace update NO destructivo de Company (solo rellena campos null)
//      y persiste un Source con outletType='financial' (audit trail).
//   4) Crea SearchRun { agentName: 'surus-agente-financieros' } con métricas.
//
// Idempotente por URL de Wikipedia: el Source tiene UNIQUE(url) y `url = data.fuente`.
// Si la Wiki se actualiza con valores nuevos, el upsert refresca title+contentText.

import { PrismaClient } from '@prisma/client';
import {
  scrapeWikipediaFinancials,
  type WikiFinancial,
  type WikiScrapeResult,
} from '@/lib/scrapers/wikipedia';

const prisma = new PrismaClient();

export const FINANCIALS_AGENT_NAME = 'surus-agente-financieros';
export const FINANCIALS_CADENCE_DAYS = 7;
const BACKFILL_DAYS = 365;

export interface FinancialsAgentResult {
  agentName: string;
  mode: 'backfill_all' | 'incremental_missing';
  companiesEvaluated: number;
  wikipediaFound: number;
  wikipediaNotFound: number;
  wikipediaErrors: number;
  fieldsUpdated: number;
  sourcesCreated: number;
  sourcesUpdated: number;
  errors: number;
  durationMs: number;
  topHits: Array<{
    slug: string;
    name: string;
    facturacionM: number | null;
    empleados: number | null;
    fuente: string;
  }>;
}

async function isFirstRun(): Promise<boolean> {
  const cfg = await prisma.scanConfig.findUnique({ where: { agentName: FINANCIALS_AGENT_NAME } });
  return !cfg?.lastRunAt;
}

async function ensureScanConfig(): Promise<void> {
  await prisma.scanConfig.upsert({
    where: { agentName: FINANCIALS_AGENT_NAME },
    create: {
      agentName: FINANCIALS_AGENT_NAME,
      cadenceDays: FINANCIALS_CADENCE_DAYS,
      isActive: true,
      lastRunAt: null,
    },
    update: { isActive: true, cadenceDays: FINANCIALS_CADENCE_DAYS },
  });
}

/**
 * Rellena los campos de Company que estén null sin sobreescribir valores existentes.
 * Devuelve el set de campos efectivamente actualizados.
 */
function buildUpdateData(
  current: {
    facturacionM: number | null;
    facturacionYear: Int | null;
    ebitdaM: number | null;
    beneficioNetoM: number | null;
    empleadosTotal: number | null;
  } | null,
  wiki: WikiFinancial,
): { data: Record<string, number | null>; updatedFields: string[] } {
  if (!current) {
    // Company sin datos previos: rellena todo lo que la Wiki dé
    const data: Record<string, number | null> = {};
    const updatedFields: string[] = [];
    if (wiki.facturacionM !== null) {
      data.facturacionM = wiki.facturacionM;
      updatedFields.push('facturacionM');
    }
    if (wiki.facturacionYear !== null) {
      data.facturacionYear = wiki.facturacionYear;
      updatedFields.push('facturacionYear');
    }
    if (wiki.ebitdaM !== null) {
      data.ebitdaM = wiki.ebitdaM;
      updatedFields.push('ebitdaM');
    }
    if (wiki.beneficioNetoM !== null) {
      data.beneficioNetoM = wiki.beneficioNetoM;
      updatedFields.push('beneficioNetoM');
    }
    if (wiki.empleados !== null) {
      data.empleadosTotal = wiki.empleados;
      updatedFields.push('empleadosTotal');
    }
    return { data, updatedFields };
  }

  // Company con datos previos: solo rellena nulls
  const data: Record<string, number | null> = {};
  const updatedFields: string[] = [];
  // Sanity guard: si el facturacionM existente parece un AÑO mal parseado
  // (2010..2030) y Wikipedia trae un valor plausible (>100M€), corregimos.
  // Esto protege contra datos de seed v6 que confundieron "2024" con 2024M€.
  if (
    current.facturacionM !== null &&
    current.facturacionM >= 2010 &&
    current.facturacionM <= 2030 &&
    wiki.facturacionM !== null &&
    wiki.facturacionM > 100
  ) {
    data.facturacionM = wiki.facturacionM;
    updatedFields.push('facturacionM');
  } else if (current.facturacionM === null && wiki.facturacionM !== null) {
    data.facturacionM = wiki.facturacionM;
    updatedFields.push('facturacionM');
  }
  if (current.facturacionYear === null && wiki.facturacionYear !== null) {
    data.facturacionYear = wiki.facturacionYear;
    updatedFields.push('facturacionYear');
  }
  if (current.ebitdaM === null && wiki.ebitdaM !== null) {
    data.ebitdaM = wiki.ebitdaM;
    updatedFields.push('ebitdaM');
  }
  if (current.beneficioNetoM === null && wiki.beneficioNetoM !== null) {
    data.beneficioNetoM = wiki.beneficioNetoM;
    updatedFields.push('beneficioNetoM');
  }
  if (current.empleadosTotal === null && wiki.empleados !== null) {
    data.empleadosTotal = wiki.empleados;
    updatedFields.push('empleadosTotal');
  }
  return { data, updatedFields };
}

// Type alias: Prisma Int → number en JS pero la firma de select usa number
type Int = number;

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  facturacionM: number | null;
  facturacionYear: number | null;
  ebitdaM: number | null;
  beneficioNetoM: number | null;
  empleadosTotal: number | null;
}

async function persistWikipediaSource(
  wiki: WikiFinancial,
  company: { id: string; slug: string; name: string },
): Promise<'created' | 'updated'> {
  const url = wiki.fuente;
  const fields: string[] = [];
  if (wiki.facturacionM !== null) {
    fields.push(`Facturación: ${wiki.facturacionM.toLocaleString('es-ES', { maximumFractionDigits: 1 })}M €`);
  }
  if (wiki.facturacionYear !== null) fields.push(`(año ${wiki.facturacionYear})`);
  if (wiki.empleados !== null) fields.push(`Empleados: ${wiki.empleados.toLocaleString('es-ES')}`);
  if (wiki.ebitdaM !== null) {
    fields.push(`EBITDA: ${wiki.ebitdaM.toLocaleString('es-ES', { maximumFractionDigits: 1 })}M €`);
  }
  if (wiki.beneficioNetoM !== null) {
    fields.push(`Beneficio neto: ${wiki.beneficioNetoM.toLocaleString('es-ES', { maximumFractionDigits: 1 })}M €`);
  }
  const title = `Wikipedia: ${company.name} — ${fields.slice(0, 3).join(' · ')}`.slice(0, 500);
  const contentText = [
    `Datos financieros de ${company.name} extraídos de Wikipedia (${url}).`,
    '',
    `• Facturación: ${wiki.facturacionM !== null ? `${wiki.facturacionM.toLocaleString('es-ES', { maximumFractionDigits: 1 })}M €` : 'n/d'}${wiki.facturacionYear ? ` (año ${wiki.facturacionYear})` : ''}`,
    `• Empleados: ${wiki.empleados !== null ? wiki.empleados.toLocaleString('es-ES') : 'n/d'}`,
    `• EBITDA: ${wiki.ebitdaM !== null ? `${wiki.ebitdaM.toLocaleString('es-ES', { maximumFractionDigits: 1 })}M €` : 'n/d'}`,
    `• Beneficio neto: ${wiki.beneficioNetoM !== null ? `${wiki.beneficioNetoM.toLocaleString('es-ES', { maximumFractionDigits: 1 })}M €` : 'n/d'}`,
    '',
    'Fuente: Wikipedia en español. Datos referenciales; pueden no reflejar el último ejercicio fiscal.',
  ].join('\n').slice(0, 50_000);

  // Comprueba si el Source ya existe
  const existing = await prisma.source.findUnique({ where: { url } });
  if (existing) {
    await prisma.source.update({
      where: { url },
      data: {
        title,
        contentText,
        companyId: company.id,
        scrapedAt: new Date(),
      },
    });
    return 'updated';
  }

  await prisma.source.create({
    data: {
      url,
      title,
      outlet: 'Wikipedia (es)',
      outletType: 'financial',
      publishedAt: new Date(),
      language: 'es',
      companyId: company.id,
      contentText,
      deimplantationSignal: false,
      outOfScopeReason: 'wikipedia_financial',
      isStale: false,
    },
  });
  return 'created';
}

export async function runFinancialsAgent(opts: { dryRun?: boolean } = {}): Promise<FinancialsAgentResult> {
  const start = Date.now();
  await ensureScanConfig();
  const firstRun = await isFirstRun();
  const mode: 'backfill_all' | 'incremental_missing' = firstRun
    ? 'backfill_all'
    : 'incremental_missing';

  // 1) Carga Companies A&B
  //    - backfill_all: TODAS las A&B
  //    - incremental_missing: solo las que tengan algún KPI en null
  const baseWhere = { tier: { in: ['A', 'B'] as ('A' | 'B')[] } };
  // "Suspect" en modo incremental: null OR facturacionM parece un año mal parseado (2010-2030)
  const whereMissing = {
    ...baseWhere,
    OR: [
      { facturacionM: null },
      { ebitdaM: null },
      { empleadosTotal: null },
      { beneficioNetoM: null },
      { facturacionM: { gte: 2010, lte: 2030 } },
    ],
  };
  const where = mode === 'backfill_all' ? baseWhere : whereMissing;

  const companies: CompanyRow[] = await prisma.company.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      facturacionM: true,
      facturacionYear: true,
      ebitdaM: true,
      beneficioNetoM: true,
      empleadosTotal: true,
    },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
  });

  const result: FinancialsAgentResult = {
    agentName: FINANCIALS_AGENT_NAME,
    mode,
    companiesEvaluated: companies.length,
    wikipediaFound: 0,
    wikipediaNotFound: 0,
    wikipediaErrors: 0,
    fieldsUpdated: 0,
    sourcesCreated: 0,
    sourcesUpdated: 0,
    errors: 0,
    durationMs: 0,
    topHits: [],
  };

  for (const company of companies) {
    let scrape: WikiScrapeResult;
    try {
      scrape = await scrapeWikipediaFinancials(company.name);
    } catch (e) {
      result.wikipediaErrors++;
      result.errors++;
      console.error(`[financials-runner] scrape error for ${company.slug}:`, String(e).slice(0, 200));
      continue;
    }

    if (!scrape.found) {
      result.wikipediaNotFound++;
      continue;
    }
    result.wikipediaFound++;

    const wiki = scrape.data;
    if (opts.dryRun) {
      // Cuenta cuántos campos SE actualizarían (sin escribir)
      const { updatedFields } = buildUpdateData(company, wiki);
      result.fieldsUpdated += updatedFields.length;
      if (result.topHits.length < 10) {
        result.topHits.push({
          slug: company.slug,
          name: company.name,
          facturacionM: wiki.facturacionM,
          empleados: wiki.empleados,
          fuente: wiki.fuente,
        });
      }
      continue;
    }

    try {
      // 1) Update Company (no destructivo)
      const { data, updatedFields } = buildUpdateData(company, wiki);
      if (Object.keys(data).length > 0) {
        await prisma.company.update({ where: { id: company.id }, data });
        result.fieldsUpdated += updatedFields.length;
      }
      // 2) Persist Source (audit trail)
      const sourceAction = await persistWikipediaSource(wiki, company);
      if (sourceAction === 'created') result.sourcesCreated++;
      else result.sourcesUpdated++;
      // 3) Top hits
      if (result.topHits.length < 10) {
        result.topHits.push({
          slug: company.slug,
          name: company.name,
          facturacionM: wiki.facturacionM,
          empleados: wiki.empleados,
          fuente: wiki.fuente,
        });
      }
    } catch (e) {
      result.errors++;
      console.error(`[financials-runner] persist error for ${company.slug}:`, String(e).slice(0, 200));
    }
  }

  // 4) SearchRun
  if (!opts.dryRun) {
    await prisma.searchRun.create({
      data: {
        agentName: FINANCIALS_AGENT_NAME,
        mode,
        itemsFound: result.wikipediaFound,
        itemsNew: result.sourcesCreated,
        itemsInScope: result.wikipediaFound,
        itemsOutOfScope: result.wikipediaNotFound,
        errorsCount: result.errors,
        startedAt: new Date(start),
        finishedAt: new Date(),
      },
    });
    await prisma.scanConfig.update({
      where: { agentName: FINANCIALS_AGENT_NAME },
      data: { lastRunAt: new Date() },
    });
  }

  result.durationMs = Date.now() - start;
  return result;
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('financials-runner.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  runFinancialsAgent({ dryRun })
    .then((r) => {
      console.log('[financials-runner] result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[financials-runner] error:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
