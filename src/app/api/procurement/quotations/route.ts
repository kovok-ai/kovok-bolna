import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const createQuotationSchema = z.object({
  procurementRequestId: z.string().uuid(),
  supplierId: z.string().min(1),
  quotedBaseRate: z.number().positive('Base rate must be positive'),
  gstRate: z.number().nonnegative().default(18.00),
  gstType: z.enum(['CGST_SGST', 'IGST', 'UNSPECIFIED']).default('CGST_SGST'),
  freightCharges: z.number().nonnegative().default(0),
  unloadingCharges: z.number().nonnegative().default(0),
  otherCharges: z.number().nonnegative().default(0),
  deliveryEta: z.string().optional(),
  leadTimeDays: z.number().int().positive().optional(),
  paymentTerms: z.string().optional(),
  validityDays: z.number().int().positive().optional(),
  brand: z.string().optional(),
  grade: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('requestId');
    const status = searchParams.get('status');

    const quotations = await withTenantContext(workspaceId, async (tx) => {
      return await tx.quotation.findMany({
        where: {
          workspaceId,
          ...(requestId ? { procurementRequestId: requestId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          supplier: {
            select: {
              id: true,
              organizationName: true,
              legalEntityName: true,
              supplierType: true,
              verificationStatus: true,
              headquarters: true,
            },
          },
          procurementRequest: {
            select: {
              requestCode: true,
              quantityValue: true,
              quantityUnit: true,
              materialCategoryId: true,
              targetGrade: true,
              targetDiameterMm: true,
              site: {
                select: { siteName: true, city: true, pinCode: true },
              },
            },
          },
        },
        orderBy: [{ isComparable: 'desc' }, { totalDeliveredAmount: 'asc' }],
      });
    });

    // Compute normalized commercial comparisons
    const formatted = quotations.map((q) => {
      const qty = Number(q.quantityValue);
      const baseRate = Number(q.quotedBaseRate);
      const baseSubtotal = baseRate * qty;
      const gstAmount = (baseSubtotal * Number(q.gstRate)) / 100;
      const freight = Number(q.freightCharges);
      const unloading = Number(q.unloadingCharges);
      const other = Number(q.otherCharges);
      const deliveredTotal = Number(q.totalDeliveredAmount);

      return {
        id: q.id,
        quotationReference: q.quotationReference,
        source: q.source,
        supplier: q.supplier,
        request: q.procurementRequest,
        spec: q.materialSpecification,
        brand: q.brand || q.supplier.organizationName,
        grade: q.grade,
        quantity: qty,
        unit: q.quantityUnit,
        baseRate,
        baseSubtotal,
        gstRate: Number(q.gstRate),
        gstType: q.gstType,
        gstAmount,
        freightCharges: freight,
        unloadingCharges: unloading,
        otherCharges: other,
        totalDeliveredAmount: deliveredTotal,
        effectiveRatePerUnit: qty > 0 ? deliveredTotal / qty : baseRate,
        leadTimeDays: q.leadTimeDays,
        deliveryEta: q.deliveryEta,
        paymentTerms: q.paymentTerms,
        validityDays: q.validityDays,
        validityDate: q.validityDate,
        status: q.status,
        isComparable: q.isComparable,
        missingTerms: q.missingTerms,
        reviewNotes: q.reviewNotes,
        createdAt: q.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      count: formatted.length,
      quotations: formatted,
    });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to list quotations:', error);
    return NextResponse.json({ error: 'Failed to list quotations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const body = await req.json();
    const parsed = createQuotationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid quotation payload', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    const quote = await withTenantContext(workspaceId, async (tx) => {
      const request = await tx.procurementRequest.findUnique({
        where: { id: data.procurementRequestId },
      });

      if (!request || request.workspaceId !== workspaceId) {
        throw new Error('Procurement request not found');
      }

      const supplier = await tx.supplierOrganization.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new Error('Supplier organization not found');
      }

      const qty = Number(request.quantityValue);
      const baseSubtotal = data.quotedBaseRate * qty;
      const gstAmount = (baseSubtotal * data.gstRate) / 100;
      const deliveredTotal = baseSubtotal + gstAmount + data.freightCharges + data.unloadingCharges + data.otherCharges;

      const missingTerms: string[] = [];
      if (data.freightCharges === 0 && !data.reviewNotes?.includes('freight included')) {
        missingTerms.push('freightCharges');
      }
      if (data.unloadingCharges === 0 && !data.reviewNotes?.includes('unloading included')) {
        missingTerms.push('unloadingCharges');
      }

      const quoteRef = `QUO-${request.requestCode}-${Date.now().toString().slice(-4)}`;

      return await tx.quotation.create({
        data: {
          workspaceId,
          procurementRequestId: data.procurementRequestId,
          supplierId: data.supplierId,
          quotationReference: quoteRef,
          source: 'MANUAL_ENTRY',
          materialSpecification: `${request.materialCategoryId} ${request.targetGrade || ''}`.trim(),
          canonicalProductId: request.canonicalProductId,
          brand: data.brand || supplier.organizationName,
          grade: data.grade || request.targetGrade,
          diameterMm: request.targetDiameterMm,
          quantityValue: request.quantityValue,
          quantityUnit: request.quantityUnit,
          quotedBaseRate: data.quotedBaseRate,
          gstRate: data.gstRate,
          gstType: data.gstType,
          freightCharges: data.freightCharges,
          unloadingCharges: data.unloadingCharges,
          otherCharges: data.otherCharges,
          totalDeliveredAmount: deliveredTotal,
          deliveryEta: data.deliveryEta,
          leadTimeDays: data.leadTimeDays,
          paymentTerms: data.paymentTerms,
          validityDays: data.validityDays,
          status: 'PENDING_REVIEW',
          isComparable: missingTerms.length === 0,
          missingTerms: missingTerms.length > 0 ? missingTerms : Prisma.JsonNull,
          reviewNotes: data.reviewNotes,
        },
      });
    });

    return NextResponse.json({ success: true, quotation: quote }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create quotation' }, { status: 400 });
  }
}
