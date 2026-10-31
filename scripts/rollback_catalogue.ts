import { prisma } from '../src/lib/db';
import { rollbackBatch, createPrismaExecutor } from '../src/lib/catalogue/importer';

async function main() {
  const batchArg = process.argv.find((arg) => arg.startsWith('--batch='));
  if (!batchArg) {
    console.error('Usage: npm run catalogue:rollback -- --batch=<BATCH_ID_OR_NUMBER>');
    process.exit(1);
  }

  const batchIdOrNumber = batchArg.split('=')[1];
  console.log('=================================================================');
  console.log('   KOVOK CATALOGUE IMPORT ROLLBACK ENGINE                         ');
  console.log(`   Target Batch: ${batchIdOrNumber}`);
  console.log('=================================================================\n');

  const db = createPrismaExecutor(prisma);
  const result = await rollbackBatch(batchIdOrNumber, db);
  console.log(`Rollback Status: ${result.status}`);
  console.log(`Reverted Inserts: ${result.revertedInsertsCount}`);
  console.log(`Reverted Updates: ${result.revertedUpdatesCount}`);
  console.log(`Skipped (Protected/Locked): ${result.skippedCount}`);

  if (result.errors.length > 0) {
    console.warn('Encountered non-fatal warnings:');
    result.errors.forEach((e) => console.warn('  •', e));
  }

  console.log('\nSUCCESS: Batch rollback completed.');
}

main()
  .catch((err) => {
    console.error('Fatal rollback error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
