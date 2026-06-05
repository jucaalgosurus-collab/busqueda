// lib/auth/admin.ts — E.10: gate de admin para el panel oculto.
//
// Patrón compartido con `app/api/daily-summary/route.ts`: secret en
// process.env.ADMIN_SECRET (o fallback CRON_SECRET) y header `x-admin-secret`.
// Si ADMIN_SECRET NO está configurado, el panel está en "dev mode" y cualquier
// llamada pasa. Esto permite que el VPS desactive el panel vía env (rotar
// secret = kill switch) y que el local funcione sin tocar .env.
//
// Uso server-side: import { assertAdmin, isAdminConfigured } from '@/lib/auth/admin';
import { NextRequest, NextResponse } from 'next/server';

const HEADER = 'x-admin-secret';

function getSecret(): string | null {
  return process.env.ADMIN_SECRET ?? process.env.CRON_SECRET ?? null;
}

export function isAdminConfigured(): boolean {
  return Boolean(getSecret());
}

export function isAdminAuthorized(req: NextRequest): boolean {
  const expected = getSecret();
  // FAIL-CLOSED (A.11): si no hay secret configurado, NO se permite nada.
  // Antes: dev mode abierto. JC reportó que las APIs estaban expuestas.
  if (!expected) return false;
  const provided = req.headers.get(HEADER) ?? req.nextUrl.searchParams.get('secret');
  if (!provided) return false;
  // comparación constant-time
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function assertAdmin(req: NextRequest): NextResponse | null {
  if (isAdminAuthorized(req)) return null;
  return NextResponse.json(
    { success: false, error: 'unauthorized' },
    { status: 401 },
  );
}
