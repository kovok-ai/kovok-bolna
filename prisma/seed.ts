import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Scrypt password hashing matching application auth
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  // CRITICAL PRODUCTION GUARD
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: Database seed execution is forbidden in production environments!');
  }

  console.log('Seeding initial reference data and development fixtures...');

  // 1. Seed Dynamic Tax Rate Rules (Historical & Current GST Rationalisation)
  const cementOld = await prisma.taxRateRule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      hsnSacCode: '2523',
      description: 'Portland cement, aluminous cement, slag cement and similar hydraulic cements (Historical)',
      cgstRate: 14.00,
      sgstRate: 14.00,
      igstRate: 28.00,
      effectiveFrom: new Date('2017-07-01'),
      effectiveTo: new Date('2025-09-21'),
      sourceCitation: 'Notification No. 1/2017-Central Tax (Rate)',
      isActive: false,
    },
  });

  const cementNew = await prisma.taxRateRule.upsert({
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

  const steel = await prisma.taxRateRule.upsert({
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

  console.log(`Tax rules initialized: HSN 2523 (Cement: 28% -> 18%), HSN 7214 (Steel: 18%)`);

  // 2. Seed Baseline Development Workspace: "Concrete & Co."
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

  // 3. Seed Workspace Roles
  const ownerRole = await prisma.workspaceRole.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'OWNER',
      },
    },
    update: {},
    create: {
      id: '22222222-2222-2222-2222-222222222221',
      workspaceId: workspace.id,
      name: 'OWNER',
      description: 'Workspace Owner with full commercial approval authorization',
      approvalLimitAmount: 10000000.00,
      canCreateRequests: true,
      canApproveQuotes: true,
      canManageSettings: true,
      canRecordReceipts: true,
    },
  });

  const buyerRole = await prisma.workspaceRole.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'BUYER',
      },
    },
    update: {},
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      workspaceId: workspace.id,
      name: 'BUYER',
      description: 'Procurement Specialist authorized to create RFQs and negotiate quotes',
      approvalLimitAmount: 50000.00,
      canCreateRequests: true,
      canApproveQuotes: false,
      canManageSettings: false,
      canRecordReceipts: true,
    },
  });

  // 4. Seed Development Admin User
  const adminPasswordHash = hashPassword('KovokSecure2026!');
  const adminUser = await prisma.user.upsert({
    where: { email: 'shiwang@concreteandco.in' },
    update: {},
    create: {
      id: '33333333-3333-3333-3333-333333333331',
      email: 'shiwang@concreteandco.in',
      name: 'Shiwang Gupta',
      passwordHash: adminPasswordHash,
      phone: '+919876543210',
      status: 'ACTIVE',
    },
  });

  // 5. Link User to Workspace as OWNER
  await prisma.workspaceMembership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      roleId: ownerRole.id,
      isDefault: true,
    },
  });

  // 6. Seed Project Sites
  await prisma.projectSite.upsert({
    where: { id: '44444444-4444-4444-4444-444444444441' },
    update: {},
    create: {
      id: '44444444-4444-4444-4444-444444444441',
      workspaceId: workspace.id,
      siteName: 'Site A — Gurugram',
      pinCode: '122018',
      city: 'Gurugram',
      address: 'Plot 42, Sector 29, Gurugram, Haryana',
      gateTimings: '08:00 AM - 07:00 PM',
      unloadingRestrictions: 'Heavy trailer allowed after 10:00 PM; crane required for 32mm rebar.',
    },
  });

  await prisma.projectSite.upsert({
    where: { id: '44444444-4444-4444-4444-444444444442' },
    update: {},
    create: {
      id: '44444444-4444-4444-4444-444444444442',
      workspaceId: workspace.id,
      siteName: 'Dwarka Commercial Project',
      pinCode: '110075',
      city: 'Delhi',
      address: 'Sector 14, Dwarka, New Delhi',
      gateTimings: '09:00 AM - 06:00 PM',
      unloadingRestrictions: 'Covered storage available for 500 cement bags. No overnight parking.',
    },
  });

  // 7. Seed Rule Profile
  await prisma.workspaceRuleProfile.upsert({
    where: { id: '55555555-5555-5555-5555-555555555551' },
    update: {},
    create: {
      id: '55555555-5555-5555-5555-555555555551',
      workspaceId: workspace.id,
      categories: ['TMT Steel', 'Cement'],
      requestSource: 'Site engineer / project manager',
      sourcingStrategy: 'Total delivered cost and delivery reliability',
      competitiveThreshold: 50000.00,
      maxVendorsPerRfq: 3,
      callWindowStart: '10:00',
      callWindowEnd: '18:00',
      callLanguage: 'Hindi + English',
      maxRetries: 2,
      autoRetryUnanswered: true,
      autoClarifyMissing: true,
      allowSubstitutions: false,
      status: 'ACTIVE',
    },
  });

  console.log('Development fixtures successfully seeded: Workspace "Concrete & Co.", User "shiwang@concreteandco.in", 2 Sites, 1 Rule Profile.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
