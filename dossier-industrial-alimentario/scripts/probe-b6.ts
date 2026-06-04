import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const c = await p.company.findFirst({ where: { sector: 'Alimentos y Bebidas' }, select: { id: true, name: true, cif: true, cnae: true, facturacionM: true, sector: true } });
  console.log('real A&B sample:', c);
  const c2 = await p.company.findFirst({ where: { name: { contains: 'Danone', mode: 'insensitive' } }, select: { id: true, name: true, cif: true, cnae: true } });
  console.log('Danone:', c2);
  const c3 = await p.company.findFirst({ where: { name: { contains: 'Mahou', mode: 'insensitive' } }, select: { id: true, name: true, cif: true, cnae: true } });
  console.log('Mahou:', c3);
  const total = await p.company.count();
  const withCif = await p.company.count({ where: { cif: { not: null } } });
  console.log('total companies:', total, 'withCIF:', withCif);
  await p.$disconnect();
})();
