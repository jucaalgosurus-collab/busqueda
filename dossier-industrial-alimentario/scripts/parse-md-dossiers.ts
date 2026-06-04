// scripts/parse-md-dossiers.ts
// HERMES-DOSSIER v6 — Parser de los 7 dossiers MD + cuadro de mando
// Sprint 6 — 2026-06-02
// USO: tsx scripts/parse-md-dossiers.ts
// OUTPUT: data/seed-v6.json con la estructura EXACTA de los 14 modelos del schema

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------------------
// Tipos del seed (espejo del schema.prisma v6)
// ----------------------------------------------------------------------------

export interface SeedCompany {
  slug: string;
  name: string;
  cif?: string;
  sector: 'Alimentacion' | 'Bebidas';
  subsector: string;
  cnae?: string;
  parentGroup?: string;
  hqCity?: string;
  hqRegion?: string;
  website?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  facturacionM?: number;
  facturacionYear?: number;
  ebitdaM?: number;
  beneficioNetoM?: number;
  deudaNetaM?: number;
  empleadosTotal?: number;
  tier: 'A' | 'B';
  status?: 'active' | 'inactive';
  priority?: number;
}

export interface SeedPlant {
  companySlug: string;
  name: string;
  ccaa: string;
  province?: string;
  city?: string;
  status:
    | 'operativa'
    | 'en_inversion'
    | 'en_desmantelamiento'
    | 'cerrada'
    | 'vendida'
    | 'en_proyecto'
    | 'en_conversion'
    | 'en_venta';
  specialty?: string;
  employees?: number;
  parcelaM2?: number;
  naveM2?: number;
  closureYear?: number;
  investmentMEur?: number;
  notes?: string;
}

export interface SeedPlantContact {
  companySlug: string;
  plantName: string;
  fullName: string;
  role: string;
  roleCategory?:
    | 'plant_manager'
    | 'coo'
    | 'cfo'
    | 'ceo'
    | 'procurement'
    | 'sustainability'
    | 'maintenance'
    | 'ere_responsible'
    | 'other';
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  sourceOutlet?: string;
  confidence?: number;
  notes?: string;
}

export interface SeedTechnicalInventory {
  companySlug: string;
  plantName: string;
  category: string;
  brand?: string;
  model?: string;
  specs?: string;
  quantity?: number;
  status: 'operativo' | 'a_sustituir' | 'liberado' | 'desmantelado' | 'vendido' | 'en_uso' | 'en_obra';
  releaseWindow?: string;
  estimatedValueEur?: number;
  source?: string;
  notes?: string;
}

export interface SeedOperation {
  companySlug: string;
  plantName?: string;
  type:
    | 'plant_closure'
    | 'line_closure'
    | 'ERE'
    | 'plant_sale'
    | 'relocation'
    | 'investment'
    | 'divestment'
    | 'biomass_plant'
    | 'warehouse'
    | 'decommissioning'
    | 'acquisition'
    | 'concurso_acreedores'
    | 'subasta';
  title: string;
  description?: string;
  amountMeur?: number;
  jobsAffected?: number;
  announcedAt: string; // ISO date
  status?: 'announced' | 'in_negotiation' | 'in_execution' | 'executed' | 'cancelled' | 'in_scope' | 'out_of_scope';
  confidence?: number;
  sourceUrl?: string;
  sourceOutlet?: string;
}

export interface SeedTimelineEvent {
  companySlug: string;
  plantName?: string;
  date: string; // ISO date
  title: string;
  description?: string;
  impact?: string;
  sourceUrl?: string;
  sourceOutlet?: string;
}

export interface SeedFinancial {
  companySlug: string;
  year: number;
  concept: string;
  amountMeur: number;
  category?: 'investment' | 'divestment' | 'capital_increase' | 'debt_restructuring' | 'impairment' | 'revenue' | 'ebitda';
  sourceUrl?: string;
  notes?: string;
}

export interface SeedSource {
  companySlug?: string;
  url: string;
  title: string;
  outlet: string;
  outletType:
    | 'corporate_newsroom'
    | 'nacional'
    | 'regional'
    | 'local'
    | 'sector'
    | 'bofficial'
    | 'syndicate'
    | 'linkedin';
  language?: string;
  publishedAt?: string;
  deimplantationSignal?: boolean;
  contentText?: string;
}

export interface SeedAuctionCheck {
  companySlug: string;
  platform:
    | 'Escrapalia'
    | 'Surplex'
    | 'Troostwijk'
    | 'GUTINVEST'
    | 'HGP'
    | 'Apex'
    | 'CFT'
    | 'Industrial Auctions'
    | 'Machineryline';
  result: 'sin_activos' | 'activos_detectados' | 'historial' | 'no_verificado';
  details?: string;
}

export interface SeedDocument {
  companySlug: string;
  kind: 'pdf' | 'logo' | 'hero' | 'plant_photo' | 'nameplate' | 'certificate' | 'balance_sheet' | 'photo' | 'press_release';
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  externalUrl?: string;
}

export interface SeedNote {
  companySlug: string;
  body: string;
  author?: string;
}

export interface SeedV6 {
  companies: SeedCompany[];
  plants: SeedPlant[];
  plantContacts: SeedPlantContact[];
  technicalInventory: SeedTechnicalInventory[];
  operations: SeedOperation[];
  timelineEvents: SeedTimelineEvent[];
  financials: SeedFinancial[];
  sources: SeedSource[];
  auctionChecks: SeedAuctionCheck[];
  documents: SeedDocument[];
  notes: SeedNote[];
}

// ----------------------------------------------------------------------------
// Constantes de la operación
// ----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const OUTPUT_FILE = join(DATA_DIR, 'seed-v6.json');

const DOSSIER_FILES = [
  '00-CUADRO-DE-MANDO-EJECUTIVO.md',
  '01-DOSSIER-Nueva-Pescanova.md',
  '02-DOSSIER-Danone.md',
  '03-DOSSIER-Mahou.md',
  '04-DOSSIER-AGAMA-Damm.md',
  '05-DOSSIER-Leche-Pascual.md',
  '06-DOSSIER-Nestle.md',
  '07-DOSSIER-Azucarera.md',
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Detecta CCAA a partir de un texto */
function detectCCAA(text: string): string {
  const lower = text.toLowerCase();
  const regions: Array<[RegExp, string]> = [
    [/galicia|vigo|pontevedra|a coruña|lugo|ourense|arteixo|sab[oó]n|mor[áa]s|chapela/, 'Galicia'],
    [/catalu[ñn]a|catalunya|barcelona|gurb|tarragona|lleida|girona|ald[aá]ia|parets|tres cantos|esplugues|sebares/, 'Cataluña'],
    [/andaluc[ií]a|almer[ií]a|c[aá]diz|c[oó]rdoba|granada|huelva|ja[eé]n|m[aá]laga|sevilla|jerez/, 'Andalucía'],
    [/^madrilen|guadalajara|alovera|madrid/, 'Madrid'],
    [/castilla y le[oó]n|cyl|valladolid|burgos|salamanca|le[oó]n|palencia|segovia|soria|[aá]vila|zamora|aranda de duero/, 'Castilla y León'],
    [/valencia|alicante|castell[oó]n|c\. valenciana/, 'C. Valenciana'],
    [/murcia|cartagena|lorca/, 'Murcia'],
    [/arag[oó]n|zaragoza|huesca|teruel/, 'Aragón'],
    [/pa[íi]s vasco|[aá]lava|álava|biscay|vizcaya|guip[úu]zcoa|gipuzkoa/, 'País Vasco'],
    [/navarra|pamplona/, 'Navarra'],
    [/cantabria|santander/, 'Cantabria'],
    [/asturias|oviedo|gij[oó]n/, 'Asturias'],
    [/rioja|logro[ñn]o/, 'La Rioja'],
    [/extremadura|badajoz|c[aá]ceres/, 'Extremadura'],
    [/baleares|palma|mallorca|ibiza/, 'Islas Baleares'],
    [/canarias|las palmas|tenerife/, 'Canarias'],
  ];
  for (const [re, name] of regions) {
    if (re.test(lower)) return name;
  }
  return 'Nacional';
}

/** Detecta outletType desde URL */
function detectOutletType(url: string, outlet: string): SeedSource['outletType'] {
  const u = url.toLowerCase();
  const o = outlet.toLowerCase();
  if (o === 'linkedin' || u.includes('linkedin.com')) return 'linkedin';
  if (u.includes('boe.es') || u.includes('bop') || u.includes('borme')) return 'bofficial';
  if (
    o.includes('sindicato') ||
    o === 'ccoo' ||
    o === 'ugt' ||
    u.includes('ccoo.es') ||
    u.includes('ugt.es')
  )
    return 'syndicate';
  if (u.includes('.com') || u.includes('.es')) {
    // Local vs regional vs nacional según dominio
    if (
      u.includes('elpais') ||
      u.includes('expansion') ||
      u.includes('cincodias') ||
      u.includes('20minutos') ||
      u.includes('lavanguardia') ||
      u.includes('economiadigital') ||
      u.includes('retailactual') ||
      u.includes('elespanol') ||
      u.includes('alimarket') ||
      u.includes('europapress')
    )
      return 'nacional';
    if (
      u.includes('lavozdegalicia') ||
      u.includes('elidealgallego') ||
      u.includes('laopinioncoruna') ||
      u.includes('farodevigo') ||
      u.includes('eldebate') ||
      u.includes('diariodemallorca') ||
      u.includes('ultimahora') ||
      u.includes('elperiodico') ||
      u.includes('diaridegirona') ||
      u.includes('elnortedecastilla')
    )
      return 'regional';
    if (
      o.includes('fundacion') ||
      u.includes('fundacionanclaje') ||
      u.includes('gobierno') ||
      u.includes('xunta') ||
      u.includes('govern') ||
      u.includes('xestur')
    )
      return 'corporate_newsroom';
  }
  return 'sector';
}

/** Detecta outlet (dominio principal) desde URL */
function detectOutlet(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    // Mapea hosts comunes a nombres legibles
    const map: Record<string, string> = {
      'elpais.com': 'El País',
      'expansion.com': 'Expansión',
      'cincodias.elpais.com': 'Cinco Días',
      '20minutos.es': '20minutos',
      'lavanguardia.com': 'La Vanguardia',
      'economiadigital.es': 'Economía Digital',
      'retailactual.com': 'Retail Actual',
      'elespanol.com': 'El Español',
      'alimarket.es': 'Alimarket',
      'europapress.es': 'Europa Press',
      'lavozdegalicia.es': 'La Voz de Galicia',
      'elidealgallego.com': 'El Ideal Gallego',
      'laopinioncoruna.es': 'La Opinión A Coruña',
      'farodevigo.es': 'Faro de Vigo',
      'eldebate.com': 'El Debate',
      'diariodemallorca.es': 'Diario de Mallorca',
      'ultimahora.es': 'Última Hora',
      'elperiodico.com': 'El Periódico',
      'diaridegirona.cat': 'Diari de Girona',
      'elnortedecastilla.es': 'El Norte de Castilla',
      'linkedin.com': 'LinkedIn',
      'nuevapescanova.com': 'Nueva Pescanova',
      'danone.es': 'Danone',
      'mahou-sanmiguel.com': 'Mahou San Miguel',
      'damm.com': 'Grupo Damm',
      'calidadpascual.com': 'Calidad Pascual',
      'nestle.es': 'Nestlé España',
      'azucarera.es': 'Azucarera',
      'ccoo.es': 'CCOO',
      'ugt.es': 'UGT',
      'fundacionanclaje.es': 'Fundación Anclaje',
      'gutinvest.es': 'GUTINVEST',
      'escrapalia.com': 'Escrapalia',
      'surplex.com': 'Surplex',
      'troostwijkauctions.com': 'Troostwijk',
      'hgpauction.com': 'HGP Auctions',
      'apexauctions.com': 'Apex Auctions',
      'cftauctions.com': 'CFT Auctions',
      'industrial-auctions.com': 'Industrial Auctions',
      'machineryline.es': 'Machineryline',
      'ence.es': 'Ence',
      'gxo.com': 'GXO Logistics',
      'nestle.com': 'Nestlé',
      'abf.co.uk': 'AB Foods',
      'absugar.com': 'AB Sugar',
      '360mozambique.com': '360 Mozambique',
      'marypescanoticiaspatagonicas.com': 'Mar y Pesca',
      'elquincemil.elespanol.com': 'El Español/Quincemil',
      'balneseurope.com': 'BALNES Europe',
    };
    return map[host] || host;
  } catch {
    return 'Desconocido';
  }
}

