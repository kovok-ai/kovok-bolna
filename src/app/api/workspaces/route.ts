import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext, prisma } from '@/lib/db';

export async function GET() {
  try {
    const sessionData = await requireSession();
    
    // Explicit server-side role authorization check
    if (!sessionData.role) {
      return NextResponse.json(
        { error: 'Forbidden: No active role membership in this workspace' },
        { status: 403 }
      );
    }

    const workspaceId = sessionData.workspace.id;

    // Use withTenantContext to guarantee RLS enforcement
    const workspaceData = await withTenantContext(workspaceId, async (tx) => {
      const sites = await tx.projectSite.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      });

      const ruleProfile = await tx.workspaceRuleProfile.findFirst({
        where: { workspaceId, status: 'ACTIVE' },
      });

      return { sites, ruleProfile };
    });

    // Reference data (system-wide reference data, explicitly flagged as Draft pending gazette sign-off)
    const rawTaxRules = await prisma.taxRateRule.findMany({
      where: { isActive: true },
      orderBy: { hsnSacCode: 'asc' },
    });

    const taxRules = rawTaxRules.map((rule) => ({
      ...rule,
      verificationStatus: 'DRAFT_PENDING_GAZETTE_VERIFICATION',
    }));

    return NextResponse.json({
      workspace: sessionData.workspace,
      user: sessionData.user,
      role: sessionData.role,
      sites: workspaceData.sites,
      ruleProfile: workspaceData.ruleProfile,
      taxRules,
    });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error?.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Workspace query error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace data' }, { status: 500 });
  }
}

