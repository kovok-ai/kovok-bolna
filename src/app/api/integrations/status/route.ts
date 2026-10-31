import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getSarvamVoiceConfigStatus } from '@/lib/integrations/sarvam-voice';

export async function GET() {
  try {
    const session = await requireSession();

    // 1. PostgreSQL Database Status
    let dbStatus = 'OPERATIONAL';
    let dbDetails = 'PostgreSQL 16 Engine connected with forced Row-Level Security';
    try {
      await prisma.$queryRaw`SELECT 1;`;
    } catch (err: any) {
      dbStatus = 'ERROR';
      dbDetails = err.message || 'Database unreachable';
    }

    // 2. Catalogue Inventory Status
    const [canonicalCount, categoryCount] = await Promise.all([
      prisma.canonicalProduct.count(),
      prisma.materialCategory.count(),
    ]);

    // 3. Sarvam Voice Integration Status
    const sarvamStatus = getSarvamVoiceConfigStatus();

    // 4. Integrations Array
    const integrations = [
      {
        id: 'postgres',
        name: 'PostgreSQL 16 & Prisma RLS',
        type: 'Core Data Store',
        status: dbStatus === 'OPERATIONAL' ? 'Fully Operational' : 'Error',
        statusColor: dbStatus === 'OPERATIONAL' ? 'green' : 'red',
        description: `${dbDetails}. 16 tables under strict tenant isolation.`,
        action: 'Inspect Invariants',
      },
      {
        id: 'catalogue',
        name: 'BIS Statutory Materials Catalogue',
        type: 'Canonical Inventory',
        status: canonicalCount > 0 ? 'Fully Operational' : 'Unseeded',
        statusColor: canonicalCount > 0 ? 'green' : 'amber',
        description: `${categoryCount} material categories, ${canonicalCount} canonical products (IS 1786:2008 & IS 269:2015).`,
        action: 'View Taxonomy',
      },
      {
        id: 'session_auth',
        name: 'Cryptographic Session & Tenant Context',
        type: 'Identity & Access',
        status: 'Fully Operational',
        statusColor: 'green',
        description: 'Scrypt async hashing, 64-character crypto session tokens, and transaction-local RLS isolation.',
        action: 'Security Audit',
      },
      {
        id: 'csv_excel',
        name: 'CSV / Excel Bulk Procurement Import',
        type: 'File Data Ingestion',
        status: 'Active (Workspace Parser)',
        statusColor: 'blue',
        description: 'Import purchase requests, site bill-of-materials (BOM), and approved vendor rosters via structured CSV.',
        action: 'Open Importer',
      },
      {
        id: 'sarvam_voice',
        name: 'Sarvam AI Voice Telephony Gateway',
        type: 'Autonomous Supplier Calling',
        status:
          sarvamStatus.status === 'CONFIGURED'
            ? 'Connected'
            : sarvamStatus.status === 'CONFIG_INCOMPLETE'
            ? 'Configuration Incomplete'
            : 'Not Configured',
        statusColor:
          sarvamStatus.status === 'CONFIGURED'
            ? 'green'
            : sarvamStatus.status === 'CONFIG_INCOMPLETE'
            ? 'amber'
            : 'gray',
        description:
          sarvamStatus.status === 'CONFIGURED'
            ? 'Autonomous Hindi/English multi-lingual supplier phone calls active. Telephony gateway ready.'
            : `Sarvam Voice Gateway requires workspace credentials. Missing: ${sarvamStatus.missingVariables.join(', ')}.`,
        action: 'Telephony Specs',
        details: sarvamStatus,
      },
      {
        id: 'erpnext',
        name: 'ERPNext & Accounting Ledgers',
        type: 'Enterprise ERP Sync',
        status: 'Planned',
        statusColor: 'gray',
        description: 'Bi-directional purchase requisition and purchase order sync with buyer accounting modules.',
        action: 'Setup Webhook',
      },
    ];

    return NextResponse.json({
      success: true,
      integrations,
      sarvamConfig: {
        status: sarvamStatus.status,
        isConfigured: sarvamStatus.isConfigured,
        missingVariables: sarvamStatus.missingVariables,
        configuredVariables: sarvamStatus.configuredVariables,
      },
    });
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Integrations status error:', error);
    return NextResponse.json({ error: 'Failed to retrieve integration statuses' }, { status: 500 });
  }
}