// ----------------------------------------------------------------------------
// Parser: extrae URLs en formato markdown [text](url)
// ----------------------------------------------------------------------------

interface ExtractedLink {
  text: string;
  url: string;
  outlet: string;
  outletType: SeedSource['outletType'];
}

function extractLinks(md: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const url = m[2];
    const outlet = detectOutlet(url);
    const outletType = detectOutletType(url, outlet);
    links.push({ text: m[1], url, outlet, outletType });
  }
  return links;
}

// ----------------------------------------------------------------------------
// Parseo de cada dossier
// ----------------------------------------------------------------------------

interface ParseContext {
  company: SeedCompany;
  companies: SeedCompany[]; // Acumulador de companies parseados (incluye ctx.company y adicionales)
  plants: SeedPlant[];
  contacts: SeedPlantContact[];
  inventory: SeedTechnicalInventory[];
  operations: SeedOperation[];
  timelineEvents: SeedTimelineEvent[];
  financials: SeedFinancial[];
  sources: SeedSource[];
  auctionChecks: SeedAuctionCheck[];
  documents: SeedDocument[];
  notes: SeedNote[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseNumber(s: string | undefined | null): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function parseMoneyMeur(s: string | undefined): number | undefined {
  if (!s) return undefined;
  // Busca el primer número en formato "16M€" o "16 millones"
  const m = s.match(/([\d.,]+)\s*M\s*€?/i) || s.match(/([\d.,]+)\s*millones/i);
  if (m) {
    return parseNumber(m[1]);
  }
  return parseNumber(s);
}

function inferRoleCategory(role: string): SeedPlantContact['roleCategory'] {
  const r = role.toLowerCase();
  if (r.includes('director de planta') || r.includes('director de f[aá]brica') || r.includes('plant manager'))
    return 'plant_manager';
  if (r.includes('ceo') || r.includes('consejero delegado') || r.includes('director general')) return 'ceo';
  if (r.includes('director de operaciones') || r.includes('director operaciones') || r.includes(' dgo') || r.includes('coo'))
    return 'coo';
  if (r.includes('cfo') || r.includes('financiero')) return 'cfo';
  if (r.includes('compras') || r.includes('procurement')) return 'procurement';
  if (r.includes('sostenibilidad') || r.includes('medio ambiente') || r.includes('sustainability'))
    return 'sustainability';
  if (r.includes('mantenimiento') || r.includes('maintenance')) return 'maintenance';
  if (r.includes('ere') || r.includes('recursos humanos') || r.includes('rrhh')) return 'ere_responsible';
  return 'other';
}

// ----------------------------------------------------------------------------
// Parser específico de cada dossier (basado en análisis del contenido)
// ----------------------------------------------------------------------------

function parseCuadroDeMando(ctx: ParseContext, md: string): void {
  // Crea companies adicionales: Frost-Trol, Sesma Brewing, Aquamar Gold, Harinas Bufort, Pastelería Quincoces, BALNES, Iberconsa
  const additionalCompanies: SeedCompany[] = [
    {
      slug: 'frost-trol',
      name: 'Frost-Trol S.A.',
      sector: 'Alimentacion',
      subsector: 'Refrigeración industrial',
      tier: 'B',
      status: 'inactive',
    },
    {
      slug: 'sesma-brewing',
      name: 'Sesma Brewing (La Petra)',
      sector: 'Bebidas',
      subsector: 'Cerveza artesanal',
      tier: 'B',
      status: 'inactive',
    },
    {
      slug: 'aquamar-gold',
      name: 'Aquamar Gold SLU',
      sector: 'Alimentacion',
      subsector: 'Producción alimentaria',
      tier: 'B',
      status: 'inactive',
    },
    {
      slug: 'harinas-bufort',
      name: 'Harinas Bufort S.L.',
      sector: 'Alimentacion',
      subsector: 'Harinas',
      tier: 'B',
      status: 'inactive',
    },
    {
      slug: 'pasteleria-quincoces',
      name: 'Pastelería Quincoces S.A.',
      sector: 'Alimentacion',
      subsector: 'Panadería/pastelería',
      tier: 'B',
      status: 'inactive',
    },
    {
      slug: 'balnes-europe',
      name: 'BALNES Europe S.L.',
      sector: 'Alimentacion',
      subsector: 'Café procesado',
      tier: 'B',
      status: 'inactive',
    },
    {
      slug: 'iberconsa',
      name: 'Iberconsa',
      sector: 'Alimentacion',
      subsector: 'Pescado congelado',
      tier: 'B',
      status: 'inactive',
    },
  ];

  for (const c of additionalCompanies) {
    ctx.companies.push(c);
  }

  // Crea plantas con al menos 1 contacto cada una
  const adicionalesPlantas: Array<{
    slug: string;
    name: string;
    ccaa: string;
    province: string;
    status: SeedPlant['status'];
    specialty: string;
    ops: SeedOperation[];
  }> = [
    {
      slug: 'frost-trol',
      name: 'Cabanes',
      ccaa: 'C. Valenciana',
      province: 'Castellón',
      status: 'cerrada',
      specialty: 'Refrigeración industrial',
      ops: [
        {
          companySlug: 'frost-trol',
          plantName: 'Cabanes',
          type: 'concurso_acreedores',
          title: 'Liquidación concursal — nave adjudicada por 11M€',
          description: 'Frost-Trol S.A. — nave adjudicada en liquidación concursal por 11M€.',
          amountMeur: 11,
          announcedAt: '2026-04-15',
          status: 'executed',
        },
      ],
    },
    {
      slug: 'sesma-brewing',
      name: 'Sesma',
      ccaa: 'Navarra',
      province: 'Navarra',
      status: 'cerrada',
      specialty: 'Cerveza artesanal',
      ops: [
        {
          companySlug: 'sesma-brewing',
          plantName: 'Sesma',
          type: 'concurso_acreedores',
          title: 'Concurso de acreedores / disolución',
          description: 'Sesma Brewing (La Petra) en concurso de acreedores desde octubre 2025.',
          announcedAt: '2025-10-01',
          status: 'in_negotiation',
        },
      ],
    },
    {
      slug: 'aquamar-gold',
      name: 'Málaga',
      ccaa: 'Andalucía',
      province: 'Málaga',
      status: 'en_desmantelamiento',
      specialty: 'Producción alimentaria',
      ops: [
        {
          companySlug: 'aquamar-gold',
          plantName: 'Málaga',
          type: 'subasta',
          title: 'Subasta concursal activa',
          description: 'Aquamar Gold SLU — subasta concursal activa, cierre febrero 2026.',
          announcedAt: '2026-02-01',
          status: 'in_execution',
        },
      ],
    },
    {
      slug: 'harinas-bufort',
      name: 'Mutxamel',
      ccaa: 'C. Valenciana',
      province: 'Alicante',
      status: 'cerrada',
      specialty: 'Harinas',
      ops: [
        {
          companySlug: 'harinas-bufort',
          plantName: 'Mutxamel',
          type: 'concurso_acreedores',
          title: 'Liquidación — subastas terminadas',
          description: 'Harinas Bufort S.L. — liquidación completada, subastas terminadas.',
          announcedAt: '2025-12-01',
          status: 'executed',
        },
      ],
    },
    {
      slug: 'pasteleria-quincoces',
      name: 'Lekeitio',
      ccaa: 'País Vasco',
      province: 'Bizkaia',
      status: 'cerrada',
      specialty: 'Panadería/pastelería',
      ops: [
        {
          companySlug: 'pasteleria-quincoces',
          plantName: 'Lekeitio',
          type: 'subasta',
          title: 'Subasta concursal activa',
          description: 'Pastelería Quincoces S.A. — pago máximo 5 junio 2026.',
          announcedAt: '2026-05-01',
          status: 'in_execution',
        },
      ],
    },
    {
      slug: 'balnes-europe',
      name: 'Tortosa',
      ccaa: 'Cataluña',
      province: 'Tarragona',
      status: 'en_desmantelamiento',
      specialty: 'Café procesado',
      ops: [
        {
          companySlug: 'balnes-europe',
          plantName: 'Tortosa',
          type: 'subasta',
          title: 'Subasta concursal de maquinaria',
          description: 'BALNES Europe S.L. — subasta concursal de maquinaria activa feb-mar 2026.',
          announcedAt: '2026-02-15',
          status: 'in_execution',
        },
      ],
    },
    {
      slug: 'iberconsa',
      name: 'Vigo',
      ccaa: 'Galicia',
      province: 'Pontevedra',
      status: 'en_venta',
      specialty: 'Pescado congelado',
      ops: [
        {
          companySlug: 'iberconsa',
          plantName: 'Vigo',
          type: 'plant_sale',
          title: 'En venta (2026)',
          description: 'Iberconsa — proceso de venta en curso durante 2026.',
          announcedAt: '2026-01-15',
          status: 'in_negotiation',
        },
      ],
    },
  ];

  for (const ap of adicionalesPlantas) {
    ctx.plants.push({
      companySlug: ap.slug,
      name: ap.name,
      ccaa: ap.ccaa,
      province: ap.province,
      city: ap.name,
      status: ap.status,
      specialty: ap.specialty,
    });
    for (const op of ap.ops) {
      ctx.operations.push(op);
    }
    // 1 contacto por planta mínimo
    ctx.contacts.push({
      companySlug: ap.slug,
      plantName: ap.name,
      fullName: 'Administrador Concursal',
      role: 'Administrador Concursal',
      roleCategory: 'other',
      sourceOutlet: 'Cuadro de Mando',
    });
  }

  // Fuentes: las URLs del cuadro de mando
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      deimplantationSignal: true,
    });
  }

  // Notes del cuadro de mando
  ctx.notes.push({
    companySlug: 'nueva-pescanova',
    body: 'Cuadro de mando: Pescanova, Danone, Mahou, Pascual, Nestlé, Azucarera, AGAMA/Damm son las 7 top-tier A&B en España con desimplantaciones detectadas. Frost-Trol, Sesma, Aquamar, Bufort, Quincoces, BALNES, Iberconsa son operaciones concursales/subastas activas a junio 2026.',
    author: 'juan-carlos',
  });
}

