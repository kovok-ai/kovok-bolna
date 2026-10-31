import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { verifyCallbackToken, ExtractedVoiceVariables } from '@/lib/integrations/sarvam-voice';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callToken = searchParams.get('call_token');
    const requestCode = searchParams.get('request_code');

    if (!callToken) {
      return NextResponse.json({ error: 'Missing authentication callback token' }, { status: 401 });
    }

    const body = await req.json();
    const attemptId = body.attempt_id || body.id;
    const duration = body.duration_seconds || body.duration || 0;
    const status = body.call_status || body.status || 'COMPLETED';
    const extracted: ExtractedVoiceVariables = body.extracted_variables || body.variables || {};
    const transcript = body.transcript || body.turns || null;

    // Find candidate call by attemptId or requestCode
    let call = null;
    if (attemptId) {
      call = await prisma.supplierVoiceCall.findFirst({
        where: { sarvamAttemptId: attemptId },
        include: { procurementRequest: true, supplier: true },
      });
    }

    if (!call && requestCode) {
      call = await prisma.supplierVoiceCall.findFirst({
        where: {
          procurementRequest: { requestCode },
          callStatus: { in: ['QUEUED', 'IN_PROGRESS', 'RINGING'] },
        },
        include: { procurementRequest: true, supplier: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!call) {
      return NextResponse.json({ error: 'Matching supplier voice call record not found' }, { status: 404 });
    }

    // Verify callback token in constant time
    const isValidToken = verifyCallbackToken(callToken, call.callbackTokenHash);
    if (!isValidToken) {
      return NextResponse.json({ error: 'Invalid callback authentication token' }, { status: 403 });
    }

    // Update the call record
    const updatedCall = await prisma.supplierVoiceCall.update({
      where: { id: call.id },
      data: {
        callStatus: status.toUpperCase() === 'SUCCESS' ? 'COMPLETED' : status.toUpperCase(),
        durationSeconds: Number(duration),
        completedAt: new Date(),
        sarvamInteractionId: body.interaction_id || null,
        extractedVariables: extracted as any,
        transcript: transcript as any,
        notes: body.notes || `Callback received. Outcome: ${extracted.call_outcome || status}`,
      },
    });

    // Idempotent Quotation Creation (Draft marked PENDING_REVIEW)
    const baseRate = Number(extracted.quoted_rate) || 0;
    if (baseRate > 0) {
      // Check if quotation already created for this call
      const existingQuote = await prisma.quotation.findFirst({
        where: { callId: call.id },
      });

      if (!existingQuote) {
        const qty = Number(call.procurementRequest.quantityValue);
        const gstRate = Number(extracted.gst_rate) || 18.0;
        const freight = Number(extracted.freight_amount) || 0;
        const unloading = Number(extracted.unloading_amount) || 0;

        const baseAmount = baseRate * qty;
        const gstAmount = (baseAmount * gstRate) / 100;
        const totalDelivered = baseAmount + gstAmount + freight + unloading;

        const missingTerms: string[] = [];
        if (!extracted.freight_amount) missingTerms.push('freight_charges');
        if (!extracted.unloading_amount) missingTerms.push('unloading_charges');
        if (!extracted.payment_terms) missingTerms.push('payment_terms');
        if (!extracted.delivery_lead_time) missingTerms.push('delivery_lead_time');

        const quoteRef = `QUO-${call.procurementRequest.requestCode}-${Date.now().toString().slice(-4)}`;

        await prisma.quotation.create({
          data: {
            workspaceId: call.workspaceId,
            procurementRequestId: call.procurementRequestId,
            supplierId: call.supplierId,
            callId: call.id,
            quotationReference: quoteRef,
            source: 'VOICE_AGENT',
            materialSpecification: `${call.procurementRequest.materialCategoryId} ${call.procurementRequest.targetGrade || ''}`.trim(),
            canonicalProductId: call.procurementRequest.canonicalProductId,
            brand: extracted.brand || call.supplier.organizationName,
            grade: extracted.grade || call.procurementRequest.targetGrade,
            diameterMm: call.procurementRequest.targetDiameterMm,
            quantityValue: call.procurementRequest.quantityValue,
            quantityUnit: call.procurementRequest.quantityUnit,
            quotedBaseRate: baseRate,
            gstRate: gstRate,
            gstType: 'CGST_SGST',
            freightCharges: freight,
            unloadingCharges: unloading,
            totalDeliveredAmount: totalDelivered,
            deliveryEta: extracted.delivery_lead_time || null,
            paymentTerms: extracted.payment_terms || null,
            status: 'PENDING_REVIEW', // Invariant: Never automatically approved
            isComparable: missingTerms.length === 0,
            missingTerms: missingTerms.length > 0 ? missingTerms : Prisma.JsonNull,
            reviewNotes: extracted.clarifications || 'Extracted via Sarvam voice agent. Awaiting buyer review.',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      callId: updatedCall.id,
      callStatus: updatedCall.callStatus,
      quotationGenerated: baseRate > 0,
    });
  } catch (error: any) {
    console.error('Sarvam webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
