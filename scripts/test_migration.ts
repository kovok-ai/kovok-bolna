import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

async function testMigration() {
  const db = new PGlite();
  console.log('Testing migrations in PGlite...');

  const m0 = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/20261030000000_init/migration.sql'), 'utf8');
  const m1 = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/20261030000001_security_and_invariants/migration.sql'), 'utf8');
  const m2 = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/20261030000002_catalogue_and_procurement_intake/migration.sql'), 'utf8');

  await db.exec(m0);
  console.log('Migration 0 applied.');
  await db.exec(m1);
  console.log('Migration 1 applied.');
  await db.exec(m2);
  console.log('Migration 2 applied successfully!');

  const tables = await db.query<{ tablename: string }>(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
  `);
  console.log('Public tables count:', tables.rows.length);
  console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));
}

testMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
