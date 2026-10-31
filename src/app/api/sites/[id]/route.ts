import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const updateSiteSchema = z.object({
  siteName: z.string().min(2).max(255).optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  city: z.string().min(2).max(128).optional(),
  address: z.string().min(5).optional(),
  contactName: z.string().max(128).optional().nullable(),
  contactPhone: z.string().max(32).optional().nullable(),
  gateTimings: z.string().max(128).optional().nullable(),
  unloadingRestrictions: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  projectId: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const { id } = await params;

    const body = await req.json();
    const parsed = updateSiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update data', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    const updatedSite = await withTenantContext(workspaceId, async (tx) => {
      const existing = await tx.projectSite.findUnique({
        where: { workspaceId_id: { workspaceId, id } },
      });

      if (!existing) {
        throw new Error('Project site not found in workspace');
      }

      if (data.isDefault) {
        await tx.projectSite.updateMany({
          where: { workspaceId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return await tx.projectSite.update({
        where: { workspaceId_id: { workspaceId, id } },
        data,
      });
    });

    return NextResponse.json({ success: true, site: updatedSite });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update site' }, { status: 400 });
  }
}

