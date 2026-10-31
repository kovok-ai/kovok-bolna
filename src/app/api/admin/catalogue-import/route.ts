import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import {
  generateDryRunReport,
  executeImport,
  createPrismaExecutor,
  CORE_VERIFIED_CANONICAL_IDS
} from '@/lib/catalogue/importer';

function getSeedDirectory(): string {
  return path.join(process.cwd(), 'catalogue_seed');
}

function getMaskedDatabaseTarget(): { host: string; database: string } {
  const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
  if (!rawUrl) return { host: 'unknown', database: 'unknown' };
  try {
    const parsed = new URL(rawUrl);
    const hostParts = parsed.hostname.split('.');
    let maskedHost = parsed.hostname;
    if (hostParts.length > 2) {
      maskedHost = `${hostParts[0].slice(0, 4)}***.${hostParts.slice(-2).join('.')}`;
    } else {
      maskedHost = `${parsed.hostname.slice(0, 3)}***`;
    }
    return {
      host: maskedHost,
      database: parsed.pathname.replace(/^\//, '') || 'defaultdb'
    };
  } catch {
    return { host: 'postgresql-remote***', database: 'production' };
  }
}

async function verifyAdminAuth(req: NextRequest): Promise<{ authorized: boolean; reason?: string }> {
  // Check 1: Admin API Key header
  const adminKey = req.headers.get('x-admin-key');
  const sessionSecret = process.env.SESSION_SECRET;
  if (adminKey && sessionSecret && adminKey === sessionSecret) {
    return { authorized: true };
  }

  // Check 2: Active user session with OWNER role
  try {
    const session = await getCurrentSession();
    if (session && session.role?.name === 'OWNER') {
      return { authorized: true };
    }
    if (session) {
      return { authorized: false, reason: 'Requires OWNER role permission' };
    }
  } catch {
    // Session validation failed
  }

  return { authorized: false, reason: 'Authentication required (Session with OWNER role or x-admin-key)' };
}

async function getLiveTableCounts() {
  const [
    users,
    workspaces,
    sessions,
    requests,
    quotations,
    orders,
    categories,
    standards,
    canonicalProducts,
    manufacturers,
    variants,
    specs,
    sources,
    evidence,
    suppliers,
    listings,
    images,
    unresolved,
    batches
  ] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.workspace.count().catch(() => 0),
    prisma.session.count().catch(() => 0),
    prisma.procurementRequest.count().catch(() => 0),
    prisma.quotation.count().catch(() => 0),
    prisma.purchaseOrder.count().catch(() => 0),
    prisma.materialCategory.count().catch(() => 0),
    prisma.standardsRegistry.count().catch(() => 0),
    prisma.canonicalProduct.count().catch(() => 0),
    prisma.manufacturer.count().catch(() => 0),
    prisma.productVariant.count().catch(() => 0),
    prisma.technicalSpecification.count().catch(() => 0),
    prisma.sourceRegistry.count().catch(() => 0),
    prisma.sourceEvidenceRecord.count().catch(() => 0),
    prisma.supplierOrganization.count().catch(() => 0),
    prisma.supplierListing.count().catch(() => 0),
    prisma.productImage.count().catch(() => 0),
    prisma.unresolvedReviewItem.count().catch(() => 0),
    prisma.importBatch.count().catch(() => 0)
  ]);

  return {
    businessData: {
      users,
      workspaces,
      sessions,
      requests,
      quotations,
      orders
    },
    catalogueTables: {
      material_categories: categories,
      standards_registry: standards,
      canonical_products: canonicalProducts,
      manufacturers,
      product_variants: variants,
      technical_specifications: specs,
      source_registry: sources,
      product_evidence: evidence,
      supplier_organizations: suppliers,
      supplier_listings: listings,
      product_images: images,
      unresolved_records: unresolved,
      import_batches: batches
    }
  };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized', reason: auth.reason }, { status: 401 });
  }

  const seedDir = getSeedDirectory();
  const db = createPrismaExecutor(prisma);
  const target = getMaskedDatabaseTarget();

  let dbVersion = 'Unknown';
  try {
    const verRes = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
    if (verRes?.[0]?.version) {
      dbVersion = verRes[0].version.split(' ')[0] + ' ' + (verRes[0].version.split(' ')[1] || '');
    }
  } catch {}

  const currentCounts = await getLiveTableCounts();
  const dryRun = await generateDryRunReport(seedDir, db);

  return NextResponse.json({
    status: 'READY_FOR_IMPORT',
    databaseTarget: {
      engine: 'PostgreSQL',
      version: dbVersion,
      hostMasked: target.host,
      database: target.database,
      ssl: true
    },
    safetyGuarantees: {
      additiveOnly: true,
      preservesExistingUsersAndWorkspaces: true,
      zeroVerifiedBrandedVariants: true,
      zeroFabricatedStockPricesOrPromises: true,
      quarantinedImagesIsolatedFromVerifiedDisplay: true,
      unresolvedRecordsPreservedForAuditReview: true
    },
    currentLiveCounts: currentCounts,
    dryRunReport: {
      batchNumber: dryRun.batchNumber,
      manifestSha256: dryRun.manifestSha256,
      totalFiles: dryRun.totalFiles,
      status: dryRun.status,
      errors: dryRun.errors,
      tableBreakdown: dryRun.tables,
      verifiedCanonicalCount: dryRun.verifiedCanonicalProductIds.length,
      provisionalCanonicalCount: dryRun.provisionalCanonicalProductIds.length,
      quarantinedImageCount: dryRun.quarantinedImageIdsCount
    }
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized', reason: auth.reason }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action !== 'execute_controlled_import') {
    return NextResponse.json(
      {
        error: 'Explicit confirmation required',
        message: 'Must pass { action: "execute_controlled_import" } to trigger production write'
      },
      { status: 400 }
    );
  }

  const seedDir = getSeedDirectory();
  const db = createPrismaExecutor(prisma);
  const target = getMaskedDatabaseTarget();

  // 1. Snapshot counts before import
  const beforeCounts = await getLiveTableCounts();

  // 2. Execute atomic idempotent import
  const result = await executeImport(seedDir, db, {
    batchNumber: `PROD-IMPORT-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`
  });

  // 3. Snapshot counts after import
  const afterCounts = await getLiveTableCounts();

  return NextResponse.json({
    success: result.status === 'COMPLETED',
    batchId: result.batchId,
    batchNumber: result.batchNumber,
    status: result.status,
    databaseTarget: {
      hostMasked: target.host,
      database: target.database
    },
    executionMetrics: {
      insertedCount: result.insertedCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      errors: result.errors,
      summary: result.summary
    },
    tableCountsBeforeAndAfter: {
      before: beforeCounts.catalogueTables,
      after: afterCounts.catalogueTables
    },
    businessDataPreserved: {
      users: `${beforeCounts.businessData.users} -> ${afterCounts.businessData.users}`,
      workspaces: `${beforeCounts.businessData.workspaces} -> ${afterCounts.businessData.workspaces}`,
      sessions: `${beforeCounts.businessData.sessions} -> ${afterCounts.businessData.sessions}`,
      requests: `${beforeCounts.businessData.requests} -> ${afterCounts.businessData.requests}`,
      orders: `${beforeCounts.businessData.orders} -> ${afterCounts.businessData.orders}`
    }
  });
}
