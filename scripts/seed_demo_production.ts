import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Safe Seed] Neither DATABASE_URL nor DIRECT_URL is configured. Skipping demo seed.');
    return;
  }

  const prisma = new PrismaClient({
    datasourceUrl: dbUrl,
  });

  try {
    // 1. Verify that database is reachable and users table exists
    const usersTableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;

    if (!usersTableCheck || !usersTableCheck[0]?.exists) {
      console.log('[Safe Seed] Table public.users does not exist yet. Please run prisma migrate deploy first.');
      await prisma.$disconnect();
      return;
    }

    console.log('[Safe Seed] Table public.users verified. Provisioning safe demo evaluation account...');

    // 2. Safe idempotent upsert of Workspace: "Concrete & Co."
    const workspace = await prisma.workspace.upsert({
      where: { slug: 'concrete-and-co' },
      update: {},
      create: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Concrete & Co.',
        slug: 'concrete-and-co',
        businessType: 'Contractor / Builder',
        serviceArea: 'Delhi NCR · 2 sites',
        isSandbox: true,
      },
    });

    // 3. Safe idempotent upsert of OWNER role
    const ownerRole = await prisma.workspaceRole.upsert({
      where: {
        workspaceId_name: {
          workspaceId: workspace.id,
          name: 'OWNER',
        },
      },
      update: {},
      create: {
        id: '11111111-1111-1111-1111-111111111112',
        workspaceId: workspace.id,
        name: 'OWNER',
        description: 'Workspace Owner with full administrative, financial and operational authority',
        approvalLimitAmount: 10000000.00,
        canCreateRequests: true,
        canApproveQuotes: true,
        canManageSettings: true,
        canRecordReceipts: true,
      },
    });

    // 4. Safe idempotent upsert of Demo User (demo@kovok.test)
    const demoPasswordHash = await hashPassword('DemoEvaluation2026!');
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@kovok.test' },
      update: { passwordHash: demoPasswordHash },
      create: {
        id: '44444444-4444-4444-4444-444444444441',
        email: 'demo@kovok.test',
        name: 'Demo Evaluation Buyer',
        passwordHash: demoPasswordHash,
        phone: '+919999900000',
        status: 'ACTIVE',
      },
    });

    // 5. Safe idempotent upsert of Workspace Membership
    await prisma.workspaceMembership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: demoUser.id,
        },
      },
      update: {
        roleId: ownerRole.id,
      },
      create: {
        workspaceId: workspace.id,
        userId: demoUser.id,
        roleId: ownerRole.id,
        isDefault: true,
      },
    });

    // 6. Safe idempotent upsert of Default Project & Sites
    const defaultProject = await prisma.project.upsert({
      where: {
        workspaceId_code: {
          workspaceId: workspace.id,
          code: 'DLF-PH5',
        },
      },
      update: {},
      create: {
        id: '44444444-4444-4444-4444-444444444440',
        workspaceId: workspace.id,
        name: 'DLF Phase V Commercial Towers',
        code: 'DLF-PH5',
        description: 'Multi-tower commercial development, Golf Course Road, Gurugram',
        status: 'ACTIVE',
      },
    });

    await prisma.projectSite.upsert({
      where: { id: '44444444-4444-4444-4444-444444444441' },
      update: { isDefault: true },
      create: {
        id: '44444444-4444-4444-4444-444444444441',
        workspaceId: workspace.id,
        projectId: defaultProject.id,
        siteName: 'Site A — Gurugram',
        pinCode: '122018',
        city: 'Gurugram',
        address: 'Plot 42, Sector 29, Gurugram, Haryana',
        gateTimings: '08:00 AM - 07:00 PM',
        unloadingRestrictions: 'Heavy trailer allowed after 10:00 PM; crane required for 32mm rebar.',
        isDefault: true,
        isActive: true,
      },
    });

    // 7. Safe idempotent upsert of statutory GST tax rules
    await prisma.taxRateRule.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        hsnSacCode: '2523',
        description: 'Portland cement, aluminous cement, slag cement and similar hydraulic cements (Post-Rationalisation)',
        cgstRate: 9.00,
        sgstRate: 9.00,
        igstRate: 18.00,
        effectiveFrom: new Date('2025-09-22'),
        effectiveTo: null,
        sourceCitation: 'PIB PRID 2163560 / GST Council 54th Meeting Rationalisation',
        isActive: true,
      },
    });

    await prisma.taxRateRule.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        hsnSacCode: '7214',
        description: 'Bars and rods of iron or non-alloy steel (TMT Reinforcement Steel)',
        cgstRate: 9.00,
        sgstRate: 9.00,
        igstRate: 18.00,
        effectiveFrom: new Date('2017-07-01'),
        effectiveTo: null,
        sourceCitation: 'Notification No. 1/2017-Central Tax (Rate)',
        isActive: true,
      },
    });

    console.log('[Safe Seed] Demo account demo@kovok.test successfully provisioned for evaluation.');
  } catch (error: any) {
    console.error('[Safe Seed] Warning during demo seeding:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[Safe Seed] Fatal error:', err);
  process.exit(1);
});
