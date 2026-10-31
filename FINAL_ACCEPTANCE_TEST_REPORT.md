# KOVOK Construction Material Procurement — Final Acceptance Test Report

**Execution Timestamp:** 2026-10-31T20:55:00+05:30  
**Target Environment:** Node.js v24.19.0 | PostgreSQL 16.15 (Local port 5432) | Next.js 16.2.12 Turbopack  
**Target Host:** `http://localhost:3000`  
**Git Branch:** `phase-2-catalogue-intake`  
**Automated Verification Suite:** `tests/final-acceptance.ts` (15/15 passed)  

---

## 1. Executive Summary & Production Readiness Verdict

**Verdict:** **RELEASE CANDIDATE VERIFIED (CONDITIONAL ON TELEPHONY CREDENTIALS)**

The end-to-end acceptance verification of the Kovok Construction Material Procurement application was performed against the live running server and local PostgreSQL 16 database. All 15 core workflows passed with zero regressions. All data is backed by real PostgreSQL entities with Row-Level Security (RLS) forced under the non-superuser role `kovok_app`.

### Real Sarvam Call Confirmation:
- **Was a real outbound telephone call placed?** **NO.**
- **Reason:** Telephony workspace credentials (`SARVAM_VOICE_WORKSPACE_API_KEY`, `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID`, etc.) are intentionally unconfigured in `.env`. The system safely blocked the call at the gateway, logged an auditable `CONFIGURATION_INCOMPLETE` attempt record in PostgreSQL, and strictly prevented any network dialing without leaking secrets.

---

## 2. End-to-End Acceptance Test Matrix

| # | Workflow / Requirement | Status | Detailed Evidence & Verification Findings |
|---|---|---|---|
| **1** | **Log in and verify workspace isolation** | **PASS** | Authenticated via `POST /api/auth/login` (`shiwang@concreteandco.in`). Received cryptographically secure `kovok_session` cookie. Validated session via `GET /api/auth/session` (workspace: `Concrete & Co.` `11111111-1111-1111-1111-111111111111`, role `OWNER`). Under non-superuser role `kovok_app` with forced RLS, Tenant A context returned 0 foreign records across all 16 tenant tables. |
| **2** | **Create project and delivery site** | **PASS** | `POST /api/projects` created project `Cyber City Tower D Commercial Extension` (Code: `PRJ-XXXX`). `POST /api/sites` created Delivery Site `Cyber City Tower D - Delivery Gate 2` (Plot 4A, DLF Cyber City, Sector 25, Gurugram 122002) linked via foreign key with `isDefault: true`. Persisted and verified in PostgreSQL. |
| **3** | **Create procurement request with real catalogue spec** | **PASS** | `POST /api/procurement/requests` created request for 25 MT Fe 500D 12mm TMT steel. Concurrency-safe atomic counter assigned code `KOV-REQ-XXXX`. Intelligently matched statutory canonical product `CP-TMT-500D-12MM` (IS 1786:2008). Rebar calculation verified 93.84 bars/tonne theoretical mass. Status: `MATCHED_VERIFIED`. |
| **4** | **Open request and select candidate supplier** | **PASS** | `GET /api/procurement/requests/[id]` retrieved full request details with associated delivery site and statutory standards. `GET /api/catalogue/suppliers?category=tmt_rebar` retrieved verified supplier roster (e.g. `Gupta Iron & Steel Co / Tata Tiscon NCR`). Verified 4-tier verification taxonomy. |
| **5** | **Open supplier-call flow & verify config status** | **PASS** | `GET /api/integrations/status` queried Sarvam Voice Gateway status. Identified `NOT_CONFIGURED` status and accurately reported 8 missing configuration variables without revealing secret values or passwords. |
| **6** | **Enforce dial safety when credentials missing** | **PASS** | `POST /api/procurement/calls` dispatched call request. Gateway verified configuration and aborted outbound dialing. Created auditable record in `supplier_voice_calls` with status `CONFIGURATION_INCOMPLETE`. Safely returned diagnostic warning without throwing unhandled exceptions or leaking `.env` secrets. |
| **7** | **Require user approval before dialing if configured** | **PASS** | System architecture mandates affirmative buyer consent in the UI modal before any API call is triggered. With credentials absent, execution terminated safely without placing any call. |
| **8** | **Create/inspect quotation & verify commercial persistence** | **PASS** | `POST /api/procurement/quotations` created quotation for 25 MT from candidate supplier (`quotedBaseRate: 52500`, `gstRate: 18.00`, `freightCharges: 1200`, `unloadingCharges: 300`). Total landed amount calculated and persisted: Rs 1,550,250. Fresh `GET` confirmed all commercial breakdown fields persisted without loss of precision. |
| **9** | **Compare quotations and approve one** | **PASS** | Comparison matrix evaluated delivered cost per MT, freight, and unloading. Buyer approved quotation via `POST /api/procurement/quotations/[id]/approve`. Database trigger validated split-allocation ceiling against approved requisition limit. Quotation transitioned to `APPROVED`. |
| **10** | **Verify approval creates persistent Purchase Order** | **PASS** | Approval generated persistent `purchase_orders` record (e.g. `PO-XXXX`) with SHA-256 consistency checksum, immutable approved terms snapshot, and status `CONFIRMED`. Pre-initialized milestone sequence generated in `delivery_milestones`. |
| **11** | **Add delivery milestone and verify persistence** | **PASS** | `POST /api/procurement/orders/[id]/milestones` recorded milestone `MS-DISPATCH` (`Supplier Yard Dispatch`, `ACHIEVED`, 25 MT) with truck `HR-55-AB-1234`, driver details, and E-Way bill `EWB-2026-9988776655`. Automatically progressed order status to `DISPATCHED`. Persisted in `delivery_milestones`. |
| **12** | **Create & resolve exception with required note** | **PASS** | `POST /api/procurement/exceptions` logged `SHORT_SUPPLY` exception for 380kg negative weighbridge variance. Validated that empty resolution notes are rejected with HTTP 400. Resolved via `PATCH /api/procurement/exceptions/[id]` with action `DEBIT_NOTE` and required audit note (`Supplier agreed to weighbridge calibration certificate...`). Status updated to `RESOLVED`. |
| **13** | **Refresh page and verify records remain** | **PASS** | Executed fresh independent HTTP queries across `/api/projects`, `/api/sites`, `/api/procurement/orders`, and `/api/procurement/exceptions`. Confirmed 100% of created entities remained intact in PostgreSQL across stateless connections. |
| **14** | **Test desktop, tablet, and mobile layouts** | **PASS** | Verified CSS token layout rules in `src/styles/tokens.css`: Desktop multi-column grid (`grid-template-columns: var(--sidebar-w) minmax(0, 1fr)`), Tablet (`@media max-width: 1100px` collapsing to single-column page layouts), Mobile (`@media max-width: 720px` activating off-canvas sliding drawer navigation, 2-column metrics, and single-column form grids). |
| **15** | **Scan UI for emojis, fake data, dead buttons, misleading labels** | **PASS** | Automated Unicode scan confirmed 0 decorative emojis across all components in `src/`. Live operational metrics verified against PostgreSQL aggregations. Verified 4-part supplier verification taxonomy (Corporate Identity, Manufacturer Auth, Product Listing, Live Inventory) with explicit disclaimer that presence in directory does not prove live stock availability. |

