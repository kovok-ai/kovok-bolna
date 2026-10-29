# Kovok — Production Implementation Plan (Amended)

**Document Status:** Amended Implementation Roadmap  
**Author:** Lead Software Engineer  
**Date:** October 30, 2026 (Amended)  
**Target Environment:** Production Construction Procurement (Indian Market)

---

## 1. Overview & Phasing Strategy

This document outlines the step-by-step engineering roadmap to transition Kovok from the current static HTML concept prototype into a hardened, production-grade modular monolith for construction procurement in India.

The existing UI prototype (`Kovok_Construction_UI_Premium/index.html`) serves as the strict visual and interaction baseline. Its calm industrial layout, table-first scanning density, custom status indicators, and multi-step modals will be preserved and ported into a Next.js 16 App Router application.

### Implementation Phases at a Glance

```
Phase 1: Foundation & Data Architecture (Weeks 1-2)
  ├── Next.js 16.0.x (Active LTS) + Node.js 24.x LTS TypeScript Workspace
  ├── PostgreSQL 16 Schema, Prisma/Drizzle ORM, Dynamic Tax Rules & Seed
  └── Multi-Tenant Workspace & Server Session Auth with Transactional RLS
          │
          ▼
Phase 2: Core Domain APIs & State Machine (Weeks 3-4)
  ├── Versioned Standards (IS 1786 Fe 415-Fe 600, Drafts & Cement Standards)
  ├── Supplier Directory with Serviceability & Calling Rules
  └── Procurement Request Intake & Specification Normalizer
          │
          ▼
Phase 3: Sarvam Voice Agent & Line-Item Quote Normalization (Weeks 5-6)
  ├── Sarvam Voice Client, Prompts, & Postgres-Backed Transactional Worker
  ├── Token-Guarded, Schema-Validated, Correlated Webhook Ingestion Engine
  └── Deterministic Line-Item Cost Calculator & Comparability Matrix
          │
          ▼
Phase 4: Gated Approvals, Orders, & Delivery Tracking (Weeks 7-8)
  ├── Dual-Gate Anti-Duplicate Approval & Split-Order Creation Engine
  ├── Immutable PO Generation with Canonical JSON Snapshot & Checksum
  └── Construction Gate Receiving (GRN) & Weighment Reconciliation
          │
          ▼
Phase 5: Exception Management & Enterprise Integrations (Weeks 9-10)
  ├── Shortfall, ETA Change, & Quality Exception State Machine
  ├── CSV / Excel Importer with Pre-flight Validation
  └── ERPNext Bidirectional Connector
          │
          ▼
Phase 6: Hardening, Security, Auditing & Cloud Deployment (Weeks 11-12)
  ├── Automated Test Suite (All Critical Acceptance & Edge Cases)
  ├── DPDP Compliance, Audit Logging & Private Storage Encryption
  └── Container Deployment on Verified India Cloud Infrastructure
```

---

## Phase 1: Foundation, Workspace Data Models, Migrations & Auth

### Objectives
- Establish the production TypeScript full-stack workspace targeting **Node.js 24.x LTS** and **Next.js 16.0.x (Active LTS)** with React 19.x.
- Set up PostgreSQL database with Prisma ORM, declarative migrations, dynamic tax rules table (`tax_rate_rules`), and strict relational constraints.
- Implement server-side session authentication with `HttpOnly`, `Secure`, and `SameSite=Lax` cookies.
- Implement transaction-local Row-Level Security (`SET LOCAL app.current_workspace_id = ...`) to prevent connection pool bleed.
- Isolate development fixtures from production seed scripts.

### Files & Modules Involved
- `package.json`, `tsconfig.json`, `next.config.js`
- `src/styles/tokens.css`, `src/styles/globals.css` (porting all CSS tokens from `index.html`)
- `prisma/schema.prisma` (initial schema: `workspaces`, `users`, `roles`, `project_sites`, `workspace_rule_profiles`, `tax_rate_rules`)
- `src/lib/db.ts` (Prisma client singleton with connection pooling)
- `src/lib/auth.ts` (Session validation, password hashing with Argon2id)
- `src/middleware.ts` (Tenant context injection and route protection)
- `prisma/seed.ts` (Sample fixtures isolated for `NODE_ENV === 'development'`)

