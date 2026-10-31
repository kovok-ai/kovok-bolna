import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';

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
          workspace: {
            select: { name: true, serviceArea: true },
          },
          allocation: {
            include: { approval: true },
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

    const terms: any = order.approvedTermsSnapshot || {};

    const csvRows = [
      ['KOVOK PROCUREMENT PLATFORM — OFFICIAL PURCHASE ORDER RECORD'],
      ['PO Number', order.poNumber],
      ['PO Status', order.poStatus],
      ['Issue Date', new Date(order.createdAt).toISOString()],
      ['Consistency Checksum', order.consistencyChecksum],
      ['Buyer Workspace', order.workspace.name],
      ['Supplier Legal Entity', terms.supplierLegalEntity || terms.supplierName],
      ['Material Specification', terms.specification],
      ['Brand / Grade', `${terms.brand || ''} ${terms.grade || ''}`.trim()],
      ['Approved Quantity', `${terms.quantityValue} ${terms.quantityUnit}`],
      ['Base Rate per Unit', `INR ${terms.baseRate}`],
      ['GST Rate', `${terms.gstRate}% (${terms.gstType || 'CGST+SGST'})`],
      ['Freight Charges', `INR ${terms.freightCharges || 0}`],
      ['Unloading Charges', `INR ${terms.unloadingCharges || 0}`],
      ['Total Delivered Payable', `INR ${terms.totalDeliveredAmount}`],
      ['Delivery Site', `${terms.deliverySite?.siteName}, ${terms.deliverySite?.city} - ${terms.deliverySite?.pinCode}`],
      ['Delivery Address', terms.deliverySite?.address || 'On file'],
      ['Payment Terms', terms.paymentTerms || 'Standard Trade Terms'],
      [''],
      ['DELIVERY MILESTONES & AUDIT HISTORY'],
      ['Milestone Code', 'Milestone Title', 'Status', 'Recorded Date', 'Quantity Delivered', 'Notes'],
      ...order.milestones.map((m) => [
        m.milestoneCode,
        m.milestoneTitle,
        m.milestoneStatus,
        m.actualDate ? new Date(m.actualDate).toLocaleDateString('en-IN') : 'Pending',
        m.quantityDelivered ? `${m.quantityDelivered} ${m.unit || ''}` : '-',
        (m.notes || '').replace(/,/g, ';'),
      ]),
    ];

    const csvContent = csvRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${order.poNumber}_kovok_order.csv"`,
      },
    });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}

