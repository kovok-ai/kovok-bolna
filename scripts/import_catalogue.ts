import path from 'path';
import { prisma } from '../src/lib/db';
import { generateDryRunReport, executeImport, createPrismaExecutor } from '../src/lib/catalogue/importer';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const seedDir = path.join(process.cwd(), 'catalogue_seed');
  const db = createPrismaExecutor(prisma);

  console.log('=================================================================');
  console.log('   KOVOK CONTROLLED CATALOGUE STAGING IMPORT PIPELINE             ');
  console.log('   Mode:', isDryRun ? 'DRY-RUN (REPORT ONLY)' : 'LIVE IMPORT (DATABASE WRITE)');
  console.log('   Seed Directory:', seedDir);
  console.log('=================================================================\n');

  console.log('1. Validating manifest and disk byte integrity...');
  const report = await generateDryRunReport(seedDir, db);

  if (report.status === 'VALIDATION_FAILED') {
    console.error('Integrity / Preflight Validation FAILED:');
    report.errors.forEach((e) => console.error('  •', e));
    process.exit(1);
  }

  console.log(`Manifest SHA-256: ${report.manifestSha256}`);
  console.log(`Verified canonical products: ${report.verifiedCanonicalProductIds.length}`);
  console.log(`Provisional canonical products: ${report.provisionalCanonicalProductIds.length}`);
  console.log(`Quarantined product images: ${report.quarantinedImageIdsCount}`);
  console.log('\nTable Breakdown:');
  console.table(report.tables);

  if (isDryRun) {
    console.log('Dry-run completed successfully. No changes written to database.');
    process.exit(0);
  }

  console.log('\n2. Executing atomic idempotent import transaction...');
  const result = await executeImport(seedDir, db, { batchNumber: report.batchNumber });
  console.log(`Import Batch Completed: ${result.batchNumber} (ID: ${result.batchId})`);
  console.log(`Inserted: ${result.insertedCount} | Updated: ${result.updatedCount} | Skipped: ${result.skippedCount}`);
  console.log('\nBatch Summary:');
  console.table(result.summary);
  console.log('\nSUCCESS: Catalogue import completed cleanly!');
}

main()
  .catch((err) => {
    console.error('Fatal import error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
