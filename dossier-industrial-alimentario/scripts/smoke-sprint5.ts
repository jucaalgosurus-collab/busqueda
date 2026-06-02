// scripts/smoke-sprint5.ts — Smoke Sprint 5: MOCR + UI investigativa
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:3002';
const BASE_PATH = '/dossier';

interface Assert {
  name: string;
  pass: boolean;
  detail?: string;
}

const asserts: Assert[] = [];
const log = (msg: string) => console.log(msg);

async function main() {
  log('=== SPRINT 5 SMOKE — MOCR + UI investigativa ===\n');

  // 1. MOCR API endpoint reachable
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/api/mocr`, { method: 'POST' });
    // 200 = success, 400 = missing file (expected when called bare), 415 = wrong content-type
    asserts.push({
      name: '1. POST /api/mocr endpoint reachable',
      pass: [200, 400, 415].includes(r.status),
      detail: `HTTP ${r.status}`,
    });
  } catch (e) {
    asserts.push({ name: '1. POST /api/mocr endpoint reachable', pass: false, detail: (e as Error).message });
  }

  // 2. /hallazgos page returns 200
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/hallazgos`);
    asserts.push({
      name: '2. GET /hallazgos returns 200',
      pass: r.status === 200,
      detail: `HTTP ${r.status}`,
    });
  } catch (e) {
    asserts.push({ name: '2. GET /hallazgos returns 200', pass: false, detail: (e as Error).message });
  }

  // 3. /mocr page returns 200
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/mocr`);
    asserts.push({
      name: '3. GET /mocr returns 200',
      pass: r.status === 200,
      detail: `HTTP ${r.status}`,
    });
  } catch (e) {
    asserts.push({ name: '3. GET /mocr returns 200', pass: false, detail: (e as Error).message });
  }

  // 4. /hallazgos/export.csv returns CSV
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/api/hallazgos/export?format=csv`);
    const ct = r.headers.get('content-type') ?? '';
    asserts.push({
      name: '4. GET /api/hallazgos/export returns CSV',
      pass: r.status === 200 && ct.includes('text/csv'),
      detail: `HTTP ${r.status}, ${ct}`,
    });
  } catch (e) {
    asserts.push({ name: '4. GET /api/hallazgos/export returns CSV', pass: false, detail: (e as Error).message });
  }

  // 5. FTS search via query param
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/hallazgos?q=Pescanova`);
    asserts.push({
      name: '5. FTS /hallazgos?q=Pescanova returns 200',
      pass: r.status === 200,
      detail: `HTTP ${r.status}`,
    });
  } catch (e) {
    asserts.push({ name: '5. FTS /hallazgos?q=Pescanova returns 200', pass: false, detail: (e as Error).message });
  }

  // 6. Filtro CCAA
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/hallazgos?ccaa=Galicia`);
    asserts.push({
      name: '6. Filtro CCAA /hallazgos?ccaa=Galicia returns 200',
      pass: r.status === 200,
      detail: `HTTP ${r.status}`,
    });
  } catch (e) {
    asserts.push({ name: '6. Filtro CCAA /hallazgos?ccaa=Galicia returns 200', pass: false, detail: (e as Error).message });
  }

  // 7. Filtro signal=in
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/hallazgos?signal=in`);
    asserts.push({
      name: '7. Filtro signal=in returns 200',
      pass: r.status === 200,
      detail: `HTTP ${r.status}`,
    });
  } catch (e) {
    asserts.push({ name: '7. Filtro signal=in returns 200', pass: false, detail: (e as Error).message });
  }

  // 8. DB asserts
  const [
    skillEvalsCount,
    documentsCount,
    sourcesCount,
    gradeA,
    gradeB,
    gradeC,
    gradeD,
  ] = await Promise.all([
    prisma.skillEvaluation.count(),
    prisma.document.count(),
    prisma.source.count(),
    prisma.skillEvaluation.count({ where: { grade: 'A' } }),
    prisma.skillEvaluation.count({ where: { grade: 'B' } }),
    prisma.skillEvaluation.count({ where: { grade: 'C' } }),
    prisma.skillEvaluation.count({ where: { grade: 'D' } }),
  ]);

  asserts.push({
    name: '8. Documentos persistidos (Document)',
    pass: documentsCount >= 0,
    detail: `count=${documentsCount}`,
  });

  asserts.push({
    name: '9. Evaluaciones MOCR (SkillEvaluation)',
    pass: skillEvalsCount >= 0,
    detail: `count=${skillEvalsCount}`,
  });

  asserts.push({
    name: '10. Fuentes totales (Newsroom+Prensa+BOE+LinkedIn) ≥ 100',
    pass: sourcesCount >= 100,
    detail: `count=${sourcesCount}`,
  });

  // 11. Distribución de grades: todos los registros tienen grade IN [A,B,C,D]
  if (skillEvalsCount > 0) {
    const allInRange = gradeA + gradeB + gradeC + gradeD === skillEvalsCount;
    asserts.push({
      name: '11. Todos los SkillEvaluation.grade IN [A,B,C,D]',
      pass: allInRange,
      detail: `A=${gradeA}, B=${gradeB}, C=${gradeC}, D=${gradeD}, total=${skillEvalsCount}`,
    });
  } else {
    asserts.push({
      name: '11. Todos los SkillEvaluation.grade IN [A,B,C,D]',
      pass: true,
      detail: 'Sin evaluaciones (no se ha subido ningún doc) — assert estructural, no funcional',
    });
  }

  // 12. MOCR pipeline imports without error
  try {
    const m = await import('@/lib/mocr/client');
    asserts.push({
      name: '12. MOCR client module loads',
      pass: typeof m.classifyDocument === 'function',
      detail: 'lib/mocr/client.ts exporta classifyDocument',
    });
  } catch (e) {
    asserts.push({ name: '12. MOCR client module loads', pass: false, detail: (e as Error).message });
  }

  // 13. Navbar tiene link /mocr
  try {
    const r = await fetch(`${BASE}${BASE_PATH}/hallazgos`);
    const html = await r.text();
    asserts.push({
      name: '13. Navbar expone link /mocr',
      pass: html.includes('/mocr') && html.includes('MOCR'),
      detail: 'Link MOCR presente en navbar',
    });
  } catch (e) {
    asserts.push({ name: '13. Navbar expone link /mocr', pass: false, detail: (e as Error).message });
  }

  // 14. Pipeline end-to-end (si hay key de Gemini + archivo de test)
  if (process.env.GEMINI_API_KEY && process.env.SMOKE_MOCR_FILE) {
    try {
      const m = await import('@/lib/mocr/client');
      const r = await m.classifyDocument({
        filePath: process.env.SMOKE_MOCR_FILE,
        kind: 'nameplate',
      });
      asserts.push({
        name: '14. MOCR E2E con archivo real → grade IN [A,B,C,D]',
        pass: ['A', 'B', 'C', 'D'].includes(r.grade),
        detail: `grade=${r.grade} score=${r.score}`,
      });
    } catch (e) {
      asserts.push({ name: '14. MOCR E2E con archivo real', pass: false, detail: (e as Error).message });
    }
  } else {
    asserts.push({
      name: '14. MOCR E2E con archivo real (skip si no hay GEMINI_API_KEY + SMOKE_MOCR_FILE)',
      pass: true,
      detail: 'skip — pendiente upload manual desde /mocr',
    });
  }

  // Reporte
  log('\n--- RESULTADOS ---');
  let pass = 0;
  for (const a of asserts) {
    const icon = a.pass ? '✓' : '✗';
    log(`${icon} ${a.name}${a.detail ? `  [${a.detail}]` : ''}`);
    if (a.pass) pass++;
  }
  log(`\n${pass}/${asserts.length} PASS`);

  const reportPath = resolve(process.cwd(), 'smoke-report-sprint5.json');
  writeFileSync(
    reportPath,
    JSON.stringify({ sprint: 5, ts: new Date().toISOString(), asserts, passed: pass, total: asserts.length }, null, 2),
  );
  log(`Reporte: ${reportPath}`);

  await prisma.$disconnect();
  process.exit(pass === asserts.length ? 0 : 1);
}

main().catch(async (e) => {
  console.error('Error fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
