// scripts/smoke-sectorizacion-10.ts — Sprint E.3 — 10 sectores del brief 2026-06-04.
//
// 10 asserts atómicos: 1 por sector. Verifica que lib/industria.ts cubre los 10 sectores
// del brief con cnaePrefix correcto y que sectorFromCnae / sectorFromOutlet funcionan.
//
// Run: pnpm tsx scripts/smoke-sectorizacion-10.ts

import { INDUSTRIAS, sectorFromCnae, sectorFromOutlet, isTransversal } from '../lib/industria';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint E.3 Sectorización 10 smoke ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`INDUSTRIAS.length = ${INDUSTRIAS.length}`);

  // E.3-1: hay 10 sectores exactos
  assert('E.3-1 [INDUSTRIAS.length === 10]', INDUSTRIAS.length === 10, `length=${INDUSTRIAS.length}`);

  // E.3-2: 1. Alimentos y Bebidas → CNAE 10+11
  const s1 = INDUSTRIAS.find((i) => i.sector === 'Alimentos y Bebidas');
  assert('E.3-2 [A&B cnaePrefix 10+11 + contactosHabilitados]',
    !!s1 && s1.cnaePrefix.includes('10') && s1.cnaePrefix.includes('11') && s1.contactosHabilitados === true,
    s1 ? `cnae=${s1.cnaePrefix.join(',')}` : 'missing');

  // E.3-3: 2. Construcción → CNAE 41-43
  const s2 = INDUSTRIAS.find((i) => i.sector === 'Construccion');
  assert('E.3-3 [Construccion cnaePrefix 41,42,43]',
    !!s2 && s2.cnaePrefix.includes('41') && s2.cnaePrefix.includes('42') && s2.cnaePrefix.includes('43'),
    s2 ? `cnae=${s2.cnaePrefix.join(',')}` : 'missing');

  // E.3-4: 3. Vehículos → CNAE 29,30
  const s3 = INDUSTRIAS.find((i) => i.sector === 'Vehiculos');
  assert('E.3-4 [Vehiculos cnaePrefix 29,30]',
    !!s3 && s3.cnaePrefix.includes('29') && s3.cnaePrefix.includes('30'),
    s3 ? `cnae=${s3.cnaePrefix.join(',')}` : 'missing');

  // E.3-5: 4. Maquinaria → CNAE 28
  const s4 = INDUSTRIAS.find((i) => i.sector === 'Maquinaria');
  assert('E.3-5 [Maquinaria cnaePrefix 28]',
    !!s4 && s4.cnaePrefix.includes('28'),
    s4 ? `cnae=${s4.cnaePrefix.join(',')}` : 'missing');

  // E.3-6: 5. Stock industrial → transversal sin CNAE
  const s5 = INDUSTRIAS.find((i) => i.sector === 'Stock industrial');
  assert('E.3-6 [Stock industrial transversal sin CNAE]',
    !!s5 && s5.transversal === true && s5.cnaePrefix.length === 0,
    s5 ? `transversal=${s5.transversal} cnae=${s5.cnaePrefix.length}` : 'missing');

  // E.3-7: 6. Equipamiento Médico → 21, 26.6, 32.5, 72.11
  const s6 = INDUSTRIAS.find((i) => i.sector === 'Equipamiento Medico Laboratorio Biotecnologia');
  assert('E.3-7 [Equipamiento cnae 21,26.6,32.5,72.11]',
    !!s6 && s6.cnaePrefix.includes('21') && s6.cnaePrefix.includes('26.6') && s6.cnaePrefix.includes('32.5') && s6.cnaePrefix.includes('72.11'),
    s6 ? `cnae=${s6.cnaePrefix.join(',')}` : 'missing');

  // E.3-8: 7. PI Marcas y Patentes → transversal
  const s7 = INDUSTRIAS.find((i) => i.sector === 'Propiedad Intelectual Marcas y Patentes');
  assert('E.3-8 [PI transversal vía OEPM/EUIPO]',
    !!s7 && s7.transversal === true && s7.cnaePrefix.length === 0,
    s7 ? `transversal=${s7.transversal}` : 'missing');

  // E.3-9: 8. Energía → CNAE 05-09, 19, 35
  const s8 = INDUSTRIAS.find((i) => i.sector === 'Energia');
  assert('E.3-9 [Energia cnaePrefix 05-09,19,35]',
    !!s8 && s8.cnaePrefix.includes('05') && s8.cnaePrefix.includes('19') && s8.cnaePrefix.includes('35'),
    s8 ? `cnae=${s8.cnaePrefix.length}` : 'missing');

  // E.3-10: 9. Patentes + 10. Industria en General
  const s9 = INDUSTRIAS.find((i) => i.sector === 'Patentes');
  const s10 = INDUSTRIAS.find((i) => i.sector === 'Industria en General');
  assert('E.3-10 [Patentes (tag) + Industria en General]',
    !!s9 && s9.transversal === true && !!s10 && s10.cnaePrefix.length > 0,
    s9 && s10 ? `patentes=transversal:${s9.transversal} industriaGen=${s10.cnaePrefix.length} cnae` : 'missing');

  // E.3-11: sectorFromCnae funcional
  assert('E.3-11 [sectorFromCnae("10.1") → A&B]',
    sectorFromCnae('10.1') === 'Alimentos y Bebidas', `got=${sectorFromCnae('10.1')}`);
  assert('E.3-11b [sectorFromCnae("28.15") → Maquinaria]',
    sectorFromCnae('28.15') === 'Maquinaria', `got=${sectorFromCnae('28.15')}`);
  assert('E.3-11c [sectorFromCnae("21.1") → Equipamiento Medico]',
    sectorFromCnae('21.1') === 'Equipamiento Medico Laboratorio Biotecnologia', `got=${sectorFromCnae('21.1')}`);
  assert('E.3-11d [sectorFromCnae("35.1") → Energia]',
    sectorFromCnae('35.1') === 'Energia', `got=${sectorFromCnae('35.1')}`);
  assert('E.3-11e [sectorFromCnae("99.9") → Industria en General]',
    sectorFromCnae('99.9') === 'Industria en General', `got=${sectorFromCnae('99.9')}`);

  // E.3-12: sectorFromOutlet funcional
  assert('E.3-12 [sectorFromOutlet("patent") → PI]',
    sectorFromOutlet('patent') === 'Propiedad Intelectual Marcas y Patentes', `got=${sectorFromOutlet('patent')}`);
  assert('E.3-12b [sectorFromOutlet("cnmv") → Stock industrial]',
    sectorFromOutlet('cnmv') === 'Stock industrial', `got=${sectorFromOutlet('cnmv')}`);
  assert('E.3-12c [sectorFromOutlet("regulatorio_aesan") → A&B]',
    sectorFromOutlet('regulatorio_aesan') === 'Alimentos y Bebidas', `got=${sectorFromOutlet('regulatorio_aesan')}`);
  assert('E.3-12d [sectorFromOutlet(null) → null]',
    sectorFromOutlet(null) === null, `got=${sectorFromOutlet(null)}`);

  // E.3-13: isTransversal
  assert('E.3-13 [isTransversal("Stock industrial") === true]',
    isTransversal('Stock industrial') === true);
  assert('E.3-13b [isTransversal("Alimentos y Bebidas") === false]',
    isTransversal('Alimentos y Bebidas') === false);

  console.log(`\n=== TOTAL: ${pass} pass / ${fail} fail ===`);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
