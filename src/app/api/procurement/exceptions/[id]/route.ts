import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const resolveExceptionSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  resolutionAction: z.string().min(3, 'A valid resolution action is strictly required'),
  resolutionNotes: z.string().min(5, 'Detailed resolution notes are strictly required for audit record'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const userId = session.user.id;
    const { id } = await params;

    const body = await req.json();
    const parsed = resolveExceptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Invalid exception resolution data',
        details: parsed.error.issues,
      }, { status: 400 });
    }

    const { status, resolutionAction, resolutionNotes } = parsed.data;

    // Strict validation: cannot resolve without action and notes
    if ((status === 'RESOLVED' || status === 'CLOSED') && (!resolutionAction.trim() || !resolutionNotes.trim())) {
      return NextResponse.json({
        error: 'Forbidden: Cannot resolve exception without a documented resolution action and note',
      }, { status: 422 });
    }

    const result = await withTenantContext(workspaceId, async (tx) => {
      const existing = await tx.procurementException.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) {
        throw new Error('Exception record not found');
      }

      const updated = await tx.procurementException.update({
        where: { id },
        data: {
          status,
          resolutionAction,
          resolutionNotes,
          resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null,
          resolvedByUserId: status === 'RESOLVED' || status === 'CLOSED' ? userId : null,
        },
        include: {
          assignedUser: { select: { name: true } },
          resolvedByUser: { select: { name: true } },
        },
      });

      // Immutable Audit Log
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorId: userId,
          action: 'EXCEPTION_RESOLVED',
          entityType: 'PROCUREMENT_EXCEPTION',
          entityId: id,
          payloadBefore: {
            status: existing.status,
            exceptionCode: existing.exceptionCode,
          },
          payloadAfter: {
            status: updated.status,
            resolutionAction,
            resolutionNotes,
            resolvedAt: updated.resolvedAt,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, exception: result });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update exception' }, { status: 400 });
  }
}

