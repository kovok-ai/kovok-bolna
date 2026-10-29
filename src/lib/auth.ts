import * as crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SESSION_COOKIE_NAME = 'kovok_session';
const SESSION_DURATION_DAYS = 7;

// -----------------------------------------------------------------------------
// 1. SECURE PASSWORD HASHING (Scrypt with Timing-Safe Verification)
// -----------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, keyBuffer.length);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// 2. SERVER-SIDE SESSION MANAGEMENT
// -----------------------------------------------------------------------------

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(params: {
  userId: string;
  workspaceId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: params.userId,
      workspaceId: params.workspaceId,
      sessionToken,
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  return { sessionToken, expiresAt };
}

export async function validateSessionToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          status: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          serviceArea: true,
          isSandbox: true,
        },
      },
    },
  });

  if (!session) return null;

  // Check expiration
  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  // Get active role for the user in this workspace
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: session.workspaceId,
        userId: session.userId,
      },
    },
    include: {
      role: true,
    },
  });

  return {
    session,
    user: session.user,
    workspace: session.workspace,
    role: membership?.role ?? null,
  };
}

export async function revokeSession(sessionToken: string): Promise<void> {
  await prisma.session.delete({ where: { sessionToken } }).catch(() => null);
}

// -----------------------------------------------------------------------------
// 3. HTTP-ONLY SECURE COOKIE HELPERS
// -----------------------------------------------------------------------------

export async function setSessionCookie(sessionToken: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
