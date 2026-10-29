# Kovok — Production Implementation Plan (Amended & Corrected)

**Document Status:** Amended Implementation Roadmap  
**Author:** Lead Software Engineer  
**Date:** October 30, 2026 (Revision 2)  
**Target Environment:** Production Construction Procurement (Indian Market)

---

## 1. Overview & Phasing Strategy

This document outlines the step-by-step engineering roadmap to transition Kovok from the current static HTML concept prototype into a hardened, production-grade modular monolith for construction procurement in India.

The existing UI prototype (`Kovok_Construction_UI_Premium/index.html`) serves as the strict visual and interaction baseline. Its calm industrial layout, table-first scanning density, custom status indicators, and multi-step modals will be preserved and ported into a Next.js 16 App Router application.

### Implementation Readiness Status
> **Implementation Readiness:** Foundation work may begin; production integrations and launch have unresolved prerequisites (live Sarvam credentials and verified test, webhook authentication confirmation, hosting/database provisioning, current standards and tax verification with a qualified adviser, legal/privacy review of calling rules, and catalogue data/image rights verification).

### Implementation Phases at a Glance

```
Phase 1: Foundation & Data Architecture (Weeks 1-2)
  ├── Next.js 16.2.x (Active LTS) + Node.js 24.x LTS TypeScript Workspace
  ├── PostgreSQL 16 Schema, Least-Privilege App Role & FORCE RLS
  ├── Dynamic Tax Rules Table (tax_rate_rules) & Dev Seed Isolation
  └── Server-Side Session Auth & Transaction-Local RLS Scoping
          │
          ▼
Phase 2: Core Domain APIs & State Machine (Weeks 3-4)
  ├── Source-Backed Standards (IS 1786 Grades/Sizes, Drafts & Cement Standards)
  ├── Supplier Directory with Serviceability & Calling Window Rules
  └── Procurement Request Intake & Specification Normalizer
          │
          ▼
Phase 3: Sarvam Voice Agent & Line-Item Quote Normalization (Weeks 5-6)
  ├── Sarvam Voice Client, Prompts, & Postgres-Backed Transactional Worker
  ├── Redacted Token Webhook Ingestion with attempt_id Correlation
  └── Deterministic Line-Item Cost Calculator & Comparability Matrix
          │
          ▼
Phase 4: Gated Approvals, Split Allocations, & Delivery Tracking (Weeks 7-8)
  ├── Approval & ApprovalAllocation Model for Split/Partial Sourcing
  ├── Immutable PO Generation with Consistency Checksum
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
  ├── Mandatory Automated Acceptance Test Suite (10 Critical Domain Tests)
  ├── DPDP Compliance, Audit Logging & Private Storage Encryption
  └── Container Deployment on Verified India Cloud Infrastructure
```

---

## Phase 1: Foundation, Workspace Data Models, Migrations & Auth

### Objectives
- Establish the production TypeScript full-stack workspace targeting **Node.js 24.x LTS** (with CI compatibility testing for **Node.js 26 LTS**) and **Next.js 16.2.x (Active LTS)** with React 19.x. Exact resolved versions pinned in `package-lock.json`.
- Set up PostgreSQL database with Prisma/Drizzle ORM, declarative migrations, dynamic tax rules table (`tax_rate_rules`), and strict relational constraints.
- Configure least-privilege database application role (e.g. `kovok_app`) without `BYPASSRLS`, and enable `FORCE ROW LEVEL SECURITY` on tenant tables.
- Implement server-side session authentication with `HttpOnly`, `Secure`, and `SameSite=Lax` cookies.
- Implement transaction-local Row-Level Security (`SET LOCAL app.current_workspace_id = ...`) to prevent connection-pool bleed in pooled database connections.
- Set up PostgreSQL-backed transactional worker (Graphile Worker / Pg-Boss) for durable outbox processing, completely avoiding Redis for Phase 1.
- Isolate development fixtures from production seed scripts.

### Files & Modules Involved
- `package.json`, `tsconfig.json`, `next.config.js`
- `src/styles/tokens.css`, `src/styles/globals.css` (porting all CSS tokens from `index.html`)
- `prisma/schema.prisma` (initial schema: `workspaces`, `users`, `roles`, `project_sites`, `workspace_rule_profiles`, `tax_rate_rules`)
- `src/lib/db.ts` (Prisma client singleton with connection pooling and app role configuration)
- `src/lib/auth.ts` (Session validation, password hashing with Argon2id)
- `src/middleware.ts` (Tenant context injection and route protection)
- `prisma/seed.ts` (Sample fixtures isolated for `NODE_ENV === 'development'`)

