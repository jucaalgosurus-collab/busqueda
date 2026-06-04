// lib/auth/password.ts — E.10: hashing de contraseñas con scrypt (Node built-in).
//
// No usamos bcrypt/argon2 para evitar dependencias nativas. scrypt de Node es
// suitable para nuestro caso (panel admin con 1-10 usuarios, no millones).
// El formato del hash es `scrypt$N$r$p$saltB64$hashB64` para que sea
// self-describing (futuro-proof si migramos a argon2).
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

// Parámetros OWASP para scrypt (2023+): N=2^14, r=8, p=1. N=2^15 puede
// superar el default 32MB del límite de memoria de Node; N=2^14 sigue
// dentro de OWASP mínimo aceptable y roundtrip <500ms en VPS modesto.
const N = 1 << 14;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_LEN = 16;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }
  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(plain, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltB64 = parts[4];
  const hashB64 = parts[5];
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  if (!saltB64 || !hashB64) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, 'base64');
    expected = Buffer.from(hashB64, 'base64');
  } catch {
    return false;
  }
  const derived = await scryptAsync(plain, salt, expected.length, { N: n, r, p });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
