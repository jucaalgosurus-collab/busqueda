// scripts/smoke-qw-5.ts — Sprint QW-5: Smoke de templates email.
//
// 6 asserts:
//   QW-5-A 8 templates en lib/data/email-templates.json
//   QW-5-B Cada template tiene id, sector, cargo, subject, body
//   QW-5-C renderTemplate sustituye {{vars}} correctamente
//   QW-5-D renderTemplate reporta missing[] si falta variable
//   QW-5-E Sin frases IA prohibidas en ningún template
//   QW-5-F Sin emojis + cobertura 4 sectores × 2 cargos
//
// Run: pnpm tsx scripts/smoke-qw-5.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

const FORBIDDEN_PHRASES = [
  /estimado\/a/i,
  /no dude en/i,
  /quedo a su disposici[oó]n/i,
  /me pongo en contacto/i,
  /espero su respuesta/i,
  /le saluda atentamente/i,
  /excelente/i,
  /innovador/i,
  /líder del sector/i,
  /puntero/i,
];

const EMOJI_RE = /[-🿿]/u;

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint QW-5 Email templates smoke (6 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);

  // QW-5-A
  const tplPath = join(process.cwd(), 'lib', 'data', 'email-templates.json');
  if (!existsSync(tplPath)) {
    assert('QW-5-A [8 templates en email-templates.json]', false, 'no existe');
    process.exit(1);
  }
  const tpls = JSON.parse(readFileSync(tplPath, 'utf-8')) as Array<Record<string, unknown>>;
  assert('QW-5-A [8 templates en email-templates.json]', tpls.length === 8, `total=${tpls.length}`);

  // QW-5-B
  const allHaveFields = tpls.every((t) =>
    typeof t.id === 'string' && typeof t.sector === 'string' && typeof t.cargo === 'string' &&
    typeof t.subject === 'string' && typeof t.body === 'string',
  );
  assert('QW-5-B [cada template tiene id, sector, cargo, subject, body]', allHaveFields, allHaveFields ? 'ok' : 'faltan campos');

  // QW-5-C
  const mod = await import('../lib/email/render.js');
  const sample = tpls[0] as { id: string; sector: string; cargo: string; subject: string; body: string };
  const r = mod.renderTemplate(sample, { empresa: 'PASCUAL', ciudad: 'Aranda de Duero', planta: 'Aranda' });
  const cOk = r.subject.includes('PASCUAL') && r.body.includes('PASCUAL') && r.body.includes('Aranda de Duero') && r.missing.length === 0;
  assert('QW-5-C [renderTemplate sustituye {{vars}}]', cOk, `subject=${r.subject.slice(0, 60)} missing=${r.missing.length}`);

  // QW-5-D
  const r2 = mod.renderTemplate(sample, { empresa: 'PASCUAL' });
  const dOk = r2.missing.length > 0 && r2.subject.includes('{{ciudad}}');
  assert('QW-5-D [renderTemplate reporta missing[] si falta variable]', dOk, `missing=${r2.missing.join(',')}`);

  // QW-5-E
  const offenders: string[] = [];
  for (const t of tpls) {
    const text = `${t.subject}\n${t.body}`;
    for (const re of FORBIDDEN_PHRASES) {
      if (re.test(text as string)) offenders.push(`${t.id}: ${re.source}`);
    }
  }
  assert('QW-5-E [sin frases IA prohibidas]', offenders.length === 0, offenders.length === 0 ? '0 ofensores' : `ofensores=${offenders.slice(0, 3).join('; ')}`);

  // QW-5-F
  const sectors = new Set(tpls.map((t) => t.sector));
  const cargos = new Set(tpls.map((t) => t.cargo));
  const emojiCount = tpls.reduce((acc, t) => acc + ((`${t.subject}${t.body}`.match(EMOJI_RE) ?? []).length), 0);
  const fOk = sectors.size === 4 && cargos.size === 2 && emojiCount === 0;
  assert('QW-5-F [4 sectores × 2 cargos, sin emojis]', fOk, `sectores=${sectors.size} cargos=${cargos.size} emojis=${emojiCount}`);

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
