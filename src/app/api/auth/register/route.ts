import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth';
import { registerWorkspaceSchema } from '@/lib/validators/auth';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const errorMessage = firstIssue
        ? `${firstIssue.path.join('.') || 'input'}: ${firstIssue.message}`
        : 'Invalid input data';
      return NextResponse.json(
        { error: errorMessage, details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceName, businessType, serviceArea, adminName, email, password, phone } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please log in.' },
        { status: 409 }
      );
    }

    // Hash password before starting database transaction to avoid holding locks during CPU-heavy scrypt
    const hashedPassword = await hashPassword(password);

    // 2. Generate unique slug
    let baseSlug = slugify(workspaceName) || 'workspace';
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // Sanitize network identifiers
    const rawIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
    const clientIp = rawIp ? rawIp.split(',')[0].trim().slice(0, 64) : undefined;
    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? undefined;

    // 3. Provision Workspace, User, Roles, Sites & Rule Profile in Transaction
    const result = await prisma.$transaction(async (tx) => {
      // a. Create Workspace
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName.trim(),
          slug,
          businessType,
          serviceArea,
          isSandbox: process.env.NODE_ENV !== 'production',
        },
      });

      // Establish transaction-local workspace tenant context for RLS policy enforcement
      await tx.$executeRawUnsafe(`SET LOCAL app.current_workspace_id = '${workspace.id}';`);

      // b. Create Roles
      const ownerRole = await tx.workspaceRole.create({
        data: {
          workspaceId: workspace.id,
          name: 'OWNER',
          description: 'Workspace Owner with full commercial authority',
          approvalLimitAmount: 10000000.00,
          canCreateRequests: true,
          canApproveQuotes: true,
          canManageSettings: true,
          canRecordReceipts: true,
        },
      });

      await tx.workspaceRole.create({
        data: {
          workspaceId: workspace.id,
          name: 'BUYER',
          description: 'Procurement Specialist',
          approvalLimitAmount: 50000.00,
          canCreateRequests: true,
          canApproveQuotes: false,
          canManageSettings: false,
          canRecordReceipts: true,
        },
      });

      // c. Create User
      const user = await tx.user.create({
        data: {
          name: adminName.trim(),
          email: normalizedEmail,
          passwordHash: hashedPassword,
          phone: phone?.trim(),
          status: 'ACTIVE',
        },
      });

      // d. Create Membership
      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          roleId: ownerRole.id,
          isDefault: true,
        },
      });

      // e. Create Default Site
      await tx.projectSite.create({
        data: {
          workspaceId: workspace.id,
          siteName: `${workspaceName.trim()} — Site A`,
          pinCode: '110001',
          city: serviceArea.split('·')[0].trim() || 'Delhi NCR',
          address: `${serviceArea} Central Receiving Yard`,
          isDefault: true,
        },
      });

      // f. Create Default Rule Profile
      await tx.workspaceRuleProfile.create({
        data: {
          workspaceId: workspace.id,
          categories: ['TMT Steel', 'Cement'],
          requestSource: 'Site engineer / project manager',
          sourcingStrategy: 'Total delivered cost and delivery reliability',
          competitiveThreshold: 50000.00,
          maxVendorsPerRfq: 3,
          callWindowStart: '10:00',
          callWindowEnd: '18:00',
          callLanguage: 'Hindi + English',
          maxRetries: 2,
          autoRetryUnanswered: true,
          autoClarifyMissing: true,
          allowSubstitutions: false,
        },
      });

      // g. Audit log
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorId: user.id,
          action: 'WORKSPACE_PROVISIONED',
          entityType: 'Workspace',
          entityId: workspace.id,
          clientIp,
          userAgent,
        },
      });

      return { workspace, user, role: ownerRole };
    });

    // 4. Create Session & Cookie
    const { sessionToken, expiresAt } = await createSession({
      userId: result.user.id,
      workspaceId: result.workspace.id,
      ipAddress: clientIp,
      userAgent,
    });

    await setSessionCookie(sessionToken, expiresAt);

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
      },
      role: result.role.name,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error?.code === 'P2002') {
      const target = (error?.meta?.target as string[]) || [];
      if (target.includes('email') || error?.message?.includes('email')) {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please log in.' },
          { status: 409 }
        );
      }
      if (target.includes('slug') || error?.message?.includes('slug')) {
        return NextResponse.json(
          { error: 'A workspace with this name already exists. Please choose a different business name.' },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred during workspace provisioning. Please check inputs and try again.' },
      { status: 500 }
    );
  }
}