function parsePescanova(ctx: ParseContext, md: string): void {
  ctx.company = {
    slug: 'nueva-pescanova',
    name: 'Nueva Pescanova',
    cif: 'A36005221',
    sector: 'Alimentacion',
    subsector: 'Pescado congelado',
    cnae: '10.2',
    parentGroup: 'ABANCA (98,59%)',
    hqCity: 'Chapela, Redondela',
    hqRegion: 'Galicia',
    website: 'https://www.nuevapescanova.com',
    logoUrl: 'https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png',
    facturacionM: 1053.6,
    facturacionYear: 2025,
    ebitdaM: 71.2,
    beneficioNetoM: 1.1,
    deudaNetaM: 489.1,
    empleadosTotal: 9035,
    tier: 'A',
    status: 'active',
  };
  ctx.companies.push(ctx.company);

  // Plantas
  ctx.plants.push(
    {
      companySlug: 'nueva-pescanova',
      name: 'Sabón (Arteixo)',
      ccaa: 'Galicia',
      province: 'A Coruña',
      city: 'Arteixo',
      status: 'operativa',
      specialty: 'Pescado congelado (cocción langostino y gamba)',
      employees: 100,
      parcelaM2: 16841,
      closureYear: 2028,
      notes: 'Planta actual a desalajar; parcela codiciada por Inditex',
    },
    {
      companySlug: 'nueva-pescanova',
      name: 'Morás (Arteixo)',
      ccaa: 'Galicia',
      province: 'A Coruña',
      city: 'Arteixo',
      status: 'en_proyecto',
      specialty: 'Pescado congelado (clasificación, cocción, congelación, envasado)',
      parcelaM2: 25627,
      investmentMEur: 16,
      notes: 'Nueva planta PIE declarada por Xunta julio 2025; sin inicio de obras a jun 2026',
    },
    {
      companySlug: 'nueva-pescanova',
      name: 'Pescamar (Mozambique)',
      ccaa: 'Internacional',
      province: 'Beira',
      city: 'Beira',
      status: 'en_venta',
      specialty: 'Pesca y procesado (joint venture 1980)',
      employees: 600,
      notes: 'Activo non core; 26 buques; teasers distribuidos sin negociaciones formales',
    },
    {
      companySlug: 'nueva-pescanova',
      name: 'Chapela',
      ccaa: 'Galicia',
      province: 'Pontevedra',
      city: 'Chapela',
      status: 'operativa',
      specialty: 'Sede corporativa',
    }
  );

  // Contactos
  ctx.contacts.push(
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Chapela',
      fullName: 'Jorge Juan Escudero Hurtado de Amezaga',
      role: 'Consejero Delegado (CEO)',
      roleCategory: 'ceo',
      sourceUrl: 'https://www.nuevapescanova.com/2026/05/05/',
      sourceOutlet: 'Nueva Pescanova',
      confidence: 0.95,
      notes: 'Firma EINF 2025; CEO desde septiembre 2024',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Chapela',
      fullName: 'José María Benavent Valero',
      role: 'Presidente del Consejo',
      sourceUrl: 'https://www.nuevapescanova.com/2026/05/05/',
      sourceOutlet: 'Nueva Pescanova',
      confidence: 0.9,
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Chapela',
      fullName: 'Marta Otero Fernández',
      role: 'Directora General de Industria',
      sourceUrl: 'https://www.lavozdegalicia.es/noticia/mercados/2023/05/07/',
      sourceOutlet: 'La Voz de Galicia',
      confidence: 0.85,
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Morás (Arteixo)',
      fullName: 'Esteban Villanueva Novo',
      role: 'Director Ejecutivo País',
      linkedinUrl: 'https://linkedin.com/in/esteban-villanueva-novo-828248159',
      sourceOutlet: 'LinkedIn',
      confidence: 0.9,
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Pescamar (Mozambique)',
      fullName: 'Nicolás Castrillo Sotelo',
      role: 'Director de Operaciones de Pesca (Mozambique)',
      linkedinUrl: 'https://linkedin.com/in/nicolas-castrillo-sotelo',
      sourceOutlet: 'LinkedIn',
      confidence: 0.9,
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Sabón (Arteixo)',
      fullName: 'Marcos Osuna',
      role: 'Ex-Gerente CI Arteixo (2015-2017)',
      sourceUrl: 'https://marypescanoticiaspatagonicas.com/nota/12074/',
      sourceOutlet: 'Mar y Pesca',
      confidence: 0.6,
      notes: 'Histórico, ya no en la empresa',
    }
  );

  // Inventario técnico
  ctx.inventory.push(
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Sabón (Arteixo)',
      category: 'linea_produccion',
      specs: 'Capacidad actual 70 Tm/día (18h trabajo); 15.000 Tm/año',
      quantity: 1,
      status: 'a_sustituir',
      releaseWindow: '2027-2028',
      notes: 'Cocción langostino y gamba; a sustituir por Morás',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Sabón (Arteixo)',
      category: 'caldera',
      specs: 'Calderas de vapor (gas natural)',
      quantity: 2,
      status: 'a_sustituir',
      releaseWindow: '2027-2028',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Sabón (Arteixo)',
      category: 'refrigeracion',
      specs: 'Túneles de congelación',
      status: 'a_sustituir',
      releaseWindow: '2027-2028',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Sabón (Arteixo)',
      category: 'envasado',
      specs: 'Líneas de envasado con sistemas de visión artificial (Sea2Table 4.0)',
      status: 'a_sustituir',
      releaseWindow: '2027-2028',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Morás (Arteixo)',
      category: 'linea_produccion',
      specs: 'Capacidad prevista 23.900 Tm/año',
      quantity: 1,
      status: 'en_obra',
      releaseWindow: '2028',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Morás (Arteixo)',
      category: 'edificio',
      specs: 'EDAR + energía fotovoltaica',
      status: 'en_obra',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Morás (Arteixo)',
      category: 'parcela',
      specs: '9 parcelas, fase C, 25.627 m²; coste 3,08M€',
      status: 'en_obra',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Sabón (Arteixo)',
      category: 'sistema_almacenaje',
      brand: 'HoloLens',
      model: 'Dynamics 365',
      specs: 'Sea2Table 4.0 — IA, IoT, Blockchain (implantado feb 2023)',
      status: 'operativo',
      notes: 'Implantación HoloLens 2 + Dynamics 365',
    }
  );

  // Operaciones
  ctx.operations.push(
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Morás (Arteixo)',
      type: 'relocation',
      title: 'Traslado planta Sabón → Morás',
      description: 'Traslado del Centro Industrial de Arteixo desde Sabón al parque empresarial de Morás. Inversión 16M€. Capacidad 23.900 Tm/año. PIE 15º de Galicia. Plazo licencia hasta abril 2028.',
      amountMeur: 16,
      announcedAt: '2025-04-01',
      status: 'in_execution',
      confidence: 0.95,
      sourceUrl: 'https://www.elidealgallego.com/a-coruna/2026-02-28/nueva-pescanova-mantiene-activo-proyecto-nueva-fabrica-arteixo-839472.html',
      sourceOutlet: 'El Ideal Gallego',
    },
    {
      companySlug: 'nueva-pescanova',
      plantName: 'Pescamar (Mozambique)',
      type: 'divestment',
      title: 'Desinversión Pescamar (Mozambique)',
      description: 'Búsqueda de comprador para Grupo Pescamar (Mozambique). Teasers distribuidos; sin negociaciones formales a junio 2026. Resultado UGE Africa -13,82M€ (2025).',
      announcedAt: '2026-01-01',
      status: 'in_negotiation',
      confidence: 0.8,
      sourceUrl: 'https://www.farodevigo.es/economia/2026/01/01/nueva-pescanova-busca-comprador-historica-mozambique-filial-125298245.html',
      sourceOutlet: 'Faro de Vigo',
    }
  );

  // Financials
  ctx.financials.push(
    {
      companySlug: 'nueva-pescanova',
      year: 2025,
      concept: 'Ventas 2025',
      amountMeur: 1053.6,
      category: 'revenue',
    },
    {
      companySlug: 'nueva-pescanova',
      year: 2025,
      concept: 'EBITDA 2025',
      amountMeur: 71.2,
      category: 'ebitda',
    },
    {
      companySlug: 'nueva-pescanova',
      year: 2026,
      concept: 'Ampliación de capital 283M€ (ABANCA 279M€)',
      amountMeur: 283,
      category: 'capital_increase',
      sourceUrl: 'https://www.nuevapescanova.com/2026/05/05/grupo-nueva-pescanova-refuerza-su-estructura-financiera-con-una-ampliacion-de-capital-de-283-millones-de-euros/',
    },
    {
      companySlug: 'nueva-pescanova',
      year: 2024,
      concept: 'Ampliación de capital ABANCA 72,6M€',
      amountMeur: 72.6,
      category: 'capital_increase',
    },
    {
      companySlug: 'nueva-pescanova',
      year: 2025,
      concept: 'Suelo Morás adjudicado por Xestur',
      amountMeur: 3.08,
      category: 'investment',
    }
  );

  // Timeline
  const tlEvents: Array<[string, string, string?, string?]> = [
    ['1990-01-01', 'Pescanova adquiere parcela Sabón (16.841 m²)'],
    ['2013-01-01', 'Bajamar Septima se traslada desde Burgos a Sabón'],
    ['2015-01-01', 'Pescanova toma control directo de la planta Sabón'],
    ['2019-08-01', 'Pescanova solicita duplicar producción 70→157 Tm/día en Sabón'],
    ['2021-04-01', 'Proyecto Sea2Table 4.0: gemelo digital multifábrica'],
    ['2023-02-01', 'Implantación HoloLens 2 + Dynamics 365 en Arteixo'],
    ['2023-07-01', 'Resultados Sea2Table 4.0: IA, IoT, Blockchain en 3 plantas gallegas'],
    ['2024-09-01', 'Jorge Escudero asume como CEO'],
    ['2024-12-01', 'ABANCA inyecta 72,6M€ en ampliación de capital'],
    ['2025-04-01', 'Xestur adjudica 9 parcelas en Morás a Pescanova por 3,08M€'],
    ['2025-07-21', 'Xunta declara el proyecto PIE (Proyecto Industrial Estratégico)'],
    ['2026-01-01', 'Faro de Vigo revela búsqueda de comprador para Pescamar'],
    ['2026-02-28', 'Empresa confirma proyecto Morás activo "sin ningún cambio"'],
    ['2026-03-30', 'Resultados 2025: vuelta a beneficios (+1,1M€)'],
    ['2026-05-05', 'ABANCA inyecta 279M€ (ampliación total 283M€)'],
    ['2026-05-20', 'Junta General aprueba ampliación de capital'],
  ];
  for (const [date, title, desc, src] of tlEvents) {
    ctx.timelineEvents.push({
      companySlug: 'nueva-pescanova',
      date,
      title,
      description: desc,
      sourceUrl: src,
    });
  }

  // Auction checks
  ctx.auctionChecks.push(
    { companySlug: 'nueva-pescanova', platform: 'Surplex', result: 'sin_activos' },
    { companySlug: 'nueva-pescanova', platform: 'Escrapalia', result: 'sin_activos' },
    { companySlug: 'nueva-pescanova', platform: 'Troostwijk', result: 'sin_activos' }
  );

  // Documentos
  ctx.documents.push({
    companySlug: 'nueva-pescanova',
    kind: 'pdf',
    fileUrl: 'https://www.nuevapescanova.com/nuevapescanova/wp-content/uploads/2026/03/EINF-31.12.2025.pdf',
    fileName: 'EINF-31.12.2025.pdf',
    mimeType: 'application/pdf',
    externalUrl: 'https://www.nuevapescanova.com/nuevapescanova/wp-content/uploads/2026/03/EINF-31.12.2025.pdf',
  });

  // Fuentes
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      companySlug: 'nueva-pescanova',
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      publishedAt: '2026-02-28',
      deimplantationSignal: true,
    });
  }
}

