import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import * as crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const userId = session.user.id;
    const { id } = await params;

    const result = await withTenantContext(workspaceId, async (tx) => {
      // 1. Fetch quotation and linked request
      const quote = await tx.quotation.findFirst({
        where: { id, workspaceId },
        include: {
          supplier: true,
          procurementRequest: {
            include: { site: true },
          },
        },
      });

      if (!quote) {
        throw new Error('Quotation not found');
      }

      if (quote.status === 'APPROVED') {
        throw new Error('Quotation is already approved');
      }

      // Generate unique PO Number
      const poCounter = Math.floor(1000 + Math.random() * 9000);
      const poNumber = `PO-${poCounter}`;
      const idempotencyKey = `PO-ALLOC-${quote.id}`;

      // 2. Prepare canonical approved terms snapshot
      const termsSnapshot = {
        quotationId: quote.id,
        quotationReference: quote.quotationReference,
        requestCode: quote.procurementRequest.requestCode,
        supplierId: quote.supplierId,
        supplierName: quote.supplier.organizationName,
        supplierLegalEntity: quote.supplier.legalEntityName,
        specification: quote.materialSpecification,
        brand: quote.brand,
        grade: quote.grade,
        quantityValue: Number(quote.quantityValue),
        quantityUnit: quote.quantityUnit,
        baseRate: Number(quote.quotedBaseRate),
        gstRate: Number(quote.gstRate),
        gstType: quote.gstType,
        freightCharges: Number(quote.freightCharges),
        unloadingCharges: Number(quote.unloadingCharges),
        otherCharges: Number(quote.otherCharges),
        totalDeliveredAmount: Number(quote.totalDeliveredAmount),
        deliverySite: {
          siteId: quote.procurementRequest.siteId,
          siteName: quote.procurementRequest.site.siteName,
          address: quote.procurementRequest.site.address,
          city: quote.procurementRequest.site.city,
          pinCode: quote.procurementRequest.site.pinCode,
        },
        paymentTerms: quote.paymentTerms || 'Standard Trade Credit / Direct Supplier Billing',
        deliveryEta: quote.deliveryEta || 'Immediate dispatch',
        approvedAt: new Date().toISOString(),
        approvedByUserId: userId,
      };

      const checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(termsSnapshot))
        .digest('hex');

      // 3. Create Approval record
      const approval = await tx.approval.create({
        data: {
          workspaceId,
          requestCode: quote.procurementRequest.requestCode,
          approvedByUserId: userId,
          totalApprovedQuantity: quote.quantityValue,
          quantityUnit: quote.quantityUnit,
          totalApprovedAmount: quote.totalDeliveredAmount,
          approvedSpecifications: {
            materialSpecification: quote.materialSpecification,
            grade: quote.grade,
            diameterMm: quote.diameterMm ? Number(quote.diameterMm) : null,
          },
          approvalStatus: 'APPROVED',
        },
      });

      // 4. Create ApprovalAllocation record
      const allocation = await tx.approvalAllocation.create({
        data: {
          approvalId: approval.id,
          workspaceId,
          quotationReference: quote.quotationReference,
          supplierName: quote.supplier.organizationName,
          allocatedQuantity: quote.quantityValue,
          allocatedPayableAmount: quote.totalDeliveredAmount,
          allocatedTermsSnapshot: termsSnapshot,
        },
      });

      // 5. Create PurchaseOrder record
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          workspaceId,
          poNumber,
          approvalAllocationId: allocation.id,
          idempotencyKey,
          approvedTermsSnapshot: termsSnapshot,
          consistencyChecksum: checksum,
          poStatus: 'CONFIRMED',
        },
      });

      // 6. Generate Initial Milestone Sequence
      const milestones = [
        {
          milestoneCode: 'MS-CONFIRMED',
          milestoneTitle: 'Purchase Order Issued & Supplier Confirmed',
          milestoneStatus: 'ACHIEVED',
          actualDate: new Date(),
          quantityDelivered: null,
          unit: quote.quantityUnit,
          notes: 'Commercial terms approved by buyer. PO generated.',
        },
        {
          milestoneCode: 'MS-DISPATCH',
          milestoneTitle: 'Supplier Yard Dispatch',
          milestoneStatus: 'PENDING',
          quantityDelivered: null,
          unit: quote.quantityUnit,
          notes: 'Awaiting dispatch confirmation from supplier mill/stockyard.',
        },
        {
          milestoneCode: 'MS-GATE-ENTRY',
          milestoneTitle: 'Site Gate Entry & Security Stamp',
          milestoneStatus: 'PENDING',
          quantityDelivered: null,
          unit: quote.quantityUnit,
          notes: 'Arrival at site gate with commercial invoice.',
        },
        {
          milestoneCode: 'MS-WEIGHBRIDGE',
          milestoneTitle: 'Weighbridge Gross & Tare Measurement',
          milestoneStatus: 'PENDING',
          quantityDelivered: null,
          unit: quote.quantityUnit,
          notes: 'Gross minus tare weight determination per IS standards.',
        },
        {
          milestoneCode: 'MS-INSPECTION',
          milestoneTitle: 'Mill Test Certificate (MTC) & Quality Inspection',
          milestoneStatus: 'PENDING',
          quantityDelivered: null,
          unit: quote.quantityUnit,
          notes: 'Cross-verification of heat number and physical diameter/grade.',
        },
        {
          milestoneCode: 'MS-OFFLOADED',
          milestoneTitle: 'Material Offloaded & Stock Reconciled',
          milestoneStatus: 'PENDING',
          quantityDelivered: null,
          unit: quote.quantityUnit,
          notes: 'Final site acceptance.',
        },
      ];

      for (const ms of milestones) {
        await tx.deliveryMilestone.create({
          data: {
            workspaceId,
            purchaseOrderId: purchaseOrder.id,
            milestoneCode: ms.milestoneCode,
            milestoneTitle: ms.milestoneTitle,
            milestoneStatus: ms.milestoneStatus,
            actualDate: ms.actualDate || null,
            quantityDelivered: ms.quantityDelivered,
            unit: ms.unit,
            notes: ms.notes,
            recordedByUserId: userId,
          },
        });
      }

      // 7. Update Quotation Status
      await tx.quotation.update({
        where: { id: quote.id },
        data: { status: 'APPROVED' },
      });

      // 8. Update Procurement Request Status
      await tx.procurementRequest.update({
        where: { id: quote.procurementRequestId },
        data: { requestStatus: 'MATCHED_VERIFIED' },
      });

      // 9. Audit Log
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorId: userId,
          action: 'APPROVAL_GRANTED',
          entityType: 'PURCHASE_ORDER',
          entityId: purchaseOrder.id,
          payloadAfter: {
            poNumber,
            totalPayable: Number(quote.totalDeliveredAmount),
            supplier: quote.supplier.organizationName,
          },
        },
      });

      return {
        purchaseOrder,
        approval,
        allocation,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Quotation approved. Purchase order ${result.purchaseOrder.poNumber} created.`,
      purchaseOrder: result.purchaseOrder,
    }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Approval failed:', error);
    return NextResponse.json({ error: error.message || 'Quotation approval failed' }, { status: 400 });
  }
}

