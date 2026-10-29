import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext, prisma } from '@/lib/db';

export async function GET() {
  try {
    const sessionData = await requireSession();
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

    // Reference data (system-wide, not tenant-bound)
    const taxRules = await prisma.taxRateRule.findMany({
      where: { isActive: true },
      orderBy: { hsnSacCode: 'asc' },
    });

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
    console.error('Workspace query error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace data' }, { status: 500 });
  }
}
