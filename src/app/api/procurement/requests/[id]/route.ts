import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    if (!session.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const workspaceId = session.workspace.id;

    const procurementRequest = await withTenantContext(workspaceId, async (tx) => {
      return await tx.procurementRequest.findFirst({
        where: { id, workspaceId },
        include: {
          site: true,
          canonicalProduct: {
            include: {
              category: true
            }
          },
          materialCategory: true,
          createdByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: 'Procurement request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: procurementRequest });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to get procurement request:', error);
    return NextResponse.json({ error: 'Failed to get procurement request' }, { status: 500 });
  }
}
