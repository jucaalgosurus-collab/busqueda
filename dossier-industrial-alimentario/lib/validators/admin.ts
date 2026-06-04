// lib/validators/admin.ts — E.10: validación de payloads del panel admin.
//
// Helpers de input validation centralizados. Usamos funciones puras
// (no Zod) para no añadir dependencia. Cada helper devuelve {ok, value} o
// {ok:false, error}. Mensajes en castellano para que el panel muestre el
// error directamente al usuario.

export interface ValidationOk<T> { ok: true; value: T }
export interface ValidationErr { ok: false; error: string }
export type Validation<T> = ValidationOk<T> | ValidationErr;

function ok<T>(value: T): ValidationOk<T> { return { ok: true, value }; }
function err(message: string): ValidationErr { return { ok: false, error: message }; }

const TIER_VALUES = new Set(['A', 'B', 'C', 'D']);
const COMPANY_STATUS = new Set(['active', 'inactive']);
const PLANT_STATUS = new Set([
  'operativa',
  'en_inversion',
  'en_desmantelamiento',
  'cerrada',
  'vendida',
  'en_proyecto',
  'en_conversion',
  'en_venta',
]);

function toStr(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > max) return s.slice(0, max);
  return s;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['1', 'true', 'si', 'sí', 'on'].includes(v.toLowerCase());
  return false;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// --- Company ----------------------------------------------------------------

export interface CompanyPatch {
  name?: string;
  cif?: string | null;
  sector?: string;
  subsector?: string;
  cnae?: string | null;
  parentGroup?: string | null;
  hqCity?: string | null;
  hqRegion?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  facturacionM?: number | null;
  facturacionYear?: number | null;
  ebitdaM?: number | null;
  beneficioNetoM?: number | null;
  deudaNetaM?: number | null;
  empleadosTotal?: number | null;
  tier?: 'A' | 'B' | 'C' | 'D';
  status?: 'active' | 'inactive';
  priority?: number;
}

