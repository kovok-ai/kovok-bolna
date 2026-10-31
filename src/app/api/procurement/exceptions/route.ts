import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const createExceptionSchema = z.object({
  exceptionType: z.enum([
    'SHORT_SUPPLY',
    'DELAYED_DELIVERY',
    'SUPPLIER_CANCELLATION',
    'SPEC_MISMATCH',
    'DAMAGED_MATERIAL',
    'MISSING_DOCUMENTATION',
    'PRICING_DISCREPANCY',
    'OTHER',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  title: z.string().min(3).max(255),
  description: z.string().min(5),
  relatedEntityType: z.enum(['PROCUREMENT_REQUEST', 'PURCHASE_ORDER', 'QUOTATION', 'DELIVERY_MILESTONE']).optional(),
  relatedEntityId: z.string().optional(),
  relatedCode: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    const exceptions = await withTenantContext(workspaceId, async (tx) => {
      return await tx.procurementException.findMany({
        where: {
          workspaceId,
          ...(status && status !== 'ALL' ? { status } : {}),
          ...(severity && severity !== 'ALL' ? { severity } : {}),
        },
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          resolvedByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      });
    });

    return NextResponse.json({
      success: true,
      count: exceptions.length,
      exceptions,
    });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to query exceptions:', error);
    return NextResponse.json({ error: 'Failed to query exceptions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;
    const userId = session.user.id;

    const body = await req.json();
    const parsed = createExceptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid exception data', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;
    const exceptionCount = Math.floor(100 + Math.random() * 900);
    const exceptionCode = `EX-${exceptionCount}`;

    const exception = await withTenantContext(workspaceId, async (tx) => {
      const created = await tx.procurementException.create({
        data: {
          workspaceId,
          exceptionCode,
          exceptionType: data.exceptionType,
          severity: data.severity,
          status: 'OPEN',
          title: data.title,
          description: data.description,
          relatedEntityType: data.relatedEntityType,
          relatedEntityId: data.relatedEntityId,
          relatedCode: data.relatedCode,
          assignedUserId: userId,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorId: userId,
          action: 'EXCEPTION_RAISED',
          entityType: 'PROCUREMENT_EXCEPTION',
          entityId: created.id,
          payloadAfter: {
            exceptionCode,
            type: data.exceptionType,
            severity: data.severity,
            title: data.title,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, exception }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create exception' }, { status: 400 });
  }
}

