import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name is required').max(255),
  code: z.string().min(2, 'Project code is required').max(64),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const projects = await withTenantContext(workspaceId, async (tx) => {
      return await tx.project.findMany({
        where: { workspaceId },
        include: {
          sites: {
            where: { isActive: true },
            select: { id: true, siteName: true, city: true, pinCode: true, isDefault: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return NextResponse.json({ success: true, count: projects.length, projects });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to list projects:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid project data', details: parsed.error.issues }, { status: 400 });
    }

    const { name, code, description } = parsed.data;

    const project = await withTenantContext(workspaceId, async (tx) => {
      // Check if project code already exists
      const existing = await tx.project.findUnique({
        where: {
          workspaceId_code: { workspaceId, code: code.toUpperCase() },
        },
      });

      if (existing) {
        throw new Error(`Project code '${code}' already exists in this workspace`);
      }

      return await tx.project.create({
        data: {
          workspaceId,
          name,
          code: code.toUpperCase(),
          description,
          status: 'ACTIVE',
        },
      });
    });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create project' }, { status: 400 });
  }
}

