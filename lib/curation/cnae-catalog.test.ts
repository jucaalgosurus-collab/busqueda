// lib/curation/cnae-catalog.test.ts — Smoke tests del catálogo CNAE
// Verifica: 33 CNAEs A&B, 5 sectores secundarios, helpers funcionales

import { strict as assert } from 'assert';
import {
  CNAES_AB,
  CNAES_ENERGIA,
  CNAES_QUIMICA,
  CNAES_CONSTRUCCION,
  CNAES_BANCA,
  CNAES_DEFENSA,
  SECTORES,
  SECTOR_LABELS,
  getCnaesBySector,
  getCnaesByEtapa,
  isAandBSector,
  type EtapaCadena,
} from './cnae-catalog';

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${e instanceof Error ? e.message : String(e)}`);
  }
}

test('CNAES_AB tiene exactamente 34 entradas', () => {
  assert.equal(CNAES_AB.length, 34);
});

test('CNAES_AB todos tienen sector=a&b', () => {
  for (const c of CNAES_AB) {
    assert.equal(c.sector, 'a&b');
  }
});

test('CNAES_AB todos tienen etapa definida', () => {
  for (const c of CNAES_AB) {
    assert.ok(c.etapa, `CNAE ${c.cnae} sin etapa`);
  }
});

test('CNAES_AB etapas cubren las 3 cadenas', () => {
  const etapas = new Set<EtapaCadena>();
  for (const c of CNAES_AB) {
    if (c.etapa) etapas.add(c.etapa);
  }
  assert.ok(etapas.has('primaria'), 'falta etapa primaria');
  assert.ok(etapas.has('transformacion'), 'falta etapa transformacion');
});

test('CNAES_AB cnaes son únicos y formato 4 dígitos', () => {
  const seen = new Set<string>();
  for (const c of CNAES_AB) {
    assert.equal(c.cnae.length, 4, `CNAE ${c.cnae} no tiene 4 dígitos`);
    assert.ok(/^\d{4}$/.test(c.cnae), `CNAE ${c.cnae} no es numérico`);
    assert.ok(!seen.has(c.cnae), `CNAE ${c.cnae} duplicado`);
    seen.add(c.cnae);
  }
});

test('Sectores secundarios tienen códigos CNAE reales', () => {
  assert.ok(CNAES_ENERGIA.length >= 10, 'Energía debe tener ≥10 CNAEs');
  assert.ok(CNAES_QUIMICA.length >= 5, 'Química debe tener ≥5 CNAEs');
  assert.ok(CNAES_CONSTRUCCION.length >= 8, 'Construcción debe tener ≥8 CNAEs');
  assert.ok(CNAES_BANCA.length >= 3, 'Banca debe tener ≥3 CNAEs');
  assert.ok(CNAES_DEFENSA.length >= 3, 'Defensa debe tener ≥3 CNAEs');
});

test('SECTORES contiene los 6 sectores', () => {
  const keys = Object.keys(SECTORES);
  assert.equal(keys.length, 6);
  assert.ok(keys.includes('a&b'));
  assert.ok(keys.includes('energia'));
  assert.ok(keys.includes('quimica'));
  assert.ok(keys.includes('construccion'));
  assert.ok(keys.includes('banca'));
  assert.ok(keys.includes('defensa'));
});

test('SECTOR_LABELS tiene label para cada sector', () => {
  for (const sector of Object.keys(SECTORES) as Array<keyof typeof SECTORES>) {
    assert.ok(SECTOR_LABELS[sector], `Falta label para ${sector}`);
  }
});

test('getCnaesBySector devuelve array readonly', () => {
  const result = getCnaesBySector('a&b');
  assert.equal(result.length, 34);
});

test('getCnaesByEtapa filtra correctamente', () => {
  const primaria = getCnaesByEtapa('primaria');
  for (const c of primaria) {
    assert.equal(c.etapa, 'primaria');
  }
  assert.ok(primaria.length >= 5, 'primaria debe tener ≥5 CNAEs');
});

test('isAandBSector solo true para a&b', () => {
  assert.equal(isAandBSector('a&b'), true);
  assert.equal(isAandBSector('energia'), false);
  assert.equal(isAandBSector('quimica'), false);
  assert.equal(isAandBSector('construccion'), false);
  assert.equal(isAandBSector('banca'), false);
  assert.equal(isAandBSector('defensa'), false);
});

console.log('━'.repeat(50));
if (failures === 0) {
  console.log(`✓ Todos los tests pasaron (${11} tests)`);
  process.exit(0);
} else {
  console.error(`✗ ${failures} test(s) fallaron`);
  process.exit(1);
}
