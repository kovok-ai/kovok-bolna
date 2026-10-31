import * as crypto from 'crypto';
import { promisify } from 'util';
import { cookies } from 'next/headers';
import { prisma } from './db';

const scryptAsync = promisify(crypto.scrypt);
const SESSION_COOKIE_NAME = 'kovok_session';
const SESSION_DURATION_DAYS = 7;

// -----------------------------------------------------------------------------
// 1. SECURE PASSWORD HASHING (Asynchronous Scrypt with Timing-Safe Verification)
// -----------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = (await scryptAsync(password, salt, keyBuffer.length)) as Buffer;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// 2. SERVER-SIDE SESSION MANAGEMENT (With RLS Context)
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

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_workspace_id = '${params.workspaceId}';`);
    await tx.session.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        sessionToken,
        expiresAt,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  });

  return { sessionToken, expiresAt };
}

export async function validateSessionToken(token: string) {
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) {
    return null;
  }

  return await prisma.$transaction(async (tx) => {
    // Set token context for RLS policy on sessions
    await tx.$executeRawUnsafe(`SET LOCAL app.current_session_token = '${token}';`);

    const session = await tx.session.findUnique({
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
      await tx.session.delete({ where: { id: session.id } }).catch(() => null);
      return null;
    }

    // Set workspace context for RLS on memberships and roles
    await tx.$executeRawUnsafe(`SET LOCAL app.current_workspace_id = '${session.workspaceId}';`);

    const membership = await tx.workspaceMembership.findUnique({
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
  });
}

export async function revokeSession(sessionToken: string): Promise<void> {
  if (!sessionToken || !/^[0-9a-f]{64}$/i.test(sessionToken)) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_session_token = '${sessionToken}';`);
    await tx.session.delete({ where: { sessionToken } }).catch(() => null);
  });
}


// -----------------------------------------------------------------------------
// 3. HTTP-ONLY SECURE COOKIE HELPERS
// -----------------------------------------------------------------------------

export function isSecureCookie(): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  // When running with explicit HTTPS APP_BASE_URL in production deployments
  if (process.env.APP_BASE_URL?.startsWith('https://')) return true;
  // Allow HTTP during local development and testing on localhost / private IPs
  return false;
}

export async function setSessionCookie(sessionToken: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