### Key Dependencies
- `next@16.0.4`, `react@19.x`, `react-dom@19.x`, `typescript`
- `@prisma/client`, `prisma`
- `zod`, `argon2`, `lucia` (or `iron-session`)

### Acceptance Criteria
1. The web application compiles in TypeScript without errors and renders the global shell (sidebar, topbar, workspace switcher) preserving the prototype's exact visual style.
2. Users can authenticate (login, logout, session refresh) and switch between authorized workspaces.
3. Database migrations run deterministically via `npx prisma migrate deploy`.
4. Running `prisma/seed.ts` creates baseline development fixtures only in non-production environments.
5. `tax_rate_rules` table seeds baseline historical and current tax rules (e.g. cement pre-22 Sept 2025 at 28%, post-22 Sept 2025 at 18%; TMT steel at 18%).

### Testing Plan
- **Unit Tests:** Password hashing, session token generation and expiry, Zod environment variable validation.
- **Integration Tests:** Database migration rollout/rollback, workspace tenant isolation queries under simulated connection pool reuse.

---

## Phase 2: Core Domain APIs & Procurement State Machine

### Objectives
- Model and implement Indian construction materials catalogue with versioned reference data for IS standards:
  - TMT Steel: IS 1786:2008 covering all canonical grades (`Fe 415, Fe 415D, Fe 500, Fe 500D, Fe 550, Fe 550D, Fe 600`) and draft revision handling.
  - Cement: IS 269:2015, IS 1489:2015, IS 455, IS 16415.
- Dynamic MTC requirement rules configured per buyer/project specification rather than universal global assumptions.
- Build the supplier directory with geolocation, serviceable PIN codes, and authorized calling windows.
- Implement the 4-step Procurement Request intake wizard with structured specification validation.

### Files & Modules Involved
- `prisma/schema.prisma` (adding `products`, `product_variants`, `material_standards`, `standard_revisions`, `suppliers`, `supplier_contacts`, `procurement_requests`)
- `src/app/api/v1/catalog/route.ts` (Catalogue search, filtering by brand/grade/standard)
- `src/app/api/v1/suppliers/route.ts` (Supplier listing, PIN code matching, capacity filters)
- `src/app/api/v1/requests/route.ts` (CRUD for procurement requests, state transitions)
- `src/components/requests/RequestWizardModal.tsx` (Ported from `requestWizard()`)
- `src/components/catalog/CatalogTable.tsx` (Ported from `catalogPage()`)
- `src/components/suppliers/SupplierTable.tsx` (Ported from `suppliersPage()`)
- `src/lib/validators/materialSchemas.ts` (Zod schemas for all IS 1786 TMT grades and cement types)

### Key Dependencies
- `zod`, custom SVG icons matching prototype

### Acceptance Criteria
1. TMT steel requests validate diameter bounds (4–50 mm) and grade against effective IS 1786 reference data.
2. Draft revisions of standards are stored as versioned reference data and prevented from being set as the binding standard until officially approved.
3. Quality documentation (MTC) is flagged as required only when mandated by project specifications, contracts, or site policies.
4. Requests validate delivery PIN codes and promised deadlines before persisting.

### Testing Plan
- **Unit Tests:** Specification validator tests (validating IS 1786 diameter bounds, cement type rules).
- **Integration Tests:** Request creation API; supplier query filtered by delivery PIN code.

---

## Phase 3: Sarvam Voice Agent & Line-Item Quote Normalization Engine

