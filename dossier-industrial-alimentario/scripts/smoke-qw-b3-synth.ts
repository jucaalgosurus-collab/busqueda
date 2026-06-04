// scripts/smoke-qw-b3-synth.ts — End-to-end test: insertar BORME sintético con 4 ceses
// de consejo para Pascual, correr el agente, verificar Source B.3 creado, limpiar.
import { PrismaClient } from '@prisma/client';
import { runRenunciasAgent } from '../lib/agents/renuncias-runner';

const prisma = new PrismaClient();

const SINTETIC_URL = 'internal://b3/smoke-synth-pascual';
const SINTETIC_BORME_URL = 'internal://b3/synth-borme-pascual';
const TEST_COMPANY_SLUG = 'pascual';

async function main() {
  console.log('=== E2E Sprint B.3 — BORME sintético con 4 ceses de consejo en Pascual ===');

  const company = await prisma.company.findUnique({ where: { slug: TEST_COMPANY_SLUG } });
  if (!company) {
    console.error('FAIL: Empresa test no encontrada:', TEST_COMPANY_SLUG);
    process.exit(2);
  }
  console.log('Empresa test:', company.name, company.id);

  // 1) Limpiar runs previos del agente
  await prisma.source.deleteMany({ where: { url: { startsWith: 'internal://b3/synth' } } });
  await prisma.source.deleteMany({ where: { url: SINTETIC_URL } });

  // 2) Insertar 1 BORME sintético con 4 ceses de consejo
  const bormeText = `PASCUAL, S.A. — Ceses/Dimisiones. M.Cons.Liq: TOMAS PASCUAL GOMEZ. Pres. Cons.: FRANCISCO PASCUAL. Secr. Cons.: MARIA LOPEZ. Vocal Cons.: PEDRO GONZALEZ. M.Cons.Liq: ANA MARTINEZ. Adm. Solid.: IGNACIO RUIZ.`;
  await prisma.source.create({
    data: {
      url: SINTETIC_BORME_URL,
      title: 'PASCUAL, S.A. — Ceses/Dimisiones (sintético)',
      outlet: 'BORME',
      outletType: 'bofficial_borme',
      language: 'es',
      companyId: null,
      contentText: bormeText,
      publishedAt: new Date(),
      deimplantationSignal: false,
      isStale: false,
    },
  });
  console.log('BORME sintético insertado con 5 ceses (4 consejo + 1 adm)');

  // 3) Reset ScanConfig lastRunAt para forzar backfill_90d
  await prisma.scanConfig.upsert({
    where: { agentName: 'surus-agente-renuncias' },
    create: { agentName: 'surus-agente-renuncias', cadenceDays: 1, isActive: true, lastRunAt: null },
    update: { lastRunAt: null },
  });
  console.log('ScanConfig lastRunAt=null (forzar backfill)');

  // 4) Run agente
  const result = await runRenunciasAgent();
  console.log('Resultado agente:', JSON.stringify(result, null, 2));

  // 5) Verificar Source B.3
  const b3Sources = await prisma.source.findMany({
    where: { url: { startsWith: 'internal://b3/' }, companyId: company.id },
  });
  console.log('B.3 sources para Pascual:', b3Sources.length);
  for (const s of b3Sources) {
    console.log('  -', s.url);
    console.log('    title:', s.title);
    console.log('    deimplantationSignal:', s.deimplantationSignal);
  }

  const pass = result.matches >= 1 && b3Sources.length >= 1;
  console.log('=== ' + (pass ? 'PASS' : 'FAIL') + ' ===');

  // 6) Limpiar
  await prisma.source.deleteMany({ where: { url: { startsWith: 'internal://b3/synth' } } });
  await prisma.source.deleteMany({ where: { url: SINTETIC_URL } });
  console.log('Cleanup OK');

  process.exit(pass ? 0 : 1);
}

main()
  .catch((e) => { console.error('FATAL:', e); process.exit(2); })
  .finally(() => prisma.$disconnect());
