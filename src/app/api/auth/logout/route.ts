import { NextResponse } from 'next/server';
import { getSessionTokenFromCookie, revokeSession, clearSessionCookie } from '@/lib/auth';

export async function POST() {
  try {
    const token = await getSessionTokenFromCookie();
    if (token) {
      await revokeSession(token);
    }
    await clearSessionCookie();

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}