function parseDanone(ctx: ParseContext, md: string): void {
  ctx.company = {
    slug: 'danone',
    name: 'Danone',
    cif: 'A17005152',
    sector: 'Alimentacion',
    subsector: 'Lácteos',
    cnae: '10.5',
    parentGroup: 'Danone S.A. (Euronext Paris)',
    hqCity: 'Barcelona',
    hqRegion: 'Cataluña',
    website: 'https://www.danone.es',
    logoUrl: 'https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png',
    tier: 'A',
    status: 'active',
    empleadosTotal: 2000,
  };
  ctx.companies.push(ctx.company);

  // Plantas
  const plantas: SeedPlant[] = [
    { companySlug: 'danone', name: 'Aldaia', ccaa: 'C. Valenciana', province: 'Valencia', city: 'Aldaia', status: 'operativa', specialty: 'Leche y productos lácteos', employees: 500, investmentMEur: 60, notes: 'Mayor planta láctea Danone en Europa; 52% exportación' },
    { companySlug: 'danone', name: 'Tres Cantos', ccaa: 'Madrid', province: 'Madrid', city: 'Tres Cantos', status: 'en_inversion', specialty: 'Productos frescos y salud (hub de ciencia)', investmentMEur: 40, notes: 'Inversión 2026-2027; absorberá producción de plantas europeas cerradas' },
    { companySlug: 'danone', name: 'Lanjarón', ccaa: 'Andalucía', province: 'Granada', city: 'Lanjarón', status: 'operativa', specialty: 'Agua mineral' },
    { companySlug: 'danone', name: 'Sant Hilari Sacalm', ccaa: 'Cataluña', province: 'Girona', city: 'Sant Hilari Sacalm', status: 'operativa', specialty: 'Agua mineral' },
    { companySlug: 'danone', name: 'Sigüenza', ccaa: 'Castilla-La Mancha', province: 'Guadalajara', city: 'Sigüenza', status: 'operativa', specialty: 'Agua mineral' },
    { companySlug: 'danone', name: 'Parets del Vallès', ccaa: 'Cataluña', province: 'Barcelona', city: 'Parets del Vallès', status: 'vendida', specialty: 'Leche (histórico: primera fábrica Danone del mundo — Centro Carasso)', notes: 'Vendida a Bon Preu 2024; hub logístico' },
    { companySlug: 'danone', name: 'Sevilla', ccaa: 'Andalucía', province: 'Sevilla', city: 'Sevilla', status: 'cerrada', specialty: 'Yogures (histórico)', closureYear: 2013 },
    { companySlug: 'danone', name: 'Salas', ccaa: 'Asturias', province: 'Asturias', city: 'Salas', status: 'cerrada', specialty: 'Leche (histórico)', closureYear: 2022 },
  ];
  ctx.plants.push(...plantas);

  // Contactos (al menos 1 por planta activa)
  ctx.contacts.push(
    { companySlug: 'danone', plantName: 'Tres Cantos', fullName: 'Francois Lacombe', role: 'Director General Danone Iberia', roleCategory: 'ceo', sourceOutlet: 'Danone', confidence: 0.9, notes: 'Directivo clave corporativo' },
    { companySlug: 'danone', plantName: 'Aldaia', fullName: 'Jaime Ávila Carrasco', role: 'Director de Operaciones Aldaia', roleCategory: 'coo', linkedinUrl: 'https://www.linkedin.com/in/jaime-avila-carrasco/', sourceOutlet: 'LinkedIn', confidence: 0.95, notes: 'Certificación Leading Your Team Through Change (2024)' },
    { companySlug: 'danone', plantName: 'Tres Cantos', fullName: 'David Ramos', role: 'Plant Manager Tres Cantos', roleCategory: 'plant_manager', sourceOutlet: 'Danone', confidence: 0.85, notes: 'Responsable de la planta con inversión 40M€' },
    { companySlug: 'danone', plantName: 'Tres Cantos', fullName: 'Meritxell Alegre', role: 'Directora Cafés Danone', roleCategory: 'other', sourceOutlet: 'Danone', confidence: 0.85 }
  );

  // Inventario técnico
  ctx.inventory.push(
    { companySlug: 'danone', plantName: 'Aldaia', category: 'linea_produccion', specs: 'Líneas UHT + líneas de yogur', status: 'operativo', notes: 'En modernización continua 60M€ 5 años' },
    { companySlug: 'danone', plantName: 'Aldaia', category: 'envasado', specs: 'Envasado aséptico', status: 'operativo' },
    { companySlug: 'danone', plantName: 'Aldaia', category: 'caldera', specs: 'Calderas de vapor', status: 'operativo' },
    { companySlug: 'danone', plantName: 'Aldaia', category: 'refrigeracion', specs: 'Sistemas de refrigeración', status: 'operativo' },
    { companySlug: 'danone', plantName: 'Aldaia', category: 'logistica', specs: 'Logística automatizada', status: 'operativo' },
    { companySlug: 'danone', plantName: 'Tres Cantos', category: 'linea_produccion', specs: 'Nueva línea de salud (en inversión 40M€)', status: 'en_obra', releaseWindow: '2026-2027' }
  );

  // Operaciones
  ctx.operations.push(
    { companySlug: 'danone', plantName: 'Tres Cantos', type: 'investment', title: 'Inversión 40M€ hub de ciencia Tres Cantos', description: 'Nueva línea de salud / hub de ciencia; absorberá producción de plantas europeas cerradas (Ochsenfurt, Villefranche).', amountMeur: 40, announcedAt: '2026-04-14', status: 'in_execution', confidence: 0.95, sourceUrl: 'https://www.retailactual.com/noticias/20260414/danone-fabrica-tres-cantos-hub-ciencia-inversion', sourceOutlet: 'Retail Actual' },
    { companySlug: 'danone', plantName: 'Aldaia', type: 'investment', title: 'Modernización Aldaia 60M€ (5 años)', description: 'Plan plurianual 2021-2026; convierte Aldaia en mayor planta láctea Danone en Europa.', amountMeur: 60, announcedAt: '2021-01-01', status: 'in_execution', confidence: 0.95 },
    { companySlug: 'danone', plantName: 'Parets del Vallès', type: 'plant_sale', title: 'Venta planta Parets del Vallès a Bon Preu', description: 'Venta de la planta (Centro Carasso, primera fábrica Danone del mundo) a Bon Preu para hub logístico.', announcedAt: '2024-01-01', status: 'executed', confidence: 0.9 },
    { companySlug: 'danone', plantName: 'Sevilla', type: 'plant_closure', title: 'Cierre planta de Sevilla (yogures)', description: 'Cierre ejecutado en 2013.', announcedAt: '2013-01-01', status: 'executed', confidence: 0.95 },
    { companySlug: 'danone', plantName: 'Salas', type: 'plant_closure', title: 'Cierre planta de Salas (leche)', description: 'Cierre ejecutado en 2022.', announcedAt: '2022-01-01', status: 'executed', confidence: 0.95 }
  );

  // Financials
  ctx.financials.push(
    { companySlug: 'danone', year: 2021, concept: 'Inicio modernización Aldaia 60M€', amountMeur: 60, category: 'investment' },
    { companySlug: 'danone', year: 2026, concept: 'Inversión Tres Cantos 40M€', amountMeur: 40, category: 'investment' }
  );

  // Timeline
  const tl: Array<[string, string, string?]> = [
    ['1919-01-01', 'Isaac Carasso funda Danone en Barcelona — primera fábrica Danone del mundo'],
    ['2013-01-01', 'Cierre de planta de Sevilla (yogures)'],
    ['2014-01-01', 'Cierre de planta de Casale Cremasco (Italia)'],
    ['2019-01-01', 'Inicio inversión progresiva en Aldaia: 60M€ en 5 años'],
    ['2022-01-01', 'Cierre de planta de Salas (Asturias) — producción de leche'],
    ['2024-01-01', 'Venta de planta de Parets del Vallès (Barcelona) a Bon Preu'],
    ['2024-01-01', 'Jaime Ávila Carrasco (Director Ops Aldaia) certificación Leading Your Team Through Change'],
    ['2025-12-01', 'Danone anuncia cierres europeos: Ochsenfurt (Alemania) y Villefranche-sur-Saône (Francia)'],
    ['2026-04-14', 'Retail Actual informa inversión 40M€ en Tres Cantos como hub de ciencia'],
    ['2026-12-31', 'Tres Cantos absorbe producción de plantas europeas que cierran'],
  ];
  for (const [date, title, desc] of tl) {
    ctx.timelineEvents.push({ companySlug: 'danone', date, title, description: desc });
  }

  // Auction checks
  ctx.auctionChecks.push(
    { companySlug: 'danone', platform: 'Escrapalia', result: 'sin_activos' },
    { companySlug: 'danone', platform: 'Surplex', result: 'sin_activos' },
    { companySlug: 'danone', platform: 'Troostwijk', result: 'sin_activos' },
    { companySlug: 'danone', platform: 'HGP', result: 'historial', details: 'Historial de liquidaciones Danone en Europa' },
    { companySlug: 'danone', platform: 'Apex', result: 'historial', details: 'Historial de liquidaciones Danone en Europa' }
  );

  // Fuentes
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      companySlug: 'danone',
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      deimplantationSignal: true,
    });
  }
}

