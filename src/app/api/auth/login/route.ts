import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validators/auth';

// In-memory sliding window rate limiter for login protection
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const loginRateLimitMap = new Map<string, RateLimitEntry>();
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = loginRateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(key: string) {
  const now = Date.now();
  const entry = loginRateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    loginRateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function resetLoginRateLimit(key: string) {
  loginRateLimitMap.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    const rawIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
    const clientIp = rawIp.split(',')[0].trim().slice(0, 64);
    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? undefined;

    // 0. Check rate limiting by client IP
    const rateCheck = checkLoginRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many failed login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please enter a valid email address and password.' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const isPasswordValid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !isPasswordValid) {
      recordFailedLogin(clientIp);
      recordFailedLogin(normalizedEmail);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Reset rate limit on successful credentials
    resetLoginRateLimit(clientIp);
    resetLoginRateLimit(normalizedEmail);

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your account is suspended. Please contact support.' },
        { status: 403 }
      );
    }

    // 2. Select default or first workspace within user-scoped transaction context
    const memberships = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${user.id}';`);
      return await tx.workspaceMembership.findMany({
        where: { userId: user.id },
        include: {
          workspace: true,
        },
      });
    });

    const defaultMembership =
      memberships.find((m) => m.isDefault) ?? memberships[0];

    if (!defaultMembership) {
      return NextResponse.json(
        { error: 'No workspace assigned to this user. Please register a new workspace or request an invitation.' },
        { status: 403 }
      );
    }

    // Resolve user's role within the active workspace tenant context under RLS
    const activeRole = await withTenantContext(defaultMembership.workspaceId, async (tx) => {
      return await tx.workspaceRole.findUnique({
        where: { id: defaultMembership.roleId },
      });
    });

    // 3. Create session
    const { sessionToken, expiresAt } = await createSession({
      userId: user.id,
      workspaceId: defaultMembership.workspaceId,
      ipAddress: clientIp,
      userAgent,
    });

    // 4. Set HttpOnly session cookie
    await setSessionCookie(sessionToken, expiresAt);

    // 5. Tenant-scoped audit log
    try {
      await withTenantContext(defaultMembership.workspaceId, async (tx) => {
        await tx.auditLog.create({
          data: {
            workspaceId: defaultMembership.workspaceId,
            actorId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            clientIp,
            userAgent,
          },
        });
      });
    } catch (auditErr) {
      console.error('[SECURITY_AUDIT_WARNING] Failed to record login audit log:', auditErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      workspace: {
        id: defaultMembership.workspace.id,
        name: defaultMembership.workspace.name,
        slug: defaultMembership.workspace.slug,
      },
      role: activeRole?.name ?? 'MEMBER',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred' },
      { status: 500 }
    );
  }
}

