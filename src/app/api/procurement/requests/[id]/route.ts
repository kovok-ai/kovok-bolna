import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const updateRequestSchema = z.object({
  requestStatus: z.enum(['DRAFT', 'MATCHED_VERIFIED', 'NEEDS_CLARIFICATION', 'CANCELLED', 'HOLD']).optional(),
  buyerNotes: z.string().optional(),
  clarificationReason: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    if (!session.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const workspaceId = session.workspace.id;

    const procurementRequest = await withTenantContext(workspaceId, async (tx) => {
      return await tx.procurementRequest.findFirst({
        where: { id, workspaceId },
        include: {
          site: true,
          canonicalProduct: {
            include: {
              category: true,
            },
          },
          materialCategory: true,
          createdByUser: {
            select: { id: true, name: true, email: true },
          },
          calls: {
            include: {
              supplier: { select: { id: true, organizationName: true, contactPhone: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          quotations: {
            include: {
              supplier: { select: { id: true, organizationName: true, verificationStatus: true } },
            },
            orderBy: { totalDeliveredAmount: 'asc' },
          },
        },
      });
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: 'Procurement request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: procurementRequest });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to get procurement request:', error);
    return NextResponse.json({ error: 'Failed to get procurement request' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const workspaceId = session.workspace.id;

    const body = await request.json();
    const parsed = updateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update payload', details: parsed.error.issues }, { status: 400 });
    }

    const updated = await withTenantContext(workspaceId, async (tx) => {
      const existing = await tx.procurementRequest.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) {
        throw new Error('Procurement request not found');
      }

      return await tx.procurementRequest.update({
        where: { id },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update request' }, { status: 400 });
  }
}
