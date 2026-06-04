// scripts/smoke-e10-auth.ts — E.10: smoke tests auth + users + sessions
//
// Tests sin DB (no acceso al Postgres del VPS desde sandbox local). Valida:
//   - importabilidad de todos los módulos nuevos
//   - hashPassword/verifyPassword roundtrip
//   - sesiones helpers
//   - validators admin (regresión)
//   - API routes existen
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashPassword, verifyPassword } from '../lib/auth/password';

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
const results: string[] = [];

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      pass++;
      results.push(`  ✅ ${name}`);
    })
    .catch((e) => {
      fail++;
      results.push(`  ❌ ${name}: ${e instanceof Error ? e.message : String(e)}`);
    });
}

function exists(p: string) {
  if (!existsSync(p)) throw new Error(`archivo no existe: ${p}`);
}
function read(p: string) {
  if (!existsSync(p)) throw new Error(`archivo no existe: ${p}`);
  return readFileSync(p, 'utf8');
}

async function main() {
  console.log('━━━ E.10 AUTH SMOKE ━━━\n');

  // 1. Files
  await test('lib/auth/password.ts existe', () => exists(join(ROOT, 'lib/auth/password.ts')));
  await test('lib/auth/session.ts existe', () => exists(join(ROOT, 'lib/auth/session.ts')));
  await test('lib/audit/sessions.ts existe', () => exists(join(ROOT, 'lib/audit/sessions.ts')));
  await test('app/api/auth/login/route.ts existe', () => exists(join(ROOT, 'app/api/auth/login/route.ts')));
  await test('app/api/auth/logout/route.ts existe', () => exists(join(ROOT, 'app/api/auth/logout/route.ts')));
  await test('app/api/auth/me/route.ts existe', () => exists(join(ROOT, 'app/api/auth/me/route.ts')));
  await test('app/api/auth/change-password/route.ts existe', () => exists(join(ROOT, 'app/api/auth/change-password/route.ts')));
  await test('app/api/admin/users/route.ts existe', () => exists(join(ROOT, 'app/api/admin/users/route.ts')));
  await test('app/api/admin/users/[id]/route.ts existe', () => exists(join(ROOT, 'app/api/admin/users/[id]/route.ts')));
  await test('app/api/admin/sessions/route.ts existe', () => exists(join(ROOT, 'app/api/admin/sessions/route.ts')));
  await test('app/admin-public/login/page.tsx existe', () => exists(join(ROOT, 'app/admin-public/login/page.tsx')));
  await test('app/admin-public/account/page.tsx existe', () => exists(join(ROOT, 'app/admin-public/account/page.tsx')));
  await test('app/admin/users/page.tsx existe', () => exists(join(ROOT, 'app/admin/users/page.tsx')));
  await test('app/admin/users/UsersClient.tsx existe', () => exists(join(ROOT, 'app/admin/users/UsersClient.tsx')));
  await test('app/admin/sessions/page.tsx existe', () => exists(join(ROOT, 'app/admin/sessions/page.tsx')));
  await test('app/admin/sessions/SessionsClient.tsx existe', () => exists(join(ROOT, 'app/admin/sessions/SessionsClient.tsx')));
  await test('app/admin/layout.tsx existe', () => exists(join(ROOT, 'app/admin/layout.tsx')));
  await test('scripts/seed-admin.ts existe', () => exists(join(ROOT, 'scripts/seed-admin.ts')));

  // 2. Schema models
  await test('schema.prisma define User', () => {
    const s = read(join(ROOT, 'prisma/schema.prisma'));
    if (!/^model User\s/m.test(s)) throw new Error('falta model User');
  });
  await test('schema.prisma define SessionLog', () => {
    const s = read(join(ROOT, 'prisma/schema.prisma'));
    if (!/^model SessionLog\s/m.test(s)) throw new Error('falta model SessionLog');
  });
  await test('User tiene role + mustChangePassword', () => {
    const s = read(join(ROOT, 'prisma/schema.prisma'));
    if (!s.includes('mustChangePassword')) throw new Error('falta mustChangePassword');
    if (!/role\s+String\s+@default\("user"\)/.test(s)) throw new Error('falta role default user');
  });
  await test('SessionLog tiene index userId+loginAt', () => {
    const s = read(join(ROOT, 'prisma/schema.prisma'));
    if (!/@@index\(\[userId, loginAt\]\)/.test(s)) throw new Error('falta index userId+loginAt');
    if (!/@@index\(\[username, loginAt\]\)/.test(s)) throw new Error('falta index username+loginAt');
    if (!/@@index\(\[ip\]\)/.test(s)) throw new Error('falta index ip');
  });

  // 3. Migration SQL
  await test('migración admin_users existe', () => {
    const dir = join(ROOT, 'prisma/migrations/20260605000100_admin_users');
    if (!existsSync(dir)) throw new Error('migración no existe');
    const sql = read(join(dir, 'migration.sql'));
    if (!/CREATE TABLE IF NOT EXISTS "User"/.test(sql)) throw new Error('falta CREATE TABLE User');
    if (!/CREATE TABLE IF NOT EXISTS "SessionLog"/.test(sql)) throw new Error('falta CREATE TABLE SessionLog');
  });

  // 4. Password hash roundtrip
  await test('hashPassword(>=8) produce formato scrypt', async () => {
    const h = await hashPassword('test12345');
    if (!h.startsWith('scrypt$')) throw new Error(`formato inesperado: ${h.slice(0, 20)}`);
    if (h.split('$').length !== 6) throw new Error('hash no tiene 6 segmentos');
  });
  await test('verifyPassword acepta password correcto', async () => {
    const h = await hashPassword('correctPassword');
    if (!(await verifyPassword('correctPassword', h))) throw new Error('verify falló');
  });
  await test('verifyPassword rechaza password incorrecto', async () => {
    const h = await hashPassword('correctPassword');
    if (await verifyPassword('wrongPassword', h)) throw new Error('verify aceptó incorrecto');
  });
  await test('verifyPassword rechaza hash corrupto', async () => {
    if (await verifyPassword('x', 'invalid$0$0$0$abc$def')) throw new Error('verify aceptó basura');
    if (await verifyPassword('x', '')) throw new Error('verify aceptó vacío');
  });
  await test('hashPassword rechaza <8 chars', async () => {
    await hashPassword('short').then(() => { throw new Error('no rechazó'); }).catch((e) => {
      if (!/8 caracteres/.test(e instanceof Error ? e.message : String(e))) throw e;
    });
  });

  // 5. Login route structure
  await test('login route usa verifyPassword + createSession', () => {
    const r = read(join(ROOT, 'app/api/auth/login/route.ts'));
    if (!r.includes('verifyPassword')) throw new Error('no usa verifyPassword');
    if (!r.includes('createSession')) throw new Error('no usa createSession');
    if (!r.includes('httpOnly')) throw new Error('cookie no es httpOnly');
  });
  await test('logout route cierra sesión', () => {
    const r = read(join(ROOT, 'app/api/auth/logout/route.ts'));
    if (!r.includes('closeSession')) throw new Error('no llama closeSession');
  });
  await test('change-password bloquea no-admin cambiando otros', () => {
    const r = read(join(ROOT, 'app/api/auth/change-password/route.ts'));
    if (!r.includes("role !== 'admin'")) throw new Error('no chequea role admin');
  });

  // 6. Users API
  await test('users POST exige ≥8 char password', () => {
    const r = read(join(ROOT, 'app/api/admin/users/route.ts'));
    if (!r.includes('8 caracteres')) throw new Error('no valida longitud');
    if (!r.includes('requireAdmin')) throw new Error('no protegido por admin');
  });
  await test('users [id] PATCH no permite auto-desactivar', () => {
    const r = read(join(ROOT, 'app/api/admin/users/[id]/route.ts'));
    if (!r.includes('No puedes desactivarte')) throw new Error('falta protección auto-desactivar');
  });
  await test('users [id] DELETE hace soft delete', () => {
    const r = read(join(ROOT, 'app/api/admin/users/[id]/route.ts'));
    if (!r.includes('isActive: false')) throw new Error('no hace soft delete');
  });

  // 7. Sessions API + dashboard
  await test('sessions route usa listSessions', () => {
    const r = read(join(ROOT, 'app/api/admin/sessions/route.ts'));
    if (!r.includes('listSessions')) throw new Error('no usa listSessions');
  });
  await test('SessionsClient muestra IP, UA, duración', () => {
    const c = read(join(ROOT, 'app/admin/sessions/SessionsClient.tsx'));
    if (!c.includes('durationSec')) throw new Error('no muestra duración');
    if (!c.includes('userAgent')) throw new Error('no muestra UA');
    if (!c.includes('ip')) throw new Error('no muestra IP');
  });

  // 8. AdminLayout redirige sin sesión
  await test('admin layout redirige a login sin sesión', () => {
    const r = read(join(ROOT, 'app/admin/layout.tsx'));
    if (!r.includes("redirect('/admin-public/login')")) throw new Error('no redirige');
    if (!r.includes('mustChangePassword')) throw new Error('no chequea cambio de password');
  });
  await test('AdminShell migra a cookies (no localStorage)', () => {
    const r = read(join(ROOT, 'app/admin/_components/AdminShell.tsx'));
    if (r.includes('localStorage')) throw new Error('todavía usa localStorage');
    if (!r.includes('me')) throw new Error('no recibe me');
  });
  await test('UsersClient no permite auto-desactivar', () => {
    const r = read(join(ROOT, 'app/admin/users/UsersClient.tsx'));
    if (!r.includes('u.id === me.id')) throw new Error('no chequea self');
  });

  // 9. Seed script
  await test('seed-admin crea jucaalgo con scrypt', () => {
    const r = read(join(ROOT, 'scripts/seed-admin.ts'));
    if (!r.includes("'jucaalgo'")) throw new Error('no crea jucaalgo');
    if (!r.includes('hashPassword')) throw new Error('no hashea');
    if (!r.includes('mustChangePassword: true')) throw new Error('no fuerza cambio');
    if (!r.includes('ADMIN_SEED_PASSWORD')) throw new Error('no lee env');
  });

  console.log(results.join('\n'));
  console.log(`\n━━━ ${pass} PASS · ${fail} FAIL ━━━`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('SMOKE CRASHED:', e);
  process.exit(1);
});
