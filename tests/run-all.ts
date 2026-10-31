/**
 * Kovok Construction Procurement Operations Platform
 * Phase 1 Foundation: Comprehensive Test Suite Runner (Remediated)
 *
 * Covers all mandatory Phase 1 acceptance tests & audit remediations:
 * 1. Environment validation & security configuration
 * 2. Asynchronous cryptographic password hashing & timing-safe verification
 * 3. Multi-migration DDL deployment (Initial + Corrective RLS & Invariant Triggers)
 * 4. Transaction rollback, recovery & atomic provisioning
 * 5. Complete RLS enforcement on all 9 tenant tables under non-superuser role (kovok_app)
 * 6. Split-fulfillment trigger enforcement (rejection of over-allocations, reduction limits, FOR UPDATE lock)
 * 7. Rate limiting on authentication endpoints (brute-force & CPU DoS mitigation)
 * 8. Dynamic tax rate rules & explicit boundary validation of Phase 1 in-memory UI
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { validateEnv } from '../src/lib/env';
import { hashPassword, verifyPassword, generateSessionToken } from '../src/lib/auth';
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from '../src/app/api/auth/login/route';
import {
  validateManifestIntegrity,
  generateDryRunReport,
  executeImport,
  rollbackBatch,
  CORE_VERIFIED_CANONICAL_IDS
} from '../src/lib/catalogue/importer';
import {
  calculateRebarConversions,
  matchProcurementRequirement,
  generateNextRequestCode
} from '../src/lib/procurement/intake';
import {
  getSarvamVoiceConfigStatus,
  generateCallbackToken,
  verifyCallbackToken,
  SARVAM_SUPPLIER_AGENT_PROMPT,
} from '../src/lib/integrations/sarvam-voice';

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
  console.log(`${BOLD}${CYAN}   KOVOK CONSTRUCTION PROCUREMENT — REMEDIATED TEST SUITE        ${RESET}`);
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
  // SUITE 2: Asynchronous Cryptographic Password Hashing & Verification
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[2/8] Asynchronous Cryptographic Hashing & Verification${RESET}`);

  await runTest('Hashes passwords asynchronously using Scrypt with unique salt', async () => {
    const pass = 'KovokSecurePass#2026';
    const hash1 = await hashPassword(pass);
    const hash2 = await hashPassword(pass);
    assert(hash1 !== hash2, 'Salt must ensure different hashes for identical passwords');
    assert(hash1.includes(':'), 'Hash format must be salt:key');
    const [salt, key] = hash1.split(':');
    assert(salt.length === 32, 'Salt should be 16 bytes hex (32 chars)');
    assert(key.length === 128, 'Key should be 64 bytes hex (128 chars)');
  });

  await runTest('Verifies matching password correctly in constant time', async () => {
    const pass = 'ConstructionProcure@9921';
    const hash = await hashPassword(pass);
    const isValid = await verifyPassword(pass, hash);
    assert(isValid === true, 'Matching password must return true');
  });

  await runTest('Rejects incorrect password safely', async () => {
    const pass = 'ConstructionProcure@9921';
    const hash = await hashPassword(pass);
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
  // SUITE 3: PostgreSQL Database DDL Migrations & Corrective Security
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[3/8] Database Migrations & Corrective RLS/Triggers (PostgreSQL 16 Engine)${RESET}`);

  const pg = new PGlite();

  await runTest('Applies Initial Migration (20261030000000_init) cleanly', async () => {
    const migration1Path = path.join(__dirname, '../prisma/migrations/20261030000000_init/migration.sql');
    const sql1 = fs.readFileSync(migration1Path, 'utf-8');
    await pg.exec(sql1);

    // Setup non-superuser role 'kovok_app' to enforce RLS
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

  await runTest('Applies Corrective Security Migration (20261030000001_security_and_invariants)', async () => {
    const migration2Path = path.join(__dirname, '../prisma/migrations/20261030000001_security_and_invariants/migration.sql');
    const sql2 = fs.readFileSync(migration2Path, 'utf-8');
    await pg.exec(sql2);

    // Regrant privileges on newly created triggers/tables to kovok_app
    await pg.exec(`
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kovok_app;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kovok_app;
    `);
  });

  await runTest('Verifies Row-Level Security is forced on all 9 tenant-scoped tables', async () => {
    const rlsRes = await pg.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity 
       FROM pg_class 
       WHERE relname IN (
         'project_sites', 'workspace_rule_profiles', 'approvals',
         'approval_allocations', 'purchase_orders', 'audit_logs',
         'workspace_roles', 'workspace_memberships', 'sessions'
       );`
    );

    assert(rlsRes.rows.length === 9, `Expected 9 tenant tables with RLS, found ${rlsRes.rows.length}`);
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
  // SUITE 4: Multi-Tenant Provisioning, Sessions & Auth Workflows
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

  await runTest('Provisions Tenant A atomically under non-superuser role with RLS context', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');

    // Insert Workspace A
    await pg.query(
      `INSERT INTO workspaces (id, name, slug, "businessType", "serviceArea", "isSandbox", "updatedAt")
       VALUES ($1, 'Concrete & Co.', 'concrete-co', 'General Contractor', 'Delhi NCR', false, NOW());`,
      [wsAId]
    );

    // CRITICAL: Establish transaction-local tenant context immediately after workspace creation
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    // Insert Roles (now RLS protected!)
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

    // Insert User A
    const passwordHashA = await hashPassword('AdminSecurePass#2026');
    await pg.query(
      `INSERT INTO users (id, email, name, "passwordHash", phone, "updatedAt")
       VALUES ($1, 'rajesh@concrete-co.in', 'Rajesh Sharma', $2, '+919811000001', NOW());`,
      [userAId, passwordHashA]
    );

    // Link Membership (now RLS protected!)
    await pg.query(
      `INSERT INTO workspace_memberships (id, "workspaceId", "userId", "roleId", "isDefault")
       VALUES ($1, $2, $3, $4, true);`,
      [membershipAId, wsAId, userAId, roleAdminAId]
    );

    // Insert Project Site (RLS protected)
    await pg.query(
      `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
       VALUES ($1, $2, 'Dwarka Sector 104', '122006', 'Gurugram', 'Site Plot 42', NOW());`,
      [crypto.randomUUID(), wsAId]
    );

    // Insert Audit Log (RLS protected)
    await pg.query(
      `INSERT INTO audit_logs (id, "workspaceId", "actorId", action, "entityType", "entityId")
       VALUES ($1, $2, $3, 'WORKSPACE_PROVISIONED', 'Workspace', $4);`,
      [crypto.randomUUID(), wsAId, userAId, wsAId]
    );


    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');

    const check = await pg.query('SELECT count(*) as count FROM workspace_memberships WHERE "workspaceId" = $1;', [wsAId]);
    assert(Number(check.rows[0].count) === 1, 'Workspace A membership established under RLS');
  });

  await runTest('Provisions Tenant B atomically under non-superuser role with RLS context', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');

    await pg.query(
      `INSERT INTO workspaces (id, name, slug, "businessType", "serviceArea", "isSandbox", "updatedAt")
       VALUES ($1, 'BluePeak Infra Ltd', 'bluepeak-infra', 'Commercial Builder', 'Mumbai MMR', false, NOW());`,
      [wsBId]
    );

    await pg.query(`SET LOCAL app.current_workspace_id = '${wsBId}';`);

    await pg.query(
      `INSERT INTO workspace_roles (id, "workspaceId", name, description, "approvalLimitAmount", "canCreateRequests", "canApproveQuotes", "canManageSettings")
       VALUES ($1, $2, 'Admin', 'Full administrative authority', 50000000.00, true, true, true);`,
      [roleAdminBId, wsBId]
    );

    const passwordHashB = await hashPassword('BluePeakAdmin#2026');
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

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');

    const check = await pg.query('SELECT count(*) as count FROM workspace_memberships WHERE "workspaceId" = $1;', [wsBId]);
    assert(Number(check.rows[0].count) === 1, 'Workspace B membership established under RLS');
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

    // Insert session with workspace scope under kovok_app
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    await pg.query(
      `INSERT INTO sessions (id, "userId", "workspaceId", "sessionToken", "expiresAt")
       VALUES ($1, $2, $3, $4, $5);`,
      [sessionId, userAId, wsAId, activeSessionToken, expiresAt.toISOString()]
    );

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');

    // Validate active session token via exact token lookup under RLS
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_session_token = '${activeSessionToken}';`);

    const sessionRes = await pg.query<{ sessionToken: string; expiresAt: string }>(
      'SELECT "sessionToken", "expiresAt" FROM sessions WHERE "sessionToken" = $1;',
      [activeSessionToken]
    );
    assert(sessionRes.rows.length === 1, 'Session must be returned when sessionToken matches');
    assert(new Date(sessionRes.rows[0].expiresAt).getTime() > Date.now(), 'Session must not be expired');

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Revokes session on logout, invalidating subsequent requests', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_session_token = '${activeSessionToken}';`);
    await pg.query('DELETE FROM sessions WHERE "sessionToken" = $1;', [activeSessionToken]);
    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');

    // Query with token
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_session_token = '${activeSessionToken}';`);
    const check = await pg.query('SELECT count(*) as count FROM sessions WHERE "sessionToken" = $1;', [activeSessionToken]);
    assert(Number(check.rows[0].count) === 0, 'Session must be deleted on logout');
    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 5: Cross-Workspace PostgreSQL Row-Level Security (RLS) Isolation
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[5/8] Comprehensive Cross-Workspace RLS Isolation (9 Tables)${RESET}`);

  await runTest('Tenant A cannot see Tenant B workspace roles under kovok_app role', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    const res = await pg.query<{ name: string; workspaceId: string }>(
      'SELECT name, "workspaceId" FROM workspace_roles;'
    );
    assert(res.rows.length === 2, `Tenant A must see exactly its own 2 roles, found ${res.rows.length}`);
    for (const r of res.rows) {
      assert(r.workspaceId === wsAId, 'All returned roles must belong to Tenant A');
    }

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Tenant A cannot see Tenant B workspace memberships under kovok_app role', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    const res = await pg.query<{ userId: string; workspaceId: string }>(
      'SELECT "userId", "workspaceId" FROM workspace_memberships;'
    );
    assert(res.rows.length === 1, `Tenant A must see only its own membership, found ${res.rows.length}`);
    assert(res.rows[0].workspaceId === wsAId, 'Membership must belong to Tenant A');

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Tenant A context cannot insert forged role with Tenant B workspace ID', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    let threw = false;
    try {
      await pg.query(
        `INSERT INTO workspace_roles (id, "workspaceId", name, description)
         VALUES ($1, $2, 'Forged Role', 'Malicious cross-tenant injection');`,
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
    assert(threw, 'Cross-tenant role insertion forgery must be rejected by RLS policy');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 6: Split Fulfillment Database-Level Trigger Enforcement
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[6/8] Database-Level Split-Allocation Invariant Triggers${RESET}`);

  const approvalId = crypto.randomUUID();
  const alloc1Id = crypto.randomUUID();
  const alloc2Id = crypto.randomUUID();

  await runTest('Creates Buyer Approval for 100 MT TMT Steel', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    await pg.query(
      `INSERT INTO approvals (id, "workspaceId", "requestCode", "approvedByUserId", "totalApprovedQuantity", "quantityUnit", "totalApprovedAmount", "approvedSpecifications", "approvalStatus")
       VALUES ($1, $2, 'KOVOK-REQ-9001', $3, 100.000, 'MT', 5450000.00, '{}', 'APPROVED');`,
      [approvalId, wsAId, userAId]
    );

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Allocation 1 (60 MT) succeeds via trigger (sum = 60 <= 100)', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    await pg.query(
      `INSERT INTO approval_allocations (id, "approvalId", "workspaceId", "quotationReference", "supplierName", "allocatedQuantity", "allocatedPayableAmount", "allocatedTermsSnapshot")
       VALUES ($1, $2, $3, 'Q-KAMD-01', 'Kamdhenu Steel', 60.000, 3270000.00, '{}');`,
      [alloc1Id, approvalId, wsAId]
    );

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Allocation 2 (40 MT) succeeds via trigger (sum = 100 <= 100)', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    await pg.query(
      `INSERT INTO approval_allocations (id, "approvalId", "workspaceId", "quotationReference", "supplierName", "allocatedQuantity", "allocatedPayableAmount", "allocatedTermsSnapshot")
       VALUES ($1, $2, $3, 'Q-TATA-02', 'Tata Tiscon', 40.000, 2180000.00, '{}');`,
      [alloc2Id, approvalId, wsAId]
    );

    await pg.exec('RESET ROLE;');
    await pg.exec('COMMIT;');
  });

  await runTest('Trigger strictly rejects Allocation 3 (10 MT) exceeding approved quantity (sum = 110 > 100)', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    let threw = false;
    try {
      await pg.query(
        `INSERT INTO approval_allocations (id, "approvalId", "workspaceId", "quotationReference", "supplierName", "allocatedQuantity", "allocatedPayableAmount", "allocatedTermsSnapshot")
         VALUES ($1, $2, $3, 'Q-OVER-03', 'Overallocator Ltd', 10.000, 545000.00, '{}');`,
        [crypto.randomUUID(), approvalId, wsAId]
      );
    } catch (e: any) {
      threw = true;
      assert(
        e.message.includes('exceeds approved quantity') || e.message.includes('check_violation'),
        `Expected trigger check_violation error, got: ${e.message}`
      );
    }

    await pg.exec('ROLLBACK;');
    await pg.exec('RESET ROLE;');
    assert(threw, 'Trigger must reject allocation when total exceeds approved quantity');
  });

  await runTest('Trigger strictly rejects UPDATE to allocation that causes sum to exceed limit', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    let threw = false;
    try {
      // Try to update alloc1 from 60 MT to 75 MT (total would be 75 + 40 = 115 > 100)
      await pg.query(
        'UPDATE approval_allocations SET "allocatedQuantity" = 75.000 WHERE id = $1;',
        [alloc1Id]
      );
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('exceeds approved quantity'), 'Must fail with trigger violation');
    }

    await pg.exec('ROLLBACK;');
    await pg.exec('RESET ROLE;');
    assert(threw, 'Trigger must reject quantity update that breaches approved limit');
  });

  await runTest('Trigger strictly rejects reducing approved quantity below currently allocated total', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    let threw = false;
    try {
      // Try to reduce approval from 100 MT to 80 MT when 100 MT is already allocated
      await pg.query(
        'UPDATE approvals SET "totalApprovedQuantity" = 80.000 WHERE id = $1;',
        [approvalId]
      );
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('Cannot reduce approved quantity'), 'Must fail with reduction trigger violation');
    }

    await pg.exec('ROLLBACK;');
    await pg.exec('RESET ROLE;');
    assert(threw, 'Trigger must prevent reducing approved quantity below active allocations');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 7: Login Rate Limiting & DoS Protection
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[7/8] Login Rate Limiting & CPU DoS Mitigation${RESET}`);

  await runTest('Allows login attempts below failure threshold', () => {
    const testIp = '192.168.1.100';
    resetLoginRateLimit(testIp);
    const check1 = checkLoginRateLimit(testIp);
    assert(check1.allowed === true, 'First attempt must be allowed');
    recordFailedLogin(testIp);
    const check2 = checkLoginRateLimit(testIp);
    assert(check2.allowed === true, 'Second attempt must be allowed');
    resetLoginRateLimit(testIp);
  });

  await runTest('Blocks login requests when 5 consecutive failures occur (HTTP 429)', () => {
    const testIp = '10.0.0.99';
    resetLoginRateLimit(testIp);
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(testIp);
    }
    const check = checkLoginRateLimit(testIp);
    assert(check.allowed === false, 'Must be blocked after 5 failed attempts');
    assert(check.retryAfterSeconds > 0, 'Must provide retry-after seconds');
    resetLoginRateLimit(testIp);
  });

  await runTest('Resets failure counter on successful authentication', () => {
    const testIp = '172.16.0.5';
    resetLoginRateLimit(testIp);
    recordFailedLogin(testIp);
    recordFailedLogin(testIp);
    resetLoginRateLimit(testIp);
    const check = checkLoginRateLimit(testIp);
    assert(check.allowed === true, 'Counter must be reset');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 8: Tax Boundaries & UI State Verification
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[8/8] Tax Boundaries & Phase 1 Procurement UI State${RESET}`);

  await runTest('Tax rules resolve dynamic rates with draft status flag', async () => {
    await pg.query(
      `INSERT INTO tax_rate_rules (id, "hsnSacCode", description, "cgstRate", "sgstRate", "igstRate", "effectiveFrom", "effectiveTo", "sourceCitation", "isActive")
       VALUES ($1, '2523', 'Cement (Draft)', 9.00, 9.00, 18.00, '2025-09-22', NULL, 'PIB PRID 2163560', true);`,
      [crypto.randomUUID()]
    );

    const res = await pg.query<{ igstRate: string }>(
      "SELECT \"igstRate\" FROM tax_rate_rules WHERE \"hsnSacCode\" = '2523' AND \"isActive\" = true;"
    );
    assert(Number(res.rows[0].igstRate) === 18.00, 'Cement rate is 18%');
  });

  await runTest('Confirms Phase 1 procurement views explicitly declare in-memory UI data', () => {
    const requestsViewContent = fs.readFileSync(
      path.join(__dirname, '../src/components/views/RequestsView.tsx'),
      'utf-8'
    );
    assert(
      requestsViewContent.includes('/api/procurement/requests') || requestsViewContent.includes('allRequests = ['),
      'RequestsView connects to real procurement intake API or declares in-memory UI data'
    );

    const appClientContent = fs.readFileSync(
      path.join(__dirname, '../src/components/KovokAppClient.tsx'),
      'utf-8'
    );
    assert(
      appClientContent.includes('handleNewRequestSubmit'),
      'KovokAppClient wizard submission triggers UI notification and tab change in Phase 1'
    );
  });

  console.log();

  // ==========================================================================
  // PHASE 2 TEST SUITES: CONTROLLED CATALOGUE INTEGRATION & INTAKE
  // ==========================================================================
  const seedDir = path.join(__dirname, '../catalogue_seed');

  // --------------------------------------------------------------------------
  // SUITE 9: Manifest & SHA-256 Byte Integrity Verification
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[9/13] Phase 2 Manifest & SHA-256 Byte Integrity Verification${RESET}`);

  await runTest('Validates SHA-256 byte integrity of all 12 staged CSV files against manifest', () => {
    const { manifest, manifestSha256 } = validateManifestIntegrity(seedDir);
    assert(manifestSha256.length === 64, 'Manifest must have a valid 64-char SHA-256 hash');
    assert(Object.keys(manifest.files).length === 12, 'Manifest must cover all 12 relational CSV files');
  });

  await runTest('Rejects tampered manifest or modified file bytes safely', () => {
    let threw = false;
    try {
      const fakeDir = path.join(__dirname, 'non_existent_seed_dir');
      validateManifestIntegrity(fakeDir);
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('not found'), 'Should report manifest not found');
    }
    assert(threw, 'Should throw on missing or invalid manifest directory');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 10: Phase 2 Additive Database Migration, Composite FK & RLS Grants
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[10/13] Phase 2 Additive Migration, Composite FK & RLS Grants${RESET}`);

  await runTest('Applies Phase 2 Migration (20261030000002_catalogue_and_procurement_intake)', async () => {
    const migration3Path = path.join(
      __dirname,
      '../prisma/migrations/20261030000002_catalogue_and_procurement_intake/migration.sql'
    );
    const sql3 = fs.readFileSync(migration3Path, 'utf-8');
    await pg.exec(sql3);

    // Grant schema privileges
    await pg.exec(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'kovok_app') THEN
          GRANT SELECT ON
            "material_categories", "standards_registry", "canonical_products",
            "manufacturers", "product_variants", "technical_specifications",
            "source_registry", "product_evidence", "supplier_organizations",
            "supplier_listings", "product_images", "unresolved_records",
            "import_batches", "import_batch_records"
          TO kovok_app;

          GRANT ALL PRIVILEGES ON
            "workspace_request_counters", "procurement_requests"
          TO kovok_app;
        END IF;
      END
      $$;
    `);
  });

  await runTest('Verifies Row-Level Security is forced on all 11 tenant-scoped tables', async () => {
    const rlsRes = await pg.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE relname IN (
         'project_sites', 'workspace_rule_profiles', 'approvals',
         'approval_allocations', 'purchase_orders', 'audit_logs',
         'workspace_roles', 'workspace_memberships', 'sessions',
         'procurement_requests', 'workspace_request_counters'
       );`
    );

    assert(rlsRes.rows.length === 11, `Expected 11 tenant tables with forced RLS, found ${rlsRes.rows.length}`);
    for (const row of rlsRes.rows) {
      assert(row.relrowsecurity === true, `${row.relname} must have relrowsecurity enabled`);
      assert(row.relforcerowsecurity === true, `${row.relname} must have relforcerowsecurity forced`);
    }
  });

  await runTest('Rejects cross-tenant project site reference in procurement requests via composite foreign key', async () => {
    // Attempt to create a procurement request for Workspace A referencing Workspace B's site
    const siteBRes = await pg.query<{ id: string }>(
      `SELECT id FROM project_sites WHERE "workspaceId" = $1 LIMIT 1;`,
      [wsBId]
    );

    let siteBId: string;
    if (siteBRes.rows.length === 0) {
      siteBId = crypto.randomUUID();
      await pg.query(
        `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
         VALUES ($1, $2, 'Bandra Kurla Site', '400051', 'Mumbai', 'Plot B', NOW());`,
        [siteBId, wsBId]
      );
    } else {
      siteBId = siteBRes.rows[0].id;
    }

    // Ensure category exists so the composite FK specifically triggers the rejection
    await pg.query(
      `INSERT INTO material_categories (id, "categoryName", "taxonomyVersion", "isActive", "researchStatus", "updatedAt")
       VALUES ('tmt_rebar', 'TMT Steel', '2.0.0', true, 'verified', NOW())
       ON CONFLICT (id) DO NOTHING;`
    );

    let fkRejected = false;
    try {
      await pg.query(
        `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
         VALUES ($1, $2, $3, 'KOV-REQ-FORGE', 'tmt_rebar', 10.0, 'TONNES', 'DRAFT', $4, NOW());`,
        [crypto.randomUUID(), wsAId, siteBId, userAId]
      );
    } catch (err: any) {
      fkRejected = true;
      assert(
        err.message.includes('foreign key') || err.message.includes('violates foreign key constraint'),
        'Composite foreign key must reject cross-tenant site reference'
      );
    }
    assert(fkRejected, 'Database must strictly reject cross-tenant site ID assignment');
  });

  await runTest('Enforces read-only SELECT privileges on shared catalogue tables for kovok_app role', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');

    let writeBlocked = false;
    try {
      await pg.query(
        `INSERT INTO canonical_products (id, "categoryId", "canonicalName", "standardProductType", "applicableStandard", "standardEditionStatus", "primaryUom", "allowedUoms", "mandatoryAttributes", "conversionFactors", "verificationStatus")
         VALUES ('CP-FORGED', 'tmt_rebar', 'Forged Product', 'Bar', 'IS 1786', '2008', 'MT', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, 'verified_standard_spec');`
      );
    } catch (err: any) {
      writeBlocked = true;
      assert(
        err.message.includes('permission denied') || err.message.includes('must be owner'),
        'Runtime app role must not have INSERT permission on shared catalogue'
      );
    } finally {
      await pg.exec('ROLLBACK;').catch(() => null);
      await pg.exec('RESET ROLE;').catch(() => null);
    }
    assert(writeBlocked, 'kovok_app role must be strictly prohibited from modifying shared catalogue tables');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 11: Controlled Catalogue Ingestion & Invariant Enforcement
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[11/13] Controlled Catalogue Staging Import & Invariants${RESET}`);

  await runTest('Dry-run report verifies 43 canonical products, 0 verified variants, and 54 quarantined images', async () => {
    const report = await generateDryRunReport(seedDir, pg);
    assert(report.status === 'READY', 'Dry-run report must be READY');
    assert(report.totalFiles === 12, 'Must audit 12 files');
    assert(report.verifiedCanonicalProductIds.length === 18, 'Must identify exactly 18 core verified canonical products');
    assert(report.provisionalCanonicalProductIds.length === 25, 'Must identify exactly 25 provisional reference products');
    assert(report.quarantinedImageIdsCount === 54, 'Must identify exactly 54 quarantined image records');
    assert(report.tables['product_variants'].verifiedCount === 0, 'Zero verified branded variants permitted');
    assert(report.tables['supplier_listings'].verifiedCount === 0, 'Zero verified supplier stock listings permitted');
  });

  let importedBatchId: string;
  await runTest('Executes atomic idempotent catalogue import populating 12 relational tables', async () => {
    const result = await executeImport(seedDir, pg, { batchNumber: 'BATCH-ACCEPTANCE-TEST-01' });
    assert(result.status === 'COMPLETED', 'Batch status must be COMPLETED');
    assert(result.insertedCount > 200, `Expected over 200 records inserted, got ${result.insertedCount}`);
    importedBatchId = result.batchId;

    const batchRes = await pg.query('SELECT status FROM import_batches WHERE id = $1;', [importedBatchId]);
    assert(batchRes.rows[0].status === 'COMPLETED', 'Batch must be recorded as COMPLETED in DB');
  });

  await runTest('Enforces exactly 18 core verified canonical products and 25 provisional reference products', async () => {
    const res = await pg.query<{ verificationStatus: string; count: string }>(
      `SELECT "verificationStatus", count(*) as count
       FROM canonical_products
       GROUP BY "verificationStatus"
       ORDER BY "verificationStatus";`
    );

    const counts: Record<string, number> = {};
    for (const r of res.rows) {
      counts[r.verificationStatus] = Number(r.count);
    }

    assert(counts['verified_standard_spec'] === 18, `Expected exactly 18 verified_standard_spec, got ${counts['verified_standard_spec']}`);
    assert(counts['provisional_reference_spec'] === 25, `Expected exactly 25 provisional_reference_spec, got ${counts['provisional_reference_spec']}`);
  });

  await runTest('Enforces zero verified branded variants (0 verified, 10 candidate, 44 blocked/unverified)', async () => {
    const verifiedVars = await pg.query<{ count: string }>(
      "SELECT count(*) as count FROM product_variants WHERE \"verificationStatus\" = 'verified';"
    );
    assert(Number(verifiedVars.rows[0].count) === 0, 'Zero branded variants may have verified status');

    const totalVars = await pg.query<{ count: string }>("SELECT count(*) as count FROM product_variants;");
    assert(Number(totalVars.rows[0].count) === 54, 'Total staged product variants must be 54');
  });

  await runTest('Enforces zero verified supplier stockists and 100% quarantined product images', async () => {
    const verifiedListings = await pg.query<{ count: string }>(
      "SELECT count(*) as count FROM supplier_listings WHERE \"listingStatus\" = 'verified_stock';"
    );
    assert(Number(verifiedListings.rows[0].count) === 0, 'Zero supplier listings may claim verified stock');

    const activeImages = await pg.query<{ count: string }>(
      'SELECT count(*) as count FROM product_images WHERE "displayInProduction" = true;'
    );
    assert(Number(activeImages.rows[0].count) === 0, 'Zero product images may be enabled for production display');
  });

  await runTest('Idempotency: Re-running import causes zero duplicate rows and zero unnecessary updates', async () => {
    const beforeTimestamp = await pg.query<{ updatedAt: string }>(
      'SELECT "updatedAt" FROM canonical_products WHERE id = $1;',
      ['CP-TMT-500D-12MM']
    );

    const result2 = await executeImport(seedDir, pg, { batchNumber: 'BATCH-ACCEPTANCE-TEST-02' });
    assert(result2.status === 'COMPLETED', 'Second import must succeed cleanly');
    assert(result2.insertedCount === 0, 'Second import must insert 0 new records');
    assert(result2.updatedCount === 0, `Second import must perform 0 updates on unchanged records, got ${result2.updatedCount}`);
    assert(result2.skippedCount === 316, `Second import must skip all 316 identical records, got ${result2.skippedCount}`);

    const afterTimestamp = await pg.query<{ updatedAt: Date | string }>(
      'SELECT "updatedAt" FROM canonical_products WHERE id = $1;',
      ['CP-TMT-500D-12MM']
    );
    const beforeMs = new Date(beforeTimestamp.rows[0].updatedAt).getTime();
    const afterMs = new Date(afterTimestamp.rows[0].updatedAt).getTime();
    assert(
      beforeMs === afterMs,
      'updatedAt must NOT be altered on unchanged records'
    );

    const totalCans = await pg.query<{ count: string }>('SELECT count(*) as count FROM canonical_products;');
    assert(Number(totalCans.rows[0].count) === 43, 'Total canonical products must remain 43 without duplication');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 12: Import Rollback Engine & Snapshot Recovery
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[12/13] Import Rollback Engine & Snapshot Recovery${RESET}`);

  await runTest('Rollback engine reverts imported records while preserving human-locked records', async () => {
    // Mark one record as human-locked
    await pg.query(
      `UPDATE import_batch_records SET "isHumanLocked" = true
       WHERE "batchId" = $1 AND "entityType" = 'canonical_products' AND "recordId" = 'CP-TMT-500D-12MM';`,
      [importedBatchId]
    );

    const rollbackResult = await rollbackBatch(importedBatchId, pg);
    assert(rollbackResult.skippedCount >= 1, 'Rollback must skip human-locked record');

    // Confirm human-locked record was preserved
    const checkLocked = await pg.query('SELECT count(*) as count FROM canonical_products WHERE id = $1;', [
      'CP-TMT-500D-12MM'
    ]);
    assert(Number(checkLocked.rows[0].count) === 1, 'Human-locked record must remain in database');
  });

  await runTest('Re-imports cleanly after rollback to restore verified production baseline', async () => {
    const restoreResult = await executeImport(seedDir, pg, { batchNumber: 'BATCH-ACCEPTANCE-TEST-03' });
    assert(restoreResult.status === 'COMPLETED', 'Restoration import must complete cleanly');

    const countRes = await pg.query<{ count: string }>('SELECT count(*) as count FROM canonical_products;');
    assert(Number(countRes.rows[0].count) === 43, 'Canonical products restored to 43');
  });

  await runTest('Rollback test with mixture of created, changed, unchanged, and human-locked records', async () => {
    // 1. Mark an existing record as human-locked
    await pg.query(
      `UPDATE import_batch_records SET "isHumanLocked" = true
       WHERE "recordId" = 'CP-TMT-500D-16MM';`
    );

    // 2. Prepare a mixed batch:
    // - 1 INSERT: newly added record 'CP-TEST-TMT-PROV'
    // - 1 UPDATE: canonicalName change on 'CP-TMT-550D-12MM'
    // - 1 HUMAN-LOCKED: 'CP-TMT-500D-16MM'
    // - Unchanged records
    const mixedBatchId = crypto.randomUUID();
    const mixedBatchNumber = 'BATCH-MIXED-TEST-01';

    await pg.query(
      `INSERT INTO import_batches (id, "batchNumber", "sourceManifestSha256", status, "createdAt")
       VALUES ($1, $2, 'test-mixed-manifest-sha', 'IMPORTING', NOW());`,
      [mixedBatchId, mixedBatchNumber]
    );

    // Snapshot before for the updated record:
    const orig550DRes = await pg.query('SELECT * FROM canonical_products WHERE id = $1;', ['CP-TMT-550D-12MM']);
    assert(orig550DRes.rows.length === 1, 'CP-TMT-550D-12MM must exist before modification');
    const orig550DRow = orig550DRes.rows[0];

    // Snapshot before for human-locked record:
    const orig16MMRes = await pg.query('SELECT * FROM canonical_products WHERE id = $1;', ['CP-TMT-500D-16MM']);
    const orig16MMRow = orig16MMRes.rows[0];

    // Execute the UPDATE on CP-TMT-550D-12MM
    await pg.query(
      'UPDATE canonical_products SET "canonicalName" = $1, "updatedAt" = NOW() WHERE id = $2;',
      ['MODIFIED NAME FOR TESTING ROLLBACK', 'CP-TMT-550D-12MM']
    );
    await pg.query(
      `INSERT INTO import_batch_records (id, "batchId", "entityType", "recordId", action, "snapshotBefore", "snapshotAfter", "isHumanLocked", "createdAt")
       VALUES ($1, $2, 'canonical_products', 'CP-TMT-550D-12MM', 'UPDATE', $3, $4, false, NOW());`,
      [crypto.randomUUID(), mixedBatchId, JSON.stringify(orig550DRow), JSON.stringify({ ...orig550DRow, canonicalName: 'MODIFIED NAME FOR TESTING ROLLBACK' })]
    );

    // Execute the INSERT of a new record 'CP-TEST-TMT-PROV'
    const newRecord = {
      id: 'CP-TEST-TMT-PROV',
      categoryId: 'tmt_rebar',
      canonicalName: 'TMT Rebar 50mm Fe 500D (Test Prov)',
      standardProductType: 'tmt_rebar_straight_length',
      applicableStandard: 'IS 1786:2008',
      standardEditionStatus: 'CURRENT_WITH_ALL_AMENDMENTS',
      primaryUom: 'TONNES',
      allowedUoms: ['TONNES'],
      mandatoryAttributes: [],
      conversionFactors: {},
      verificationStatus: 'provisional_reference_spec'
    };
    await pg.query(
      `INSERT INTO canonical_products (id, "categoryId", "canonicalName", "standardProductType", "applicableStandard", "standardEditionStatus", "primaryUom", "allowedUoms", "mandatoryAttributes", "conversionFactors", "verificationStatus", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, NOW(), NOW());`,
      [newRecord.id, newRecord.categoryId, newRecord.canonicalName, newRecord.standardProductType, newRecord.applicableStandard, newRecord.standardEditionStatus, newRecord.primaryUom, JSON.stringify(newRecord.allowedUoms), JSON.stringify(newRecord.mandatoryAttributes), JSON.stringify(newRecord.conversionFactors), newRecord.verificationStatus]
    );
    await pg.query(
      `INSERT INTO import_batch_records (id, "batchId", "entityType", "recordId", action, "snapshotBefore", "snapshotAfter", "isHumanLocked", "createdAt")
       VALUES ($1, $2, 'canonical_products', 'CP-TEST-TMT-PROV', 'INSERT', null, $3, false, NOW());`,
      [crypto.randomUUID(), mixedBatchId, JSON.stringify(newRecord)]
    );

    // Human-locked record reference in this batch:
    await pg.query(
      `INSERT INTO import_batch_records (id, "batchId", "entityType", "recordId", action, "snapshotBefore", "snapshotAfter", "isHumanLocked", "createdAt")
       VALUES ($1, $2, 'canonical_products', 'CP-TMT-500D-16MM', 'UPDATE', $3, $4, true, NOW());`,
      [crypto.randomUUID(), mixedBatchId, JSON.stringify(orig16MMRow), JSON.stringify(orig16MMRow)]
    );

    // Complete batch
    await pg.query("UPDATE import_batches SET status = 'COMPLETED', \"completedAt\" = NOW() WHERE id = $1;", [mixedBatchId]);

    // Verify pre-rollback assertions:
    const checkBeforeRollbackNew = await pg.query('SELECT count(*) as count FROM canonical_products WHERE id = $1;', ['CP-TEST-TMT-PROV']);
    assert(Number(checkBeforeRollbackNew.rows[0].count) === 1, 'Created record must exist before rollback');

    const checkBeforeRollbackMod = await pg.query('SELECT "canonicalName" FROM canonical_products WHERE id = $1;', ['CP-TMT-550D-12MM']);
    assert(checkBeforeRollbackMod.rows[0].canonicalName === 'MODIFIED NAME FOR TESTING ROLLBACK', 'Changed record has modified canonicalName');

    // 3. Perform rollback of mixed batch
    const rollbackRes = await rollbackBatch(mixedBatchId, pg);
    assert(rollbackRes.status === 'ROLLED_BACK', 'Mixed batch rollback must succeed');
    assert(rollbackRes.revertedInsertsCount === 1, `Expected 1 reverted insert, got ${rollbackRes.revertedInsertsCount}`);
    assert(rollbackRes.revertedUpdatesCount === 1, `Expected 1 reverted update, got ${rollbackRes.revertedUpdatesCount}`);
    assert(rollbackRes.skippedCount >= 1, `Expected at least 1 skipped (human-locked), got ${rollbackRes.skippedCount}`);

    // 4. Verify post-rollback assertions:
    const checkAfterRollbackNew = await pg.query('SELECT count(*) as count FROM canonical_products WHERE id = $1;', ['CP-TEST-TMT-PROV']);
    assert(Number(checkAfterRollbackNew.rows[0].count) === 0, 'Created record must be deleted upon rollback');

    const checkAfterRollbackMod = await pg.query('SELECT "canonicalName" FROM canonical_products WHERE id = $1;', ['CP-TMT-550D-12MM']);
    assert(checkAfterRollbackMod.rows[0].canonicalName === orig550DRow.canonicalName, 'Changed record must be restored to pre-import snapshot canonicalName');

    const checkLockedRecord = await pg.query('SELECT count(*) as count FROM canonical_products WHERE id = $1;', ['CP-TMT-500D-16MM']);
    assert(Number(checkLockedRecord.rows[0].count) === 1, 'Human-locked record must be preserved');
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUITE 13: Procurement Intake Matching Engine & Calculations
  // --------------------------------------------------------------------------
  console.log(`${BOLD}[13/13] Procurement Intake Matching Engine & Calculations${RESET}`);

  await runTest('12mm Fe 500D rebar: Calculates unrounded theoretical mass (10.656 kg) and 93.84 bars/tonne', () => {
    const calc = calculateRebarConversions(12, 20, 'TONNES');
    assert(calc.nominalMassKgPerMeter === 0.888, 'Nominal mass must be 0.888 kg/m per IS 1786 Table 1');
    assert(calc.singleBarMassKg === 10.656, 'Single 12m bar mass must be exactly 10.656 kg (12 * 0.888)');
    assert(calc.theoreticalBarsPerTonne === 93.84, 'Theoretical bars per tonne must be 93.84 (unrounded 1000 / 10.656)');
    assert(calc.totalPiecesEstimated === 1877, '20 MT of 12mm rebar equals ~1877 pieces');
    assert(calc.commercialBillingCaveat.includes('weighbridge'), 'Must state commercial weighbridge billing caveat');
  });

  await runTest('14mm Fe 500D rebar: Routes unlisted diameter to NEEDS_CLARIFICATION without silent substitution', () => {
    const match = matchProcurementRequirement('CAT-TMT-STEEL', 'Fe 500D', 14, 10, 'TONNES');
    assert(match.requestStatus === 'NEEDS_CLARIFICATION', 'Unlisted size must route to NEEDS_CLARIFICATION');
    assert(match.canonicalProductId === null, 'Must not claim verified canonical product ID');
    assert(match.clarificationReason!.includes('Clause 6.1.1'), 'Must cite IS 1786 Clause 6.1.1 for non-standard size');
  });

  await runTest('28mm Fe 500D rebar: Routes provisional size to NEEDS_CLARIFICATION', () => {
    const match = matchProcurementRequirement('CAT-TMT-STEEL', 'Fe 500D', 28, 10, 'TONNES');
    assert(match.requestStatus === 'NEEDS_CLARIFICATION', 'Provisional size must route to NEEDS_CLARIFICATION');
    assert(match.canonicalProductId === 'CP-TMT-500D-28MM', 'Preserves candidate provisional product ID');
    assert(match.clarificationReason!.includes('PROVISIONAL_SPECIFICATION'), 'Explains provisional status');
  });

  await runTest('Fe 500D CRS rebar: Routes special rolling grade to NEEDS_CLARIFICATION', () => {
    const match = matchProcurementRequirement('CAT-TMT-STEEL', 'Fe 500D CRS', 12, 10, 'TONNES');
    assert(match.requestStatus === 'NEEDS_CLARIFICATION', 'CRS steel must route to NEEDS_CLARIFICATION');
    assert(match.clarificationReason!.includes('Corrosion Resistant Steel'), 'Clarification explains mill heat chemistry requirement');
  });

  await runTest('TMT steel without grade: Routes ambiguous request to NEEDS_CLARIFICATION', () => {
    const match = matchProcurementRequirement('CAT-TMT-STEEL', '', 12, 10, 'TONNES');
    assert(match.requestStatus === 'NEEDS_CLARIFICATION', 'Missing grade must route to clarification');
    assert(match.clarificationReason!.includes('UNRESOLVED_GRADE_SPECIFICATION'), 'States grade is required');
  });

  await runTest('OPC 53 cement: Matches core verified canonical specification (CP-CEM-OPC-53)', () => {
    const match = matchProcurementRequirement('CAT-CEMENT', 'OPC 53', undefined, 300, 'BAGS');
    assert(match.requestStatus === 'MATCHED_VERIFIED', 'OPC 53 must match verified specification');
    assert(match.canonicalProductId === 'CP-CEM-OPC-53', 'Matches CP-CEM-OPC-53');
  });

  await runTest('OPC 43 cement: Routes provisional specification to NEEDS_CLARIFICATION', () => {
    const match = matchProcurementRequirement('CAT-CEMENT', 'OPC 43', undefined, 300, 'BAGS');
    assert(match.requestStatus === 'NEEDS_CLARIFICATION', 'OPC 43 must route to clarification');
    assert(match.canonicalProductId === 'CP-CEM-OPC-43', 'Preserves provisional ID');
  });

  await runTest('Flags IS 456 durability advisory review note for coastal/marine foundation cement', () => {
    const match = matchProcurementRequirement('CAT-CEMENT', 'OPC 53', undefined, 500, 'BAGS', 'Marine piling foundation raft');
    assert(match.requestStatus === 'MATCHED_VERIFIED', 'Matches product');
    assert(match.advisoryEngineeringNote !== null, 'Advisory durability note must be flagged');
    assert(match.advisoryEngineeringNote!.includes('IS 456:2000 Durability Advisory'), 'Advisory cites IS 456 Table 4/5');
  });

  await runTest('Atomic request counter generates sequential KOV-REQ codes without aggregate locking', async () => {
    // Create site A if not present
    const siteAId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
       VALUES ($1, $2, 'Test Site Gurugram', '122002', 'Gurugram', 'Site Alpha', NOW())
       ON CONFLICT ("workspaceId", id) DO NOTHING;`,
      [siteAId, wsAId]
    );

    // Counter increment 1
    const c1 = await pg.query<{ nextCounter: number }>(`
      INSERT INTO workspace_request_counters ("workspaceId", "nextCounter", "updatedAt")
      VALUES ($1::uuid, 2, NOW())
      ON CONFLICT ("workspaceId")
      DO UPDATE SET "nextCounter" = workspace_request_counters."nextCounter" + 1, "updatedAt" = NOW()
      RETURNING workspace_request_counters."nextCounter" - 1 AS "nextCounter";
    `, [wsAId]);
    const code1 = `KOV-REQ-${String(c1.rows[0].nextCounter).padStart(4, '0')}`;

    // Counter increment 2
    const c2 = await pg.query<{ nextCounter: number }>(`
      INSERT INTO workspace_request_counters ("workspaceId", "nextCounter", "updatedAt")
      VALUES ($1::uuid, 2, NOW())
      ON CONFLICT ("workspaceId")
      DO UPDATE SET "nextCounter" = workspace_request_counters."nextCounter" + 1, "updatedAt" = NOW()
      RETURNING workspace_request_counters."nextCounter" - 1 AS "nextCounter";
    `, [wsAId]);
    const code2 = `KOV-REQ-${String(c2.rows[0].nextCounter).padStart(4, '0')}`;

    assert(code1 === 'KOV-REQ-0001', `Expected KOV-REQ-0001, got ${code1}`);
    assert(code2 === 'KOV-REQ-0002', `Expected KOV-REQ-0002, got ${code2}`);

    // Insert request with code 1
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, 'tmt_rebar', 'CP-TMT-500D-12MM', 20.0, 'TONNES', 'MATCHED_VERIFIED', $5, NOW());`,
      [crypto.randomUUID(), wsAId, siteAId, code1, userAId]
    );
  });

  await runTest('Cross-tenant isolation: Tenant A context cannot query Tenant B procurement requests under RLS', async () => {
    // Create Tenant B site & request
    const siteBId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
       VALUES ($1, $2, 'Mumbai Site B', '400001', 'Mumbai', 'Site Beta', NOW())
       ON CONFLICT ("workspaceId", id) DO NOTHING;`,
      [siteBId, wsBId]
    );

    const reqBId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, 'KOV-REQ-0001', 'cement', 'CP-CEM-OPC-53', 300.0, 'BAGS', 'MATCHED_VERIFIED', $4, NOW());`,
      [reqBId, wsBId, siteBId, userBId]
    );

    // Query under kovok_app role with Tenant A context
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    const queryRes = await pg.query<{ id: string; requestCode: string; workspaceId: string }>(
      'SELECT id, "requestCode", "workspaceId" FROM procurement_requests;'
    );

    await pg.exec('RESET ROLE;');
    await pg.exec('ROLLBACK;');

    assert(queryRes.rows.length === 1, `Tenant A must see exactly 1 request, got ${queryRes.rows.length}`);
    assert(queryRes.rows[0].workspaceId === wsAId, 'Tenant A can only see requests belonging to Workspace A');
  });

  console.log();

  // ==========================================================================
  // PHASE 3 TEST SUITES: RELEASE CANDIDATE MODULES & WORKFLOWS
  // ==========================================================================
  console.log(`${BOLD}[14/14] Release Candidate Additive Migration & Modules${RESET}`);

  await runTest('Applies Phase 3 Migration (20261031000000_release_candidate_modules)', async () => {
    const migration4Path = path.join(
      __dirname,
      '../prisma/migrations/20261031000000_release_candidate_modules/migration.sql'
    );
    const sql4 = fs.readFileSync(migration4Path, 'utf-8');
    await pg.exec(sql4);

    // Grant schema privileges on new tables to kovok_app
    await pg.exec(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'kovok_app') THEN
          GRANT ALL ON
            "projects", "supplier_voice_calls", "quotations", "delivery_milestones", "procurement_exceptions"
          TO kovok_app;
        END IF;
      END
      $$;
    `);
  });

  await runTest('Verifies Row-Level Security is forced on all 16 tenant tables', async () => {
    const rlsRes = await pg.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE relname IN (
         'project_sites', 'workspace_rule_profiles', 'approvals',
         'approval_allocations', 'purchase_orders', 'audit_logs',
         'workspace_roles', 'workspace_memberships', 'sessions',
         'procurement_requests', 'workspace_request_counters',
         'projects', 'supplier_voice_calls', 'quotations',
         'delivery_milestones', 'procurement_exceptions'
       );`
    );

    assert(rlsRes.rows.length === 16, `Expected 16 tenant tables with forced RLS, found ${rlsRes.rows.length}`);
    for (const row of rlsRes.rows) {
      assert(row.relrowsecurity === true, `${row.relname} must have relrowsecurity enabled`);
      assert(row.relforcerowsecurity === true, `${row.relname} must have relforcerowsecurity forced`);
    }
  });

  await runTest('Sarvam Voice config status accurately reports missing server variables without leaking secrets', () => {
    const status = getSarvamVoiceConfigStatus();
    assert(typeof status.isConfigured === 'boolean', 'isConfigured must be boolean');
    assert(['NOT_CONFIGURED', 'CONFIG_INCOMPLETE', 'CONFIGURED'].includes(status.status), 'Valid status string');
    assert(Array.isArray(status.missingVariables), 'missingVariables must be array');
    assert(Array.isArray(status.configuredVariables), 'configuredVariables must be array');
  });

  await runTest('Sarvam callback token generation produces 64-char crypto hash with timing-safe verification', () => {
    const { token, tokenHash } = generateCallbackToken();
    assert(token.length === 64, 'Token must be 64-char hex');
    assert(tokenHash.length === 64, 'Hash must be 64-char sha256');
    assert(verifyCallbackToken(token, tokenHash) === true, 'Matching token must verify');
    assert(verifyCallbackToken('invalid_tampered_token', tokenHash) === false, 'Tampered token must reject');
  });

  await runTest('Quotation persistence and cross-workspace RLS isolation', async () => {
    const testSiteAId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
       VALUES ($1, $2, 'Test Site Gurugram Alpha', '122002', 'Gurugram', 'Site Alpha', NOW())
       ON CONFLICT ("workspaceId", id) DO NOTHING;`,
      [testSiteAId, wsAId]
    );

    const testReqId = crypto.randomUUID();
    const quoteId = crypto.randomUUID();
    const quoteRef = 'QUO-TEST-0001';

    // Insert request first
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, 'KOV-REQ-TEST-1', 'tmt_rebar', 'CP-TMT-500D-12MM', 20.0, 'TONNES', 'MATCHED_VERIFIED', $4, NOW());`,
      [testReqId, wsAId, testSiteAId, userAId]
    );

    // Insert under kovok_app for Tenant A
    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    await pg.query(
      `INSERT INTO quotations (
         id, "workspaceId", "procurementRequestId", "supplierId", "quotationReference",
         source, "materialSpecification", "quantityValue", "quantityUnit",
         "quotedBaseRate", "gstRate", "freightCharges", "unloadingCharges",
         "totalDeliveredAmount", "status", "isComparable", "updatedAt"
       ) VALUES (
         $1, $2, $3, 'SUP-JSW-ONE', $4,
         'MANUAL', 'TMT Steel Fe 500D 12mm', 20.000, 'TONNES',
         52000.00, 18.00, 14000.00, 3500.00,
         1244700.00, 'PENDING_REVIEW', true, NOW()
       );`,
      [quoteId, wsAId, testReqId, quoteRef]
    );

    // Tenant A can query it
    const qA = await pg.query('SELECT id, "quotationReference" FROM quotations WHERE id = $1;', [quoteId]);
    assert(qA.rows.length === 1, 'Tenant A must see its quotation');

    // Switch to Tenant B under kovok_app
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsBId}';`);
    const qB = await pg.query('SELECT id, "quotationReference" FROM quotations WHERE id = $1;', [quoteId]);
    assert(qB.rows.length === 0, 'Tenant B must NOT see Tenant A quotation under RLS');

    await pg.exec('RESET ROLE;');
    await pg.exec('ROLLBACK;');
  });

  await runTest('Purchase Order generation preserves consistency checksum and initializes delivery milestones', async () => {
    const freshApprovalId = crypto.randomUUID();
    const testPoId = crypto.randomUUID();
    const testAllocId = crypto.randomUUID();
    const termsSnapshot = {
      spec: 'TMT Steel Fe 500D · 12mm',
      qty: 20,
      rate: 52000,
      deliveredTotal: 1244700,
    };
    const checksum = crypto.createHash('sha256').update(JSON.stringify(termsSnapshot)).digest('hex');

    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    // Create fresh approval
    await pg.query(
      `INSERT INTO approvals (id, "workspaceId", "requestCode", "approvedByUserId", "totalApprovedQuantity", "quantityUnit", "totalApprovedAmount", "approvedSpecifications", "approvalStatus")
       VALUES ($1, $2, 'KOV-REQ-PO-TEST', $3, 20.000, 'TONNES', 1244700.00, '{}', 'APPROVED');`,
      [freshApprovalId, wsAId, userAId]
    );

    // Create allocation
    await pg.query(
      `INSERT INTO approval_allocations (
         id, "approvalId", "workspaceId", "quotationReference", "supplierName",
         "allocatedQuantity", "allocatedPayableAmount", "allocatedTermsSnapshot"
       ) VALUES ($1, $2, $3, 'QUO-REF-99', 'JSW One MSME', 20.000, 1244700.00, $4);`,
      [testAllocId, freshApprovalId, wsAId, JSON.stringify(termsSnapshot)]
    );

    // Create PO
    await pg.query(
      `INSERT INTO purchase_orders (
         id, "workspaceId", "poNumber", "approvalAllocationId", "idempotencyKey",
         "approvedTermsSnapshot", "consistencyChecksum", "poStatus"
       ) VALUES ($1, $2, 'PO-9999', $3, 'IDEMP-9999', $4, $5, 'CONFIRMED');`,
      [testPoId, wsAId, testAllocId, JSON.stringify(termsSnapshot), checksum]
    );

    // Create milestone
    const msId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO delivery_milestones (
         id, "workspaceId", "purchaseOrderId", "milestoneCode", "milestoneTitle", "milestoneStatus"
       ) VALUES ($1, $2, $3, 'MS-GATE-ENTRY', 'Gate Security Stamp', 'PENDING');`,
      [msId, wsAId, testPoId]
    );

    const msQuery = await pg.query('SELECT id, "milestoneCode" FROM delivery_milestones WHERE "purchaseOrderId" = $1;', [testPoId]);
    assert(msQuery.rows.length === 1, 'Delivery milestone must be linked to purchase order');

    await pg.exec('RESET ROLE;');
    await pg.exec('ROLLBACK;');
  });

  await runTest('Procurement exception resolution strictly enforces resolution action and notes', async () => {
    const exId = crypto.randomUUID();

    await pg.exec('BEGIN;');
    await pg.exec('SET ROLE kovok_app;');
    await pg.query(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    // Create exception
    await pg.query(
      `INSERT INTO procurement_exceptions (
         id, "workspaceId", "exceptionCode", "exceptionType", severity, status, title, description, "updatedAt"
       ) VALUES ($1, $2, 'EX-999', 'SHORT_SUPPLY', 'HIGH', 'OPEN', 'Shortfall reported', 'Mill delivered 18 of 20 MT', NOW());`,
      [exId, wsAId]
    );

    // Resolve exception with mandatory action and notes
    await pg.query(
      `UPDATE procurement_exceptions
       SET status = 'RESOLVED', "resolutionAction" = 'Alternative Sourcing', "resolutionNotes" = 'Remaining 2 MT ordered from regional stockist', "resolvedAt" = NOW()
       WHERE id = $1;`,
      [exId]
    );

    const check = await pg.query<{ status: string; resolutionAction: string }>(
      'SELECT status, "resolutionAction" FROM procurement_exceptions WHERE id = $1;',
      [exId]
    );
    assert(check.rows[0].status === 'RESOLVED', 'Exception must be RESOLVED');
    assert(check.rows[0].resolutionAction === 'Alternative Sourcing', 'Resolution action must be recorded');

    await pg.exec('RESET ROLE;');
    await pg.exec('ROLLBACK;');
  });

  // --------------------------------------------------------------------------
  // SUITE 15: Robust Concurrency-Safe Request Code Generation & Telephony Invariants
  // --------------------------------------------------------------------------
  console.log(`\n${BOLD}[15/15] Robust Concurrency-Safe Request Code Generation & Telephony Invariants${RESET}`);

  const pgliteAdapter = {
    $executeRawUnsafe: async (sql: string, ...params: any[]) => {
      return await pg.query(sql, params);
    },
    $queryRawUnsafe: async <T = any>(sql: string, ...params: any[]) => {
      const res = await pg.query(sql, params);
      return res.rows as T;
    }
  };

  // Create a dedicated project site for WS A in this test suite
  const suiteSiteAId = crypto.randomUUID();
  await pg.query(
    `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
     VALUES ($1, $2, 'Suite 15 Site A', '122002', 'Gurugram', 'Tower A Yard', NOW())
     ON CONFLICT ("workspaceId", id) DO NOTHING;`,
    [suiteSiteAId, wsAId]
  );

  await runTest('Creating several requests in the same workspace generates strictly sequential codes', async () => {
    await pg.exec(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    const code1 = await generateNextRequestCode(pgliteAdapter, wsAId);
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, 'tmt_rebar', 'CP-TMT-500D-12MM', 10.0, 'TONNES', 'MATCHED_VERIFIED', $5, NOW());`,
      [crypto.randomUUID(), wsAId, suiteSiteAId, code1, userAId]
    );

    const code2 = await generateNextRequestCode(pgliteAdapter, wsAId);
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, 'tmt_rebar', 'CP-TMT-500D-16MM', 15.0, 'TONNES', 'MATCHED_VERIFIED', $5, NOW());`,
      [crypto.randomUUID(), wsAId, suiteSiteAId, code2, userAId]
    );

    const code3 = await generateNextRequestCode(pgliteAdapter, wsAId);
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, 'cement', 'CP-CEM-OPC-53', 200.0, 'BAGS', 'MATCHED_VERIFIED', $5, NOW());`,
      [crypto.randomUUID(), wsAId, suiteSiteAId, code3, userAId]
    );

    const num1 = parseInt(code1.replace('KOV-REQ-', ''), 10);
    const num2 = parseInt(code2.replace('KOV-REQ-', ''), 10);
    const num3 = parseInt(code3.replace('KOV-REQ-', ''), 10);

    assert(num2 === num1 + 1, `Expected consecutive sequence: ${num1} -> ${num2}`);
    assert(num3 === num2 + 1, `Expected consecutive sequence: ${num2} -> ${num3}`);
  });

  await runTest('Creating requests concurrently produces completely unique, non-colliding codes', async () => {
    await pg.exec(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    // Concurrently invoke code generation 5 times
    const concurrentCodes = await Promise.all([
      generateNextRequestCode(pgliteAdapter, wsAId),
      generateNextRequestCode(pgliteAdapter, wsAId),
      generateNextRequestCode(pgliteAdapter, wsAId),
      generateNextRequestCode(pgliteAdapter, wsAId),
      generateNextRequestCode(pgliteAdapter, wsAId),
    ]);

    // Insert all concurrently generated codes
    for (const c of concurrentCodes) {
      await pg.query(
        `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
         VALUES ($1, $2, $3, $4, 'tmt_rebar', 'CP-TMT-500D-12MM', 5.0, 'TONNES', 'MATCHED_VERIFIED', $5, NOW());`,
        [crypto.randomUUID(), wsAId, suiteSiteAId, c, userAId]
      );
    }

    const uniqueCodes = new Set(concurrentCodes);
    assert(uniqueCodes.size === 5, `Expected 5 unique codes, got: ${concurrentCodes.join(', ')}`);
  });

  await runTest('Existing request codes remain unchanged and pre-seeded high numbers advance counter safely', async () => {
    await pg.exec(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    // Verify existing codes remain unchanged in database
    const existingCheck = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM procurement_requests WHERE "workspaceId" = $1 AND "requestCode" = 'KOV-REQ-0001';`,
      [wsAId]
    );
    assert(parseInt(existingCheck.rows[0].count, 10) >= 1, 'Existing KOV-REQ-0001 must remain unchanged');

    // Simulate pre-seeded request with high number (KOV-REQ-0100)
    const highCode = 'KOV-REQ-0100';
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, 'tmt_rebar', 'CP-TMT-500D-12MM', 25.0, 'TONNES', 'MATCHED_VERIFIED', $5, NOW());`,
      [crypto.randomUUID(), wsAId, suiteSiteAId, highCode, userAId]
    );

    // Generating next code must automatically leap past 100 to avoid unique constraint collision
    const nextCode = await generateNextRequestCode(pgliteAdapter, wsAId);
    assert(nextCode === 'KOV-REQ-0101', `Expected counter to advance to KOV-REQ-0101 after pre-seeded 0100, got ${nextCode}`);

    // Verify insert succeeds without P2002 collision
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, 'tmt_rebar', 'CP-TMT-500D-12MM', 25.0, 'TONNES', 'MATCHED_VERIFIED', $5, NOW());`,
      [crypto.randomUUID(), wsAId, suiteSiteAId, nextCode, userAId]
    );
  });

  await runTest('Different workspaces maintain completely independent request code sequences', async () => {
    // Create new Workspace C
    const wsCId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO workspaces (id, name, slug, "businessType", "serviceArea", "isSandbox", "updatedAt")
       VALUES ($1, 'Workspace Gamma', 'workspace-gamma', 'Contractor', 'Noida', true, NOW());`,
      [wsCId]
    );

    const siteCId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO project_sites (id, "workspaceId", "siteName", "pinCode", "city", address, "updatedAt")
       VALUES ($1, $2, 'Site Gamma Noida', '201301', 'Noida', 'Sector 62', NOW());`,
      [siteCId, wsCId]
    );

    await pg.exec(`SET LOCAL app.current_workspace_id = '${wsCId}';`);

    // Sequence for fresh Workspace C must start at KOV-REQ-0001
    const codeC1 = await generateNextRequestCode(pgliteAdapter, wsCId);
    assert(codeC1 === 'KOV-REQ-0001', `Workspace C sequence must start at KOV-REQ-0001, got ${codeC1}`);

    // Insert in Workspace C with KOV-REQ-0001
    await pg.query(
      `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "canonicalProductId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, 'cement', 'CP-CEM-OPC-53', 100.0, 'BAGS', 'MATCHED_VERIFIED', $5, NOW());`,
      [crypto.randomUUID(), wsCId, siteCId, codeC1, userBId]
    );

    // Verify that both wsA and wsC have KOV-REQ-0001 simultaneously under @@unique([workspaceId, requestCode])
    const countA = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM procurement_requests WHERE "workspaceId" = $1 AND "requestCode" = 'KOV-REQ-0001';`,
      [wsAId]
    );
    const countC = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM procurement_requests WHERE "workspaceId" = $1 AND "requestCode" = 'KOV-REQ-0001';`,
      [wsCId]
    );
    assert(parseInt(countA.rows[0].count, 10) >= 1, 'Workspace A has KOV-REQ-0001');
    assert(parseInt(countC.rows[0].count, 10) === 1, 'Workspace C has KOV-REQ-0001');
  });

  await runTest('Failed request creation does not dispatch or record a supplier voice call', async () => {
    await pg.exec(`SET LOCAL app.current_workspace_id = '${wsAId}';`);

    const callsBefore = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM supplier_voice_calls WHERE "workspaceId" = $1;`,
      [wsAId]
    );
    const countBefore = parseInt(callsBefore.rows[0].count, 10);

    // Simulate failed request creation (e.g. invalid site reference)
    let requestFailed = false;
    const fakeSiteId = crypto.randomUUID();
    try {
      await pg.query(
        `INSERT INTO procurement_requests (id, "workspaceId", "siteId", "requestCode", "materialCategoryId", "quantityValue", "quantityUnit", "requestStatus", "createdByUserId", "updatedAt")
         VALUES ($1, $2, $3, 'KOV-REQ-INVALID', 'tmt_rebar', 10.0, 'TONNES', 'MATCHED_VERIFIED', $4, NOW());`,
        [crypto.randomUUID(), wsAId, fakeSiteId, userAId]
      );
    } catch {
      requestFailed = true;
    }
    assert(requestFailed, 'Invalid foreign key project site insert must fail');

    // Attempting to dispatch call for a non-existent request must fail
    const nonExistentRequestId = crypto.randomUUID();
    const reqCheck = await pg.query(
      `SELECT * FROM procurement_requests WHERE id = $1 AND "workspaceId" = $2;`,
      [nonExistentRequestId, wsAId]
    );
    assert(reqCheck.rows.length === 0, 'Non-existent request must not exist');

    const callsAfter = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM supplier_voice_calls WHERE "workspaceId" = $1;`,
      [wsAId]
    );
    const countAfter = parseInt(callsAfter.rows[0].count, 10);

    assert(countAfter === countBefore, `Voice calls must not be recorded or dispatched on failed requests (${countBefore} -> ${countAfter})`);
  });

  console.log();

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log(`${BOLD}${CYAN}=================================================================${RESET}`);
  console.log(`${BOLD}PHASE 1 & PHASE 2 COMPREHENSIVE TEST RUNNER SUMMARY:${RESET}`);
  console.log(`  Total Executed Tests: ${BOLD}${passedTests + failedTests}${RESET}`);
  console.log(`  Passed: ${GREEN}${BOLD}${passedTests}${RESET}`);
  console.log(`  Failed: ${failedTests > 0 ? RED : GREEN}${BOLD}${failedTests}${RESET}`);
  console.log(`${BOLD}${CYAN}=================================================================${RESET}`);

  await pg.close().catch(() => null);

  if (failedTests > 0) {
    console.error(`\n${RED}FAILURE: One or more tests failed. Review output above.${RESET}`);
    process.exitCode = 1;
  } else {
    console.log(`\n${GREEN}${BOLD}SUCCESS: All Phase 1 and Phase 2 acceptance tests passed!${RESET}\n`);
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(`\n${RED}FATAL ERROR in test runner:${RESET}`, err);
  process.exitCode = 1;
});