export function validateCompanyCreate(raw: unknown): Validation<CompanyPatch & { slug: string }> {
  if (!raw || typeof raw !== 'object') return err('Payload inválido');
  const r = raw as Record<string, unknown>;
  const name = toStr(r.name, 200);
  if (!name) return err('El nombre es obligatorio');
  const sector = toStr(r.sector, 80);
  if (!sector) return err('El sector es obligatorio');
  const subsector = toStr(r.subsector, 120);
  if (!subsector) return err('El subsector es obligatorio');
  let slug = toStr(r.slug, 80);
  if (!slug) {
    slug = name.toLowerCase()
      .normalize('NFD')
      // Quita diacríticos (compatible cross-platform: BMP Combining Diacritical Marks U+0300–U+036F)
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
  if (!slug) return err('No se pudo derivar un slug válido');
  const tier = toStr(r.tier, 1)?.toUpperCase() ?? 'A';
  if (!TIER_VALUES.has(tier)) return err('Tier inválido (A|B|C|D)');
  const status = toStr(r.status, 16) ?? 'active';
  if (!COMPANY_STATUS.has(status)) return err('Status de empresa inválido');
  return ok({
    name,
    slug,
    sector,
    subsector,
    cif: toStr(r.cif, 16),
    cnae: toStr(r.cnae, 16),
    parentGroup: toStr(r.parentGroup, 120),
    hqCity: toStr(r.hqCity, 80),
    hqRegion: toStr(r.hqRegion, 80),
    website: toStr(r.website, 300),
    logoUrl: toStr(r.logoUrl, 500),
    heroImageUrl: toStr(r.heroImageUrl, 500),
    facturacionM: toNum(r.facturacionM),
    facturacionYear: toInt(r.facturacionYear),
    ebitdaM: toNum(r.ebitdaM),
    beneficioNetoM: toNum(r.beneficioNetoM),
    deudaNetaM: toNum(r.deudaNetaM),
    empleadosTotal: toInt(r.empleadosTotal),
    tier: tier as 'A' | 'B' | 'C' | 'D',
    status: status as 'active' | 'inactive',
    priority: toInt(r.priority) ?? 0,
  });
}

export function validateCompanyPatch(raw: unknown): Validation<CompanyPatch> {
  if (!raw || typeof raw !== 'object') return err('Payload inválido');
  const r = raw as Record<string, unknown>;
  const out: CompanyPatch = {};
  if ('name' in r) {
    const n = toStr(r.name, 200);
    if (!n) return err('Nombre vacío');
    out.name = n;
  }
  if ('cif' in r) out.cif = toStr(r.cif, 16);
  if ('sector' in r) {
    const s = toStr(r.sector, 80);
    if (!s) return err('Sector vacío');
    out.sector = s;
  }
  if ('subsector' in r) {
    const s = toStr(r.subsector, 120);
    if (!s) return err('Subsector vacío');
    out.subsector = s;
  }
  if ('cnae' in r) out.cnae = toStr(r.cnae, 16);
  if ('parentGroup' in r) out.parentGroup = toStr(r.parentGroup, 120);
  if ('hqCity' in r) out.hqCity = toStr(r.hqCity, 80);
  if ('hqRegion' in r) out.hqRegion = toStr(r.hqRegion, 80);
  if ('website' in r) out.website = toStr(r.website, 300);
  if ('logoUrl' in r) out.logoUrl = toStr(r.logoUrl, 500);
  if ('heroImageUrl' in r) out.heroImageUrl = toStr(r.heroImageUrl, 500);
  if ('facturacionM' in r) out.facturacionM = toNum(r.facturacionM);
  if ('facturacionYear' in r) out.facturacionYear = toInt(r.facturacionYear);
  if ('ebitdaM' in r) out.ebitdaM = toNum(r.ebitdaM);
  if ('beneficioNetoM' in r) out.beneficioNetoM = toNum(r.beneficioNetoM);
  if ('deudaNetaM' in r) out.deudaNetaM = toNum(r.deudaNetaM);
  if ('empleadosTotal' in r) out.empleadosTotal = toInt(r.empleadosTotal);
  if ('tier' in r) {
    const t = toStr(r.tier, 1)?.toUpperCase();
    if (!t || !TIER_VALUES.has(t)) return err('Tier inválido (A|B|C|D)');
    out.tier = t as 'A' | 'B' | 'C' | 'D';
  }
  if ('status' in r) {
    const s = toStr(r.status, 16);
    if (!s || !COMPANY_STATUS.has(s)) return err('Status de empresa inválido');
    out.status = s as 'active' | 'inactive';
  }
  if ('priority' in r) out.priority = toInt(r.priority) ?? 0;
  return ok(out);
}

// --- Plant ------------------------------------------------------------------

export interface PlantCreateInput {
  companyId: string;
  name: string;
  ccaa: string;
  province: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  specialty: string | null;
  employees: number | null;
  parcelaM2: number | null;
  naveM2: number | null;
  openedAt: Date | null;
  closedAt: Date | null;
  closureYear: number | null;
  investmentMEur: number | null;
  notes: string | null;
}

export interface PlantPatch {
  name?: string;
  ccaa?: string;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string;
  specialty?: string | null;
  employees?: number | null;
  parcelaM2?: number | null;
  naveM2?: number | null;
  openedAt?: Date | null;
  closedAt?: Date | null;
  closureYear?: number | null;
  investmentMEur?: number | null;
  notes?: string | null;
}

export function validatePlantCreate(raw: unknown): Validation<PlantCreateInput> {
  if (!raw || typeof raw !== 'object') return err('Payload inválido');
  const r = raw as Record<string, unknown>;
  const companyId = toStr(r.companyId, 64);
  if (!companyId) return err('companyId es obligatorio');
  const name = toStr(r.name, 120);
  if (!name) return err('El nombre de la sede es obligatorio');
  const ccaa = toStr(r.ccaa, 60);
  if (!ccaa) return err('La CCAA es obligatoria');
  const status = toStr(r.status, 32) ?? 'operativa';
  if (!PLANT_STATUS.has(status)) return err(`Status de sede inválido (${[...PLANT_STATUS].join('|')})`);
  // Regla de negocio: si la sede nace cerrada o vendida, exigir closedAt.
  if ((status === 'cerrada' || status === 'vendida') && !toDate(r.closedAt)) {
    return err(`Sede con status='${status}' requiere closedAt`);
  }
  return ok({
    companyId,
    name,
    ccaa,
    province: toStr(r.province, 60),
    city: toStr(r.city, 80),
    address: toStr(r.address, 200),
    lat: toNum(r.lat),
    lng: toNum(r.lng),
    status,
    specialty: toStr(r.specialty, 120),
    employees: toInt(r.employees),
    parcelaM2: toNum(r.parcelaM2),
    naveM2: toNum(r.naveM2),
    openedAt: toDate(r.openedAt),
    closedAt: toDate(r.closedAt),
    closureYear: toInt(r.closureYear),
    investmentMEur: toNum(r.investmentMEur),
    notes: toStr(r.notes, 2000),
  });
}

export function validatePlantPatch(raw: unknown): Validation<PlantPatch> {
  if (!raw || typeof raw !== 'object') return err('Payload inválido');
  const r = raw as Record<string, unknown>;
  const out: PlantPatch = {};
  if ('name' in r) {
    const n = toStr(r.name, 120);
    if (!n) return err('Nombre de sede vacío');
    out.name = n;
  }
  if ('ccaa' in r) {
    const s = toStr(r.ccaa, 60);
    if (!s) return err('CCAA vacía');
    out.ccaa = s;
  }
  if ('province' in r) out.province = toStr(r.province, 60);
  if ('city' in r) out.city = toStr(r.city, 80);
  if ('address' in r) out.address = toStr(r.address, 200);
  if ('lat' in r) out.lat = toNum(r.lat);
  if ('lng' in r) out.lng = toNum(r.lng);
  if ('status' in r) {
    const s = toStr(r.status, 32);
    if (!s || !PLANT_STATUS.has(s)) return err('Status de sede inválido');
    out.status = s;
  }
  if ('specialty' in r) out.specialty = toStr(r.specialty, 120);
  if ('employees' in r) out.employees = toInt(r.employees);
  if ('parcelaM2' in r) out.parcelaM2 = toNum(r.parcelaM2);
  if ('naveM2' in r) out.naveM2 = toNum(r.naveM2);
  if ('openedAt' in r) out.openedAt = toDate(r.openedAt);
  if ('closedAt' in r) out.closedAt = toDate(r.closedAt);
  if ('closureYear' in r) out.closureYear = toInt(r.closureYear);
  if ('investmentMEur' in r) out.investmentMEur = toNum(r.investmentMEur);
  if ('notes' in r) out.notes = toStr(r.notes, 2000);
  return ok(out);
}

// --- diff (para audit log) --------------------------------------------------

export function diffPatch<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after) as Array<keyof T>) {
    if (!(k in before)) continue;
    const a = before[k] as unknown;
    const b = after[k] as unknown;
    if (!shallowEq(a, b)) out[k as string] = { from: a, to: b };
  }
  return out;
}

function shallowEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null && b === undefined) return true;
  if (b === null && a === undefined) return true;
  return false;
}
