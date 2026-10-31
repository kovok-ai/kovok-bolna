import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const milestoneRecordSchema = z.object({
  milestoneCode: z.string().min(2),
  milestoneTitle: z.string().min(2),
  milestoneStatus: z.enum(['ACHIEVED', 'FLAGGED', 'SKIPPED']).default('ACHIEVED'),
  quantityDelivered: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  actualDate: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const userId = session.user.id;
    const { id } = await params;

    const body = await req.json();
    const parsed = milestoneRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid milestone data', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    const result = await withTenantContext(workspaceId, async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id, workspaceId },
      });

      if (!order) {
        throw new Error('Purchase order not found');
      }

      // Check if this milestone already exists for this order
      const existing = await tx.deliveryMilestone.findFirst({
        where: { purchaseOrderId: id, milestoneCode: data.milestoneCode },
      });

      let milestoneRecord;
      if (existing) {
        milestoneRecord = await tx.deliveryMilestone.update({
          where: { id: existing.id },
          data: {
            milestoneStatus: data.milestoneStatus,
            actualDate: data.actualDate ? new Date(data.actualDate) : new Date(),
            quantityDelivered: data.quantityDelivered ?? existing.quantityDelivered,
            notes: data.notes ?? existing.notes,
            recordedByUserId: userId,
          },
        });
      } else {
        milestoneRecord = await tx.deliveryMilestone.create({
          data: {
            workspaceId,
            purchaseOrderId: id,
            milestoneCode: data.milestoneCode,
            milestoneTitle: data.milestoneTitle,
            milestoneStatus: data.milestoneStatus,
            actualDate: data.actualDate ? new Date(data.actualDate) : new Date(),
            quantityDelivered: data.quantityDelivered ?? null,
            unit: data.unit ?? 'tonnes',
            notes: data.notes ?? null,
            recordedByUserId: userId,
          },
        });
      }

      // Automatically update order status based on milestone achieved
      let newPoStatus: any = order.poStatus;
      if (data.milestoneCode.includes('DISPATCH')) newPoStatus = 'DISPATCHED';
      else if (data.milestoneCode.includes('GATE') || data.milestoneCode.includes('WEIGHBRIDGE')) newPoStatus = 'ARRIVED';
      else if (data.milestoneCode.includes('INSPECTION')) newPoStatus = 'INSPECTED';
      else if (data.milestoneCode.includes('OFFLOAD')) newPoStatus = 'RECONCILED';

      if (newPoStatus !== order.poStatus) {
        await tx.purchaseOrder.update({
          where: { id },
          data: { poStatus: newPoStatus },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorId: userId,
          action: 'DELIVERY_MILESTONE_RECORDED',
          entityType: 'PURCHASE_ORDER',
          entityId: id,
          payloadAfter: {
            milestone: data.milestoneTitle,
            status: data.milestoneStatus,
            quantityDelivered: data.quantityDelivered,
          },
        },
      });

      return { milestone: milestoneRecord, poStatus: newPoStatus };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to record milestone' }, { status: 400 });
  }
}