### Key Dependencies
- `next@16.2.x`, `react@19.x`, `react-dom@19.x`, `typescript`
- `@prisma/client`, `prisma`
- `zod`, `argon2`, `lucia` (or `iron-session`)
- `graphile-worker` (or `pg-boss`)

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
- Model Indian construction materials catalogue with source-backed reference data for IS standards:
  - TMT Steel: IS 1786:2008 covering standard grades (`Fe 415, Fe 500, Fe 550, Fe 600`), ductile grades (`Fe 415D, Fe 500D, Fe 550D`), seismic grades (`Fe 415S, Fe 500S`), and higher strength variants (`Fe 650, Fe 700`). Nominal sizes from 4 to 50 mm, with mutually agreed custom sizes subject to review. (Enum claims strictly non-exhaustive).
  - Cement: IS 269:2015, IS 1489:2015, IS 455, IS 16415.
- Draft revisions of standards (e.g. BIS 2025 draft revision of IS 1786) are recorded in draft status and strictly prevented from being activated as binding standards until officially approved and gazetted by BIS.
- Quality documentation (MTC) rules configured dynamically per buyer/project specification rather than universal global assumptions.
- Build supplier directory with geolocation, serviceable PIN codes, and authorized calling windows.
- Implement the 4-step Procurement Request intake wizard with structured specification validation.

### Files & Modules Involved
- `prisma/schema.prisma` (adding `products`, `product_variants`, `material_standards`, `material_grades`, `material_nominal_sizes`, `standard_revisions`, `suppliers`, `supplier_contacts`, `procurement_requests`)
- `src/app/api/v1/catalog/route.ts` (Catalogue search, filtering by brand/grade/standard)
- `src/app/api/v1/suppliers/route.ts` (Supplier listing, PIN code matching, capacity filters)
- `src/app/api/v1/requests/route.ts` (CRUD for procurement requests, state transitions)
- `src/components/requests/RequestWizardModal.tsx` (Ported from `requestWizard()`)
- `src/components/catalog/CatalogTable.tsx` (Ported from `catalogPage()`)
- `src/components/suppliers/SupplierTable.tsx` (Ported from `suppliersPage()`)
- `src/lib/validators/materialSchemas.ts` (Zod schemas for all source-backed IS 1786 TMT grades and cement types)

### Acceptance Criteria
1. TMT steel requests validate diameter bounds and grade against effective IS 1786 reference data.
2. Draft revisions of standards are stored as versioned reference data and prevented from being set as the binding standard until officially approved.
3. Quality documentation (MTC) is flagged as required only when mandated by project specifications, contracts, or site policies.
4. Requests validate delivery PIN codes and promised deadlines before persisting.

---

## Phase 3: Sarvam Voice Agent & Line-Item Quote Normalization Engine

### Objectives
- Integrate with Sarvam AI outbound call APIs using a durable, PostgreSQL-backed transactional worker (Graphile Worker / Pg-Boss), avoiding Redis for Phase 1.
- Implement verified webhook security:
  - Secret endpoint ingestion token with URL/query-string redaction in all application, proxy, and observability logs.
  - Strict Zod schema validation against Sarvam's documented payload (`attempt_id`, `status`, `interaction_id`, `final_agent_variables`, `transcript`).
  - Correlation strictly to internally initiated call attempts (`attempt_id`).
  - Persistence in `webhook_events` before acknowledging (HTTP 200); domain processing enqueued transactionally via the outbox worker.
- Build deterministic line-item quote calculation engine and comparability matrix.
- Enforce the non-authority rule: webhooks update evidence only and never directly create a PO or authorize an order.

### Files & Modules Involved
- `src/lib/sarvam/client.ts` (Sarvam API client for voice agent call creation)
- `src/lib/sarvam/prompts.ts` (Prompt templates in Hindi, English, and Hinglish for trade RFQs)
- `src/workers/callScheduler.worker.ts` (PostgreSQL-backed worker handling call dispatch and rate limiting)
- `src/app/api/v1/webhooks/sarvam/route.ts` (Token validation, log redaction, schema validation, attempt correlation, quote parsing)
- `src/lib/quotations/lineItemCalculator.ts` (Deterministic calculation of taxable base, effective GST rate from `tax_rate_rules`, freight, and unloading)
- `src/lib/quotations/comparability.ts` (Evaluates completeness: quote is incomplete ONLY if a material cost or term is `UNKNOWN` and relevant)
- `src/components/quotations/QuotationMatrix.tsx` (Ported from `quotesPage()`)