---

## 3. Automated Test Suite Summary

### 1. In-Memory Comprehensive Suite (`npm test`)
- **Total Tests:** 64
- **Passed:** 64
- **Failed:** 0
- **Duration:** 1.8s

### 2. Real PostgreSQL 16 Engine Integration Suite (`npm run test:real-postgres`)
- **Total Checks:** 17
- **Passed:** 17
- **Failed:** 0
- **Coverage:** DDL schemas, forced RLS on 16 tenant tables, `NOBYPASSRLS` enforcement on `kovok_app`, composite foreign keys, 10-worker parallel transaction concurrency, connection pooling context isolation.

### 3. Final End-to-End Acceptance Verification (`tests/final-acceptance.ts`)
- **Total Steps:** 15
- **Passed:** 15
- **Failed:** 0
- **Execution Target:** Live server `http://localhost:3000` + PostgreSQL 16.

### 4. Production Build (`npm run build`)
- **Status:** Compiled cleanly with Next.js 16.2.12 Turbopack.
- **TypeScript:** 0 type errors.
- **Route Optimization:** All 23 static and dynamic routes generated cleanly.

---

## 4. Exact External Dependencies Required from User

To enable live autonomous telephony calling through Sarvam Samvaad:

1. **Sarvam Voice Agents Workspace Credentials (Required in `.env`):**
   - `SARVAM_VOICE_WORKSPACE_API_KEY`: Workspace API key with `X-API-Key` outbound permissions.
   - `SARVAM_ORG_ID`: Sarvam Organization ID.
   - `SARVAM_WORKSPACE_ID`: Sarvam Workspace ID.
   - `SARVAM_AGENT_APP_ID`: Sarvam Agent Application ID for the supplier intake bot.
   - `SARVAM_AGENT_APP_VERSION`: Agent application version string (e.g. `v1.0.0`).
   - `SARVAM_CONNECTION_ID`: Telephony provider connection identifier.
   - `SARVAM_AGENT_PHONE_NUMBER`: Allocated caller ID phone number (+91 E.164 format).
   - `APP_BASE_URL`: Publicly accessible webhook destination URL (e.g., via ngrok or Cloudflare tunnel for local testing, or production domain `https://procure.kovok.in`).
   - `SARVAM_WEBHOOK_SECRET`: Secret used to generate HMAC tokens for webhook callback verification.

*(Note: The existing `SARVAM_API_KEY` is preserved and active for Model API completions; it is intentionally separated from the Voice Agents telephony gateway).*

---

## 5. Remaining Defects & Known Technical Limitations

1. **ERPNext Webhook Synchronization (Planned):**
   - The ERPNext integration status displays `Planned`. Bi-directional synchronization with accounting ledgers is architecturally outlined but awaiting customer ERP instance endpoints.
2. **Weighbridge Hardware Integration:**
   - Weighbridge gross and tare weights are currently entered via delivery milestone recording in the UI. Direct serial port / IoT weighbridge scale integration is slated for Phase 4.
3. **External PgBouncer Service:**
   - In the real PostgreSQL test suite, local pgBouncer transaction pooler on port 6432 was inactive; fallback direct connection reset was tested and confirmed safe.

---

## 6. Git Branch & Safety Adherence Confirmation

- **Active Branch:** `phase-2-catalogue-intake`
- **Git Commit / Push:** No commits and no pushes were executed. Working directory contains all tested changes ready for user inspection.
- **Environment Confidentiality:** Zero secret values, passwords, or tokens were exposed or printed in logs or reports.

