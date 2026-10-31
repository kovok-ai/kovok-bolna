import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const updateQuotationSchema = z.object({
  quotedBaseRate: z.number().positive().optional(),
  gstRate: z.number().nonnegative().optional(),
  gstType: z.enum(['CGST_SGST', 'IGST', 'UNSPECIFIED']).optional(),
  freightCharges: z.number().nonnegative().optional(),
  unloadingCharges: z.number().nonnegative().optional(),
  otherCharges: z.number().nonnegative().optional(),
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED']).optional(),
  deliveryEta: z.string().optional(),
  paymentTerms: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const { id } = await params;

    const quote = await withTenantContext(workspaceId, async (tx) => {
      return await tx.quotation.findFirst({
        where: { id, workspaceId },
        include: {
          supplier: true,
          procurementRequest: {
            include: { site: true },
          },
          call: true,
        },
      });
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, quotation: quote });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch quotation' }, { status: 500 });
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
    const parsed = updateQuotationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update payload', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    const updated = await withTenantContext(workspaceId, async (tx) => {
      const quote = await tx.quotation.findFirst({
        where: { id, workspaceId },
      });

      if (!quote) {
        throw new Error('Quotation not found');
      }

      const qty = Number(quote.quantityValue);
      const baseRate = data.quotedBaseRate ?? Number(quote.quotedBaseRate);
      const gstRate = data.gstRate ?? Number(quote.gstRate);
      const freight = data.freightCharges ?? Number(quote.freightCharges);
      const unloading = data.unloadingCharges ?? Number(quote.unloadingCharges);
      const other = data.otherCharges ?? Number(quote.otherCharges);

      const baseSubtotal = baseRate * qty;
      const gstAmount = (baseSubtotal * gstRate) / 100;
      const totalDelivered = baseSubtotal + gstAmount + freight + unloading + other;

      return await tx.quotation.update({
        where: { id },
        data: {
          ...data,
          quotedBaseRate: baseRate,
          gstRate,
          freightCharges: freight,
          unloadingCharges: unloading,
          otherCharges: other,
          totalDeliveredAmount: totalDelivered,
          isComparable: freight > 0 || quote.isComparable,
        },
      });
    });

    return NextResponse.json({ success: true, quotation: updated });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update quotation' }, { status: 400 });
  }
}

