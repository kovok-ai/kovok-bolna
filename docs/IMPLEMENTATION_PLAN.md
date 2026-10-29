# Kovok — Production Implementation Plan

**Document Status:** Approved Implementation Roadmap  
**Author:** Lead Software Engineer  
**Date:** October 30, 2026  
**Target Environment:** Production Construction Procurement (Indian Market)

---

## 1. Overview & Phasing Strategy

This document outlines the step-by-step engineering roadmap to transition Kovok from the current static HTML concept prototype into a hardened, production-grade construction procurement application for the Indian market.

The existing UI prototype (`index.html`) serves as the strict visual and interaction baseline. Its calm industrial layout, table-first scanning density, custom status indicators, and multi-step modals will be preserved and ported into a modular full-stack TypeScript architecture.

### Implementation Phases at a Glance

```
Phase 1: Foundation & Data Architecture (Weeks 1-2)
  ├── Full-stack Next.js + TypeScript Repo Structure
  ├── PostgreSQL 16 Schema, Prisma ORM, Migrations & Seeds
  └── Multi-Tenant Workspace & Role-Based Access Control (RBAC)
          │
          ▼
Phase 2: Core Domain APIs & State Machine (Weeks 3-4)
  ├── IS-compliant Catalogue (IS 1786 TMT Steel, IS 269/1489 Cement)
  ├── Supplier Directory with Serviceability & Calling Rules
  └── Procurement Request Intake & Natural Language Normalizer
          │
          ▼
Phase 3: Sarvam Voice Agent & Quote Normalization (Weeks 5-6)
  ├── Sarvam Voice Client, Prompts, & Concurrency-Guarded Worker
  ├── HMAC-verified, Idempotent Webhook Ingestion Engine
  └── Deterministic Delivered-Cost Calculator & Comparison Matrix
          │
          ▼
Phase 4: Gated Approvals, Orders, & Delivery Tracking (Weeks 7-8)
  ├── Dual-Gate Anti-Duplicate Approval & Order Creation Engine
  ├── Immutable PO Generation (Buyer-to-Supplier Direct Payment)
  └── Construction Gate Receiving (GRN) & Weighment Reconciliation
          │
          ▼
Phase 5: Exception Management & Enterprise Integrations (Weeks 9-10)
  ├── Shortfall, ETA Change, & Quality Exception State Machine
  ├── CSV / Excel Importer with Pre-flight Validation
  └── ERPNext Bidirectional Connector
          │
          ▼
Phase 6: Hardening, Security, Auditing & Production Launch (Weeks 11-12)
  ├── End-to-End Playwright Automated Test Suite
  ├── DPDP Compliance, Audit Logging & Private Storage Encryption
  └── GCP Container Deployment (Cloud Run, Cloud SQL, Memorystore)
```

---

## Phase 1: Foundation, Workspace Data Models, Migrations & Auth

### Objectives
- Establish the production TypeScript full-stack workspace preserving all visual CSS tokens from the prototype.
- Set up PostgreSQL database with Prisma ORM, declarative migrations, and strict relational constraints.
- Implement multi-tenant authentication, workspace context switching, and role-based access control (RBAC).
- Isolate development fixtures from production seed scripts.

### Files & Modules Involved
- `package.json`, `tsconfig.json`, `next.config.js`
- `src/styles/tokens.css`, `src/styles/globals.css` (porting all CSS from `index.html`)
- `prisma/schema.prisma` (initial schema: `workspaces`, `users`, `roles`, `project_sites`, `workspace_rule_profiles`)
- `src/lib/db.ts` (Prisma client singleton with connection pooling)
- `src/lib/auth.ts` (Session validation, JWT handling, password hashing with Argon2)
- `src/middleware.ts` (Tenant context injection and route protection)
- `prisma/seed.ts` (Sample fixtures isolated for `NODE_ENV === 'development'`)

### Key Dependencies
- `next`, `react`, `react-dom`, `typescript`
- `@prisma/client`, `prisma`
- `zod`, `jose` or `next-auth`, `argon2`

### Acceptance Criteria
1. The web application compiles in TypeScript without errors and renders the global shell (sidebar, topbar, workspace switcher).
2. Users can authenticate (login, logout, session refresh) and switch between authorized workspaces.
3. Database migrations run deterministically via `npx prisma migrate deploy`.
4. Running `prisma/seed.ts` creates baseline development fixtures (Concrete & Co., Site A Gurugram, Site B Dwarka) only in non-production environments.

### Testing Plan
- **Unit Tests:** Password hashing, JWT token generation and expiry, Zod environment variable validation.
- **Integration Tests:** Database migration rollout/rollback, workspace tenant isolation queries.

---

## Phase 2: Core Domain APIs & Procurement State Machine

### Objectives
- Model and implement the Indian construction materials catalogue with specific support for TMT steel (IS 1786) and cement (IS 269, IS 1489, IS 455).
- Build the supplier directory with geolocation, serviceable PIN codes, and authorized calling windows.
- Implement the 4-step Procurement Request intake wizard with structured specification validation.

