// scripts/seed-admin.ts — E.10: crea el admin inicial (jucaalgo).
//
// Uso:
//   tsx scripts/seed-admin.ts               # crea jucaalgo si no existe
//   ADMIN_SEED_PASSWORD=... tsx scripts/seed-admin.ts
//
// Por defecto usa ADMIN_SEED_PASSWORD del .env; si no existe y NODE_ENV!=='production',
// usa '13470811' con warning. El seed marca mustChangePassword=true para forzar
// el cambio en el primer login.
import { prisma } from '../lib/db/prisma';
import { hashPassword } from '../lib/auth/password';

const DEFAULT_DEV_PASSWORD = '13470811';

async function main() {
  const username = 'jucaalgo';
  const envPwd = process.env.ADMIN_SEED_PASSWORD;
  const isProd = process.env.NODE_ENV === 'production';
  const password = envPwd ?? (isProd ? null : DEFAULT_DEV_PASSWORD);
  if (!password) {
    console.error('[seed-admin] ERROR: ADMIN_SEED_PASSWORD no definido en producción. Abortando.');
    process.exit(1);
  }
  if (!envPwd && !isProd) {
    console.warn(`[seed-admin] AVISO: usando contraseña dev por defecto '${DEFAULT_DEV_PASSWORD}'. Define ADMIN_SEED_PASSWORD en .env para producción.`);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`[seed-admin] usuario '${username}' ya existe (id=${existing.id}, role=${existing.role}). No se hace nada.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const created = await prisma.user.create({
    data: {
      username,
      displayName: 'Juan Carlos Alvarado',
      role: 'admin',
      passwordHash,
      mustChangePassword: true,
      isActive: true,
      createdBy: 'seed',
    },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  console.log(`[seed-admin] admin '${created.username}' creado (id=${created.id}). debe cambiar contraseña en primer login.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('[seed-admin] ERROR:', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
