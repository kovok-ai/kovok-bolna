import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const orders = await withTenantContext(workspaceId, async (tx) => {
      return await tx.purchaseOrder.findMany({
        where: {
          workspaceId,
          ...(status ? { poStatus: status } : {}),
        },
        include: {
          allocation: {
            select: {
              quotationReference: true,
              supplierName: true,
              allocatedQuantity: true,
              allocatedPayableAmount: true,
            },
          },
          milestones: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    const formatted = orders.map((o) => {
      const terms: any = o.approvedTermsSnapshot || {};
      const achievedMilestones = o.milestones.filter((m) => m.milestoneStatus === 'ACHIEVED');
      const latestAchieved = achievedMilestones[achievedMilestones.length - 1];
      const pendingMilestone = o.milestones.find((m) => m.milestoneStatus === 'PENDING');

      // Calculate quantity received from milestones
      const deliveredQty = o.milestones.reduce((acc, m) => {
        return acc + (m.quantityDelivered ? Number(m.quantityDelivered) : 0);
      }, 0);

      const totalQty = Number(o.allocation.allocatedQuantity);
      const pendingQty = Math.max(0, totalQty - deliveredQty);

      return {
        id: o.id,
        poNumber: o.poNumber,
        poStatus: o.poStatus,
        createdAt: o.createdAt,
        consistencyChecksum: o.consistencyChecksum,
        supplierName: o.allocation.supplierName,
        quotationReference: o.allocation.quotationReference,
        specification: terms.specification || 'Construction Material',
        brand: terms.brand || 'Conforming Brand',
        grade: terms.grade || 'Standard Conforming',
        totalQuantity: totalQty,
        quantityUnit: terms.quantityUnit || 'tonnes',
        deliveredQuantity: deliveredQty,
        pendingQuantity: pendingQty,
        totalPayableAmount: Number(o.allocation.allocatedPayableAmount),
        siteName: terms.deliverySite?.siteName || 'Site A — Gurugram',
        siteCity: terms.deliverySite?.city || 'Gurugram',
        sitePinCode: terms.deliverySite?.pinCode || '122001',
        paymentTerms: terms.paymentTerms || 'Standard Trade Terms',
        deliveryEta: terms.deliveryEta || 'Immediate dispatch',
        latestMilestone: latestAchieved?.milestoneTitle || 'Order Issued',
        nextMilestone: pendingMilestone?.milestoneTitle || 'All Milestones Completed',
        milestonesCount: o.milestones.length,
        milestones: o.milestones,
      };
    });

    return NextResponse.json({
      success: true,
      count: formatted.length,
      orders: formatted,
    });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to list orders:', error);
    return NextResponse.json({ error: 'Failed to list purchase orders' }, { status: 500 });
  }
}

