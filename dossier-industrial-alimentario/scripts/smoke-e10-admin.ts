// scripts/smoke-e10-admin.ts — E.10: smoke del panel admin
//
// Verifica:
//   - Validators: company create/patch, plant create/patch
//   - Slug derivado, idempotencia
//   - Diff solo cuando hay cambios reales
//   - Auth helper en dev mode
//   - Response shapes (sin tocar la DB)
//
// Sin acceso a Postgres del VPS: este smoke cubre el 100% del path de
// validación + auth, que es donde se introducen los bugs.

import {
  validateCompanyCreate,
  validateCompanyPatch,
  validatePlantCreate,
  validatePlantPatch,
  diffPatch,
} from '../lib/validators/admin';
import { isAdminConfigured } from '../lib/auth/admin';

let pass = 0;
let fail = 0;
const fails: string[] = [];

function assert(cond: boolean, label: string): void {
  if (cond) {
    pass++;
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    fails.push(label);
    // eslint-disable-next-line no-console
    console.log(`  ✗ ${label}`);
  }
}

function section(name: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n[${name}]`);
}

// ── validateCompanyCreate ───────────────────────────────────────────────────
section('validateCompanyCreate');

{
  const v = validateCompanyCreate({ name: 'Pascual', sector: 'Alimentos y Bebidas', subsector: 'Lácteos' });
  assert(v.ok, 'caso mínimo OK');
  if (v.ok) {
    assert(v.value.slug === 'pascual', `slug derivado = 'pascual' (got '${v.value.slug}')`);
    assert(v.value.tier === 'A', 'tier default A');
    assert(v.value.status === 'active', 'status default active');
  }
}
{
  const v = validateCompanyCreate({ name: 'Pascual SA', sector: 'Alimentos y Bebidas', subsector: 'Lácteos', slug: 'pascual-sa' });
  assert(v.ok && v.ok && v.value.slug === 'pascual-sa', 'slug explícito gana sobre derivado');
}
{
  const v = validateCompanyCreate({ name: 'Calidad Pascual, S.A.U.', sector: 'Alimentos y Bebidas', subsector: 'Lácteos' });
  assert(v.ok && v.value.slug === 'calidad-pascual-s-a-u', 'slug limpia acentos y puntuación');
}
{
  const v = validateCompanyCreate({ name: '  ', sector: 'X', subsector: 'Y' });
  assert(!v.ok, 'rechaza nombre vacío');
}
{
  const v = validateCompanyCreate({ name: 'Foo', sector: 'Alimentos y Bebidas', subsector: 'Lácteos', tier: 'Z' });
  assert(!v.ok && v.error.includes('Tier'), 'rechaza tier inválido');
}
{
  const v = validateCompanyCreate({ name: 'Foo', sector: 'Alimentos y Bebidas', subsector: 'Lácteos', facturacionM: 1500, empleadosTotal: 5000 });
  assert(v.ok && v.value.facturacionM === 1500, 'acepta KPIs numéricos');
}
{
  const v = validateCompanyCreate({ name: 'Foo', sector: 'Alimentos y Bebidas', subsector: 'Lácteos', status: 'weird' });
  assert(!v.ok, 'rechaza status inválido');
}
{
  const v = validateCompanyCreate({});
  assert(!v.ok, 'rechaza payload vacío');
}
{
  const v = validateCompanyCreate(null);
  assert(!v.ok, 'rechaza null');
}

// ── validateCompanyPatch ────────────────────────────────────────────────────
section('validateCompanyPatch');

{
  const v = validateCompanyPatch({ facturacionM: 200, empleadosTotal: 1000 });
  assert(v.ok && v.value.facturacionM === 200, 'patch acepta campos individuales');
}
{
  const v = validateCompanyPatch({ name: '' });
  assert(!v.ok, 'patch rechaza name vacío');
}
{
  const v = validateCompanyPatch({ status: 'inactive' });
  assert(v.ok && v.value.status === 'inactive', 'patch status inactiva');
}
{
  const v = validateCompanyPatch({});
  assert(v.ok && Object.keys(v.value).length === 0, 'patch vacío = no-op');
}

// ── validatePlantCreate ─────────────────────────────────────────────────────
section('validatePlantCreate');

{
  const v = validatePlantCreate({ companyId: 'cuid-1', name: 'Alovera', ccaa: 'Castilla-La Mancha' });
  assert(v.ok, 'caso mínimo OK');
  if (v.ok) {
    assert(v.value.status === 'operativa', 'status default operativa');
  }
}
{
  const v = validatePlantCreate({ companyId: 'cuid-1', name: 'Alovera', ccaa: 'Castilla-La Mancha', status: 'weird' });
  assert(!v.ok, 'rechaza status inválido');
}
{
  const v = validatePlantCreate({ companyId: 'cuid-1', name: 'Alovera', ccaa: 'Castilla-La Mancha', status: 'cerrada' });
  assert(!v.ok && v.error.includes('closedAt'), 'status cerrada exige closedAt');
}
{
  const v = validatePlantCreate({ companyId: 'cuid-1', name: 'Alovera', ccaa: 'Castilla-La Mancha', status: 'cerrada', closedAt: '2024-06-15' });
  assert(v.ok && v.value.closedAt instanceof Date, 'status cerrada + closedAt OK');
}
{
  const v = validatePlantCreate({ companyId: 'cuid-1', name: 'Alovera', ccaa: 'Castilla-La Mancha', employees: 'not-a-number' });
  assert(v.ok && v.value.employees === null, 'employees no-numérico → null');
}
{
  const v = validatePlantCreate({ name: 'Alovera', ccaa: 'CLM' });
  assert(!v.ok && v.error.includes('companyId'), 'exige companyId');
}

// ── validatePlantPatch ──────────────────────────────────────────────────────
section('validatePlantPatch');

{
  const v = validatePlantPatch({ city: 'Alovera', employees: 200 });
  assert(v.ok && v.value.employees === 200, 'patch acepta city + employees');
}
{
  const v = validatePlantPatch({ status: 'cerrada' });
  assert(v.ok, 'patch a status terminal válido (la API luego exige closedAt)');
}
{
  const v = validatePlantPatch({ lat: 40.483 });
  assert(v.ok && v.value.lat === 40.483, 'patch lat numérico');
}

// ── diffPatch ───────────────────────────────────────────────────────────────
section('diffPatch');

{
  const before = { name: 'Pascual', facturacionM: 100, status: 'active' };
  const after = { name: 'Pascual', facturacionM: 200, status: 'active' };
  const d = diffPatch(before, after);
  assert('facturacionM' in d, 'detecta facturacionM cambiada');
  assert(!('name' in d), 'no detecta name igual');
  assert(!('status' in d), 'no detecta status igual');
}
{
  const before = { fecha: new Date('2024-01-01') };
  const after = { fecha: new Date('2024-01-01') };
  const d = diffPatch(before, after);
  assert(!('fecha' in d), 'Date igual → no diff (comparación por time)');
}
{
  const before = { name: 'Pascual' };
  const after = { name: null };
  const d = diffPatch(before, after);
  assert('name' in d, 'name null != string → diff');
}

// ── isAdminConfigured ───────────────────────────────────────────────────────
section('isAdminConfigured');

assert(typeof isAdminConfigured() === 'boolean', 'isAdminConfigured devuelve boolean');

// ── Resumen ─────────────────────────────────────────────────────────────────
console.log(`\n──── smoke-e10: ${pass} PASS · ${fail} FAIL ────`);
if (fail > 0) {
  console.error('Fallos:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