function parseMahou(ctx: ParseContext, md: string): void {
  ctx.company = {
    slug: 'mahou-sanmiguel',
    name: 'Mahou-San Miguel',
    cif: 'A28003615',
    sector: 'Bebidas',
    subsector: 'Cerveza y bebidas',
    cnae: '11.0',
    hqCity: 'Madrid',
    hqRegion: 'Madrid',
    website: 'https://www.mahou-sanmiguel.com',
    logoUrl: 'https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png',
    facturacionM: 1933.5,
    facturacionYear: 2024,
    ebitdaM: 300.3,
    beneficioNetoM: 114.8,
    empleadosTotal: 4419,
    tier: 'A',
    status: 'active',
  };
  ctx.companies.push(ctx.company);

  // Plantas: Alovera (foco), resto en estado operativa
  const fabricas = ['Alovera', 'Burgos', 'Candelaria', 'Córdoba', 'Granada', 'Lleida', 'Málaga'];
  const fabricasCCAA: Record<string, [string, string]> = {
    Alovera: ['Castilla-La Mancha', 'Guadalajara'],
    Burgos: ['Castilla y León', 'Burgos'],
    Candelaria: ['Canarias', 'Santa Cruz de Tenerife'],
    Córdoba: ['Andalucía', 'Córdoba'],
    Granada: ['Andalucía', 'Granada'],
    Lleida: ['Cataluña', 'Lleida'],
    Málaga: ['Andalucía', 'Málaga'],
  };
  for (const f of fabricas) {
    const [ccaa, prov] = fabricasCCAA[f];
    ctx.plants.push({
      companySlug: 'mahou-sanmiguel',
      name: f,
      ccaa,
      province: prov,
      city: f,
      status: 'operativa',
      specialty: 'Cerveza',
    });
  }
  // Añadir Madrid cerrada
  ctx.plants.push({
    companySlug: 'mahou-sanmiguel',
    name: 'Madrid',
    ccaa: 'Madrid',
    province: 'Madrid',
    city: 'Madrid',
    status: 'cerrada',
    specialty: 'Cerveza (histórico)',
    closureYear: 1993,
  });
  // Alovera: detalle de inversiones
  const aloveraIdx = ctx.plants.findIndex((p) => p.companySlug === 'mahou-sanmiguel' && p.name === 'Alovera');
  if (aloveraIdx >= 0) {
    ctx.plants[aloveraIdx] = {
      ...ctx.plants[aloveraIdx],
      parcelaM2: 69000,
      naveM2: 69000,
      investmentMEur: 107, // 80 + 16 + 11
      notes: 'Gran inversión: almacén automatizado 80M€ + biomasa 16M€ + modernización 11M€',
    };
  }

  // Contactos
  ctx.contacts.push(
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', fullName: 'Nicolás Castrejón', role: 'Director General de Operaciones (DGO)', roleCategory: 'coo', linkedinUrl: 'https://www.linkedin.com/in/nicolas-castrejon/', sourceOutlet: 'LinkedIn', confidence: 0.95 },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', fullName: 'César Rodríguez', role: 'Director de Fábrica Alovera', roleCategory: 'plant_manager', linkedinUrl: 'https://www.linkedin.com/in/cesar-rodriguez-mahou/', sourceOutlet: 'LinkedIn', confidence: 0.95, notes: 'Director desde enero 2026' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', fullName: 'Marc Borrada', role: 'Director Centro de Producción + Compras', roleCategory: 'procurement', linkedinUrl: 'https://www.linkedin.com/in/marc-borreda/', sourceOutlet: 'LinkedIn', confidence: 0.95 },
    { companySlug: 'mahou-sanmiguel', plantName: 'Córdoba', fullName: 'Enrique Alonso', role: 'Director de Fábrica Córdoba', roleCategory: 'plant_manager', sourceOutlet: 'Mahou', confidence: 0.9 }
  );

  // Inventario técnico Alovera
  ctx.inventory.push(
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', category: 'sistema_almacenaje', specs: 'Almacén automatizado 69.000 m², 100K pales, 71 muelles, IA', status: 'en_obra', releaseWindow: '2027', notes: 'Sustituye almacén convencional; 80M€ inversión' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', category: 'co_generacion', brand: 'Magnon/Ence', model: '2 calderas 10 MWt', specs: 'Planta biomasa; reducción -95% CO2', status: 'en_obra', releaseWindow: '1er sem 2026', notes: '16M€ inversión; operador Magnon/Ence' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', category: 'caldera', specs: 'Calderas de gas natural (back-up) a liberar tras biomasa', status: 'a_sustituir', releaseWindow: '2do sem 2026' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', category: 'sistema_almacenaje', specs: 'Almacén convencional a liberar (cuando nuevo almacén esté operativo)', status: 'a_sustituir', releaseWindow: '2027' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', category: 'logistica', specs: 'Carretillas elevadoras convencionales', status: 'a_sustituir', releaseWindow: '2027', notes: 'Sustituidas por automatización' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', category: 'packaging', specs: 'Líneas de packaging antiguas', status: 'a_sustituir', notes: 'Modernización continua' }
  );

  // Operaciones
  ctx.operations.push(
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', type: 'warehouse', title: 'Almacén automatizado Alovera 80M€', description: 'Nuevo almacén 69.000 m² con IA, 100K pales, 71 muelles. Operador logístico GXO Logistics (acuerdo marzo 2026). Operativo previsto 2027.', amountMeur: 80, announcedAt: '2025-01-01', status: 'in_execution', confidence: 0.95, sourceUrl: 'https://www.mahou-sanmiguel.com/es-es/sala-de-prensa/notas-de-prensa/mahou-san-miguel-avanza-en-las-obras-de-su-innovador-almacen-de-alovera', sourceOutlet: 'Mahou San Miguel' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', type: 'biomass_plant', title: 'Planta biomasa Alovera 16M€', description: '2 calderas de biomasa 10 MWt; -95% CO2; operador Magnon/Ence. Puesta en marcha 1er semestre 2026.', amountMeur: 16, announcedAt: '2025-01-01', status: 'in_execution', confidence: 0.95, sourceUrl: 'https://www.mahou-sanmiguel.com/es-es/sala-de-prensa/notas-de-prensa/mahou-san-miguel-impulsa-la-descarbonizacion-con-una-nueva-planta-de-biomasa-en-alovera', sourceOutlet: 'Mahou San Miguel' },
    { companySlug: 'mahou-sanmiguel', plantName: 'Alovera', type: 'investment', title: 'Modernización Alovera 2022', description: 'Modernización completada en 2022 (11M€).', amountMeur: 11, announcedAt: '2022-01-01', status: 'executed', confidence: 0.95 }
  );

  // Financials
  ctx.financials.push(
    { companySlug: 'mahou-sanmiguel', year: 2024, concept: 'Facturación 2024', amountMeur: 1933.5, category: 'revenue' },
    { companySlug: 'mahou-sanmiguel', year: 2024, concept: 'EBITDA 2024', amountMeur: 300.3, category: 'ebitda' },
    { companySlug: 'mahou-sanmiguel', year: 2024, concept: 'Beneficio neto 2024', amountMeur: 114.8, category: 'revenue' },
    { companySlug: 'mahou-sanmiguel', year: 2025, concept: 'Almacén automatizado Alovera 80M€', amountMeur: 80, category: 'investment' },
    { companySlug: 'mahou-sanmiguel', year: 2025, concept: 'Planta biomasa Alovera 16M€', amountMeur: 16, category: 'investment' },
    { companySlug: 'mahou-sanmiguel', year: 2022, concept: 'Modernización Alovera 11M€', amountMeur: 11, category: 'investment' }
  );

  // Timeline
  const tl: Array<[string, string]> = [
    ['1993-01-01', 'Cierre fábrica de Madrid'],
    ['2022-01-01', 'Modernización de Alovera: 11M€'],
    ['2025-01-01', 'Inicio obras almacén automatizado Alovera (80M€)'],
    ['2025-01-01', 'Proyecto planta biomasa Alovera (16M€), operador Magnon/Ence'],
    ['2026-03-01', 'Acuerdo con GXO Logistics como operador logístico'],
    ['2026-01-01', 'César Rodríguez asume como Director de Fábrica Alovera'],
    ['2026-06-30', 'Puesta en marcha planta biomasa (2 calderas 10 MWt)'],
    ['2027-12-31', 'Almacén automatizado operativo (69.000 m², 100K pales, 71 muelles)'],
  ];
  for (const [date, title] of tl) {
    ctx.timelineEvents.push({ companySlug: 'mahou-sanmiguel', date, title });
  }

  // Auction checks
  ctx.auctionChecks.push(
    { companySlug: 'mahou-sanmiguel', platform: 'Escrapalia', result: 'sin_activos' },
    { companySlug: 'mahou-sanmiguel', platform: 'Surplex', result: 'sin_activos' },
    { companySlug: 'mahou-sanmiguel', platform: 'Troostwijk', result: 'sin_activos' }
  );

  // Sources
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      companySlug: 'mahou-sanmiguel',
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      deimplantationSignal: true,
    });
  }
}

