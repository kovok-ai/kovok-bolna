import { execSync } from 'child_process';
import path from 'path';

async function main() {
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl || dbUrl === '[SENSITIVE]' || (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://'))) {
    console.log('[Deploy Migrations] No valid DATABASE_URL or DIRECT_URL set. Skipping migrations.');
    return;
  }

  console.log('[Deploy Migrations] Connecting to database and running pending Prisma migrations...');
  try {
    // Run prisma migrate deploy
    const prismaCmd = `npx prisma migrate deploy --schema=prisma/schema.prisma`;
    execSync(prismaCmd, { stdio: 'inherit', env: process.env });
    console.log('[Deploy Migrations] Database migrations completed successfully.');

    // Run safe demo account seeding
    console.log('[Deploy Migrations] Checking demo evaluation account setup...');
    const seedCmd = `npx tsx scripts/seed_demo_production.ts`;
    execSync(seedCmd, { stdio: 'inherit', env: process.env });
  } catch (error: any) {
    console.error('[Deploy Migrations] Error applying migrations:', error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Deploy Migrations] Fatal error:', err);
  process.exit(1);
});
