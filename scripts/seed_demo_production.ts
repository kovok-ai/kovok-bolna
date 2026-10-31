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

    // 3. Safe idempotent upsert of Demo User (demo@kovok.test)
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

    // 4. Provision tenant resources under strict RLS context
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_workspace_id = '${workspace.id}';`);

      // Safe idempotent upsert of OWNER role
      const ownerRole = await tx.workspaceRole.upsert({
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

      // Safe idempotent upsert of Workspace Membership
      await tx.workspaceMembership.upsert({
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

      // Safe idempotent upsert of Default Project & Sites
      const defaultProject = await tx.project.upsert({
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

      await tx.projectSite.upsert({
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

      // Safe idempotent upsert of statutory GST tax rules
      await tx.taxRateRule.upsert({
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

      await tx.taxRateRule.upsert({
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

      // -------------------------------------------------------------------------
      // Curated Evaluation Experience (Isolated to Concrete & Co. Workspace)
      // -------------------------------------------------------------------------
      console.log('[Safe Seed] Provisioning curated evaluation dataset in evaluation workspace...');

      // a. Procurement Requests (2-3 realistic requests using researched catalogue)
      const req1 = await tx.procurementRequest.upsert({
        where: {
          workspaceId_requestCode: {
            workspaceId: workspace.id,
            requestCode: 'KOV-REQ-0001',
          },
        },
        update: {},
        create: {
          id: '55555555-5555-5555-5555-555555555501',
          workspaceId: workspace.id,
          siteId: '44444444-4444-4444-4444-444444444441',
          requestCode: 'KOV-REQ-0001',
          materialCategoryId: 'tmt_rebar',
          canonicalProductId: 'CP-TMT-500D-12MM',
          targetGrade: 'Fe 500D',
          targetDiameterMm: 12.00,
          quantityValue: 25.000,
          quantityUnit: 'TONNES',
          requestStatus: 'MATCHED_VERIFIED',
          derivedCalculations: {
            theoreticalMassKgPerM: 0.888,
            standardLengthM: 12,
            massPerBarKg: 10.656,
            barsPerTonne: 93.84,
            totalPieces: 2346,
            weighbridgeRequired: true,
          },
          buyerNotes: 'Phase 2 Foundation raft reinforcement. Delivery required in 24t flatbed trailer. Gate timing 08:00 AM - 07:00 PM.',
          createdByUserId: demoUser.id,
        },
      });

      const req2 = await tx.procurementRequest.upsert({
        where: {
          workspaceId_requestCode: {
            workspaceId: workspace.id,
            requestCode: 'KOV-REQ-0002',
          },
        },
        update: {},
        create: {
          id: '55555555-5555-5555-5555-555555555502',
          workspaceId: workspace.id,
          siteId: '44444444-4444-4444-4444-444444444441',
          requestCode: 'KOV-REQ-0002',
          materialCategoryId: 'cement',
          canonicalProductId: 'CP-CEM-OPC-53',
          targetGrade: 'OPC 53',
          quantityValue: 500.000,
          quantityUnit: 'BAGS',
          requestStatus: 'MATCHED_VERIFIED',
          derivedCalculations: {
            bagsPerTonne: 20,
            totalMetricTonnes: 25.0,
            bagWeightKg: 50,
            standard: 'IS 269:2015',
          },
          buyerNotes: 'Structural column pour. Fresh batch with manufacturer test certificate required upon gate entry.',
          createdByUserId: demoUser.id,
        },
      });

      await tx.procurementRequest.upsert({
        where: {
          workspaceId_requestCode: {
            workspaceId: workspace.id,
            requestCode: 'KOV-REQ-0003',
          },
        },
        update: {},
        create: {
          id: '55555555-5555-5555-5555-555555555503',
          workspaceId: workspace.id,
          siteId: '44444444-4444-4444-4444-444444444441',
          requestCode: 'KOV-REQ-0003',
          materialCategoryId: 'tmt_rebar',
          canonicalProductId: 'CP-TMT-500D-16MM',
          targetGrade: 'Fe 500D',
          targetDiameterMm: 16.00,
          quantityValue: 40.000,
          quantityUnit: 'TONNES',
          requestStatus: 'MATCHED_VERIFIED',
          derivedCalculations: {
            theoreticalMassKgPerM: 1.578,
            standardLengthM: 12,
            massPerBarKg: 18.936,
            barsPerTonne: 52.81,
            totalPieces: 2112,
            weighbridgeRequired: true,
          },
          buyerNotes: 'Main vertical column reinforcement bars. Staggered delivery schedule.',
          createdByUserId: demoUser.id,
        },
      });

      // b. Illustrative Supplier Quotations (Apples-to-apples comparison for KOV-REQ-0001)
      await tx.quotation.upsert({
        where: { id: '66666666-6666-6666-6666-666666666601' },
        update: {},
        create: {
          id: '66666666-6666-6666-6666-666666666601',
          workspaceId: workspace.id,
          procurementRequestId: req1.id,
          supplierId: 'SUP-TATA-DEALER-NCR', // Gupta Iron & Steel Co (Tata Tiscon Authorized Distributor)
          quotationReference: 'QUO-KOV-0001-01',
          source: 'MANUAL_ENTRY',
          materialSpecification: 'Tata Tiscon 12mm Fe 500D TMT Rebar (IS 1786:2008)',
          canonicalProductId: 'CP-TMT-500D-12MM',
          brand: 'Tata Tiscon',
          grade: 'Fe 500D',
          diameterMm: 12.00,
          quantityValue: 25.000,
          quantityUnit: 'TONNES',
          quotedBaseRate: 54500.00,
          gstRate: 18.00,
          gstType: 'CGST_SGST',
          freightCharges: 12500.00,
          unloadingCharges: 2500.00,
          otherCharges: 0.00,
          totalDeliveredAmount: 1622750.00,
          leadTimeDays: 2,
          deliveryEta: '2 business days from order confirmation',
          paymentTerms: '30-day corporate trade credit upon delivery & weighment verification',
          validityDays: 7,
          status: 'PENDING_REVIEW',
          isComparable: true,
          reviewNotes: 'Illustrative evaluation record · Not supplier-confirmed. Full delivered breakdown with 30-day credit facility.',
        },
      });

      await tx.quotation.upsert({
        where: { id: '66666666-6666-6666-6666-666666666602' },
        update: {},
        create: {
          id: '66666666-6666-6666-6666-666666666602',
          workspaceId: workspace.id,
          procurementRequestId: req1.id,
          supplierId: 'SUP-INFRA-MKT', // Infra.Market (Hella Infra Market Pvt Ltd)
          quotationReference: 'QUO-KOV-0001-02',
          source: 'MANUAL_ENTRY',
          materialSpecification: 'JSW Neosteel 12mm Fe 500D TMT Rebar (IS 1786:2008)',
          canonicalProductId: 'CP-TMT-500D-12MM',
          brand: 'JSW Neosteel',
          grade: 'Fe 500D',
          diameterMm: 12.00,
          quantityValue: 25.000,
          quantityUnit: 'TONNES',
          quotedBaseRate: 53800.00,
          gstRate: 18.00,
          gstType: 'CGST_SGST',
          freightCharges: 15000.00,
          unloadingCharges: 0.00,
          otherCharges: 0.00,
          totalDeliveredAmount: 1602100.00,
          leadTimeDays: 3,
          deliveryEta: '3 business days from order confirmation',
          paymentTerms: '100% advance RTGS prior to truck dispatch',
          validityDays: 5,
          status: 'PENDING_REVIEW',
          isComparable: true,
          reviewNotes: 'Illustrative evaluation record · Not supplier-confirmed. Lower landed price (-₹20,650 vs Tata Tiscon); requires upfront payment.',
        },
      });

      // Quotation for Cement Request KOV-REQ-0002 (Approved)
      const quoteCement = await tx.quotation.upsert({
        where: { id: '66666666-6666-6666-6666-666666666603' },
        update: {},
        create: {
          id: '66666666-6666-6666-6666-666666666603',
          workspaceId: workspace.id,
          procurementRequestId: req2.id,
          supplierId: 'SUP-ULTRATECH-DEALER-MUMBAI', // Shree Balaji Building Materials (UltraTech Authorized Stockist)
          quotationReference: 'QUO-KOV-0002-01',
          source: 'MANUAL_ENTRY',
          materialSpecification: 'UltraTech OPC 53 Grade Cement (50kg Bag, IS 269:2015)',
          canonicalProductId: 'CP-CEM-OPC-53',
          brand: 'UltraTech Cement',
          grade: 'OPC 53',
          quantityValue: 500.000,
          quantityUnit: 'BAGS',
          quotedBaseRate: 380.00,
          gstRate: 28.00,
          gstType: 'CGST_SGST',
          freightCharges: 5000.00,
          unloadingCharges: 2500.00,
          otherCharges: 0.00,
          totalDeliveredAmount: 250700.00,
          leadTimeDays: 1,
          deliveryEta: 'Next day morning delivery (09:00 AM)',
          paymentTerms: '15-day commercial trade credit',
          validityDays: 7,
          status: 'APPROVED',
          isComparable: true,
          reviewNotes: 'Illustrative evaluation record · Approved buyer baseline for foundation casting batch.',
        },
      });

      // c. Approval & Allocation for PO Generation
      const approval = await tx.approval.upsert({
        where: { id: '77777777-7777-7777-7777-777777777701' },
        update: {},
        create: {
          id: '77777777-7777-7777-7777-777777777701',
          workspaceId: workspace.id,
          requestCode: 'KOV-REQ-0002',
          approvedByUserId: demoUser.id,
          totalApprovedQuantity: 500.000,
          quantityUnit: 'BAGS',
          totalApprovedAmount: 250700.00,
          approvedSpecifications: {
            product: 'UltraTech OPC 53 Grade Cement',
            standard: 'IS 269:2015',
            packaging: '50kg HDPE laminated bag',
          },
          approvalStatus: 'APPROVED',
        },
      });

      const allocation = await tx.approvalAllocation.upsert({
        where: { id: '77777777-7777-7777-7777-777777777702' },
        update: {},
        create: {
          id: '77777777-7777-7777-7777-777777777702',
          approvalId: approval.id,
          workspaceId: workspace.id,
          quotationReference: 'QUO-KOV-0002-01',
          supplierName: 'Shree Balaji Building Materials (UltraTech Authorized Stockist)',
          allocatedQuantity: 500.000,
          allocatedPayableAmount: 250700.00,
          allocatedTermsSnapshot: {
            quotationId: quoteCement.id,
            quotationReference: 'QUO-KOV-0002-01',
            supplierName: 'Shree Balaji Building Materials (UltraTech Authorized Stockist)',
            baseRate: 380.00,
            gstRate: 28.00,
            freightCharges: 5000.00,
            unloadingCharges: 2500.00,
            totalDeliveredAmount: 250700.00,
            deliverySite: 'Site A — Gurugram',
            paymentTerms: '15-day commercial trade credit',
          },
        },
      });

      // d. Purchase Order: PO-0261
      const approvedTerms = {
        poNumber: 'PO-0261',
        quotationReference: 'QUO-KOV-0002-01',
        supplierName: 'Shree Balaji Building Materials (UltraTech Authorized Stockist)',
        materialSpecification: 'UltraTech OPC 53 Grade Cement (50kg Bag, IS 269:2015)',
        quantityValue: 500.0,
        quantityUnit: 'BAGS',
        totalDeliveredAmount: 250700.0,
        paymentTerms: '15-day commercial trade credit',
        deliveryEta: 'Immediate dispatch',
        siteName: 'Site A — Gurugram',
        siteCity: 'Gurugram',
        sitePinCode: '122018',
      };
      const poChecksum = crypto.createHash('sha256').update(JSON.stringify(approvedTerms)).digest('hex');

      const po = await tx.purchaseOrder.upsert({
        where: {
          workspaceId_poNumber: {
            workspaceId: workspace.id,
            poNumber: 'PO-0261',
          },
        },
        update: {},
        create: {
          id: '88888888-8888-8888-8888-888888888801',
          workspaceId: workspace.id,
          poNumber: 'PO-0261',
          approvalAllocationId: allocation.id,
          idempotencyKey: 'PO-ALLOC-66666666-6666-6666-6666-666666666603',
          approvedTermsSnapshot: approvedTerms,
          consistencyChecksum: poChecksum,
          poStatus: 'CONFIRMED',
        },
      });

      // e. Delivery Milestones
      await tx.deliveryMilestone.upsert({
        where: { id: '99999999-9999-9999-9999-999999999901' },
        update: {},
        create: {
          id: '99999999-9999-9999-9999-999999999901',
          workspaceId: workspace.id,
          purchaseOrderId: po.id,
          milestoneCode: 'MS-DISPATCH',
          milestoneTitle: 'Plant Dispatch & E-Way Bill Verified',
          milestoneStatus: 'ACHIEVED',
          targetDate: new Date(Date.now() - 4 * 3600 * 1000),
          actualDate: new Date(Date.now() - 3 * 3600 * 1000),
          quantityDelivered: 500.000,
          unit: 'BAGS',
          notes: 'Dispatched from Panipat mixing terminal via Vehicle HR-55-AB-1234. E-Way Bill verified.',
          recordedByUserId: demoUser.id,
        },
      });

      await tx.deliveryMilestone.upsert({
        where: { id: '99999999-9999-9999-9999-999999999902' },
        update: {},
        create: {
          id: '99999999-9999-9999-9999-999999999902',
          workspaceId: workspace.id,
          purchaseOrderId: po.id,
          milestoneCode: 'MS-GATE-ENTRY',
          milestoneTitle: 'Site Gate Entry & Weighbridge Reconciled',
          milestoneStatus: 'PENDING',
          targetDate: new Date(Date.now() + 12 * 3600 * 1000),
          quantityDelivered: null,
          unit: 'BAGS',
          notes: 'Awaiting site arrival at Sector 29 Gurugram yard. Inspection team on alert.',
        },
      });

      // f. Procurement Exception (Clear reason, resolution action & notes)
      await tx.procurementException.upsert({
        where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        update: {},
        create: {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          workspaceId: workspace.id,
          exceptionCode: 'EX-2026-001',
          exceptionType: 'DELAYED_DELIVERY',
          severity: 'MEDIUM',
          status: 'OPEN',
          title: 'Transit delay due to regional commercial vehicle restrictions on NH-48',
          description: 'Delivery truck HR-55-AB-1234 carrying 500 bags of UltraTech OPC 53 cement for PO-0261 was held at the border checkpoint due to peak-hour heavy commercial vehicle (HCV) entry restrictions into Gurugram. Expected transit delay is ~3.5 hours.',
          relatedEntityType: 'PURCHASE_ORDER',
          relatedEntityId: po.id,
          relatedCode: 'PO-0261',
          assignedUserId: demoUser.id,
          resolutionAction: 'Adjusted site casting window from 10:00 AM to 14:00 PM; driver cleared checkpoint at 08:45 AM.',
          resolutionNotes: 'Site engineer Manoj Kumar notified. Concrete pouring crew rescheduled without cost overrun.',
        },
      });
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