### Files & Modules Involved
- `prisma/schema.prisma` (adding `products`, `product_variants`, `standards`, `suppliers`, `supplier_contacts`, `procurement_requests`)
- `src/app/api/v1/catalog/route.ts` (Catalogue search, filtering by brand/grade/standard)
- `src/app/api/v1/suppliers/route.ts` (Supplier listing, PIN code matching, capacity filters)
- `src/app/api/v1/requests/route.ts` (CRUD for procurement requests, state transitions)
- `src/components/requests/RequestWizardModal.tsx` (Ported from `requestWizard()`)
- `src/components/catalog/CatalogTable.tsx` (Ported from `catalogPage()`)
- `src/components/suppliers/SupplierTable.tsx` (Ported from `suppliersPage()`)
- `src/lib/validators/materialSchemas.ts` (Zod schemas for TMT grades Fe 500D/550D and cement types OPC/PPC)

### Key Dependencies
- `zod`
- `lucide-react` or custom SVG icon components matching prototype

### Acceptance Criteria
1. TMT steel requests require grade, diameter, and unit (tonnes); Cement requests require cement type (OPC/PPC), pack size (50 kg bag/bulk), and quantity.
2. Requests validate delivery PIN codes and promised deadlines before persisting.
3. Catalogue search provides sub-100ms response across canonical brands and IS standards.
4. New requests transition through valid states: `DRAFT` $\rightarrow$ `PENDING_CONFIRMATION` $\rightarrow$ `SOURCING_AUTHORIZED`.

### Testing Plan
- **Unit Tests:** Specification validator tests (validating IS 1786 diameter bounds, cement type rules).
- **Integration Tests:** Request creation API with valid and invalid payloads; supplier query filtered by delivery PIN code.

---

## Phase 3: Sarvam Voice Agent & Quotation Normalization Engine

### Objectives
- Integrate with Sarvam AI APIs to dispatch automated outbound voice calls to shortlisted suppliers.
- Implement an asynchronous worker (BullMQ + Redis) enforcing IST business hours (10:00 - 18:00 IST) and retry policies.
- Build HMAC-SHA256 signature verification and an idempotent webhook processor for call events and quote extractions.
- Create the deterministic delivered-cost calculation engine and comparability evaluation matrix.

### Files & Modules Involved
- `src/lib/sarvam/client.ts` (Sarvam API client for voice agent call creation)
- `src/lib/sarvam/prompts.ts` (Prompt templates in Hindi, English, and Hinglish for trade RFQs)
- `src/workers/callScheduler.worker.ts` (BullMQ worker handling call dispatch and rate limiting)
- `src/app/api/v1/webhooks/sarvam/route.ts` (HMAC verification, event deduplication, extraction parser)
- `src/lib/quotations/costCalculator.ts` (Deterministic calculation of subtotal, discounts, 18%/28% GST, freight, and unloading)
- `src/lib/quotations/comparability.ts` (Evaluates completeness; marks quotes missing freight/unloading as `Non-comparable`)
- `src/components/quotations/QuotationMatrix.tsx` (Ported from `quotesPage()`)

### Key Dependencies
- `bullmq`, `ioredis`
- `crypto` (built-in Node.js for HMAC-SHA256)

### Acceptance Criteria
1. Calls to suppliers are dispatched only during configured business hours; out-of-hours requests are queued for next business morning.
2. Webhooks verify `x-sarvam-signature`. Invalid signatures return HTTP 401.
3. Duplicate webhook deliveries with the same `event_id` are acknowledged with HTTP 200 without duplicate processing.
4. Quotations without confirmed freight or unloading are explicitly flagged as `Non-comparable (Incomplete)` and excluded from automated lead recommendation.
5. Delivered total cost calculations match exact mathematical sums: $\text{Base} + \text{GST} + \text{Freight} + \text{Unloading}$.

### Testing Plan
- **Unit Tests:** Cost calculation with various GST and freight configurations; comparability logic tests with complete vs partial quotes.
- **Integration Tests:** Webhook endpoint testing with valid signature, invalid signature, and duplicate replay attack.
- **Mock Voice Tests:** `MockSarvamVoiceProvider` simulating complete multi-turn supplier quotes.

---

## Phase 4: Buyer Approval Engine, Orders, & Delivery Reconciliation

### Objectives
- Enforce the core business invariant: **Buyer pays supplier directly; Kovok must never create an order without verified buyer authorization**.
- Implement the dual-gate anti-duplicate order prevention mechanism (distributed locks + database constraints).
- Generate immutable Purchase Orders (PO) containing a cryptographic hash of approved terms.
- Build construction site gate receiving (GRN) tracking delivery challans, weighbridge slips, and condition inspection.

### Files & Modules Involved
- `prisma/schema.prisma` (adding `approvals`, `purchase_orders`, `gate_receipts`, `audit_logs`)
- `src/lib/approvals/approvalService.ts` (Approval authorization checks, cryptographic snapshot hashing)
- `src/app/api/v1/approvals/route.ts` (Endpoint for authorized buyer approval submission)
- `src/app/api/v1/orders/route.ts` (PO retrieval, dispatch tracking, receipt recording)
- `src/components/orders/OrdersTable.tsx` (Ported from `ordersPage()`)
- `src/components/orders/ReceiptModal.tsx` (Gate receipt entry: weighbridge gross/tare, bag count, condition)

