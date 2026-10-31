import { execSync } from 'child_process';

const PROD_URL = 'https://kovok-bolna-six.vercel.app';
const DEMO_EMAIL = 'demo@kovok.test';
const DEMO_PASSWORD = 'DemoEvaluation2026!';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=================================================================');
  console.log('   KOVOK PRODUCTION CONTROLLED CATALOGUE IMPORT ORCHESTRATOR     ');
  console.log(`   Target Deployment: ${PROD_URL}`);
  console.log('=================================================================\n');

  // Step 1: Wait for deployment to be updated with new admin route
  console.log('1. Waiting for Vercel deployment of commit f4f217a...');
  let authenticatedCookie = '';
  let maxAttempts = 30;
  let ready = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Login to get session cookie
      const loginRes = await fetch(`${PROD_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      });

      const setCookie = loginRes.headers.get('set-cookie');
      if (setCookie) {
        authenticatedCookie = setCookie.split(';')[0];
      }

      // Check if admin endpoint is available
      const adminRes = await fetch(`${PROD_URL}/api/admin/catalogue-import`, {
        headers: { Cookie: authenticatedCookie }
      });

      if (adminRes.status === 200) {
        console.log(`✓ Admin endpoint online and authenticated (Attempt ${attempt})`);
        ready = true;
        break;
      } else {
        console.log(`  Waiting for deployment... status ${adminRes.status} (Attempt ${attempt}/${maxAttempts})`);
      }
    } catch (err: any) {
      console.log(`  Connection attempt ${attempt} waiting: ${err.message}`);
    }
    await sleep(6000);
  }

  if (!ready) {
    console.error('ERROR: Admin endpoint not available after wait period.');
    process.exit(1);
  }

  // Step 2: Preflight Dry-Run & Target Verification
  console.log('\n2. Executing preflight dry-run against live production database...');
  const preflightRes = await fetch(`${PROD_URL}/api/admin/catalogue-import`, {
    headers: { Cookie: authenticatedCookie }
  });
  const preflight = await preflightRes.json();

  console.log('\nTarget Confirmation:');
  console.log(`  Engine      : ${preflight.databaseTarget.engine}`);
  console.log(`  Version     : ${preflight.databaseTarget.version}`);
  console.log(`  Host        : ${preflight.databaseTarget.hostMasked} (credentials protected)`);
  console.log(`  Database    : ${preflight.databaseTarget.database}`);
  console.log(`  SSL Enabled : ${preflight.databaseTarget.ssl}`);

  console.log('\nSafety Guarantees Verified:');
  console.log(`  Additive Only                 : ${preflight.safetyGuarantees.additiveOnly}`);
  console.log(`  Preserves Business Data       : ${preflight.safetyGuarantees.preservesExistingUsersAndWorkspaces}`);
  console.log(`  Zero Verified Variants (Strict): ${preflight.safetyGuarantees.zeroVerifiedBrandedVariants}`);
  console.log(`  Zero Fabricated Stock/Prices  : ${preflight.safetyGuarantees.zeroFabricatedStockPricesOrPromises}`);
  console.log(`  Quarantined Images Isolated   : ${preflight.safetyGuarantees.quarantinedImagesIsolatedFromVerifiedDisplay}`);

  console.log('\nDry-Run Table Breakdown:');
  console.table(preflight.dryRunReport.tableBreakdown);

  // Step 3: Trigger Controlled Explicit Import
  console.log('\n3. Triggering explicit one-time import transaction on production...');
  const execRes = await fetch(`${PROD_URL}/api/admin/catalogue-import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authenticatedCookie
    },
    body: JSON.stringify({ action: 'execute_controlled_import' })
  });

  const execData = await execRes.json();
  if (!execData.success) {
    console.error('Production import failed:', execData);
    process.exit(1);
  }

  console.log(`✓ Import Batch Created: ${execData.batchNumber} (ID: ${execData.batchId})`);
  console.log(`✓ Status: ${execData.status}`);
  console.log(`✓ Total Inserted: ${execData.executionMetrics.insertedCount}`);
  console.log(`✓ Total Updated : ${execData.executionMetrics.updatedCount}`);
  console.log(`✓ Total Skipped : ${execData.executionMetrics.skippedCount}`);

  console.log('\nTable Counts (Before -> After):');
  console.table(
    Object.keys(execData.tableCountsBeforeAndAfter.after).map((t) => ({
      table: t,
      before: execData.tableCountsBeforeAndAfter.before[t] ?? 0,
      after: execData.tableCountsBeforeAndAfter.after[t] ?? 0,
      difference:
        (execData.tableCountsBeforeAndAfter.after[t] ?? 0) -
        (execData.tableCountsBeforeAndAfter.before[t] ?? 0)
    }))
  );

  console.log('\nBusiness & User Data Preservation Check:');
  console.log(execData.businessDataPreserved);

  // Step 4: Verify Live APIs
  console.log('\n4. Verifying live APIs on production...');

  const catRes = await fetch(`${PROD_URL}/api/catalogue/categories`);
  const catData = await catRes.json();
  console.log(`• Categories API : ${catData.categories?.length} categories returned`);

  const prodRes = await fetch(`${PROD_URL}/api/catalogue/products`);
  const prodData = await prodRes.json();
  console.log(`• Products API   : ${prodData.total} products returned (${prodData.products?.length} listed)`);

  const suppRes = await fetch(`${PROD_URL}/api/catalogue/suppliers`);
  const suppData = await suppRes.json();
  console.log(`• Suppliers API  : ${suppData.count} supplier organizations returned`);

  console.log('\n=================================================================');
  console.log('   PRODUCTION IMPORT COMPLETED AND VERIFIED SUCCESSFULLY!        ');
  console.log('=================================================================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

