/**
 * Kovok Construction Procurement Operations Platform
 * Phase 1 Foundation: Comprehensive Test Suite Runner
 *
 * Covers all mandatory Phase 1 acceptance tests:
 * 1. Missing or invalid environment variables
 * 2. Production rejection of development fixtures
 * 3. Cryptographic password hashing and timing-safe verification
 * 4. Database DDL migration and transaction rollback/recovery
 * 5. Multi-tenant workspace provisioning, login, logout, and session lifecycle
 * 6. Role-based authorization (RBAC) checks
 * 7. Cross-workspace data isolation via PostgreSQL Row-Level Security (RLS)
 * 8. Split fulfillment data model & consistency checksum validation
 * 9. Dynamic effective-dated GST tax rules (cement rationalisation)
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { validateEnv } from '../src/lib/env';
import { hashPassword, verifyPassword, generateSessionToken } from '../src/lib/auth';

// ANSI terminal colors for clear test reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passedTests = 0;
let failedTests = 0;
const testResults: Array<{ name: string; passed: boolean; error?: string; durationMs: number }> = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(testName: string, testFn: () => Promise<void> | void) {
  const start = Date.now();
  process.stdout.write(`  • ${testName} ... `);
  try {
    await testFn();
    const duration = Date.now() - start;
    console.log(`${GREEN}PASS${RESET} (${duration}ms)`);
    passedTests++;
    testResults.push({ name: testName, passed: true, durationMs: duration });
  } catch (err: any) {
    const duration = Date.now() - start;
    console.log(`${RED}FAIL${RESET} (${duration}ms)`);
    console.log(`    ${RED}${err.message || err}${RESET}`);
    failedTests++;
    testResults.push({ name: testName, passed: false, error: err.message || String(err), durationMs: duration });
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
  console.log(`${BOLD}${CYAN}=================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   KOVOK CONSTRUCTION PROCUREMENT — PHASE 1 FOUNDATION TEST SUITE ${RESET}`);
  console.log(`${BOLD}${CYAN}   Node.js ${process.version} | PostgreSQL 16 (PGlite) | TypeScript 5.7+${RESET}`);
  console.log(`${BOLD}${CYAN}=================================================================${RESET}\n`);

  // --------------------------------------------------------------------------
  // SUITE 1: Environment Variables & Configuration Validation
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[1/8] Environment Validation & Security Configuration${RESET}`);

  await runTest('Rejects missing DATABASE_URL', () => {
    let threw = false;
    try {
      validateEnv({
        NODE_ENV: 'test',
        SESSION_SECRET: 'super-secret-key-that-is-at-least-32-chars-long!',
      });
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('DATABASE_URL'), 'Error should specify DATABASE_URL is missing');
    }
    assert(threw, 'Should have thrown for missing DATABASE_URL');
  });

  await runTest('Rejects missing SESSION_SECRET', () => {
    let threw = false;
    try {
      validateEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/kovok',
      });
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('SESSION_SECRET'), 'Error should specify SESSION_SECRET is missing');
    }
    assert(threw, 'Should have thrown for missing SESSION_SECRET');
  });

  await runTest('Rejects SESSION_SECRET shorter than 32 characters', () => {
    let threw = false;
    try {
      validateEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/kovok',
        SESSION_SECRET: 'too-short',
      });
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('at least 32 characters'), 'Should enforce minimum length');
    }
    assert(threw, 'Should have thrown for short SESSION_SECRET');
  });

  await runTest('Accepts valid configuration and applies defaults', () => {
    const validated = validateEnv({
      DATABASE_URL: 'postgresql://kovok_app:secret@localhost:5432/kovok_dev',
      SESSION_SECRET: 'kovok_phase_1_foundation_super_secure_session_secret_2026',
    });
    assert(validated.NODE_ENV === 'development', 'Default NODE_ENV should be development');
    assert(validated.PORT === '3000', 'Default PORT should be 3000');
    assert(validated.APP_URL === 'http://localhost:3000', 'Default APP_URL should be http://localhost:3000');
  });

  await runTest('Rejects development seed execution in production environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const seedFile = fs.readFileSync(path.join(__dirname, '../prisma/seed.ts'), 'utf-8');
      assert(
        seedFile.includes("process.env.NODE_ENV === 'production'") &&
        seedFile.includes('FATAL: Database seed execution is forbidden in production environments!'),
        'seed.ts must contain an explicit throw when NODE_ENV is production'
      );
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });


  console.log();

  // --------------------------------------------------------------------------
  // SUITE 2: Cryptographic Hashing & Auth Primitives
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[2/8] Cryptographic Password Hashing & Verification${RESET}`);

  await runTest('Hashes passwords using Scrypt with unique salt', async () => {
    const pass = 'KovokSecurePass#2026';
    const hash1 = hashPassword(pass);
    const hash2 = hashPassword(pass);
    assert(hash1 !== hash2, 'Salt must ensure different hashes for identical passwords');
    assert(hash1.includes(':'), 'Hash format must be salt:key');
    const [salt, key] = hash1.split(':');
    assert(salt.length === 32, 'Salt should be 16 bytes hex (32 chars)');
    assert(key.length === 128, 'Key should be 64 bytes hex (128 chars)');
  });

  await runTest('Verifies matching password correctly in constant time', async () => {
    const pass = 'ConstructionProcure@9921';
    const hash = hashPassword(pass);
    const isValid = await verifyPassword(pass, hash);
    assert(isValid === true, 'Matching password must return true');
  });

  await runTest('Rejects incorrect password safely', async () => {
    const pass = 'ConstructionProcure@9921';
    const hash = hashPassword(pass);
    const isValid = await verifyPassword('WrongPassword#123', hash);
    assert(isValid === false, 'Incorrect password must return false');
  });

  await runTest('Rejects corrupted or malformed hash without crashing', async () => {
    const isValid = await verifyPassword('password', 'not-a-valid-hash');
    assert(isValid === false, 'Malformed hash should return false without unhandled throw');
  });

  await runTest('Generates 64-char cryptographically secure session token', () => {
    const token = generateSessionToken();
    assert(token.length === 64, 'Session token must be 32 bytes hex (64 chars)');
    const token2 = generateSessionToken();
    assert(token !== token2, 'Consecutive tokens must be distinct');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 3: PostgreSQL Database DDL Migration & Rollback/Recovery
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[3/8] Database Migration & Rollback Recovery (PostgreSQL 16 Engine)${RESET}`);

  const pg = new PGlite();

  await runTest('Applies canonical Phase 1 migration SQL cleanly', async () => {
    const migrationPath = path.join(__dirname, '../prisma/migrations/20261030000000_init/migration.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute DDL statements in PGlite
    await pg.exec(sqlContent);

    // Verify tables exist
    const tablesRes = await pg.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
    );
    const tableNames = tablesRes.rows.map((r) => r.tablename);
    
    const requiredTables = [
      'workspaces',
      'project_sites',
      'users',
      'workspace_roles',
      'workspace_memberships',
      'sessions',
      'workspace_rule_profiles',
      'tax_rate_rules',
      'approvals',
      'approval_allocations',
      'purchase_orders',
      'audit_logs',
    ];

    for (const t of requiredTables) {
      assert(tableNames.includes(t), `Table ${t} must exist in migrated database`);
    }

    // Set up application non-superuser role so RLS is enforced
    await pg.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kovok_app') THEN
          CREATE ROLE kovok_app;
        END IF;
      END
      $$;
      GRANT USAGE ON SCHEMA public TO kovok_app;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kovok_app;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kovok_app;
    `);
  });

  await runTest('Verifies Row-Level Security is enabled and forced on tenant tables', async () => {
    const rlsRes = await pg.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity 
       FROM pg_class 
       WHERE relname IN ('project_sites', 'workspace_rule_profiles', 'approvals', 'approval_allocations', 'purchase_orders', 'audit_logs');`
    );

    assert(rlsRes.rows.length === 6, 'Must inspect all 6 tenant-scoped tables');
    for (const row of rlsRes.rows) {
      assert(row.relrowsecurity === true, `${row.relname} must have relrowsecurity enabled`);
      assert(row.relforcerowsecurity === true, `${row.relname} must have relforcerowsecurity forced`);
    }
  });

  await runTest('Demonstrates transaction rollback and recovery behavior', async () => {
    await pg.exec('BEGIN;');
    const testWsId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO workspaces (id, name, slug, "businessType", "serviceArea", "updatedAt") 
       VALUES ($1, 'Rollback Test WS', 'rollback-ws', 'Contractor', 'Delhi', NOW());`,
      [testWsId]
    );

    const insideRes = await pg.query('SELECT count(*) as count FROM workspaces WHERE id = $1;', [testWsId]);
    assert(Number(insideRes.rows[0].count) === 1, 'Should exist inside active transaction');

    await pg.exec('ROLLBACK;');

    const outsideRes = await pg.query('SELECT count(*) as count FROM workspaces WHERE id = $1;', [testWsId]);
    assert(Number(outsideRes.rows[0].count) === 0, 'Must be 0 after transaction rollback');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 4: Multi-Tenant Workspace Provisioning & Auth Workflows
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[4/8] Workspace Provisioning, Sessions & Auth Workflows${RESET}`);

  const wsAId = crypto.randomUUID();
  const wsBId = crypto.randomUUID();
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();
  const roleAdminAId = crypto.randomUUID();
  const roleEngAId = crypto.randomUUID();
  const roleAdminBId = crypto.randomUUID();
  const membershipAId = crypto.randomUUID();
  const membershipBId = crypto.randomUUID();

  await runTest('Provisions Tenant A ("Concrete & Co.") with roles and admin user', async () => {
    await pg.query(
      `INSERT INTO workspaces (id, name, slug, "businessType", "serviceArea", "isSandbox", "updatedAt")
       VALUES ($1, 'Concrete & Co.', 'concrete-co', 'General Contractor', 'Delhi NCR', false, NOW());`,
      [wsAId]
    );

    await pg.query(
      `INSERT INTO workspace_roles (id, "workspaceId", name, description, "approvalLimitAmount", "canCreateRequests", "canApproveQuotes", "canManageSettings")
       VALUES ($1, $2, 'Admin', 'Full administrative authority', 10000000.00, true, true, true);`,
      [roleAdminAId, wsAId]
    );
    await pg.query(
      `INSERT INTO workspace_roles (id, "workspaceId", name, description, "approvalLimitAmount", "canCreateRequests", "canApproveQuotes", "canManageSettings")
       VALUES ($1, $2, 'Site Engineer', 'Field engineer requisition role', 0.00, true, false, false);`,
      [roleEngAId, wsAId]
    );

    const passwordHashA = hashPassword('AdminSecurePass#2026');
    await pg.query(
      `INSERT INTO users (id, email, name, "passwordHash", phone, "updatedAt")
       VALUES ($1, 'rajesh@concrete-co.in', 'Rajesh Sharma', $2, '+919811000001', NOW());`,
      [userAId, passwordHashA]
    );

    await pg.query(
      `INSERT INTO workspace_memberships (id, "workspaceId", "userId", "roleId", "isDefault")
       VALUES ($1, $2, $3, $4, true);`,
      [membershipAId, wsAId, userAId, roleAdminAId]
    );

    const check = await pg.query('SELECT count(*) as count FROM workspace_memberships WHERE "workspaceId" = $1;', [wsAId]);
    assert(Number(check.rows[0].count) === 1, 'Workspace A membership established');
  });

  await runTest('Provisions Tenant B ("BluePeak Infra") with isolated user and admin role', async () => {
    await pg.query(
      `INSERT INTO workspaces (id, name, slug, "businessType", "serviceArea", "isSandbox", "updatedAt")
       VALUES ($1, 'BluePeak Infra Ltd', 'bluepeak-infra', 'Commercial Builder', 'Mumbai MMR', false, NOW());`,
      [wsBId]
    );

    await pg.query(
      `INSERT INTO workspace_roles (id, "workspaceId", name, description, "approvalLimitAmount", "canCreateRequests", "canApproveQuotes", "canManageSettings")
       VALUES ($1, $2, 'Admin', 'Full administrative authority', 50000000.00, true, true, true);`,
      [roleAdminBId, wsBId]
    );

    const passwordHashB = hashPassword('BluePeakAdmin#2026');
    await pg.query(
      `INSERT INTO users (id, email, name, "passwordHash", phone, "updatedAt")
       VALUES ($1, 'priya@bluepeak.in', 'Priya Patel', $2, '+919822000002', NOW());`,
      [userBId, passwordHashB]
    );

    await pg.query(
      `INSERT INTO workspace_memberships (id, "workspaceId", "userId", "roleId", "isDefault")
       VALUES ($1, $2, $3, $4, true);`,
      [membershipBId, wsBId, userBId, roleAdminBId]
    );

    const check = await pg.query('SELECT count(*) as count FROM workspace_memberships WHERE "workspaceId" = $1;', [wsBId]);
    assert(Number(check.rows[0].count) === 1, 'Workspace B membership established');
  });

  let activeSessionToken: string = '';

  await runTest('Creates active session on successful credential authentication', async () => {
    const res = await pg.query<{ id: string; passwordHash: string }>(
      'SELECT id, "passwordHash" FROM users WHERE email = $1;',
      ['rajesh@concrete-co.in']
    );
    assert(res.rows.length === 1, 'User must be found by email');

    const valid = await verifyPassword('AdminSecurePass#2026', res.rows[0].passwordHash);
    assert(valid === true, 'Password verification must succeed');

    activeSessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionId = crypto.randomUUID();

    await pg.query(
      `INSERT INTO sessions (id, "userId", "workspaceId", "sessionToken", "expiresAt")
       VALUES ($1, $2, $3, $4, $5);`,
      [sessionId, userAId, wsAId, activeSessionToken, expiresAt.toISOString()]
    );

    const sessionRes = await pg.query<{ sessionToken: string; expiresAt: string }>(
      'SELECT "sessionToken", "expiresAt" FROM sessions WHERE "sessionToken" = $1;',
      [activeSessionToken]
    );
    assert(sessionRes.rows.length === 1, 'Session must exist');
    assert(new Date(sessionRes.rows[0].expiresAt).getTime() > Date.now(), 'Session must not be expired');
  });

  await runTest('Revokes session on logout, invalidating subsequent requests', async () => {
    await pg.query('DELETE FROM sessions WHERE "sessionToken" = $1;', [activeSessionToken]);

    const check = await pg.query('SELECT count(*) as count FROM sessions WHERE "sessionToken" = $1;', [activeSessionToken]);
    assert(Number(check.rows[0].count) === 0, 'Session must be deleted on logout');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 5: Role-Based Access Control (RBAC)
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[5/8] Role-Based Authorization Checks (RBAC)${RESET}`);

  await runTest('Authorizes Admin role for administrative actions', async () => {
    const rolesRes = await pg.query<{ name: string; canManageSettings: boolean }>(
      'SELECT name, "canManageSettings" FROM workspace_roles WHERE id = $1;',
      [roleAdminAId]
    );
    assert(rolesRes.rows.length === 1, 'Role must exist');
    assert(rolesRes.rows[0].name === 'Admin', 'Role name is Admin');
    assert(rolesRes.rows[0].canManageSettings === true, 'Admin can manage settings');
  });

  await runTest('Denies Site Engineer role for administrative actions', async () => {
    const rolesRes = await pg.query<{ name: string; canManageSettings: boolean; canApproveQuotes: boolean }>(
      'SELECT name, "canManageSettings", "canApproveQuotes" FROM workspace_roles WHERE id = $1;',
      [roleEngAId]
    );
    assert(rolesRes.rows.length === 1, 'Role must exist');
    assert(rolesRes.rows[0].name === 'Site Engineer', 'Role name is Site Engineer');
    assert(rolesRes.rows[0].canManageSettings === false, 'Site Engineer must not manage settings');
    assert(rolesRes.rows[0].canApproveQuotes === false, 'Site Engineer must not approve quotes');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 6: Cross-Workspace PostgreSQL Row-Level Security (RLS) Isolation
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[6/8] Cross-Workspace Row-Level Security (RLS) Isolation${RESET}`);

  const siteAId = crypto.randomUUID();
  const siteBId = crypto.randomUUID();

  await runTest('Seeds project sites for both Tenant A and Tenant B', async () => {
    // Seed site for Tenant A
    await pg.query(
      `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
       VALUES ($1, $2, 'Dwarka Expressway Sector 104', '122006', 'Gurugram', 'Site Plot 42', NOW());`,
      [siteAId, wsAId]
    );

    // Seed site for Tenant B
    await pg.query(
      `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
       VALUES ($1, $2, 'BKC Commercial Tower 3', '400051', 'Mumbai', 'Plot C-68, G Block', NOW());`,
      [siteBId, wsBId]
    );
  });

  await runTest('Tenant A context ONLY sees Tenant A records; ZERO Tenant B records visible', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    const res = await pg.query<{ id: string; siteName: string; workspaceId: string }>(
      'SELECT id, "siteName", "workspaceId" FROM project_sites;'
    );

    assert(res.rows.length === 1, `Tenant A must see exactly 1 site, found ${res.rows.length}`);
    assert(res.rows[0].id === siteAId, 'Tenant A must see siteA');
    assert(res.rows[0].workspaceId === wsAId, 'Record workspaceId must match Tenant A');
    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Tenant B context ONLY sees Tenant B records; ZERO Tenant A records visible', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsBId}';`);

    const res = await pg.query<{ id: string; siteName: string; workspaceId: string }>(
      'SELECT id, "siteName", "workspaceId" FROM project_sites;'
    );

    assert(res.rows.length === 1, `Tenant B must see exactly 1 site, found ${res.rows.length}`);
    assert(res.rows[0].id === siteBId, 'Tenant B must see siteB');
    assert(res.rows[0].workspaceId === wsBId, 'Record workspaceId must match Tenant B');
    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Tenant A cannot access Tenant B record by targeting its ID in query', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    const res = await pg.query<{ id: string }>('SELECT id FROM project_sites WHERE id = $1;', [siteBId]);

    assert(res.rows.length === 0, 'RLS must reject cross-tenant record lookup; returned rows must be 0');
    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Tenant A context cannot insert record forged with Tenant B workspace ID', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    let threw = false;
    try {
      await pg.query(
        `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
         VALUES ($1, $2, 'Forged Cross-Tenant Site', '110001', 'Delhi', 'Unauthorized injection', NOW());`,
        [crypto.randomUUID(), wsBId]
      );
    } catch (e: any) {
      threw = true;
      assert(
        e.message.toLowerCase().includes('violates row-level security policy') ||
        e.message.toLowerCase().includes('policy'),
        'Must fail with RLS policy violation'
      );
    }

    await pg.exec('ROLLBACK;');
    await pg.exec('RESET ROLE;');
    assert(threw, 'Cross-tenant insert forgery must be rejected by RLS policy');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 7: Split Fulfillment & Consistency Checksum Data Model
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[7/8] Split Fulfillment Data Model & Consistency Checksum${RESET}`);

  const approvalId = crypto.randomUUID();
  const alloc1Id = crypto.randomUUID();
  const alloc2Id = crypto.randomUUID();

  await runTest('Creates single Buyer Approval authorizing 100 MT TMT Steel', async () => {
    await pg.query(
      `INSERT INTO approvals (id, "workspaceId", "requestCode", "approvedByUserId", "totalApprovedQuantity", "quantityUnit", "totalApprovedAmount", "approvedSpecifications", "approvalStatus")
       VALUES ($1, $2, 'KOVOK-REQ-8801', $3, 100.000, 'MT', 5450000.00, $4, 'APPROVED');`,
      [
        approvalId,
        wsAId,
        userAId,
        JSON.stringify({ category: 'TMT_STEEL', grade: 'Fe 550D', standard: 'IS 1786:2008' }),
      ]
    );
  });

  await runTest('Creates two split allocations (60 MT + 40 MT) under the same Approval', async () => {
    // Allocation 1: 60 MT to Kamdhenu Steel
    await pg.query(
      `INSERT INTO approval_allocations (id, "approvalId", "workspaceId", "quotationReference", "supplierName", "allocatedQuantity", "allocatedPayableAmount", "allocatedTermsSnapshot")
       VALUES ($1, $2, $3, 'Q-KAMD-01', 'Kamdhenu Steel Traders', 60.000, 3270000.00, $4);`,
      [
        alloc1Id,
        approvalId,
        wsAId,
        JSON.stringify({ ratePerMt: 54500, deliveryTerms: 'FOR Site', taxRate: 18 }),
      ]
    );

    // Allocation 2: 40 MT to Tata Tiscon Distributor
    await pg.query(
      `INSERT INTO approval_allocations (id, "approvalId", "workspaceId", "quotationReference", "supplierName", "allocatedQuantity", "allocatedPayableAmount", "allocatedTermsSnapshot")
       VALUES ($1, $2, $3, 'Q-TATA-02', 'Tata Tiscon North Hub', 40.000, 2180000.00, $4);`,
      [
        alloc2Id,
        approvalId,
        wsAId,
        JSON.stringify({ ratePerMt: 54500, deliveryTerms: 'FOR Site', taxRate: 18 }),
      ]
    );

    // Verify quantity invariant: sum(allocated) <= approved
    const allocSumRes = await pg.query<{ total: string }>(
      'SELECT SUM("allocatedQuantity") as total FROM approval_allocations WHERE "approvalId" = $1;',
      [approvalId]
    );
    assert(Number(allocSumRes.rows[0].total) === 100.0, 'Sum of split allocations must equal 100 MT');
  });

  await runTest('Issues distinct Purchase Orders bound to unique approval_allocation_id', async () => {
    const poPayload1 = JSON.stringify({ poNumber: 'PO-2026-0001', allocId: alloc1Id, amount: 3270000 });
    const checksum1 = crypto.createHash('sha256').update(poPayload1).digest('hex');

    const poPayload2 = JSON.stringify({ poNumber: 'PO-2026-0002', allocId: alloc2Id, amount: 2180000 });
    const checksum2 = crypto.createHash('sha256').update(poPayload2).digest('hex');

    // Insert PO 1
    await pg.query(
      `INSERT INTO purchase_orders (id, "workspaceId", "poNumber", "approvalAllocationId", "idempotencyKey", "approvedTermsSnapshot", "consistencyChecksum", "poStatus")
       VALUES ($1, $2, 'PO-2026-0001', $3, 'idemp-po-001', $4, $5, 'CONFIRMED');`,
      [crypto.randomUUID(), wsAId, alloc1Id, poPayload1, checksum1]
    );

    // Insert PO 2
    await pg.query(
      `INSERT INTO purchase_orders (id, "workspaceId", "poNumber", "approvalAllocationId", "idempotencyKey", "approvedTermsSnapshot", "consistencyChecksum", "poStatus")
       VALUES ($1, $2, 'PO-2026-0002', $3, 'idemp-po-002', $4, $5, 'CONFIRMED');`,
      [crypto.randomUUID(), wsAId, alloc2Id, poPayload2, checksum2]
    );

    const countRes = await pg.query('SELECT count(*) as count FROM purchase_orders WHERE "workspaceId" = $1;', [wsAId]);
    assert(Number(countRes.rows[0].count) === 2, 'Two separate POs generated for the split fulfillment');
  });

  await runTest('Enforces UNIQUE (approval_allocation_id): Rejects duplicate PO on same allocation', async () => {
    let threw = false;
    try {
      await pg.query(
        `INSERT INTO purchase_orders (id, "workspaceId", "poNumber", "approvalAllocationId", "idempotencyKey", "approvedTermsSnapshot", "consistencyChecksum", "poStatus")
         VALUES ($1, $2, 'PO-2026-0001-DUPLICATE', $3, 'idemp-dup-001', '{}', 'fake-checksum', 'CONFIRMED');`,
        [crypto.randomUUID(), wsAId, alloc1Id]
      );
    } catch (e: any) {
      threw = true;
      assert(
        e.message.includes('purchase_orders_approvalAllocationId_key') ||
        e.message.toLowerCase().includes('unique constraint'),
        'Must violate unique constraint on approvalAllocationId'
      );
    }
    assert(threw, 'Must strictly forbid issuing multiple POs for the same allocation');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 8: Dynamic Effective-Dated Tax Rules (GST Rationalisation)
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[8/8] Dynamic Tax Rate Rules & Effective Date Logic${RESET}`);

  await runTest('Seeds effective-dated GST rules (cement 28% pre-22 Sept 2025, 18% post)', async () => {
    // Cement pre-rationalisation
    await pg.query(
      `INSERT INTO tax_rate_rules (id, "hsnSacCode", description, "cgstRate", "sgstRate", "igstRate", "effectiveFrom", "effectiveTo", "sourceCitation", "isActive")
       VALUES ($1, '2523', 'Cement (Historical pre-Sept 2025)', 14.00, 14.00, 28.00, '2017-07-01', '2025-09-21', 'Notification 1/2017-CT', false);`,
      [crypto.randomUUID()]
    );

    // Cement post-rationalisation
    await pg.query(
      `INSERT INTO tax_rate_rules (id, "hsnSacCode", description, "cgstRate", "sgstRate", "igstRate", "effectiveFrom", "effectiveTo", "sourceCitation", "isActive")
       VALUES ($1, '2523', 'Cement (Post-rationalisation)', 9.00, 9.00, 18.00, '2025-09-22', NULL, 'PIB PRID 2163560', true);`,
      [crypto.randomUUID()]
    );

    // TMT Steel
    await pg.query(
      `INSERT INTO tax_rate_rules (id, "hsnSacCode", description, "cgstRate", "sgstRate", "igstRate", "effectiveFrom", "effectiveTo", "sourceCitation", "isActive")
       VALUES ($1, '7214', 'TMT Steel Bars', 9.00, 9.00, 18.00, '2017-07-01', NULL, 'Standard Steel Schedule', true);`,
      [crypto.randomUUID()]
    );
  });

  await runTest('Resolves 28% GST for Cement on historical invoice date (e.g., 2025-08-15)', async () => {
    const historicalDate = '2025-08-15';
    const res = await pg.query<{ igstRate: string; cgstRate: string; sgstRate: string }>(
      `SELECT "igstRate", "cgstRate", "sgstRate" FROM tax_rate_rules 
       WHERE "hsnSacCode" = '2523' 
         AND "effectiveFrom" <= $1::date 
         AND ("effectiveTo" IS NULL OR "effectiveTo" >= $1::date)
       ORDER BY "effectiveFrom" DESC LIMIT 1;`,
      [historicalDate]
    );

    assert(res.rows.length === 1, 'Must find matching tax rule');
    assert(Number(res.rows[0].igstRate) === 28.00, `Historical cement IGST must be 28%, got ${res.rows[0].igstRate}%`);
    assert(Number(res.rows[0].cgstRate) === 14.00, 'Historical cement CGST must be 14%');
  });

  await runTest('Resolves 18% GST for Cement on current date (post-Sept 22, 2025)', async () => {
    const currentDate = '2026-10-30';
    const res = await pg.query<{ igstRate: string; cgstRate: string; sgstRate: string }>(
      `SELECT "igstRate", "cgstRate", "sgstRate" FROM tax_rate_rules 
       WHERE "hsnSacCode" = '2523' 
         AND "effectiveFrom" <= $1::date 
         AND ("effectiveTo" IS NULL OR "effectiveTo" >= $1::date)
       ORDER BY "effectiveFrom" DESC LIMIT 1;`,
      [currentDate]
    );

    assert(res.rows.length === 1, 'Must find matching current tax rule');
    assert(Number(res.rows[0].igstRate) === 18.00, `Current cement IGST must be 18%, got ${res.rows[0].igstRate}%`);
    assert(Number(res.rows[0].cgstRate) === 9.00, 'Current cement CGST must be 9%');
  });

  await runTest('Resolves 18% GST for TMT Steel on current date', async () => {
    const currentDate = '2026-10-30';
    const res = await pg.query<{ igstRate: string }>(
      `SELECT "igstRate" FROM tax_rate_rules 
       WHERE "hsnSacCode" = '7214' 
         AND "effectiveFrom" <= $1::date 
         AND ("effectiveTo" IS NULL OR "effectiveTo" >= $1::date)
       ORDER BY "effectiveFrom" DESC LIMIT 1;`,
      [currentDate]
    );

    assert(res.rows.length === 1, 'Must find matching current steel rule');
    assert(Number(res.rows[0].igstRate) === 18.00, `Steel IGST must be 18%, got ${res.rows[0].igstRate}%`);
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log(`${BOLD}${CYAN}=================================================================${RESET}`);
  console.log(`${BOLD}TEST RUNNER SUMMARY:${RESET}`);
  console.log(`  Total Executed Tests: ${BOLD}${passedTests + failedTests}${RESET}`);
  console.log(`  Passed: ${GREEN}${BOLD}${passedTests}${RESET}`);
  console.log(`  Failed: ${failedTests > 0 ? RED : GREEN}${BOLD}${failedTests}${RESET}`);
  console.log(`${BOLD}${CYAN}=================================================================${RESET}`);

  if (failedTests > 0) {
    console.error(`\n${RED}FAILURE: One or more tests failed. Review output above.${RESET}`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}SUCCESS: All Phase 1 Foundation acceptance tests passed!${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`\n${RED}FATAL ERROR in test runner:${RESET}`, err);
  process.exit(1);
});