### Objectives
- Integrate with Sarvam AI outbound call APIs using a durable, PostgreSQL-backed transactional worker (e.g. Graphile Worker / Pg-Boss).
- Implement verified webhook security:
  - Secret endpoint ingestion token (`?token=...`)
  - Strict Zod schema validation against Sarvam's documented payload (`attempt_id`, `status`, `interaction_id`, `final_agent_variables`, `transcript`)
  - Correlation strictly to internally initiated call attempts (`attempt_id`)
  - Rate limiting and server-side verification poll (`GET /voice-agents/outbound/:attempt_id`)
- Build the deterministic line-item quote calculation engine and comparability matrix.

### Files & Modules Involved
- `src/lib/sarvam/client.ts` (Sarvam API client for voice agent call creation)
- `src/lib/sarvam/prompts.ts` (Prompt templates in Hindi, English, and Hinglish for trade RFQs)
- `src/workers/callScheduler.worker.ts` (PostgreSQL-backed worker handling call dispatch and rate limiting)
- `src/app/api/v1/webhooks/sarvam/route.ts` (Token validation, schema validation, attempt correlation, quote parsing)
- `src/lib/quotations/lineItemCalculator.ts` (Deterministic calculation of taxable base, effective GST rate from `tax_rate_rules`, freight, and unloading)
- `src/lib/quotations/comparability.ts` (Evaluates completeness: quote is incomplete ONLY if a material cost or term is `UNKNOWN` and relevant)
- `src/components/quotations/QuotationMatrix.tsx` (Ported from `quotesPage()`)

### Key Dependencies
- `graphile-worker` (or `pg-boss`)

### Acceptance Criteria
1. Calls to suppliers are dispatched only during configured business hours (10:00 - 18:00 IST weekdays); out-of-hours requests are queued for next business morning.
2. Webhooks require valid secret ingestion token; un-correlated `attempt_id` callbacks are rejected.
3. Webhook callbacks update quote candidate evidence, but **never independently create a PO or bypass buyer approval**.
4. Quotations missing freight or unloading are marked as `Non-comparable (Incomplete)` only if relevant to the delivery basis; if `INCLUDED_IN_MATERIAL` or `NOT_APPLICABLE`, they are marked comparable.
5. Calculated payable total is compared with supplier quoted total, and commercial variances are flagged.

### Testing Plan
- **Unit Tests:** Line-item cost calculation with tax-inclusive vs tax-exclusive prices; comparability logic with `INCLUDED`, `NOT_APPLICABLE`, and `UNKNOWN` terms.
- **Integration Tests:** Webhook endpoint testing with valid token, invalid token, un-correlated attempt ID, and duplicate replay attack.
- **Mock Voice Tests:** `MockSarvamVoiceProvider` simulating complete multi-turn supplier quotes.

---

## Phase 4: Buyer Approval Engine, Orders, & Delivery Reconciliation

### Objectives
- Enforce the core business invariant: **Buyer pays supplier directly; Kovok must never create an order without verified buyer authorization**.
- Implement order authorization gate supporting **split/partial fulfillment** without overly restrictive unique constraints.
- Require client-supplied `idempotency_key` and unique `approval_id` to prevent duplicate submissions.
- Store canonical JSON snapshot of approved commercial terms along with SHA-256 checksum on the PO.
- Build construction site gate receiving (GRN) tracking delivery challans, weighbridge slips, and condition inspection.

### Files & Modules Involved
- `prisma/schema.prisma` (adding `approvals`, `purchase_orders`, `gate_receipts`, `audit_logs`)
- `src/lib/approvals/approvalService.ts` (Authorization checks, canonical JSON snapshot generation, SHA-256 checksum)
- `src/app/api/v1/approvals/route.ts` (Endpoint for authorized buyer approval submission)
- `src/app/api/v1/orders/route.ts` (PO retrieval, dispatch tracking, receipt recording)
- `src/components/orders/OrdersTable.tsx` (Ported from `ordersPage()`)
- `src/components/orders/ReceiptModal.tsx` (Gate receipt entry: weighbridge gross/tare, bag count, condition)

### Key Dependencies
- Built-in Node.js `crypto` for SHA-256 canonical hashing

