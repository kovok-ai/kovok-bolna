import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

// Scrypt password hashing matching application auth
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
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
  const adminPasswordHash = await hashPassword('KovokSecure2026!');
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

  // 6. Seed Projects and Project Sites
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

  const siteA = await prisma.projectSite.upsert({
    where: { id: '44444444-4444-4444-4444-444444444441' },
    update: {
      projectId: defaultProject.id,
      isDefault: true,
    },
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

  await prisma.projectSite.upsert({
    where: { id: '44444444-4444-4444-4444-444444444442' },
    update: {
      projectId: defaultProject.id,
      isDefault: false,
    },
    create: {
      id: '44444444-4444-4444-4444-444444444442',
      workspaceId: workspace.id,
      projectId: defaultProject.id,
      siteName: 'Dwarka Commercial Project',
      pinCode: '110075',
      city: 'Delhi',
      address: 'Sector 14, Dwarka, New Delhi',
      gateTimings: '09:00 AM - 06:00 PM',
      unloadingRestrictions: 'Covered storage available for 500 cement bags. No overnight parking.',
      isDefault: false,
      isActive: true,
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

  // 8. Seed Initial Procurement Request: KOV-REQ-0001
  const req1 = await prisma.procurementRequest.upsert({
    where: {
      workspaceId_requestCode: {
        workspaceId: workspace.id,
        requestCode: 'KOV-REQ-0001',
      },
    },
    update: {},
    create: {
      id: '66666666-6666-6666-6666-666666666661',
      workspaceId: workspace.id,
      siteId: siteA.id,
      requestCode: 'KOV-REQ-0001',
      materialCategoryId: 'tmt_rebar',
      canonicalProductId: 'CP-TMT-500D-12MM',
      targetGrade: 'Fe 500D',
      targetDiameterMm: 12.00,
      quantityValue: 20.000,
      quantityUnit: 'TONNES',
      derivedCalculations: {
        nominalMassKgPerMeter: 0.888,
        singleBarMassKg: 10.656,
        theoreticalBarsPerTonne: 93.84,
        totalPiecesEstimated: 1877,
      },
      requestStatus: 'MATCHED_VERIFIED',
      clarificationReason: null,
      buyerNotes: 'Standard 12m length conforming to IS 1786:2008 Grade Fe 500D. Test certificate mandatory with delivery.',
      createdByUserId: adminUser.id,
    },
  });

  // 9. Seed Quotations for KOV-REQ-0001
  const quote1 = await prisma.quotation.upsert({
    where: { id: '77777777-7777-7777-7777-777777777771' },
    update: {},
    create: {
      id: '77777777-7777-7777-7777-777777777771',
      workspaceId: workspace.id,
      procurementRequestId: req1.id,
      supplierId: 'SUP-JSW-ONE',
      quotationReference: 'QUO-KOV-0001-01',
      source: 'VOICE_AGENT',
      materialSpecification: 'TMT Steel Fe 500D · 12mm',
      canonicalProductId: 'CP-TMT-500D-12MM',
      brand: 'JSW Neosteel',
      grade: 'Fe 500D',
      diameterMm: 12.00,
      quantityValue: 20.000,
      quantityUnit: 'TONNES',
      quotedBaseRate: 52000.00,
      gstRate: 18.00,
      gstType: 'CGST_SGST',
      freightCharges: 14000.00,
      unloadingCharges: 3500.00,
      otherCharges: 0.00,
      totalDeliveredAmount: 1244700.00, // (52000*20)*1.18 + 14000 + 3500 = 12,27,200 + 17500 = 12,44,700
      leadTimeDays: 2,
      deliveryEta: 'Tomorrow, 9:00 AM',
      paymentTerms: 'Direct Supplier Billing / 30 Days Net',
      validityDays: 3,
      status: 'PENDING_REVIEW',
      isComparable: true,
      reviewNotes: 'Verified dealer direct dispatch. Mill test certificate included.',
    },
  });

  await prisma.quotation.upsert({
    where: { id: '77777777-7777-7777-7777-777777777772' },
    update: {},
    create: {
      id: '77777777-7777-7777-7777-777777777772',
      workspaceId: workspace.id,
      procurementRequestId: req1.id,
      supplierId: 'SUP-TATA-DEALER-NCR',
      quotationReference: 'QUO-KOV-0001-02',
      source: 'VOICE_AGENT',
      materialSpecification: 'TMT Steel Fe 500D · 12mm',
      canonicalProductId: 'CP-TMT-500D-12MM',
      brand: 'Tata Tiscon',
      grade: 'Fe 500D',
      diameterMm: 12.00,
      quantityValue: 20.000,
      quantityUnit: 'TONNES',
      quotedBaseRate: 53500.00,
      gstRate: 18.00,
      gstType: 'CGST_SGST',
      freightCharges: 16000.00,
      unloadingCharges: 4000.00,
      otherCharges: 0.00,
      totalDeliveredAmount: 1282600.00, // (53500*20)*1.18 + 20000 = 12,62,600 + 20000 = 12,82,600
      leadTimeDays: 3,
      deliveryEta: 'In 3 business days',
      paymentTerms: 'Advance RTGS / Authorized Dealership',
      validityDays: 2,
      status: 'PENDING_REVIEW',
      isComparable: true,
      reviewNotes: 'Authorized primary distributor stock in Naraina Mandi.',
    },
  });

  await prisma.quotation.upsert({
    where: { id: '77777777-7777-7777-7777-777777777773' },
    update: {},
    create: {
      id: '77777777-7777-7777-7777-777777777773',
      workspaceId: workspace.id,
      procurementRequestId: req1.id,
      supplierId: 'SUP-INFRA-MKT',
      quotationReference: 'QUO-KOV-0001-03',
      source: 'VOICE_AGENT',
      materialSpecification: 'TMT Steel Fe 500D · 12mm',
      canonicalProductId: 'CP-TMT-500D-12MM',
      brand: 'Secondary Rolling Brand',
      grade: 'Fe 500D',
      diameterMm: 12.00,
      quantityValue: 20.000,
      quantityUnit: 'TONNES',
      quotedBaseRate: 51200.00,
      gstRate: 18.00,
      gstType: 'CGST_SGST',
      freightCharges: 0.00,
      unloadingCharges: 0.00,
      otherCharges: 0.00,
      totalDeliveredAmount: 1208320.00,
      leadTimeDays: 1,
      deliveryEta: 'Same day dispatch',
      paymentTerms: 'Immediate Payment Required',
      validityDays: 1,
      status: 'PENDING_REVIEW',
      isComparable: false,
      missingTerms: ['freightCharges', 'unloadingCharges'],
      reviewNotes: 'Supplier has not confirmed freight and unloading to Gurugram site. Delivered total is incomplete.',
    },
  });

  // 10. Seed an initial Purchase Order PO-0261
  const approval = await prisma.approval.upsert({
    where: { id: '88888888-8888-8888-8888-888888888881' },
    update: {},
    create: {
      id: '88888888-8888-8888-8888-888888888881',
      workspaceId: workspace.id,
      requestCode: 'KOV-REQ-0000',
      approvedByUserId: adminUser.id,
      totalApprovedQuantity: 20.000,
      quantityUnit: 'TONNES',
      totalApprovedAmount: 1012000.00,
      approvedSpecifications: {
        materialSpecification: 'TMT Steel Fe 550D · 12mm',
        grade: 'Fe 550D',
        diameterMm: 12.00,
      },
      approvalStatus: 'APPROVED',
    },
  });

  const allocation = await prisma.approvalAllocation.upsert({
    where: { id: '88888888-8888-8888-8888-888888888882' },
    update: {},
    create: {
      id: '88888888-8888-8888-8888-888888888882',
      approvalId: approval.id,
      workspaceId: workspace.id,
      quotationReference: 'QUO-KOV-0000-01',
      supplierName: 'Shakti Steel & Co.',
      allocatedQuantity: 20.000,
      allocatedPayableAmount: 1012000.00,
      allocatedTermsSnapshot: {
        specification: 'TMT Steel Fe 550D · 12 mm',
        brand: 'JSW Neosteel',
        grade: 'Fe 550D',
        quantityValue: 20,
        quantityUnit: 'tonnes',
        baseRate: 42000,
        gstRate: 18,
        freightCharges: 14000,
        unloadingCharges: 3500,
        totalDeliveredAmount: 1012000,
        deliverySite: { siteName: 'Site A — Gurugram', city: 'Gurugram', pinCode: '122018' },
      },
    },
  });

  const po = await prisma.purchaseOrder.upsert({
    where: {
      workspaceId_poNumber: {
        workspaceId: workspace.id,
        poNumber: 'PO-0261',
      },
    },
    update: {},
    create: {
      id: '88888888-8888-8888-8888-888888888883',
      workspaceId: workspace.id,
      poNumber: 'PO-0261',
      approvalAllocationId: allocation.id,
      idempotencyKey: 'PO-ALLOC-88888888-8888-8888-8888-888888888882',
      approvedTermsSnapshot: allocation.allocatedTermsSnapshot as any,
      consistencyChecksum: 'a7b9c4d8e2f109876543210fedcba9876543210abcdef1234567890abcdef12',
      poStatus: 'CONFIRMED',
    },
  });

  // Seed Delivery Milestones for PO-0261
  await prisma.deliveryMilestone.upsert({
    where: { id: '99999999-9999-9999-9999-999999999991' },
    update: {},
    create: {
      id: '99999999-9999-9999-9999-999999999991',
      workspaceId: workspace.id,
      purchaseOrderId: po.id,
      milestoneCode: 'MS-CONFIRMED',
      milestoneTitle: 'Purchase Order Issued & Supplier Confirmed',
      milestoneStatus: 'ACHIEVED',
      actualDate: new Date(),
      quantityDelivered: 20.000,
      unit: 'TONNES',
      notes: 'Buyer approval confirmed under rule profile threshold. Supplier confirmed rolling allocation.',
      recordedByUserId: adminUser.id,
    },
  });

  await prisma.deliveryMilestone.upsert({
    where: { id: '99999999-9999-9999-9999-999999999992' },
    update: {},
    create: {
      id: '99999999-9999-9999-9999-999999999992',
      workspaceId: workspace.id,
      purchaseOrderId: po.id,
      milestoneCode: 'MS-DISPATCH',
      milestoneTitle: 'Supplier Yard Dispatch',
      milestoneStatus: 'PENDING',
      notes: 'Vehicle dispatch scheduled from regional stockyard.',
      recordedByUserId: adminUser.id,
    },
  });

  // 11. Seed Open Exceptions
  await prisma.procurementException.upsert({
    where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    update: {},
    create: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      workspaceId: workspace.id,
      exceptionCode: 'EX-001',
      exceptionType: 'DELAYED_DELIVERY',
      severity: 'HIGH',
      status: 'OPEN',
      title: 'Supplier rolling cycle delay notice',
      description: 'Northline Metals reported a 24-hour maintenance shift in rolling cycle. Dispatch shifted from Oct 31 to Nov 1.',
      relatedEntityType: 'PURCHASE_ORDER',
      relatedCode: 'PO-0261',
      assignedUserId: adminUser.id,
    },
  });

  console.log('Operational release candidate fixtures initialized: Project, Requests, Quotes, PO-0261, Milestones, Exceptions.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
