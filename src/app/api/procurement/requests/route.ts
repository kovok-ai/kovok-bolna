import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { createProcurementRequest } from '@/lib/procurement/intake';
import { z } from 'zod';

const createRequestSchema = z.object({
  siteId: z.string().uuid(),
  materialCategoryId: z.string().min(1),
  targetGrade: z.string().optional(),
  targetDiameterMm: z.number().positive().optional(),
  quantityValue: z.number().positive(),
  quantityUnit: z.enum(['TONNES', 'BAGS', 'PIECES']),
  buyerNotes: z.string().optional()
});

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workspaceId = session.workspace.id;

    const requests = await withTenantContext(workspaceId, async (tx) => {
      return await tx.procurementRequest.findMany({
        where: { workspaceId },
        include: {
          site: { select: { id: true, siteName: true, pinCode: true, city: true } },
          canonicalProduct: { select: { id: true, canonicalName: true, applicableStandard: true } },
          materialCategory: { select: { id: true, categoryName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to list procurement requests:', error);
    return NextResponse.json({ error: 'Failed to list procurement requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!session.role || !session.role.canCreateRequests) {
      return NextResponse.json(
        { error: 'Forbidden: User role cannot create procurement requests' },
        { status: 403 }
      );
    }

    const json = await request.json();
    const parsed = createRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const workspaceId = session.workspace.id;
    const userId = session.user.id;

    const result = await withTenantContext(workspaceId, async (tx) => {
      return await createProcurementRequest(tx as any, workspaceId, userId, parsed.data);
    });

    return NextResponse.json(
      {
        message:
          result.match.requestStatus === 'MATCHED_VERIFIED'
            ? 'Procurement requirement matched with verified canonical specification'
            : 'Procurement requirement routed to clarification review',
        request: result.request,
        match: result.match
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error?.message?.includes('ProjectSite not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Failed to create procurement request:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create request' }, { status: 500 });
  }
}