### Acceptance Criteria
1. Only users with role `OWNER` or `APPROVER` can approve quotes above the configured competitive threshold.
2. Double-clicking or simultaneous approval requests produce exactly one Purchase Order per approval version.
3. Split fulfillment allows generating distinct POs from split approvals of a quotation without constraint violation.
4. Approved purchase orders display the notice: "Payment terms: Direct Buyer-to-Supplier. Kovok does not hold funds."
5. Site gate receiving records gross/tare weighment and flags weight shortages exceeding IS standard tolerance (±0.5% for steel).

### Testing Plan
- **Concurrency & Idempotency Tests:** Simulated simultaneous approval requests verifying that idempotency keys and database constraints prevent double orders.
- **Split Order Tests:** Validating multiple POs created for split quantities under distinct approval records.
- **RBAC Tests:** Unauthorized user role attempting to approve a quote returns HTTP 403 Forbidden.

---

## Phase 5: Exception Management & Enterprise Integrations

### Objectives
- Implement recovery state machine for procurement exceptions (supplier shortfalls, delayed ETAs, quality/rust issues at receipt).
- Build the CSV/Excel importer with schema validation, dry-run previews, and row-level error reporting.
- Build a working connector for ERPNext to sync item masters, supplier lists, and push approved POs.

### Files & Modules Involved
- `src/lib/exceptions/exceptionService.ts` (Lifecycle management: `Detected` $\rightarrow$ `Investigating` $\rightarrow$ `Resolved`)
- `src/app/api/v1/exceptions/route.ts` (CRUD and recovery actions for exceptions)
- `src/components/exceptions/ExceptionsQueue.tsx` (Ported from `exceptionsPage()`)
- `src/components/exceptions/RecoveryModal.tsx` (Ported from `recoveryModal()`)
- `src/lib/integrations/csvImporter.ts` (Streaming CSV parser, validation against Zod schemas)
- `src/lib/integrations/erpnextClient.ts` (ERPNext REST API client: sync items, suppliers, purchase orders)
- `src/components/integrations/IntegrationsView.tsx` (Ported from `integrationsPage()`)

### Key Dependencies
- `papaparse`, `xlsx`
- Native `fetch` with retry handling

### Acceptance Criteria
1. Supplier shortfall of 8 tonnes on a 20-tonne order generates an open exception and provides structured options (find alternative supplier vs accept revised schedule).
2. CSV import displays a preview table with valid rows, invalid rows, and clear error reasons before committing to database.
3. Connected ERPNext integration verifies API key/secret, tests connection, and respects ERPNext as the master source for supplier records.

### Testing Plan
- **Unit Tests:** CSV importer parsing valid and malformed files; exception state machine transition validation.
- **Integration Tests:** ERPNext mock server test verifying authenticated synchronization and error handling.

---

## Phase 6: Production Hardening, Security, Auditing & Deployment

### Objectives
- Implement mandatory automated acceptance test suite covering all core requirements and domain edge cases.
- Implement immutable audit logging for all commercial and voice actions.
- Enforce strict security: HTTP security headers, CORS policies, rate limiting, and private cloud storage pre-signed URLs.
- Containerize the application and deploy on verified Indian cloud infrastructure.

### Files & Modules Involved
- `Dockerfile`, `docker-compose.yml`
- `.github/workflows/ci.yml` (Linting, type checking, unit/integration tests, Playwright E2E)
- `src/lib/audit/auditLogger.ts` (Append-only audit trail logger)
- `tests/e2e/procurement-flow.spec.ts` (Playwright E2E test suite)
- `src/lib/storage/s3Client.ts` (Encrypted object storage with pre-signed upload/download URLs)

---

## 2. Mandatory Acceptance Test Suite

The automated test suite must implement and pass the following 10 critical domain and security test cases before production release:

