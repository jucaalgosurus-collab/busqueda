// app/api/admin/sessions/route.ts — E.10: dashboard de sesiones (admin only).
import { NextRequest, NextResponse } from 'next/server';
import { listSessions } from '@/lib/audit/sessions';
import { requireAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 100)));
  const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true';
  const data = await listSessions({ limit, activeOnly });
  return NextResponse.json({ success: true, data });
}
