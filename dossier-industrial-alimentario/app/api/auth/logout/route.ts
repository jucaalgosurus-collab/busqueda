// app/api/auth/logout/route.ts — E.10: logout cierra la sesión activa.
import { NextResponse } from 'next/server';
import { SESSION_COOKIES, getCurrentUser } from '@/lib/auth/session';
import { closeSession } from '@/lib/audit/sessions';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (user) await closeSession(user.sessionId);
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIES.COOKIE_UID);
  res.cookies.delete(SESSION_COOKIES.COOKIE_SID);
  return res;
}
