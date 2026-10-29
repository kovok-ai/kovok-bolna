import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validators/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          include: {
            workspace: true,
            role: true,
          },
        },
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'User account is suspended' },
        { status: 403 }
      );
    }

    // 2. Select default or first workspace
    const defaultMembership =
      user.memberships.find((m) => m.isDefault) ?? user.memberships[0];

    if (!defaultMembership) {
      return NextResponse.json(
        { error: 'No workspace assigned to this user' },
        { status: 403 }
      );
    }

    // 3. Create session
    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    const { sessionToken, expiresAt } = await createSession({
      userId: user.id,
      workspaceId: defaultMembership.workspaceId,
      ipAddress,
      userAgent,
    });

    // 4. Set HttpOnly session cookie
    await setSessionCookie(sessionToken, expiresAt);

    // 5. Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId: defaultMembership.workspaceId,
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        clientIp: ipAddress,
        userAgent,
      },
    }).catch(() => null);

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
      role: defaultMembership.role.name,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred' },
      { status: 500 }
    );
  }
}