function parseAgama(ctx: ParseContext, md: string): void {
  ctx.company = {
    slug: 'damm',
    name: 'Grupo Damm',
    cif: 'A08008723',
    sector: 'Bebidas',
    subsector: 'Cerveza + Lácteos (en salida)',
    cnae: '11.0',
    parentGroup: 'Grupo Damm',
    hqCity: 'Barcelona',
    hqRegion: 'Cataluña',
    website: 'https://www.damm.com',
    logoUrl: 'https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png',
    facturacionM: 2025,
    facturacionYear: 2024,
    ebitdaM: 321,
    beneficioNetoM: 175,
    tier: 'A',
    status: 'active',
  };
  ctx.companies.push(ctx.company);

  // Planta AGAMA cerrada
  ctx.plants.push({
    companySlug: 'damm',
    name: 'AGAMA Palma de Mallorca',
    ccaa: 'Islas Baleares',
    province: 'Islas Baleares',
    city: 'Palma de Mallorca',
    status: 'cerrada',
    specialty: 'Leche fresca, productos lácteos, Cacaolat (antes), Laccao (antes)',
    employees: 14,
    closureYear: 2026,
    notes: 'Polígono Son Carbo (o cercano); fundada 1958; adquirida por Damm 2017; cese 1 abril 2026',
  });

  // Contactos
  ctx.contacts.push(
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', fullName: 'Demetrio Carceller', role: 'Presidente Grupo Damm', roleCategory: 'ceo', sourceUrl: 'https://www.expansion.com/', sourceOutlet: 'Expansión', confidence: 0.95 },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', fullName: 'Josep Barbena', role: 'Director General Cacaolat', linkedinUrl: 'https://www.linkedin.com/in/josep-barbena/', sourceOutlet: 'LinkedIn', confidence: 0.9, notes: 'Gestiona marca Cacaolat vendida parcialmente a Idilia' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', fullName: 'José Joaquín Vila', role: 'Director de Negocio Lácteo Damm', linkedinUrl: 'https://www.linkedin.com/in/jose-joaquin-vila/', sourceOutlet: 'LinkedIn', confidence: 0.9, notes: 'Responsable de la división láctea' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', fullName: 'Jesús Ávila', role: 'Representante CCOO', sourceOutlet: 'CCOO', confidence: 0.85, notes: 'Se abstuvo en acuerdo de cierre; voz crítica' }
  );

  // Inventario técnico (liberado tras cierre)
  ctx.inventory.push(
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', category: 'linea_produccion', specs: 'Líneas de tratamiento de leche: pasteurizadoras, UHT, homogeneizadoras', status: 'desmantelado', notes: 'Desmantelamiento denunciado sept 2025' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', category: 'envasado', specs: 'Líneas de embotellado: llenadoras, etiquetadoras, encapsuladoras', status: 'desmantelado', notes: 'Cese 1 abril 2026' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', category: 'caldera', specs: 'Calderas de vapor (procesos lácteos)', status: 'liberado', releaseWindow: '2026' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', category: 'sistema_almacenaje', specs: 'Tanques de almacenaje: silos de leche, tanques de proceso', status: 'liberado', releaseWindow: '2026' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', category: 'refrigeracion', specs: 'Sistemas de refrigeración: cámaras frigoríficas, torres de refrigeración', status: 'liberado', releaseWindow: '2026' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', category: 'edificio', specs: 'Equipos de laboratorio, control microbiológico', status: 'liberado' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', category: 'logistica', specs: 'Cintas transportadoras, paletizadoras', status: 'liberado' }
  );

  // Operaciones
  ctx.operations.push(
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', type: 'plant_closure', title: 'Cierre planta AGAMA Palma de Mallorca', description: 'Cese total de operaciones el 1 abril 2026. 14 trabajadores: 5 recolocados, 9 con indemnización. 1,1M€ de subvención reclamada por Govern Balear. Proyecto DAMM Next Generation 42M€ cancelado.', announcedAt: '2026-03-03', status: 'executed', jobsAffected: 14, confidence: 0.98, sourceUrl: 'https://www.ultimahora.es/noticias/part-forana/2026/03/23/2595143/grupo-damm-llega-principio-acuerdo-los-trabajadores-agama.html', sourceOutlet: 'Última Hora' },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', type: 'divestment', title: 'Venta 50% Cacaolat a Idilia Foods', description: 'Venta de la mitad de Cacaolat a Idilia Foods (junio 2024).', amountMeur: 0, announcedAt: '2024-06-01', status: 'executed', confidence: 0.9 },
    { companySlug: 'damm', plantName: 'AGAMA Palma de Mallorca', type: 'relocation', title: 'Traslado producción Laccao a Barcelona', description: 'Traslado de producción Laccao a Barcelona (junio 2021).', announcedAt: '2021-06-01', status: 'executed', confidence: 0.85 }
  );

  // Financials
  ctx.financials.push(
    { companySlug: 'damm', year: 2024, concept: 'Facturación Grupo Damm 2024', amountMeur: 2025, category: 'revenue' },
    { companySlug: 'damm', year: 2024, concept: 'EBITDA 2024', amountMeur: 321, category: 'ebitda' },
    { companySlug: 'damm', year: 2024, concept: 'Beneficio neto 2024', amountMeur: 175, category: 'revenue' },
    { companySlug: 'damm', year: 2026, concept: 'Subvención reclamada Govern Balear', amountMeur: 1.1, category: 'debt_restructuring', notes: 'Reclamación al Govern' }
  );

  // Timeline
  const tl: Array<[string, string, string?]> = [
    ['1958-01-01', 'Fundación de AGAMA (planta lechera en Palma de Mallorca)'],
    ['2017-01-01', 'Grupo Damm adquiere AGAMA'],
    ['2017-12-31', 'Inversión acumulada AGAMA 2017-2026: 7-8M€'],
    ['2021-06-01', 'Traslado de producción Laccao a Barcelona'],
    ['2024-06-01', 'Venta del 50% de Cacaolat a Idilia Foods'],
    ['2025-09-01', 'Trabajadores denuncian desmantelamiento de la planta'],
    ['2025-12-01', 'Damm deja de comprar leche a ganaderos de Mallorca'],
    ['2026-03-03', 'Damm comunica formalmente el cierre de la planta'],
    ['2026-03-10', 'Primera reunión de la mesa negociadora'],
    ['2026-03-23', 'Acuerdo entre Damm y trabajadores: 5 recolocados, 9 con indemnización'],
    ['2026-03-31', 'Última recogida de leche a ganaderos'],
    ['2026-04-01', 'Cese del embotellado'],
    ['2026-04-10', 'Fin de los contratos laborales'],
  ];
  for (const [date, title, desc] of tl) {
    ctx.timelineEvents.push({ companySlug: 'damm', date, title, description: desc });
  }

  // Auction checks
  ctx.auctionChecks.push(
    { companySlug: 'damm', platform: 'Escrapalia', result: 'sin_activos' },
    { companySlug: 'damm', platform: 'Surplex', result: 'no_verificado', details: 'No verificado activamente' },
    { companySlug: 'damm', platform: 'Troostwijk', result: 'no_verificado', details: 'No verificado activamente' }
  );

  // Sources
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      companySlug: 'damm',
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      deimplantationSignal: true,
    });
  }
}

function parsePascual(ctx: ParseContext, md: string): void {
  ctx.company = {
    slug: 'leche-pascual',
    name: 'Leche Pascual (Calidad Pascual)',
    cif: 'A09004872',
    sector: 'Alimentacion',
    subsector: 'Lácteos',
    cnae: '10.5',
    parentGroup: 'Grupo Pascual',
    hqCity: 'Aranda de Duero',
    hqRegion: 'Castilla y León',
    website: 'https://calidadpascual.com',
    logoUrl: 'https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png',
    facturacionM: 929,
    facturacionYear: 2024,
    beneficioNetoM: 20,
    tier: 'A',
    status: 'active',
  };
  ctx.companies.push(ctx.company);

  // Plantas
  ctx.plants.push(
    { companySlug: 'leche-pascual', name: 'Gurb', ccaa: 'Cataluña', province: 'Barcelona', city: 'Gurb', status: 'en_desmantelamiento', specialty: 'Leche UHT, Llet Nostra (histórico)', parcelaM2: 46000, naveM2: 12000, closureYear: 2026, notes: 'Vendida a Casa Tarradellas para fábrica de mozzarella; cierre 31 jul 2026' },
    { companySlug: 'leche-pascual', name: 'Aranda de Duero', ccaa: 'Castilla y León', province: 'Burgos', city: 'Aranda de Duero', status: 'operativa', specialty: 'Leche UHT (sede + producción principal)', notes: 'Recibe línea UHT 1 trasladada desde Gurb' }
  );

  // Contactos
  ctx.contacts.push(
    { companySlug: 'leche-pascual', plantName: 'Aranda de Duero', fullName: 'Tomás Pascual', role: 'Presidente Grupo Pascual', roleCategory: 'ceo', sourceUrl: 'https://www.expansion.com/', sourceOutlet: 'Expansión', confidence: 0.95 },
    { companySlug: 'leche-pascual', plantName: 'Aranda de Duero', fullName: 'César Vargas', role: 'CEO Grupo Pascual', roleCategory: 'ceo', linkedinUrl: 'https://www.linkedin.com/in/cesar-vargas-pascual/', sourceOutlet: 'LinkedIn', confidence: 0.95, notes: 'CEO desde enero 2026; lidera Proyecto AURA' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', fullName: 'Mònica Planas', role: 'Directora de Fábrica Gurb', roleCategory: 'plant_manager', linkedinUrl: 'https://www.linkedin.com/in/monica-planas/', sourceOutlet: 'LinkedIn', confidence: 0.9, notes: 'Gestiona la planta en desmantelamiento' },
    { companySlug: 'leche-pascual', plantName: 'Aranda de Duero', fullName: 'David Ramírez', role: 'Responsable de Producción Pascual', roleCategory: 'coo', sourceOutlet: 'Pascual', confidence: 0.85, notes: 'Responsable de producción y traslado de líneas' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', fullName: 'Quim Català', role: 'Abogado de los trabajadores', sourceOutlet: 'Representación legal', confidence: 0.85, notes: 'Representación legal de los trabajadores afectados' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', fullName: 'Josep Tarradellas', role: 'Presidente Casa Tarradellas', roleCategory: 'ceo', sourceOutlet: 'Casa Tarradellas', confidence: 0.95, notes: 'Comprador de la planta de Gurb' }
  );

  // Inventario técnico
  ctx.inventory.push(
    { companySlug: 'leche-pascual', plantName: 'Gurb', category: 'linea_produccion', brand: 'GEA', specs: 'Línea UHT 1', status: 'liberado', releaseWindow: '2026-Q2', notes: 'TRASLADADA a Aranda de Duero' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', category: 'linea_produccion', specs: 'Línea UHT 2', status: 'desmantelado', releaseWindow: '2026-Q3', notes: 'En desmantelamiento; destino desconocido' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', category: 'sistema_almacenaje', specs: 'Tanques de almacenaje: silos de leche, tanques de proceso', status: 'a_sustituir', releaseWindow: '2026-Q3' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', category: 'envasado', specs: 'Sistemas de llenado y envasado: llenadoras asépticas, etiquetadoras', status: 'a_sustituir', releaseWindow: '2026-Q3' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', category: 'caldera', specs: 'Calderas de vapor', status: 'a_sustituir', releaseWindow: '2026-Q3' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', category: 'refrigeracion', specs: 'Sistemas de refrigeración: cámaras frigoríficas', status: 'a_sustituir', releaseWindow: '2026-Q3' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', category: 'logistica', specs: 'Cintas transportadoras', status: 'a_sustituir', releaseWindow: '2026-Q3' },
    { companySlug: 'leche-pascual', plantName: 'Aranda de Duero', category: 'linea_produccion', brand: 'GEA', specs: 'Línea UHT 1 (trasladada desde Gurb)', status: 'en_uso', notes: 'Recibe línea UHT 1' }
  );

  // Operaciones
  ctx.operations.push(
    { companySlug: 'leche-pascual', plantName: 'Gurb', type: 'plant_sale', title: 'Venta planta Gurb a Casa Tarradellas', description: 'Venta de la planta de Gurb a Casa Tarradellas para fábrica de mozzarella. 46.000 m² parcela, 12.000 m² nave.', announcedAt: '2026-04-01', status: 'in_execution', confidence: 0.95, sourceUrl: 'https://www.elperiodico.com/es/economia/20260508/trabajadores-leche-pascual-denuncian-desmantela-fabrica-gurb-129987051', sourceOutlet: 'El Periódico' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', type: 'line_closure', title: 'Cese producción Llet Nostra en Gurb', description: 'Cese producción Llet Nostra 13 mayo 2026; huelga indefinida desde 11 mayo; corte C-17 el 31 mayo.', announcedAt: '2026-05-13', status: 'in_execution', confidence: 0.95, sourceUrl: 'https://www.elperiodico.com/es/economia/20260508/trabajadores-leche-pascual-denuncian-desmantela-fabrica-gurb-129987051', sourceOutlet: 'El Periódico' },
    { companySlug: 'leche-pascual', plantName: 'Gurb', type: 'relocation', title: 'Traslado Línea UHT 1 a Aranda de Duero', description: 'Traslado de la Línea UHT 1 a Aranda de Duero.', announcedAt: '2026-05-01', status: 'executed', confidence: 0.9 }
  );

  // Financials
  ctx.financials.push(
    { companySlug: 'leche-pascual', year: 2024, concept: 'Facturación 2024', amountMeur: 929, category: 'revenue' },
    { companySlug: 'leche-pascual', year: 2024, concept: 'Beneficio neto 2024', amountMeur: 20, category: 'revenue' }
  );

  // Timeline
  const tl: Array<[string, string, string?]> = [
    ['2025-09-01', 'Pascual y Casa Tarradellas anuncian alianza para producción de mozzarella'],
    ['2026-01-01', 'Nuevo CEO César Vargas toma posesión; Proyecto AURA anunciado'],
    ['2026-04-01', 'Anuncio público de venta de planta de Gurb a Casa Tarradellas'],
    ['2026-05-08', 'Trabajadores denuncian desmantelamiento de la planta'],
    ['2026-05-11', 'Huelga indefinida convocada por trabajadores'],
    ['2026-05-13', 'Cese de producción de Llet Nostra en Gurb'],
    ['2026-05-31', 'Corte de la carretera C-17 por trabajadores'],
    ['2026-07-31', 'Cierre previsto de la planta'],
  ];
  for (const [date, title, desc] of tl) {
    ctx.timelineEvents.push({ companySlug: 'leche-pascual', date, title, description: desc });
  }

  // Auction checks
  ctx.auctionChecks.push(
    { companySlug: 'leche-pascual', platform: 'Escrapalia', result: 'sin_activos' },
    { companySlug: 'leche-pascual', platform: 'Surplex', result: 'sin_activos' },
    { companySlug: 'leche-pascual', platform: 'Troostwijk', result: 'sin_activos' },
    { companySlug: 'leche-pascual', platform: 'GUTINVEST', result: 'activos_detectados', details: 'Equipos GEA en Barcelona — origen Gurb NO confirmado' }
  );

  // Sources
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      companySlug: 'leche-pascual',
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      deimplantationSignal: true,
    });
  }
}

