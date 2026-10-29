import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/session';

export async function GET() {
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    user: sessionData.user,
    workspace: sessionData.workspace,
    role: sessionData.role?.name ?? null,
    expiresAt: sessionData.session.expiresAt,
  });
}
