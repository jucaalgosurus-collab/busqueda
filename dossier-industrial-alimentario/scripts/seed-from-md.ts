// scripts/seed-from-md.ts
// HERMES-DOSSIER — Seed inicial desde los 7 dossiers MD + cuadro de mando
// Sprint 1 — 2026-06-02
// USO: pnpm seed (desde /opt/hermes-dossier/apps/dossier-industrial)

import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const SEED_DIR = '/opt/hermes-dossier/data/seed';

interface Dossier {
  slug: string;
  name: string;
  cif?: string;
  sector: string;
  subsector: string;
  cnae: string;
  region: string;
  tier: string;
  web?: string;
  rawMd: string;
  filename: string;
}

// Mapeo de dossier → metadata conocida
const DOSSIER_META: Record<string, Omit<Dossier, 'rawMd' | 'filename'>> = {
  '01-DOSSIER-Nueva-Pescanova': {
    slug: 'nueva-pescanova',
    name: 'Nueva Pescanova',
    cif: 'A36005221',
    sector: 'Alimentacion',
    subsector: 'Pescado, marisco y derivados',
    cnae: '10.2',
    region: 'Galicia',
    tier: 'tier1',
    web: 'https://pescanova.com',
  },
  '02-DOSSIER-Danone': {
    slug: 'danone',
    name: 'Danone',
    cif: 'A17005152',
    sector: 'Alimentacion',
    subsector: 'Lácteos y derivados',
    cnae: '10.5',
    region: 'Cataluña',
    tier: 'tier1',
    web: 'https://danone.es',
  },
  '03-DOSSIER-Mahou': {
    slug: 'mahou-sanmiguel',
    name: 'Mahou-San Miguel',
    cif: 'A28003615',
    sector: 'Bebidas',
    subsector: 'Cerveza',
    cnae: '11.0',
    region: 'Madrid',
    tier: 'tier1',
    web: 'https://mahou-sanmiguel.com',
  },
  '04-DOSSIER-AGAMA-Damm': {
    slug: 'damm',
    name: 'Damm',
    cif: 'A08008723',
    sector: 'Bebidas',
    subsector: 'Cerveza',
    cnae: '11.0',
    region: 'Cataluña',
    tier: 'tier1',
    web: 'https://damm.com',
  },
  '05-DOSSIER-Leche-Pascual': {
    slug: 'leche-pascual',
    name: 'Leche Pascual (Calidad Pascual)',
    cif: 'A09004872',
    sector: 'Alimentacion',
    subsector: 'Lácteos y derivados',
    cnae: '10.5',
    region: 'Castilla y León',
    tier: 'tier1',
    web: 'https://calidadpascual.com',
  },
  '06-DOSSIER-Nestle': {
    slug: 'nestle-espana',
    name: 'Nestlé España',
    cif: 'A08005449',
    sector: 'Alimentacion',
    subsector: 'Multicategoría (lácteos, café, cereales, agua)',
    cnae: '10.8',
    region: 'Cataluña',
    tier: 'tier1',
    web: 'https://nestle.es',
  },
  '07-DOSSIER-Azucarera': {
    slug: 'azucarera',
    name: 'Azucarera (ABF)',
    cif: 'A28001980',
    sector: 'Alimentacion',
    subsector: 'Azúcar',
    cnae: '10.8',
    region: 'Andalucía',
    tier: 'tier1',
    web: 'https://azucarera.es',
  },
};

// Detección de CCAA desde el nombre del dossier
function detectRegionFromText(text: string): string | null {
  const regions = [
    { kw: 'galicia|vigo|pontevedra|a coruña|lugo|ourense', r: 'Galicia' },
    { kw: 'cataluña|catalunya|barcelona|tarragona|lleida|girona', r: 'Cataluña' },
    { kw: 'andalucia|almería|cádiz|córdoba|granada|huelva|jaén|málaga|sevilla', r: 'Andalucía' },
    { kw: 'madrid|getafe|móstoles|alcobendas', r: 'Madrid' },
    { kw: 'castilla y león|cyl|valladolid|burgos|salamanca|león|palencia|segovia|soria|ávila|zamora', r: 'Castilla y León' },
    { kw: 'valencia|alicante|castellón|c. valenciana', r: 'C. Valenciana' },
    { kw: 'murcia|cartagena|lorca', r: 'Murcia' },
    { kw: 'aragón|zaragoza|huesca|teruel', r: 'Aragón' },
    { kw: 'país vasco|alava|álava|biscay|vizcaya|guipúzcoa|gipuzkoa', r: 'País Vasco' },
    { kw: 'navarra|pamplona', r: 'Navarra' },
    { kw: 'cantabria|santander', r: 'Cantabria' },
    { kw: 'asturias|oviedo|gijón', r: 'Asturias' },
    { kw: 'rioja|logroño', r: 'La Rioja' },
    { kw: 'extremadura|badajoz|cáceres', r: 'Extremadura' },
    { kw: 'baleares|palma|mallorca|ibiza', r: 'Islas Baleares' },
    { kw: 'canarias|las palmas|tenerife', r: 'Canarias' },
  ];
  const lower = text.toLowerCase();
  for (const { kw, r } of regions) {
    if (new RegExp(kw).test(lower)) return r;
  }
  return null;
}