function parseNestle(ctx: ParseContext, md: string): void {
  ctx.company = {
    slug: 'nestle-espana',
    name: 'Nestlé España',
    cif: 'A08005449',
    sector: 'Alimentacion',
    subsector: 'Alimentación múltiple (lácteos, café, cereales, agua)',
    cnae: '10.8',
    parentGroup: 'Nestlé S.A.',
    hqCity: 'Esplugues de Llobregat',
    hqRegion: 'Cataluña',
    website: 'https://www.nestle.es',
    logoUrl: 'https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png',
    facturacionM: 2894,
    facturacionYear: 2025,
    empleadosTotal: 4158,
    tier: 'A',
    status: 'active',
  };
  ctx.companies.push(ctx.company);

  // Centros
  const centros: Array<[string, string, string, string, 'operativa' | 'en_inversion', number?]> = [
    ['Esplugues de Llobregat', 'Cataluña', 'Barcelona', 'Oficinas corporativas', 'operativa', undefined],
    ['La Penilla', 'Cantabria', 'Cantabria', 'Fábrica de café y derivados', 'operativa', 800],
    ['Pontecesures', 'Galicia', 'Pontevedra', 'Fábrica', 'operativa', 200],
    ['Miajadas', 'Extremadura', 'Cáceres', 'Fábrica', 'operativa', 80],
    ['Girona', 'Cataluña', 'Girona', 'Fábrica de packaging', 'en_inversion', undefined],
    ['Sebares', 'Asturias', 'Asturias', 'Fábrica (2 nuevas líneas)', 'en_inversion', undefined],
  ];
  for (const [name, ccaa, prov, specialty, status, employees] of centros) {
    ctx.plants.push({
      companySlug: 'nestle-espana',
      name,
      ccaa,
      province: prov,
      city: name,
      status,
      specialty,
      employees: employees as number | undefined,
    });
  }

  // Contactos
  ctx.contacts.push(
    { companySlug: 'nestle-espana', plantName: 'Esplugues de Llobregat', fullName: 'Pablo Isla', role: 'Presidente global Nestlé (ex-Inditex)', roleCategory: 'ceo', sourceUrl: 'https://elpais.com/economia/', sourceOutlet: 'El País', confidence: 0.95 },
    { companySlug: 'nestle-espana', plantName: 'Esplugues de Llobregat', fullName: 'Philipp Navratil', role: 'CEO global Nestlé', roleCategory: 'ceo', sourceUrl: 'https://www.nestle.com/', sourceOutlet: 'Nestlé', confidence: 0.95 },
    { companySlug: 'nestle-espana', plantName: 'Esplugues de Llobregat', fullName: 'Olivier Helfer', role: 'Presidente Nestlé España + CFO Europa', roleCategory: 'ceo', linkedinUrl: 'https://www.linkedin.com/in/olivier-helfer/', sourceOutlet: 'LinkedIn', confidence: 0.95, notes: 'Doble cargo; contacto clave para España y Europa' },
    { companySlug: 'nestle-espana', plantName: 'Esplugues de Llobregat', fullName: 'Jordi Llarch', role: 'Director General Nestlé España', roleCategory: 'ceo', linkedinUrl: 'https://www.linkedin.com/in/jordi-llarch/', sourceOutlet: 'LinkedIn', confidence: 0.95, notes: 'Ejecutivo principal en España' }
  );

  // Inventario técnico
  ctx.inventory.push(
    { companySlug: 'nestle-espana', plantName: 'Girona', category: 'packaging', specs: 'Equipos de packaging antiguos', status: 'a_sustituir', releaseWindow: '2026-2027', notes: 'A sustituir por nuevas líneas de packaging (+25 puestos)' },
    { companySlug: 'nestle-espana', plantName: 'Sebares', category: 'linea_produccion', specs: 'Líneas de producción obsoletas', status: 'a_sustituir', releaseWindow: '2026-2027', notes: 'A sustituir por 2 nuevas líneas (+10 puestos)' },
    { companySlug: 'nestle-espana', plantName: 'Sebares', category: 'linea_produccion', specs: '2 nuevas líneas de producción', status: 'en_obra', releaseWindow: '2026-2027' },
    { companySlug: 'nestle-espana', plantName: 'Girona', category: 'packaging', specs: 'Nuevas líneas de packaging (+25 puestos)', status: 'en_obra', releaseWindow: '2026-2027' },
    { companySlug: 'nestle-espana', plantName: 'Esplugues de Llobregat', category: 'edificio', specs: 'Reducción espacio de oficinas', status: 'a_sustituir' }
  );

  // Operaciones (ERE)
  const ereOps: SeedOperation[] = [
    { companySlug: 'nestle-espana', plantName: 'Esplugues de Llobregat', type: 'ERE', title: 'ERE Esplugues — 158 despidos', description: 'Principalmente oficinas. Movilizaciones CCOO 1 junio 2026.', jobsAffected: 158, announcedAt: '2026-01-15', status: 'in_negotiation', confidence: 0.95, sourceUrl: 'https://www.20minutos.es/lainformacion/economia-y-finanzas/nestle-rebaja-numero-afectados-ere-267-trabajadores-crear-nuevos-puestos-trabajo-girona-sebares_6976452_0.html', sourceOutlet: '20minutos' },
    { companySlug: 'nestle-espana', plantName: 'La Penilla', type: 'ERE', title: 'ERE La Penilla — 43 despidos', description: 'Sobre ~800 empleados (~5%). Paros 2-4 junio 2026.', jobsAffected: 43, announcedAt: '2026-01-15', status: 'in_negotiation', confidence: 0.95, sourceUrl: 'https://www.20minutos.es/lainformacion/economia-y-finanzas/nestle-rebaja-numero-afectados-ere-267-trabajadores-crear-nuevos-puestos-trabajo-girona-sebares_6976452_0.html', sourceOutlet: '20minutos' },
    { companySlug: 'nestle-espana', plantName: 'Pontecesures', type: 'ERE', title: 'ERE Pontecesures — 27 despidos (14% plantilla)', description: 'Huelga indefinida desde junio 2026.', jobsAffected: 27, announcedAt: '2026-01-15', status: 'in_negotiation', confidence: 0.95, sourceUrl: 'https://www.20minutos.es/lainformacion/economia-y-finanzas/nestle-rebaja-numero-afectados-ere-267-trabajadores-crear-nuevos-puestos-trabajo-girona-sebares_6976452_0.html', sourceOutlet: '20minutos' },
    { companySlug: 'nestle-espana', plantName: 'Miajadas', type: 'ERE', title: 'ERE Miajadas — 8 despidos (10% plantilla)', description: 'ERE Cáceres.', jobsAffected: 8, announcedAt: '2026-01-15', status: 'in_negotiation', confidence: 0.9 },
    { companySlug: 'nestle-espana', plantName: 'Girona', type: 'investment', title: 'Girona — 25 nuevos puestos (packaging)', description: 'Neto: +13 (pierde 12, gana 25).', jobsAffected: 13, announcedAt: '2026-05-01', status: 'in_execution', confidence: 0.9 },
    { companySlug: 'nestle-espana', plantName: 'Sebares', type: 'investment', title: 'Sebares — 10 nuevos puestos (2 nuevas líneas)', description: 'Neto: +6 (pierde 4, gana 10).', jobsAffected: 6, announcedAt: '2026-05-01', status: 'in_execution', confidence: 0.9 }
  ];
  for (const op of ereOps) ctx.operations.push(op);

  // Financials
  ctx.financials.push(
    { companySlug: 'nestle-espana', year: 2025, concept: 'Facturación 2025 (récord)', amountMeur: 2894, category: 'revenue' }
  );

  // Timeline
  const tl: Array<[string, string, string?]> = [
    ['2024-01-01', 'Nestlé anuncia plan global "Fuel for Growth" — 16.000 despidos mundiales'],
    ['2025-12-01', 'Inicio negociaciones ERE en España con representación sindical'],
    ['2026-05-01', 'ERE rebajado de 301 a 267 afectados tras negociación'],
    ['2026-06-01', 'CCOO convoca movilizaciones'],
    ['2026-06-02', 'Paros en La Penilla'],
    ['2026-06-04', 'Fin paros La Penilla'],
    ['2026-06-15', 'Huelga indefinida en Pontecesures'],
  ];
  for (const [date, title, desc] of tl) {
    ctx.timelineEvents.push({ companySlug: 'nestle-espana', date, title, description: desc });
  }

  // Auction checks
  ctx.auctionChecks.push(
    { companySlug: 'nestle-espana', platform: 'Escrapalia', result: 'sin_activos' },
    { companySlug: 'nestle-espana', platform: 'Surplex', result: 'sin_activos' },
    { companySlug: 'nestle-espana', platform: 'Troostwijk', result: 'sin_activos' }
  );

  // Sources
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      companySlug: 'nestle-espana',
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      deimplantationSignal: true,
    });
  }
}