### Acceptance Criteria
1. Calls to suppliers are dispatched only during configured business hours (10:00 - 18:00 IST weekdays); out-of-hours requests are queued for next business morning.
2. Webhooks require valid secret ingestion token; un-correlated `attempt_id` callbacks are rejected.
3. Webhook callbacks update quote candidate evidence, but **never independently create a PO or bypass buyer approval**.
4. Quotations missing freight or unloading are marked as `Non-comparable (Incomplete)` only if relevant to the delivery basis; if `INCLUDED_IN_MATERIAL` or `NOT_APPLICABLE`, they are marked comparable.
5. Calculated payable total is compared with supplier quoted total, and commercial variances are flagged.

---

## Phase 4: Buyer Approval Engine, Split Allocations, & Delivery Tracking

### Objectives
- Enforce the core business invariant: **Buyer pays supplier directly; Kovok must never create an order without verified buyer authorization**.
- Implement the split fulfillment data model:
  - `Approval` captures overall authorized plan and quantity ceiling.
  - `ApprovalAllocation` captures each authorized supplier, material variant, quantity, unit price, and commercial terms.
  - `PurchaseOrder` references a unique `approval_allocation_id`: `UNIQUE (approval_allocation_id)`.
  - Client-supplied `idempotency_key`: `UNIQUE (workspace_id, idempotency_key)` to prevent duplicate submissions on network retries.
  - Quantity validation: $\sum \text{Allocated Quantity} \le \text{Approved Quantity}$.
- Store canonical JSON snapshot of approved commercial terms along with a SHA-256 consistency checksum on the PO.
- Immutability enforced by application state machine guards, restricted database permissions, and append-only audit trail.
- Build construction site gate receiving (GRN) tracking delivery challans, weighbridge slips, and condition inspection (partial deliveries against a single PO handled at gate receiving).

### Files & Modules Involved
- `prisma/schema.prisma` (adding `approvals`, `approval_allocations`, `purchase_orders`, `gate_receipts`, `audit_logs`)
- `src/lib/approvals/approvalService.ts` (Authorization checks, allocation validation, canonical JSON snapshot generation, SHA-256 checksum)
- `src/app/api/v1/approvals/route.ts` (Endpoint for authorized buyer approval submission)
- `src/app/api/v1/orders/route.ts` (PO retrieval, dispatch tracking, receipt recording)
- `src/components/orders/OrdersTable.tsx` (Ported from `ordersPage()`)
- `src/components/orders/ReceiptModal.tsx` (Gate receipt entry: weighbridge gross/tare, bag count, condition)

### Acceptance Criteria
1. Only users with role `OWNER` or `APPROVER` can approve quotes above the configured competitive threshold.
2. Double-clicking or simultaneous approval requests produce exactly one Purchase Order per allocation.
3. Split fulfillment allows generating distinct POs from multiple allocations under one approved plan without constraint violation.
4. Approved purchase orders display the notice: "Payment terms: Direct Buyer-to-Supplier. Kovok does not hold funds."
5. Site gate receiving records gross/tare weighment and flags weight shortages exceeding IS standard tolerance (±0.5% for steel).

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

### Acceptance Criteria
1. Supplier shortfall of 8 tonnes on a 20-tonne order generates an open exception and provides structured options (find alternative supplier vs accept revised schedule).
2. CSV import displays a preview table with valid rows, invalid rows, and clear error reasons before committing to database.
3. Connected ERPNext integration verifies API key/secret, tests connection, and respects ERPNext as the master source for supplier records.

---

## Phase 6: Production Hardening, Security, Auditing & Deployment

### Objectives
- Implement the mandatory automated acceptance test suite covering all 10 critical domain and security test cases.
- Implement immutable audit logging for all commercial and voice actions.
- Enforce strict security: HTTP security headers, CORS policies, rate limiting, and private cloud storage pre-signed URLs.
- Containerize the application and deploy on verified Indian cloud infrastructure.

---

## 2. Mandatory Acceptance Test Suite

The automated test suite must implement and pass the following 10 critical domain and security test cases before production release:

| # | Test Identifier | Test Scope & Assertion Criteria |
| :- | :--- | :--- |
| **1** | `test_tax_rate_effective_date_handling` | Verifies dynamic tax resolution: a transaction dated before 22 Sept 2025 resolves cement GST at 28%; a transaction dated on or after 22 Sept 2025 resolves cement GST at 18% (PIB PRID 2163560). |
| **2** | `test_quote_tax_inclusive_vs_exclusive` | Asserts that line-item tax math correctly computes payable totals for tax-exclusive quotes (base + tax) and back-calculates taxable base for tax-inclusive quotes without double counting. |
| **3** | `test_incomplete_freight_and_handling_handling` | Confirms that quotes with `UNKNOWN` freight/unloading are marked `Non-comparable (Incomplete)`, while quotes with `INCLUDED_IN_MATERIAL` or `NOT_APPLICABLE` remain `Comparable`. |
| **4** | `test_stale_and_duplicate_webhooks` | Transmits duplicate Sarvam webhook payloads with identical `attempt_id`; asserts that the second payload returns HTTP 200 without duplicate quote creation or state corruption. |
| **5** | `test_unexpected_attempt_ids` | Sends a Sarvam webhook with an unknown or expired `attempt_id`; asserts that the system rejects/drops the payload and flags an audit warning. |
| **6** | `test_cross_tenant_data_access` | Simulates concurrent database queries across two distinct workspaces using pooled connections; asserts that `FORCE ROW LEVEL SECURITY` with `SET LOCAL app.current_workspace_id` strictly isolates data and prevents cross-tenant leakage. |
| **7** | `test_duplicate_approval_submissions` | Submits concurrent approval requests for the same quotation using identical `idempotency_key`; asserts that exactly one Purchase Order is generated and the second request returns the existing PO. |
| **8** | `test_split_partial_fulfilment` | Approves a 20-tonne requirement split into Allocation 1 (12 tonnes from Supplier A, generating PO-1) and Allocation 2 (8 tonnes from Supplier B, generating PO-2); asserts both POs are created without constraint violation and total quantity matches approved ceiling. |
| **9** | `test_material_grade_mismatch` | Submits a request for TMT `Fe 550D` where the supplier quote extraction returns `Fe 500`; asserts that the system flags a specification mismatch exception and prevents automated recommendation. |
| **10** | `test_no_po_without_verified_approval` | Attempts to invoke the order creation endpoint directly without a valid, approved approval allocation; asserts that the system strictly rejects with HTTP 403 Forbidden. |

---

## 3. Unresolved Decisions & Open Inquiries

| # | Topic | Current Recommendation | Open Question / Alternative (Needs Confirmation) |
| :- | :--- | :--- | :--- |
| **1** | **Sarvam Webhook Cryptographic Signing** | Secret endpoint URL token with log redaction + schema validation + `attempt_id` correlation + persistence before acknowledgment. | *Inquiry with Sarvam Support:* Does Sarvam plan to provide an HMAC signature header or published webhook egress IP ranges for outbound voice callbacks? |
| **2** | **Telephony Carrier & Caller ID** | Use Sarvam hosted outbound calling during Phase 3. | Does the buyer require bringing their own telephony trunk (e.g., Exotel / Tata Tele / Airtel) to display their enterprise caller ID to local suppliers? |
| **3** | **Cloud Provider & Region Selection** | Evaluate AWS `ap-south-1` (Mumbai), GCP `asia-south1` (Mumbai), and Azure `centralindia` (Pune). | Final selection pending latency benchmarks, managed PostgreSQL pricing, and tenant data handling requirements under the Indian DPDP Act. |
| **4** | **ERP Connector Priority** | Focus development on ERPNext as the primary supported connector in Phase 5, alongside CSV/Excel. | Should TallyPrime integration (requiring a local Windows agent) or Zoho Books take precedence after ERPNext based on target customer onboarding demand? |
| **5** | **Live GSTIN Verification Integration** | Use regex and checksum validation in Phase 2; evaluate live GSP API in Phase 5. | Should Kovok subscribe to a live GST verification API (e.g., ClearTax / Karza / Sandbox) during supplier onboarding to verify GSTIN active status and filing frequency? |
| **6** | **Payment Confirmation Tracking** | Buyer pays supplier directly. Buyer records payment by entering UTR / NEFT reference number. | Is UTR recording sufficient, or should Kovok support bank statement upload / account aggregator integration to auto-match payments? |
| **7** | **Data Retention & Calling Regulations** | 90-day transcript retention configured as a proposed product default. | Complete formal legal/privacy review of supplier calls, AI disclosure, recording, opt-out handling, and TRAI/DoT calling regulations before live calls. |
