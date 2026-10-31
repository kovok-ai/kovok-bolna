import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const createSiteSchema = z.object({
  siteName: z.string().min(2, 'Site name is required').max(255),
  pinCode: z.string().regex(/^\d{6}$/, 'PIN code must be a 6-digit Indian postal code'),
  city: z.string().min(2, 'City is required').max(128),
  address: z.string().min(5, 'Delivery address is required'),
  contactName: z.string().max(128).optional(),
  contactPhone: z.string().max(32).optional(),
  gateTimings: z.string().max(128).optional(),
  unloadingRestrictions: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  projectId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const sites = await withTenantContext(workspaceId, async (tx) => {
      return await tx.projectSite.findMany({
        where: { workspaceId },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
    });

    return NextResponse.json({ success: true, count: sites.length, sites });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to list project sites:', error);
    return NextResponse.json({ error: 'Failed to list project sites' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const body = await req.json();
    const parsed = createSiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid site data', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    const site = await withTenantContext(workspaceId, async (tx) => {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await tx.projectSite.updateMany({
          where: { workspaceId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return await tx.projectSite.create({
        data: {
          workspaceId,
          siteName: data.siteName,
          pinCode: data.pinCode,
          city: data.city,
          address: data.address,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          gateTimings: data.gateTimings,
          unloadingRestrictions: data.unloadingRestrictions,
          isDefault: data.isDefault,
          projectId: data.projectId,
          isActive: true,
        },
      });
    });

    return NextResponse.json({ success: true, site }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create project site' }, { status: 400 });
  }
}

