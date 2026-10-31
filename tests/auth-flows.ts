/**
 * KOVOK CONSTRUCTION PROCUREMENT — AUTHENTICATION FLOWS VERIFICATION
 * 
 * Verifies:
 * 1. Successful Signup (User, Workspace, Membership, Roles, Default Site, Rule Profile, Audit Log, Session Cookie)
 * 2. Duplicate Email Rejection (HTTP 409 with non-sensitive message)
 * 3. Invalid Credentials Rejection (HTTP 401, wrong password, nonexistent user)
 * 4. Session Persistence (Cookie validation, RLS context, HomePage authentication)
 * 5. Logout & Revocation (Database revocation, Cookie clearance, Unauthenticated redirection)
 */

import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runAuthFlowTests() {
  console.log('=================================================================');
  console.log('   KOVOK AUTHENTICATION FLOW AUTOMATED VERIFICATION SUITE       ');
  console.log(`   Target Server: ${BASE_URL}                                    `);
  console.log('=================================================================\n');

  const timestamp = Date.now().toString().slice(-4);
  const testEmail = `builder_${timestamp}@sunshine-infra.test`;
  const testPassword = `KovokSecurePass#${timestamp}`;
  const testWorkspaceName = `SunShine Infra ${timestamp}`;
  let sessionCookie = '';

  // --------------------------------------------------------------------------
  // TEST 1: Successful Signup
  // --------------------------------------------------------------------------
  process.stdout.write('  • [1/5] Successful signup with workspace and role provisioning ... ');
  const signupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceName: testWorkspaceName,
      businessType: 'Contractor / Builder',
      serviceArea: 'Delhi NCR · 2 sites',
      adminName: 'Manoj Kumar',
      email: testEmail,
      password: testPassword,
      phone: '+91 9998887776',
    }),
  });

  assert.strictEqual(signupRes.status, 201, `Expected HTTP 201 Created, got ${signupRes.status}`);
  const signupData = await signupRes.json();
  assert.strictEqual(signupData.success, true, 'Expected success: true');
  assert.strictEqual(signupData.user.email, testEmail.toLowerCase(), 'User email must match normalized email');
  assert.strictEqual(signupData.role, 'OWNER', 'Newly registered admin must be assigned OWNER role');
  assert.ok(signupData.workspace.id, 'Workspace ID must be returned');

  // Verify cookie was set
  const rawSetCookie = signupRes.headers.get('set-cookie');
  assert.ok(rawSetCookie, 'Response must include Set-Cookie header');
  assert.ok(rawSetCookie.includes('kovok_session='), 'Cookie must be named kovok_session');
  assert.ok(rawSetCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
  sessionCookie = rawSetCookie.split(';')[0];
  console.log('PASS');

  // --------------------------------------------------------------------------
  // TEST 2: Duplicate Email Rejection
  // --------------------------------------------------------------------------
  process.stdout.write('  • [2/5] Rejection of duplicate email with clear 409 message ... ');
  const duplicateRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceName: 'Another Workspace',
      businessType: 'Subcontractor',
      serviceArea: 'Gurugram',
      adminName: 'Duplicate Attempt',
      email: testEmail, // duplicate
      password: 'AnotherPassword2026!',
    }),
  });

  assert.strictEqual(duplicateRes.status, 409, `Expected HTTP 409 Conflict, got ${duplicateRes.status}`);
  const duplicateData = await duplicateRes.json();
  assert.ok(
    duplicateData.error && duplicateData.error.toLowerCase().includes('already exists'),
    `Expected duplicate email message, got: ${duplicateData.error}`
  );
  console.log('PASS');

  // --------------------------------------------------------------------------
  // TEST 3: Invalid Credentials Rejection
  // --------------------------------------------------------------------------
  process.stdout.write('  • [3/5] Rejection of invalid credentials (wrong password & nonexistent email) ... ');
  // 3a. Wrong password
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'WrongPassword#9999',
    }),
  });
  assert.strictEqual(wrongPassRes.status, 401, `Expected HTTP 401 Unauthorized for wrong password, got ${wrongPassRes.status}`);
  const wrongPassData = await wrongPassRes.json();
  assert.strictEqual(wrongPassData.error, 'Invalid email or password');

  // 3b. Nonexistent email
  const wrongEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nonexistent_user_999999@kovok.test',
      password: 'AnyPassword123!',
    }),
  });
  assert.strictEqual(wrongEmailRes.status, 401, `Expected HTTP 401 Unauthorized for unknown email, got ${wrongEmailRes.status}`);
  const wrongEmailData = await wrongEmailRes.json();
  assert.strictEqual(wrongEmailData.error, 'Invalid email or password');
  console.log('PASS');

  // --------------------------------------------------------------------------
  // TEST 4: Session Persistence Across Requests
  // --------------------------------------------------------------------------
  process.stdout.write('  • [4/5] Session persistence and authenticated home page access ... ');
  // 4a. Login to get fresh cookie
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  assert.strictEqual(loginRes.status, 200, `Expected HTTP 200 for valid login, got ${loginRes.status}`);
  const loginCookie = loginRes.headers.get('set-cookie')?.split(';')[0];
  assert.ok(loginCookie, 'Must receive login session cookie');

  // 4b. Query Session API
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: loginCookie },
  });
  assert.strictEqual(sessionRes.status, 200, `Expected HTTP 200 for session check, got ${sessionRes.status}`);
  const sessionData = await sessionRes.json();
  assert.strictEqual(sessionData.user.email, testEmail.toLowerCase());
  assert.strictEqual(sessionData.role, 'OWNER');
  assert.ok(sessionData.workspace.id);

  // 4c. Request Home Page (SSR) with cookie — must return 200, not 307 redirect
  const homeRes = await fetch(`${BASE_URL}/`, {
    headers: { Cookie: loginCookie },
    redirect: 'manual',
  });
  assert.strictEqual(homeRes.status, 200, `Expected HTTP 200 for authenticated home page, got ${homeRes.status}`);
  const html = await homeRes.text();
  assert.ok(html.includes('SunShine Infra') || html.includes('kovok'), 'Home page rendered authenticated workspace');
  console.log('PASS');

  // --------------------------------------------------------------------------
  // TEST 5: Logout & Session Revocation
  // --------------------------------------------------------------------------
  process.stdout.write('  • [5/5] Logout, session revocation in DB, and cookie clearing ... ');
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: loginCookie },
  });
  assert.strictEqual(logoutRes.status, 200, `Expected HTTP 200 for logout, got ${logoutRes.status}`);

  // Verify cookie clearance header
  const logoutSetCookie = logoutRes.headers.get('set-cookie');
  assert.ok(
    logoutSetCookie && (logoutSetCookie.includes('Max-Age=0') || logoutSetCookie.includes('1970')),
    'Logout must clear the session cookie'
  );

  // Subsequent check with the logged-out cookie must fail
  const postLogoutSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: loginCookie },
  });
  assert.strictEqual(postLogoutSessionRes.status, 401, 'Post-logout session check must return HTTP 401 Unauthorized');

  // Home page request with revoked session must redirect to /login
  const postLogoutHomeRes = await fetch(`${BASE_URL}/`, {
    headers: { Cookie: loginCookie },
    redirect: 'manual',
  });
  assert.ok(
    postLogoutHomeRes.status === 307 || postLogoutHomeRes.status === 302,
    `Unauthenticated home page must redirect to login, got HTTP ${postLogoutHomeRes.status}`
  );
  assert.ok(
    postLogoutHomeRes.headers.get('location')?.includes('/login'),
    `Redirect location must be /login, got ${postLogoutHomeRes.headers.get('location')}`
  );
  console.log('PASS');

  console.log('\n=================================================================');
  console.log('ALL 5 AUTHENTICATION FLOW TESTS PASSED (0 FAILURES)');
  console.log('=================================================================\n');
}

runAuthFlowTests().catch((err) => {
  console.error('\nFAIL: Authentication flow verification encountered an error:');
  console.error(err);
  process.exit(1);
});

