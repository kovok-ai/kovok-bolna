import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const metrics = await withTenantContext(workspaceId, async (tx) => {
      const [
        totalRequests,
        verifiedRequests,
        clarificationRequests,
        totalQuotes,
        pendingQuotes,
        approvedQuotes,
        totalOrders,
        activeOrders,
        reconciledOrders,
        openExceptions,
        criticalExceptions,
        recentRequests,
        recentOrders,
      ] = await Promise.all([
        tx.procurementRequest.count({ where: { workspaceId } }),
        tx.procurementRequest.count({ where: { workspaceId, requestStatus: 'MATCHED_VERIFIED' } }),
        tx.procurementRequest.count({ where: { workspaceId, requestStatus: 'NEEDS_CLARIFICATION' } }),
        tx.quotation.count({ where: { workspaceId } }),
        tx.quotation.count({ where: { workspaceId, status: 'PENDING_REVIEW' } }),
        tx.quotation.count({ where: { workspaceId, status: 'APPROVED' } }),
        tx.purchaseOrder.count({ where: { workspaceId } }),
        tx.purchaseOrder.count({ where: { workspaceId, poStatus: { in: ['CONFIRMED', 'DISPATCHED', 'ARRIVED', 'INSPECTED'] } } }),
        tx.purchaseOrder.count({ where: { workspaceId, poStatus: 'RECONCILED' } }),
        tx.procurementException.count({ where: { workspaceId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        tx.procurementException.count({ where: { workspaceId, status: { in: ['OPEN', 'IN_PROGRESS'] }, severity: 'CRITICAL' } }),
        tx.procurementRequest.findMany({
          where: { workspaceId },
          include: {
            site: { select: { siteName: true, city: true, pinCode: true } },
            canonicalProduct: { select: { canonicalName: true, applicableStandard: true } },
            materialCategory: { select: { categoryName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        tx.purchaseOrder.findMany({
          where: { workspaceId },
          include: {
            allocation: {
              select: { supplierName: true, allocatedQuantity: true, allocatedPayableAmount: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      return {
        openRequests: totalRequests,
        verifiedRequests,
        clarificationRequests,
        awaitingQuotations: Math.max(0, totalRequests - approvedQuotes),
        quotationsPendingReview: pendingQuotes,
        approvedQuotations: approvedQuotes,
        activePurchaseOrders: activeOrders,
        totalPurchaseOrders: totalOrders,
        reconciledDeliveries: reconciledOrders,
        deliveriesInProgress: activeOrders,
        openExceptions,
        criticalExceptions,
        recentRequests,
        recentOrders,
      };
    });

    return NextResponse.json({ success: true, metrics });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to compute procurement metrics:', error);
    return NextResponse.json({ error: 'Failed to compute procurement metrics' }, { status: 500 });
  }
}

