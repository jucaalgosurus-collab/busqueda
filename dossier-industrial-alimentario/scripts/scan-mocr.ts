// scripts/scan-mocr.ts — CLI entrypoint MOCR
// Uso: pnpm exec tsx scripts/scan-mocr.ts <file> <kind> [companySlug]
import { classifyDocument } from '@/lib/mocr/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const file = process.argv[2];
const kind = process.argv[3] as 'nameplate' | 'certificate' | 'balance_sheet' | 'photo';
const companySlug = process.argv[4];

if (!file || !kind) {
  console.error('Uso: scan-mocr.ts <filePath> <kind> [companySlug]');
  process.exit(1);
}

(async () => {
  try {
    let companyId: string | undefined;
    if (companySlug) {
      const c = await prisma.company.findUnique({ where: { slug: companySlug } });
      companyId = c?.id;
    }
    const r = await classifyDocument({ filePath: file, kind, companyId });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