| # | Test Identifier | Test Scope & Assertion Criteria |
| :- | :--- | :--- |
| **1** | `test_tax_rate_effective_date_handling` | Verifies dynamic tax resolution: a transaction dated before 22 Sept 2025 resolves cement GST at 28%; a transaction dated on or after 22 Sept 2025 resolves cement GST at 18%. |
| **2** | `test_quote_tax_inclusive_vs_exclusive` | Asserts that line-item tax math correctly computes payable totals for tax-exclusive quotes (base + tax) and back-calculates taxable base for tax-inclusive quotes without double counting. |
| **3** | `test_incomplete_freight_and_handling_handling` | Confirms that quotes with `UNKNOWN` freight/unloading are marked `Non-comparable (Incomplete)`, while quotes with `INCLUDED_IN_MATERIAL` or `NOT_APPLICABLE` remain `Comparable`. |
| **4** | `test_stale_and_duplicate_webhooks` | Transmits duplicate Sarvam webhook payloads with identical `attempt_id`; asserts that the second payload returns HTTP 200 without duplicate quote creation or state corruption. |
| **5** | `test_unexpected_attempt_ids` | Sends a Sarvam webhook with an unknown or expired `attempt_id`; asserts that the system rejects/drops the payload and flags an audit warning. |
| **6** | `test_cross_tenant_data_access` | Simulates concurrent database queries across two distinct workspaces using pooled connections; asserts that `SET LOCAL app.current_workspace_id` strictly isolates data and prevents cross-tenant leakage. |
| **7** | `test_duplicate_approval_submissions` | Submits concurrent approval requests for the same quotation using identical `idempotency_key`; asserts that exactly one Purchase Order is generated and the second request returns the existing PO. |
| **8** | `test_split_partial_fulfilment` | Approves a partial quantity (e.g. 12 of 20 tonnes) on Quotation A (generating PO-1), followed by approving the balance (8 tonnes) on Quotation B (generating PO-2); asserts both POs are created without constraint violation. |
| **9** | `test_material_grade_mismatch` | Submits a request for TMT `Fe 550D` where the supplier quote extraction returns `Fe 500`; asserts that the system flags a specification mismatch exception and prevents automated recommendation. |
| **10** | `test_no_po_without_verified_approval` | Attempts to invoke the order creation endpoint directly without a valid, approved approval record; asserts that the system strictly rejects with HTTP 403 Forbidden. |

---

## 3. Unresolved Decisions & Open Inquiries

| # | Topic | Current Recommendation | Open Question / Alternative (Needs Confirmation) |
| :- | :--- | :--- | :--- |
| **1** | **Sarvam Webhook Cryptographic Signing** | Use secret endpoint URL token + schema validation + `attempt_id` correlation + server-side verification poll. | *Inquiry with Sarvam Support:* Does Sarvam plan to provide an HMAC signature header or published webhook egress IP ranges for outbound voice callbacks? |
| **2** | **Telephony Carrier & Caller ID** | Use Sarvam hosted outbound calling during Phase 3. | Does the buyer require bringing their own telephony trunk (e.g., Exotel / Tata Tele / Airtel) to display their enterprise caller ID to local suppliers? |
| **3** | **Cloud Provider & Region Selection** | Evaluate AWS `ap-south-1` (Mumbai), GCP `asia-south1` (Mumbai), and Azure `centralindia` (Pune). | Final selection pending latency benchmarks, managed PostgreSQL pricing, and tenant data handling requirements under the Indian DPDP Act. |
| **4** | **ERP Connector Priority** | Focus development on ERPNext as the primary supported connector in Phase 5, alongside CSV/Excel. | Should TallyPrime integration (requiring a local Windows agent) or Zoho Books take precedence after ERPNext based on target customer onboarding demand? |
| **5** | **Live GSTIN Verification Integration** | Use regex and checksum validation in Phase 2; evaluate live GSP API in Phase 5. | Should Kovok subscribe to a live GST verification API (e.g., ClearTax / Karza / Sandbox) during supplier onboarding to verify GSTIN active status and filing frequency? |
| **6** | **Payment Confirmation Tracking** | Buyer pays supplier directly. Buyer records payment by entering UTR / NEFT reference number. | Is UTR recording sufficient, or should Kovok support bank statement upload / account aggregator integration to auto-match payments? |