### Key Dependencies
- `ioredis` (distributed lock via Redlock pattern)

### Acceptance Criteria
1. Only users with role `OWNER` or `APPROVER` can approve quotes above the configured competitive threshold.
2. Double-clicking or simultaneous approval requests produce exactly one Purchase Order.
3. Approved purchase orders display the notice: "Payment terms: Direct Buyer-to-Supplier. Kovok does not hold funds."
4. Site gate receiving records gross/tare weighment and flags weight shortages exceeding IS standard tolerance (±0.5% for steel).

### Testing Plan
- **Concurrency Tests:** Simulated simultaneous approval requests verifying that distributed locks and database unique constraints prevent double orders.
- **RBAC Tests:** Unauthorized user role attempting to approve a quote returns HTTP 403 Forbidden.

---

## Phase 5: Exception Management & Enterprise Integrations

### Objectives
- Implement the recovery state machine for procurement exceptions (supplier shortfalls, delayed ETAs, quality/rust issues at receipt).
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
- `axios` or native `fetch` with retry handling

### Acceptance Criteria
1. Supplier shortfall of 8 tonnes on a 20-tonne order generates an open exception and provides structured options (find alternative supplier vs accept revised schedule).
2. CSV import displays a preview table with valid rows, invalid rows, and clear error reasons before committing to the database.
3. Connected ERPNext integration verifies API key/secret, tests connection, and respects ERPNext as the master source for supplier records.

### Testing Plan
- **Unit Tests:** CSV importer parsing valid and malformed files; exception state machine transition validation.
- **Integration Tests:** ERPNext mock server test verifying authenticated synchronization and error handling.

---

## Phase 6: Production Hardening, Security, Auditing & Deployment

### Objectives
- Build comprehensive Playwright end-to-end automated test suites covering the entire user journey.
- Implement immutable audit logging for all commercial and voice actions.
- Enforce strict security: HTTP security headers, CORS policies, rate limiting, and private cloud storage pre-signed URLs.
- Containerize the application and deploy on managed Indian cloud infrastructure.

### Files & Modules Involved
- `Dockerfile`, `docker-compose.yml`
- `.github/workflows/ci.yml` (Linting, type checking, unit/integration tests, Playwright E2E)
- `src/lib/audit/auditLogger.ts` (Append-only audit trail logger)
- `tests/e2e/procurement-flow.spec.ts` (Playwright E2E test suite)
- `src/lib/storage/s3Client.ts` (Encrypted object storage with pre-signed upload/download URLs)

### Key Dependencies
- `@playwright/test`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

### Acceptance Criteria
1. All Playwright automated tests pass across desktop (1440px) and mobile (390px) viewports without JavaScript errors or layout regressions.
2. All commercial actions (approvals, quote changes, order creation) generate non-repudiable records in `audit_logs`.
3. Application passes security scans (no exposed credentials, secure cookie flags, strict Content Security Policy).
4. Container builds successfully and deploys to GCP Cloud Run / Cloud SQL in region `asia-south1` (Mumbai).

---

## Unresolved Architectural Decisions & Open Questions

The following decisions require business and stakeholder input during the review phase:

| # | Topic | Current Recommendation | Open Question / Alternative |
| :- | :--- | :--- | :--- |
| **1** | **Telephony & Carrier Infrastructure** | Use Sarvam AI hosted telephony infrastructure for outbound calling in initial rollout. | Does the buyer require bringing their own telephony trunk (e.g., Exotel / Twilio / Tata Teleservices) to display their company's caller ID to local suppliers? |
| **2** | **Secondary ERP Connector Priority** | Focus development on ERPNext as the primary supported ERP connector, alongside universal CSV/Excel import/export. | Should TallyPrime integration (requiring a local Windows agent / Tally .NET connector) or Zoho Books take precedence after ERPNext? |
| **3** | **Government GST & e-Way Bill Verification** | Use regex and checksum validation for 15-digit GSTINs in Phase 2; integrate with GSP (GST Suvidha Provider) APIs in Phase 5. | Should Kovok subscribe to a live GST verification API (e.g., ClearTax / Karza / Sandbox) to verify supplier active status during onboarding? |
| **4** | **Payment Confirmation Tracking** | The buyer pays the supplier directly. Kovok provides an "Acknowledge Payment" button where the buyer enters UTR / NEFT reference number. | Is UTR recording sufficient, or should Kovok support bank statement upload / account aggregator integration to auto-match payments? |
| **5** | **Regional Dialects & Languages** | Support Hindi (`hi-IN`), Indian English (`en-IN`), and Hinglish code-switching in Sarvam prompts for Phase 3. | What secondary Indian languages (e.g., Marathi, Gujarati, Telugu, Tamil, Bengali) are needed based on target buyer geographic expansion? |