function parseDossiers(): Dossier[] {
  if (!existsSync(SEED_DIR)) {
    throw new Error(`Seed dir not found: ${SEED_DIR}`);
  }
  const files = readdirSync(SEED_DIR).filter((f) => f.endsWith('.md') && f !== '00-CUADRO-DE-MANDO-EJECUTIVO.md');

  const dossiers: Dossier[] = [];
  for (const f of files) {
    const stem = f.replace(/\.md$/, '');
    const meta = DOSSIER_META[stem];
    if (!meta) {
      console.warn(`[seed] No metadata for ${f}, skipping`);
      continue;
    }
    const rawMd = readFileSync(join(SEED_DIR, f), 'utf-8');

    // Sobrescribe region si el MD contiene otra CCAA
    const detectedRegion = detectRegionFromText(rawMd);
    const region = detectedRegion || meta.region;

    dossiers.push({ ...meta, region, rawMd, filename: f });
  }
  return dossiers;
}

async function main() {
  console.log('[seed] Parsing 7 dossiers from MD files...');
  const dossiers = parseDossiers();
  console.log(`[seed] Found ${dossiers.length} dossiers`);

  // Stats
  let companiesCreated = 0;
  let operationsCreated = 0;
  let contactsCreated = 0;
  let sourcesCreated = 0;

  for (const d of dossiers) {
    console.log(`[seed] → ${d.name} (${d.region})`);

    // 1) Company
    const company = await prisma.company.upsert({
      where: { slug: d.slug },
      update: { region: d.region, notes: `Sprint 1 seed from ${d.filename}` },
      create: {
        slug: d.slug,
        name: d.name,
        cif: d.cif,
        sector: d.sector,
        subsector: d.subsector,
        cnae: d.cnae,
        region: d.region,
        web: d.web,
        tier: d.tier,
        notes: `Sprint 1 seed from ${d.filename}`,
      },
    });
    companiesCreated++;

    // 2) Operation: el dossier ya documenta movimientos estratégicos previos
    // El "tipo" más probable de un dossier industrial es desimplantación/cierre
    const opType = (() => {
      const lower = d.rawMd.toLowerCase();
      if (lower.includes('ere') || lower.includes('regulación de empleo')) return 'ERE';
      if (lower.includes('cierre') || lower.includes('desmantel')) return 'plant_closure';
      if (lower.includes('línea') || lower.includes('linea')) return 'line_closure';
      if (lower.includes('deslocaliz') || lower.includes('mudanz') || lower.includes('traslad')) return 'production_relocation';
      if (lower.includes('liquidación') || lower.includes('liquidacion') || lower.includes('fin de activ')) return 'end_of_activity';
      if (lower.includes('desinvers') || lower.includes('venta de activ')) return 'asset_divestment';
      return 'line_closure'; // default conservador para dossier industrial
    })();

    // Extrae una descripción corta del primer párrafo o título
    const firstHeading = d.rawMd.match(/^#\s+(.+)$/m)?.[1] || d.name;
    const operation = await prisma.operation.create({
      data: {
        companyId: company.id,
        type: opType,
        description: `Detectado en dossier ${d.filename}: ${firstHeading.slice(0, 200)}`,
        status: 'announced',
        confidence: 0.7,
        announcedAt: new Date('2026-06-02'),
      },
    });
    operationsCreated++;

    // 3) Source: el dossier MD en sí como source histórica
    const source = await prisma.source.create({
      data: {
        url: `local://dossier-industrial-alimentario/${d.filename}`,
        title: firstHeading,
        outlet: 'Dossier HERMES (seed)',
        outletType: 'corporate_newsroom',
        publishedAt: new Date('2026-06-02'),
        content: d.rawMd.slice(0, 5000), // primeros 5KB
        contentHash: Buffer.from(d.filename).toString('base64'),
        deimplantationSignal: true,
        language: 'es',
        country: 'ES',
        region: d.region,
        isStale: false,
      },
    });
    sourcesCreated++;

    // 4) Vincular source → company
    await prisma.articleCompany.create({
      data: {
        articleId: source.id,
        companyId: company.id,
        sentiment: -0.5, // desimplantación = negativo
        relevance: 1.0,
      },
    });

    // 5) Operation → source
    await prisma.operation.update({
      where: { id: operation.id },
      data: { sourceId: source.id },
    });

    // 6) Contactos seed (3-4 decisores ficticios pero plausibles por empresa)
    const sampleContacts: Array<{ name: string; role: string; relevance: string }> = [
      { name: 'Director de Planta', role: 'Director de Planta', relevance: 'plant_manager' },
      { name: 'Director de Sostenibilidad', role: 'Director de Sostenibilidad y Medio Ambiente', relevance: 'sustainability' },
      { name: 'Director de Mantenimiento', role: 'Director de Mantenimiento', relevance: 'maintenance' },
      { name: 'CFO', role: 'Director Financiero (CFO)', relevance: 'cfo' },
    ];

    for (const sc of sampleContacts) {
      // Genera email plausible (placeholder, no se envía nada)
      const slug = d.slug.replace(/-/g, '');
      const emailGuess = `${sc.relevance}@${slug}.es`;
      const linkedinGuess = `https://www.linkedin.com/in/${sc.relevance}-${slug}`;

      await prisma.contact.create({
        data: {
          fullName: `${sc.name} (${d.name})`,
          currentRole: sc.role,
          currentCompanyId: company.id,
          linkedinUrl: linkedinGuess,
          email: emailGuess,
          emailVerified: false,
          roleRelevance: sc.relevance,
          sourceId: source.id,
        },
      });
      contactsCreated++;
    }
  }

  // 7) Scan configs para los 6 agentes (desactivados en Sprint 1, se activan en S2-S4)
  const scanAgents = [
    { name: 'newsrooms-corporativas', region: 'Nacional', cadence: 2 },
    { name: 'prensa-nacional-general', region: 'Nacional', cadence: 2 },
    { name: 'prensa-regional-local', region: '17 CCAA', cadence: 2 },
    { name: 'prensa-sectorial-alimentaria', region: 'Nacional', cadence: 2 },
    { name: 'boe-bop-sindicatos', region: 'Nacional', cadence: 2 },
    { name: 'linkedin-osint', region: 'Nacional', cadence: 2 },
  ];

  for (const a of scanAgents) {
    await prisma.scanConfig.upsert({
      where: { agentName: a.name },
      update: { cadenceDays: a.cadence },
      create: {
        agentName: a.name,
        region: a.region,
        subsector: 'CNAE 10+11 (Alimentos y Bebidas)',
        keywords: [
          'desimplantación', 'cierre de planta', 'ERE', 'desmantelamiento',
          'línea de producción', 'fin de actividad', 'desinversión', 'liquidación',
        ],
        sources: ['newsrooms corporativos', 'prensa general', 'prensa sectorial'],
        cadenceDays: a.cadence,
        isActive: false, // desactivado en Sprint 1, se activa en Sprints 2-4
      },
    });
  }

  console.log('\n========== SEED SUMMARY ==========');
  console.log(`✓ Companies : ${companiesCreated} (expected: 7)`);
  console.log(`✓ Operations: ${operationsCreated} (expected: ≥7)`);
  console.log(`✓ Sources   : ${sourcesCreated} (expected: ≥7)`);
  console.log(`✓ Contacts  : ${contactsCreated} (expected: ≥28 = 4 por empresa × 7)`);
  console.log(`✓ ScanConfigs: 6 agents`);
  console.log('===================================\n');

  // Asserts
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`✗ ASSERTION FAILED: ${msg}`);
      process.exit(1);
    }
    console.log(`✓ ${msg}`);
  };

  assert(companiesCreated === 7, '7 companies seeded');
  assert(operationsCreated >= 7, '≥7 operations seeded');
  assert(contactsCreated >= 28, '≥28 contacts seeded');
  assert(sourcesCreated >= 7, '≥7 sources seeded');

  console.log('\n✓ All seed assertions passed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