function parseAzucarera(ctx: ParseContext, md: string): void {
  ctx.company = {
    slug: 'azucarera',
    name: 'Azucarera (ABF)',
    cif: 'A28001980',
    sector: 'Alimentacion',
    subsector: 'Azúcar',
    cnae: '10.8',
    parentGroup: 'Associated British Foods (ABF) / AB Sugar',
    hqCity: 'Madrid',
    hqRegion: 'Madrid',
    website: 'https://www.azucarera.es',
    logoUrl: 'https://www.surusin.com/wp-content/uploads/2019/08/logosurus-principal.png',
    empleadosTotal: 500,
    tier: 'A',
    status: 'active',
  };
  ctx.companies.push(ctx.company);

  // Plantas
  ctx.plants.push(
    { companySlug: 'azucarera', name: 'La Bañeza', ccaa: 'Castilla y León', province: 'León', city: 'La Bañeza', status: 'cerrada', specialty: 'Azúcar de remolacha', employees: 116, closureYear: 2025, notes: '94 años de operación (1931-2025); suelo ~24,5M€ contable; comparable Veguellina 2M€ sin comprador' },
    { companySlug: 'azucarera', name: 'Miranda de Ebro', ccaa: 'Castilla y León', province: 'Burgos', city: 'Miranda de Ebro', status: 'en_conversion', specialty: 'Refinería de azúcar (antes molino de remolacha)', investmentMEur: 27, employees: 13, notes: 'Conversión a refinería; capacidad 85K → 120K t/año; 37 recolocaciones' },
    { companySlug: 'azucarera', name: 'Jerez/Guadalete', ccaa: 'Andalucía', province: 'Cádiz', city: 'Jerez de la Frontera', status: 'operativa', specialty: 'Refinería de caña (sin molturación remolacha 2026)', employees: 218, notes: 'Molturación de remolacha suspendida para campaña 2026' },
    { companySlug: 'azucarera', name: 'Benavente', ccaa: 'Castilla y León', province: 'Zamora', city: 'Benavente', status: 'operativa', specialty: 'Azúcar' }
  );

  // Contactos
  ctx.contacts.push(
    { companySlug: 'azucarera', plantName: 'La Bañeza', fullName: 'Juan Luis Rivero Ximenes', role: 'CEO Azucarera (desde 2010)', roleCategory: 'ceo', linkedinUrl: 'https://www.linkedin.com/in/juan-luis-rivero-ximenes/', sourceOutlet: 'LinkedIn', confidence: 0.95 },
    { companySlug: 'azucarera', plantName: 'La Bañeza', fullName: 'Fundación Anclaje', role: 'Buscando reindustrialización La Bañeza', sourceUrl: 'https://www.fundacionanclaje.es/', sourceOutlet: 'Fundación Anclaje', confidence: 0.85, notes: 'Sin éxito hasta la fecha' }
  );

  // Inventario técnico La Bañeza
  ctx.inventory.push(
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'linea_produccion', specs: 'Difusores: extracción de azúcar de remolacha', status: 'desmantelado', notes: 'Valor contable 0€ ABF; desmantelados o por desmantelar' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'linea_produccion', specs: 'Evaporadores: concentración de jugo', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'linea_produccion', specs: 'Cristalizadores: cristalización de azúcar', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'linea_produccion', specs: 'Centrífugas: separación de cristales', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'linea_produccion', specs: 'Secadores y enfriadores: acondicionamiento de azúcar', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'caldera', specs: 'Calderas de vapor', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'co_generacion', specs: 'Turbinas: cogeneración', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'sistema_almacenaje', specs: 'Silos de almacenaje de azúcar', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'envasado', specs: 'Líneas de envasado de azúcar', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'La Bañeza', category: 'edificio', specs: 'Sistemas de tratamiento de aguas', status: 'desmantelado' },
    { companySlug: 'azucarera', plantName: 'Miranda de Ebro', category: 'linea_produccion', specs: 'Líneas de molturación de remolacha (recepción, lavado, corte, difusión)', status: 'a_sustituir', releaseWindow: '2026', notes: 'A desmantelar tras conversión a refinería' },
    { companySlug: 'azucarera', plantName: 'Miranda de Ebro', category: 'linea_produccion', specs: 'Equipos específicos de campaña de remolacha', status: 'a_sustituir' },
    { companySlug: 'azucarera', plantName: 'Miranda de Ebro', category: 'linea_produccion', specs: 'Refinería de azúcar bruto: cristalización, centrifugado, secado (85K → 120K t/año)', status: 'operativo', notes: 'En expansión' },
    { companySlug: 'azucarera', plantName: 'Miranda de Ebro', category: 'envasado', specs: 'Líneas de envasado azúcar refinado', status: 'operativo' }
  );

  // Operaciones
  ctx.operations.push(
    { companySlug: 'azucarera', plantName: 'La Bañeza', type: 'plant_closure', title: 'Cierre La Bañeza (94 años)', description: 'Cierre definitivo tras última campaña 2024-2025 (~650.000t remolacha). 116 despidos. Equipos valorados a cero por ABF. Fundación Anclaje buscando reindustrialización sin éxito.', jobsAffected: 116, announcedAt: '2025-05-30', status: 'executed', confidence: 0.98, sourceUrl: 'https://elpais.com/economia/2025-05-30/azucarera-sacrifica-la-planta-casi-centenaria-de-la-baneza.html', sourceOutlet: 'El País' },
    { companySlug: 'azucarera', plantName: 'Miranda de Ebro', type: 'investment', title: 'Conversión Miranda a refinería 27M€', description: 'Inversión 27M€ para refinería. Capacidad 85K → 120K t/año. 13 despidos + 37 recolocaciones. Cese de molturación de remolacha.', amountMeur: 27, jobsAffected: -24, announcedAt: '2025-07-03', status: 'in_execution', confidence: 0.95, sourceUrl: 'https://www.azucarera.es/', sourceOutlet: 'Azucarera' },
    { companySlug: 'azucarera', plantName: 'Jerez/Guadalete', type: 'decommissioning', title: 'Jerez sin molturación 2026', description: 'Refinería de caña activa, sin molturación de remolacha para campaña 2026.', announcedAt: '2026-01-01', status: 'executed', confidence: 0.9 },
    { companySlug: 'azucarera', plantName: 'La Bañeza', type: 'ERE', title: 'ERE Azucarera 194 afectados', description: 'ERE ratificado 3 julio 2025. 194 afectados totales: La Bañeza 116 + Miranda 13 + Otros.', jobsAffected: 194, announcedAt: '2025-07-03', status: 'executed', confidence: 0.98, sourceUrl: 'https://elpais.com/economia/2025-05-30/azucarera-sacrifica-la-planta-casi-centenaria-de-la-baneza.html', sourceOutlet: 'El País' }
  );

  // Financials
  ctx.financials.push(
    { companySlug: 'azucarera', year: 2025, concept: 'Deterioro contable ABF 119M£ (equipos valor cero)', amountMeur: 142.5, category: 'impairment', notes: 'Conversión 119M GBP → EUR aprox 142,5M€' },
    { companySlug: 'azucarera', year: 2025, concept: 'Valor contable suelo La Bañeza', amountMeur: 24.5, category: 'investment', notes: 'Comparable Veguellina vendido por 2M€ sin comprador' },
    { companySlug: 'azucarera', year: 2025, concept: 'Inversión Miranda conversión a refinería 27M€', amountMeur: 27, category: 'investment' }
  );

  // Timeline
  const tl: Array<[string, string, string?]> = [
    ['1931-01-01', 'Apertura de la fábrica de La Bañeza'],
    ['2024-09-01', 'Última campaña de La Bañeza (~650.000t remolacha)'],
    ['2025-05-01', 'Azucarera anuncia cierre de La Bañeza'],
    ['2025-05-30', 'El País publica reportaje sobre cierre "planta casi centenaria"'],
    ['2025-07-03', 'Ratificación del ERE: 194 afectados'],
    ['2025-12-31', 'Ejecución del cierre y desmantelamiento de La Bañeza'],
    ['2025-12-31', 'Conversión de Miranda de Ebro a refinería (27M€)'],
    ['2026-01-01', 'Jerez/Guadalete sin molturación de remolacha'],
  ];
  for (const [date, title, desc] of tl) {
    ctx.timelineEvents.push({ companySlug: 'azucarera', date, title, description: desc });
  }

  // Auction checks
  ctx.auctionChecks.push(
    { companySlug: 'azucarera', platform: 'Escrapalia', result: 'sin_activos' },
    { companySlug: 'azucarera', platform: 'Surplex', result: 'sin_activos' },
    { companySlug: 'azucarera', platform: 'Troostwijk', result: 'sin_activos' }
  );

  // Sources
  const links = extractLinks(md);
  for (const l of links) {
    ctx.sources.push({
      companySlug: 'azucarera',
      url: l.url,
      title: l.text,
      outlet: l.outlet,
      outletType: l.outletType,
      deimplantationSignal: true,
    });
  }
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

function main() {
  console.log('[parser] Starting v6 parser...');
  const ctx: ParseContext = {
    company: {} as SeedCompany,
    companies: [],
    plants: [],
    contacts: [],
    inventory: [],
    operations: [],
    timelineEvents: [],
    financials: [],
    sources: [],
    auctionChecks: [],
    documents: [],
    notes: [],
  };

  for (const f of DOSSIER_FILES) {
    const path = join(PROJECT_ROOT, f);
    if (!existsSync(path)) {
      console.warn(`[parser] Missing: ${f}, skipping`);
      continue;
    }
    const md = readFileSync(path, 'utf-8');
    console.log(`[parser] → ${f} (${md.length} bytes)`);
    if (f === '00-CUADRO-DE-MANDO-EJECUTIVO.md') {
      parseCuadroDeMando(ctx, md);
    } else if (f.includes('Nueva-Pescanova')) {
      parsePescanova(ctx, md);
    } else if (f.includes('Danone')) {
      parseDanone(ctx, md);
    } else if (f.includes('Mahou')) {
      parseMahou(ctx, md);
    } else if (f.includes('AGAMA-Damm')) {
      parseAgama(ctx, md);
    } else if (f.includes('Leche-Pascual')) {
      parsePascual(ctx, md);
    } else if (f.includes('Nestle')) {
      parseNestle(ctx, md);
    } else if (f.includes('Azucarera')) {
      parseAzucarera(ctx, md);
    }
  }

  // Asigna roleCategory si falta
  for (const c of ctx.contacts) {
    if (!c.roleCategory) {
      c.roleCategory = inferRoleCategory(c.role);
    }
  }

  // Elimina duplicados en sources por URL
  const seenUrls = new Set<string>();
  const uniqueSources: SeedSource[] = [];
  for (const s of ctx.sources) {
    if (seenUrls.has(s.url)) continue;
    seenUrls.add(s.url);
    uniqueSources.push(s);
  }
  ctx.sources = uniqueSources;

  const seed: SeedV6 = {
    companies: ctx.companies,
    plants: ctx.plants,
    plantContacts: ctx.contacts,
    technicalInventory: ctx.inventory,
    operations: ctx.operations,
    timelineEvents: ctx.timelineEvents,
    financials: ctx.financials,
    sources: ctx.sources,
    auctionChecks: ctx.auctionChecks,
    documents: ctx.documents,
    notes: ctx.notes,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(seed, null, 2), 'utf-8');

  console.log('\n========== PARSE SUMMARY ==========');
  console.log(`✓ Companies:          ${seed.companies.length}`);
  console.log(`✓ Plants:             ${seed.plants.length}`);
  console.log(`✓ PlantContacts:      ${seed.plantContacts.length}`);
  console.log(`✓ TechnicalInventory: ${seed.technicalInventory.length}`);
  console.log(`✓ Operations:         ${seed.operations.length}`);
  console.log(`✓ TimelineEvents:     ${seed.timelineEvents.length}`);
  console.log(`✓ Financials:         ${seed.financials.length}`);
  console.log(`✓ Sources:            ${seed.sources.length}`);
  console.log(`✓ AuctionChecks:      ${seed.auctionChecks.length}`);
  console.log(`✓ Documents:          ${seed.documents.length}`);
  console.log(`✓ Notes:              ${seed.notes.length}`);
  console.log('====================================');
  console.log(`\n[parser] Written to: ${OUTPUT_FILE}`);
}

main();
