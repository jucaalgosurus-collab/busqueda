// scripts/backfill-email-verification.ts — Sprint E.1b
// Revierte emailVerified: true → false para contactos sin row en EmailVerification.
// Luego re-verifica en lotes de 50 con throttle 5s.
// Idempotente: corre varias veces = mismo resultado final.
//
// Uso: pnpm tsx scripts/backfill-email-verification.ts [--dry-run] [--batch=50]

import { PrismaClient } from '@prisma/client';
import { verifyEmailWithCache } from '../lib/agents/email-verifier';

const prisma = new PrismaClient();
const HUNTER_KEY = process.env.HUNTER_API_KEY ?? '';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1] ?? '50', 10) : 50;

  if (!HUNTER_KEY) {
    throw new Error('HUNTER_API_KEY no está en .env');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BACKFILL EMAIL VERIFICATION — Sprint E.1b');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Modo: ${dryRun ? 'DRY RUN' : 'REAL'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('');

  // Paso 1: identificar contactos "contaminados" (emailVerified=true sin row EmailVerification)
  const contaminated = await prisma.plantContact.findMany({
    where: {
      emailVerified: true,
      email: { not: null },
    },
    select: { id: true, email: true, fullName: true, companyId: true },
  });

  console.log(`Contactos con emailVerified=true: ${contaminated.length}`);

  let reverted = 0;
  let alreadyCached = 0;
  let notCached = 0;
  const toReverify: Array<{ id: string; email: string }> = [];

  for (const c of contaminated) {
    if (!c.email) continue;
    const normalized = c.email.trim().toLowerCase();
    const cached = await prisma.emailVerification.findUnique({
      where: { email: normalized },
    });
    if (cached && cached.expiresAt > new Date()) {
      alreadyCached++;
    } else {
      notCached++;
      toReverify.push({ id: c.id, email: normalized });
      if (!dryRun) {
        // Revertir a false para que la siguiente enrichment lo re-verifique
        await prisma.plantContact.update({
          where: { id: c.id },
          data: { emailVerified: false },
        });
        reverted++;
      }
    }
  }

  console.log(`  Ya cacheados (no tocar): ${alreadyCached}`);
  console.log(`  Sin cache (revertir):    ${notCached}`);
  console.log(`  Revertidos en este run: ${reverted}`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN: no se llamó a Hunter.');
    return;
  }

  // Paso 2: re-verificar los revertidos en lotes
  console.log(`Re-verificando ${toReverify.length} emails en lotes de ${batchSize}...`);
  let valid = 0, invalid = 0, acceptAll = 0, errorCount = 0;
  for (let i = 0; i < toReverify.length; i += batchSize) {
    const batch = toReverify.slice(i, i + batchSize);
    console.log(`  Lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(toReverify.length / batchSize)}: ${batch.length} emails`);
    for (const item of batch) {
      try {
        const v = await verifyEmailWithCache(item.email, HUNTER_KEY, prisma);
        if (v.status === 'valid') {
          await prisma.plantContact.update({
            where: { id: item.id },
            data: { emailVerified: true },
          });
          valid++;
        } else if (v.status === 'invalid') {
          // Email inválido: lo limpiamos
          await prisma.plantContact.update({
            where: { id: item.id },
            data: { email: null, emailVerified: false },
          });
          invalid++;
        } else if (v.status === 'accept_all' || v.status === 'unknown') {
          await prisma.plantContact.update({
            where: { id: item.id },
            data: { emailVerified: true },
          });
          acceptAll++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('rate limited')) {
          console.warn(`  Rate limit. Parando lote. Procesados: ${i + batch.indexOf(item)}/${toReverify.length}`);
          break;
        }
        errorCount++;
        console.warn(`  Error verificando ${item.email}: ${msg}`);
      }
      await new Promise((r) => setTimeout(r, 5000)); // throttle 5s
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESUMEN BACKFILL:');
  console.log(`  Re-verificados válidos:       ${valid}`);
  console.log(`  Inválidos (limpiados):        ${invalid}`);
  console.log(`  Accept-all / unknown:         ${acceptAll}`);
  console.log(`  Errores (sin acción):         ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
