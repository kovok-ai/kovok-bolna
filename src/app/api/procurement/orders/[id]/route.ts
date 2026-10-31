import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const updateOrderSchema = z.object({
  poStatus: z.enum(['CONFIRMED', 'DISPATCHED', 'ARRIVED', 'INSPECTED', 'RECONCILED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const { id } = await params;

    const order = await withTenantContext(workspaceId, async (tx) => {
      return await tx.purchaseOrder.findFirst({
        where: { id, workspaceId },
        include: {
          allocation: {
            include: {
              approval: true,
            },
          },
          milestones: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const { id } = await params;

    const body = await req.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update payload', details: parsed.error.issues }, { status: 400 });
    }

    const updated = await withTenantContext(workspaceId, async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) {
        throw new Error('Purchase order not found');
      }

      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(parsed.data.poStatus ? { poStatus: parsed.data.poStatus } : {}),
        },
      });
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update order' }, { status: 400 });
  }
}

