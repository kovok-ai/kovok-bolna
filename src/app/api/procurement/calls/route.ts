import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { initiateSarvamOutboundCall } from '@/lib/integrations/sarvam-voice';
import { z } from 'zod';

const callInitiationSchema = z.object({
  procurementRequestId: z.string().uuid(),
  supplierId: z.string().min(1),
  supplierPhoneOverride: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('requestId');

    const calls = await withTenantContext(workspaceId, async (tx) => {
      return await tx.supplierVoiceCall.findMany({
        where: {
          workspaceId,
          ...(requestId ? { procurementRequestId: requestId } : {}),
        },
        include: {
          supplier: {
            select: { id: true, organizationName: true, supplierType: true },
          },
          procurementRequest: {
            select: { requestCode: true, quantityValue: true, quantityUnit: true, targetGrade: true },
          },
          initiatedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return NextResponse.json({ success: true, count: calls.length, calls });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to query supplier calls:', error);
    return NextResponse.json({ error: 'Failed to query supplier calls' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const userId = session.user.id;

    const body = await req.json();
    const parsed = callInitiationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid call initiation data', details: parsed.error.issues }, { status: 400 });
    }

    const { procurementRequestId, supplierId, supplierPhoneOverride } = parsed.data;

    // Fetch request and supplier details inside tenant context
    const { request, supplier } = await withTenantContext(workspaceId, async (tx) => {
      const reqRecord = await tx.procurementRequest.findUnique({
        where: { id: procurementRequestId },
        include: {
          site: true,
          canonicalProduct: true,
          materialCategory: true,
        },
      });

      if (!reqRecord || reqRecord.workspaceId !== workspaceId) {
        throw new Error('Procurement request not found');
      }

      const suppRecord = await tx.supplierOrganization.findUnique({
        where: { id: supplierId },
      });

      if (!suppRecord) {
        throw new Error('Supplier organization not found');
      }

      return { request: reqRecord, supplier: suppRecord };
    });

    const targetPhone = supplierPhoneOverride || supplier.contactPhone;
    if (!targetPhone) {
      return NextResponse.json(
        { error: `Supplier '${supplier.organizationName}' has no contact phone registered` },
        { status: 400 }
      );
    }

    const isSteel =
      request.materialCategoryId === 'tmt_rebar' || request.materialCategoryId === 'CAT-TMT-STEEL';
    const specDesc = isSteel
      ? `TMT Steel ${request.targetGrade ?? ''} ${request.targetDiameterMm ? `${request.targetDiameterMm}mm` : ''}`
      : `Cement ${request.targetGrade ?? ''}`;

    // Initiate call via Sarvam Voice client
    const callResult = await initiateSarvamOutboundCall({
      workspaceId,
      procurementRequestId,
      requestCode: request.requestCode,
      supplierId: supplier.id,
      supplierName: supplier.organizationName,
      supplierPhone: targetPhone,
      materialSpecification: specDesc.trim(),
      targetQuantity: Number(request.quantityValue),
      quantityUnit: request.quantityUnit,
      deliverySiteName: request.site.siteName,
      deliveryCity: request.site.city,
      deliveryPinCode: request.site.pinCode,
      initiatedByUserId: userId,
    });

    // Record call in DB
    const savedCall = await withTenantContext(workspaceId, async (tx) => {
      return await tx.supplierVoiceCall.create({
        data: {
          workspaceId,
          procurementRequestId,
          supplierId,
          initiatedByUserId: userId,
          supplierPhoneNumber: targetPhone,
          callbackTokenHash: callResult.callbackTokenHash,
          sarvamAttemptId: callResult.attemptId ?? null,
          callStatus: callResult.success ? 'QUEUED' : callResult.status,
          notes: callResult.error ? `Initiation status: ${callResult.error}` : 'Call dispatched to Sarvam AI gateway',
        },
        include: {
          supplier: { select: { organizationName: true } },
          procurementRequest: { select: { requestCode: true } },
        },
      });
    });

    return NextResponse.json({
      success: callResult.success,
      status: callResult.status,
      call: savedCall,
      warning: callResult.error || null,
      missingConfig: callResult.missingConfig || null,
    }, { status: callResult.success ? 201 : 200 });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Call initiation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate supplier call' }, { status: 400 });
  }
}

