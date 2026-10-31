import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { withTenantContext } from '@/lib/db';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  competitiveThreshold: z.number().nonnegative().optional(),
  maxVendorsPerRfq: z.number().int().min(1).max(10).optional(),
  callWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  callWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  callLanguage: z.string().max(16).optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  autoRetryUnanswered: z.boolean().optional(),
  autoClarifyMissing: z.boolean().optional(),
  allowSubstitutions: z.boolean().optional(),
  requestSource: z.string().optional(),
  sourcingStrategy: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const profile = await withTenantContext(workspaceId, async (tx) => {
      let current = await tx.workspaceRuleProfile.findFirst({
        where: { workspaceId, status: 'ACTIVE' },
      });

      if (!current) {
        // Create default active profile if not exists
        current = await tx.workspaceRuleProfile.create({
          data: {
            workspaceId,
            categories: ['TMT Steel', 'Cement'],
            requestSource: 'Site engineer / project manager',
            sourcingStrategy: 'Total delivered cost and delivery reliability',
            competitiveThreshold: 50000.0,
            maxVendorsPerRfq: 3,
            callWindowStart: '10:00',
            callWindowEnd: '18:00',
            callLanguage: 'hi-IN',
            maxRetries: 2,
            autoRetryUnanswered: true,
            autoClarifyMissing: true,
            allowSubstitutions: false,
            status: 'ACTIVE',
          },
        });
      }

      return current;
    });

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to get workspace settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = session.workspace.id;

    const body = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid settings payload', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    const updated = await withTenantContext(workspaceId, async (tx) => {
      let current = await tx.workspaceRuleProfile.findFirst({
        where: { workspaceId, status: 'ACTIVE' },
      });

      if (current) {
        return await tx.workspaceRuleProfile.update({
          where: { id: current.id },
          data,
        });
      } else {
        return await tx.workspaceRuleProfile.create({
          data: {
            workspaceId,
            categories: ['TMT Steel', 'Cement'],
            requestSource: data.requestSource || 'Site engineer / project manager',
            sourcingStrategy: data.sourcingStrategy || 'Total delivered cost and delivery reliability',
            competitiveThreshold: data.competitiveThreshold ?? 50000.0,
            maxVendorsPerRfq: data.maxVendorsPerRfq ?? 3,
            callWindowStart: data.callWindowStart ?? '10:00',
            callWindowEnd: data.callWindowEnd ?? '18:00',
            callLanguage: data.callLanguage ?? 'hi-IN',
            maxRetries: data.maxRetries ?? 2,
            autoRetryUnanswered: data.autoRetryUnanswered ?? true,
            autoClarifyMissing: data.autoClarifyMissing ?? true,
            allowSubstitutions: data.allowSubstitutions ?? false,
            status: 'ACTIVE',
          },
        });
      }
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update workspace settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 400 });
  }
}

