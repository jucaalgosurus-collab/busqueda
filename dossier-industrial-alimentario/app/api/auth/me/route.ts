// app/api/auth/me/route.ts — E.10: devuelve el usuario actual o 401.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
