# Kovok — Production Architecture Decisions (ADR) (Amended & Corrected)

**Document Status:** Amended Architecture Reference  
**Author:** Lead Software Engineer  
**Date:** October 30, 2026 (Revision 2)  
**Target Environment:** Production Construction Procurement (Indian Market)

---

## 1. Architectural Strategy & Guiding Principles

Kovok transforms from a front-end UI concept into a production-grade enterprise procurement platform for construction materials in India (TMT steel, cement, aggregates, RMC).

### Core Architectural Invariants
1. **Practical Modular Monolith:** A unified, modular TypeScript codebase avoiding premature microservices overhead while maintaining strict domain separation (Catalog, Suppliers, Requests, Voice, Quotes, Approvals, Orders, Gate Receiving, Exceptions, Integrations).
2. **Deterministic Commercial Integrity:** Kovok validates and compares quotes deterministically via mathematical models. Calculations never rely on non-deterministic LLM arithmetic.
3. **Strict Human-in-the-Loop Authorization:** The buyer pays the supplier directly. Kovok is an operations and intelligence layer; it **never executes a commercial commitment or generates a Purchase Order without verified, explicit buyer authorization**.
4. **Resilient Transactional Asynchrony:** Outbound calls, webhook processing, deadline alarms, and ERP sync are managed through durable, PostgreSQL-backed transactional background jobs.
5. **India Data Residency & DPDP Compliance:** All buyer data, audio recordings, and commercial ledgers must comply with India's Digital Personal Data Protection (DPDP) Act. Cloud provider and region selection will be finalized based on verified data residency, pricing, and latency in India.

### Readiness Status
> **Implementation Readiness:** Foundation work may begin; production integrations and launch have unresolved prerequisites (live Sarvam credentials and verified test, webhook authentication confirmation, hosting/database provisioning, current standards and tax verification with a qualified adviser, legal/privacy review of calling rules, and catalogue data/image rights verification).

---

## 2. Technology Stack & Runtime Specification

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Web Browser (Client)                          │
│   Next.js 16.2.x App Router · Custom Industrial UI · CSS Tokens        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Secure HttpOnly Session Cookies)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Application & API Layer (Server)                    │
│   Node.js 24.x LTS · Next.js 16.2.x (Active LTS) · Zod Contracts       │
│   Domain Services: Catalog · Quotes · Approvals · Orders · Exceptions  │
└──────────────┬────────────────────────────────────────┬────────────────┘
               │                                        │
┌──────────────▼────────────────────┐ ┌─────────────────▼────────────────┐
│  PostgreSQL 16+                   │ │   Sarvam AI Voice Telephony      │
│  - Prisma / Drizzle ORM           │ │  - Outbound Agent Calls          │
│  - Least-Privilege App Role       │ │  - Tokenized, Redacted Webhooks  │
│  - FORCE ROW LEVEL SECURITY       │ │  - Internal Call Correlation     │
│  - Transaction-Local Tenant RLS   │ │  - Persistence Before Ack        │
│  - Transactional Outbox Worker    │ └──────────────────────────────────┘
│    (Graphile Worker / Pg-Boss)    │
└───────────────────────────────────┘
```

| Component | Pinned / Selected Technology | Architectural Rationale & Compatibility |
| :--- | :--- | :--- |
| **Runtime Environment** | **Node.js 24.x LTS** | Supported LTS release. Primary conservative baseline with CI matrix verification for **Node.js 26 LTS** (which entered LTS on 28 October 2026). Node.js 20 reached End-of-Life on 24 March 2026 and is strictly rejected. |
| **Web Framework** | **Next.js 16.2.x (Active LTS)** | Latest patched stable release in the Active LTS line with React 19.x. Exact resolved dependencies pinned in `package-lock.json` and verified in CI. Server Components guarantee server secrets never leak to client bundles. |
| **Styling & UI Tokens** | **Tailored CSS Modules / Vanilla Tokens** | Retains the calm, industrial table-first layout from `index.html` (`--bg: #f7f8fa`, `--panel: #fff`, `--blue: #315c9b`, `--green: #236b4a`, `--amber: #855d1c`, etc.) without generic UI component library bloat. |
| **Database & Persistence** | **PostgreSQL 16+** | ACID transactional guarantees; `pg_trgm` extension for fuzzy brand/SKU/PIN search; native JSONB for flexible specifications; transaction-local Row-Level Security (RLS) with `FORCE ROW LEVEL SECURITY`. |
| **ORM & Migrations** | **Prisma ORM / Drizzle ORM** | Declarative schema definitions, type-safe queries, deterministic forward migrations, and isolated development seeds. |
| **Async Job Engine** | **PostgreSQL-backed Worker (Graphile Worker / Pg-Boss)** | Durability with transactional outbox pattern: jobs are committed in the *same database transaction* as domain state changes. Avoids Redis for Phase 1. Redis is not mandatory and will be revisited only if future load/latency requirements justify it. |
| **Voice & Speech Engine** | **Sarvam AI APIs** | Indian Indic conversational voice agents tuned for Hindi, Hinglish, and Indian English trade vocabulary. |
| **Authentication** | **Server-side Sessions with HttpOnly Cookies** | Maintained session library (e.g. Lucia Auth or iron-session) utilizing secure, `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Custom JWTs are avoided for the primary web app and reserved exclusively for external machine API clients. |
| **Object Storage** | **S3-Compatible Cloud Storage (India Region)** | Encrypted private bucket storage for weighbridge challans, test certificates, and invoice snapshots with pre-signed URLs. |

---

## 3. Construction Domain & Dynamic Tax Architecture

### 3.1 Standards Reference Data (IS 1786 & Cement)
- **IS 1786:2008 (High Strength Deformed Steel Bars):**
  - Designation and nominal size are modeled as **source-backed reference data** (`material_grades`, `material_nominal_sizes`).
  - BIS product manuals (Revision 3) and BIS LIMS listings document multiple designations:
    - Standard grades: `Fe 415, Fe 500, Fe 550, Fe 600`.
    - Ductile ("D") grades for earthquake-resistant design: `Fe 415D, Fe 500D, Fe 550D`.
    - Seismic ("S") grades: `Fe 415S, Fe 500S`.
    - Higher strength variants: `Fe 650, Fe 700`.
  - Nominal sizes listed in BIS product manuals: `4, 5, 6, 8, 10, 12, 16, 20, 25, 28, 32, 36, 40, 45, 50 mm`, with provisions that other sizes may be mutually agreed between purchaser and manufacturer.
  - *Architectural Rule:* The word "exhaustive" is strictly removed from enum claims. Non-listed or custom sizes are supported only as buyer/supplier-confirmed values subject to human review.
  - **Draft Standards Handling:** BIS published a 2025 draft revision of IS 1786. Draft standards are recorded in `standard_revisions` with status `DRAFT_UNDER_REVIEW`. They must **never** be activated as binding production standards until officially approved and gazetted by BIS.
- **Documentation & Mill Test Certificates (MTC):**
  - MTC is **not** an unconditional global prerequisite.
  - MTC requirement is dynamic, derived from: (a) applicable standard clauses, (b) buyer/project engineering specifications, (c) purchase contract terms, or (d) site receiving policies.
- **Cement Standards & Attributes:**
  - Governed by **IS 269:2015** (OPC 33, 43, 53), **IS 1489:2015** (PPC), **IS 455** (PSC), and **IS 16415** (Composite).
  - Bag size (50 kg HDPE, 25 kg, bulk tankers) and manufacturing freshness (batch week) are modeled as source-backed product/lot/order attributes and buyer policies.

### 3.2 Dynamic, Source-Backed Tax Configuration
- **GST Rationalisation Reality:** On 22 September 2025, cement GST was reduced from 28% to 18% (PIB Press Release PRID 2163560).
- **Architecture Invariant:** Never hard-code global 18% or 28% tax rates. Tax rates are resolved through an **effective-dated tax configuration table**:

```sql
CREATE TABLE tax_rate_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hsn_sac_code VARCHAR(16) NOT NULL, -- e.g. '7214' (TMT), '2523' (Cement)
    description VARCHAR(255) NOT NULL,
    cgst_rate NUMERIC(5, 2) NOT NULL,
    sgst_rate NUMERIC(5, 2) NOT NULL,
    igst_rate NUMERIC(5, 2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE, -- NULL indicates current active rate
    source_citation TEXT NOT NULL, -- e.g. 'Notification No. XX/2025-Central Tax (Rate)'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Line-Level Treatment:** Do not apply one GST rate across all components by default. Tax classification, tax-inclusive/exclusive pricing, freight/handling treatment, and place-of-supply (CGST+SGST vs IGST) may differ by invoice arrangement.
- **Evidence vs Validation:** Supplier quoted totals are recorded as *evidence*; Kovok's computed total is a *validation calculation*. Classification uncertainty is flagged for human review. HSN mappings and rates must be reviewed with a qualified Indian tax adviser before live invoicing.

---

## 4. Deterministic Line-Item Quote Model & Comparability

Rather than a simplistic aggregate equation, Kovok implements a **deterministic line-item commercial model**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QUOTATION LINE ITEMS                            │
├───────────────┬──────────────┬───────────────┬─────────────────────────┤
│ Line Type     │ Base Price   │ Tax Status    │ Logistics Inclusivity   │
├───────────────┼──────────────┼───────────────┼─────────────────────────┤
│ MATERIAL      │ ₹9,50,000    │ EXCLUSIVE     │ NOT_APPLICABLE          │
│ FREIGHT       │ ₹30,000      │ EXCLUSIVE     │ SEPARATELY_BILLED       │
│ UNLOADING     │ ₹0           │ N/A           │ INCLUDED_IN_MATERIAL    │
└───────────────┴──────────────┴───────────────┴─────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Compute Line Taxes: Base * Tax Rate (from effective tax rule)       │
│ 2. Sum Lines: Material + Freight + Unloading (if separately billed)    │
│ 3. Validate vs Supplier Quoted Total: Flag variance if mismatch        │
│ 4. Evaluate Comparability: Incomplete ONLY if a relevant term = UNKNOWN│
└────────────────────────────────────────────────────────────────────────┘
```

### Relational Quote Schema
```sql
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    request_id UUID NOT NULL REFERENCES procurement_requests(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    status VARCHAR(32) NOT NULL, -- 'CONFIRMED', 'PARTIAL', 'INCOMPLETE', 'EXPIRED', 'REJECTED'
    quoted_payable_total NUMERIC(14, 2) NOT NULL, -- Evidence as quoted by supplier
    computed_payable_total NUMERIC(14, 2) NOT NULL, -- Deterministic validation calculation
    commercial_variance NUMERIC(14, 2) GENERATED ALWAYS AS (quoted_payable_total - computed_payable_total) STORED,
    is_comparable BOOLEAN NOT NULL DEFAULT FALSE,
    comparability_notes TEXT,
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quotation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    line_type VARCHAR(32) NOT NULL, -- 'MATERIAL', 'FREIGHT', 'LOADING', 'UNLOADING', 'INSURANCE', 'OTHER'
    taxable_base NUMERIC(14, 2) NOT NULL,
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    hsn_sac_code VARCHAR(16),
    tax_category VARCHAR(32) NOT NULL, -- 'STANDARD_GST', 'EXEMPT', 'REVERSE_CHARGE'
    tax_rate_percent NUMERIC(5, 2) NOT NULL,
    tax_treatment VARCHAR(16) NOT NULL, -- 'EXCLUSIVE', 'INCLUSIVE'
    logistics_inclusivity VARCHAR(32) NOT NULL, -- 'INCLUDED_IN_MATERIAL', 'SEPARATELY_BILLED', 'NOT_APPLICABLE', 'UNKNOWN'
    computed_tax_amount NUMERIC(14, 2) NOT NULL,
    computed_line_total NUMERIC(14, 2) NOT NULL
);
```

### Comparability Rules
- A quote is flagged as `Non-comparable (Incomplete)` **only** when a material cost or required term is `UNKNOWN` and relevant to the delivery basis.
- If freight or unloading is explicitly marked `INCLUDED_IN_MATERIAL` or `NOT_APPLICABLE` (e.g., ex-yard basis), the quote is fully comparable.

---

## 5. Verified Sarvam Webhook Security & Event Correlation

Sarvam AI's public Instant Outbound Webhook contract transmits `attempt_id`, `status`, `interaction_id`, `final_agent_variables`, and `transcript`. It does **not** document an HMAC signature header or general event timestamp.

```
Incoming Webhook (POST /api/v1/webhooks/sarvam/events?token=SECRET_TOKEN)
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Validate Secret Endpoint Ingestion Token & Redact Logs              │
│    (Token/query-strings strictly redacted from all proxy/server logs)  │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Schema Validation (Zod against Sarvam Documented Webhook Payload)   │
│    (Return HTTP 400 if malformed)                                      │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Internal Call Correlation:                                          │
│    Does incoming attempt_id match an active Kovok call attempt?        │
│    ├── NO  ──► Log suspicious, return HTTP 404/200 (Drop event)        │
│    └── YES ──► Proceed                                                 │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Transactional Persistence Before Acknowledgment:                    │
│    - Persist event in webhook_events table                             │
│    - Enqueue domain processing transactionally via outbox worker       │
│    - Return HTTP 200 to Sarvam                                         │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. Optional Server Verification: Query Sarvam API GET /outbound/:id   │
│ 6. Non-Authority Rule: Webhook NEVER creates a PO or approves orders.  │
└────────────────────────────────────────────────────────────────────────┘
```

### Logging & Non-Authority Safeguards
1. **Log Redaction:** If a URL token is used as a fallback, middleware must redact the full URL and query strings from application, proxy, and observability logs to prevent credential leakage.
2. **Persistence Before Acknowledgment:** The webhook event is stored in `webhook_events` before returning HTTP 200; domain processing is dispatched asynchronously via the database outbox worker.
3. **Non-Authority Rule:** A webhook callback updates call transcripts and candidate quote details, but **never independently authorizes an order or generates a PO**.

---

## 6. Authentication, Multi-Tenancy & Hardened PostgreSQL RLS

### Single Primary Authentication Strategy
- Web application uses **secure server-side sessions** with `HttpOnly`, `Secure`, and `SameSite=Lax` cookies.
- Avoids custom JWT and session duplication. JWTs are reserved exclusively for machine-to-machine API integrations.

### Hardened Row-Level Security (RLS) & Database App Role
1. **Least-Privilege App Role:** The application connects using a dedicated role (e.g. `kovok_app`) that does **not** have `SUPERUSER` or `BYPASSRLS` privileges.
2. **Enforce RLS on Owners:** Tables use `FORCE ROW LEVEL SECURITY` so even table owners respect RLS policies:
   ```sql
   ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;
   ALTER TABLE procurement_requests FORCE ROW LEVEL SECURITY;
   
   CREATE POLICY workspace_isolation_policy ON procurement_requests
       FOR ALL
       USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', TRUE), '')::uuid);
   ```
3. **Transaction-Local Setting:** To prevent connection-pool bleed in connection poolers (PgBouncer), tenant context is set **transaction-locally** within the transaction:
   ```typescript
   await prisma.$transaction(async (tx) => {
     await tx.$executeRawUnsafe(
       `SET LOCAL app.current_workspace_id = '${currentWorkspaceId}';`
     );
     return tx.procurementRequest.findMany({ ... });
   });
   ```
4. **Background Job Tenant Context:** Background workers and webhooks resolve `workspace_id` strictly from **trusted internal call records or job rows**, never from untrusted external webhook metadata.

---

## 7. Duplicate Order Prevention, Split Fulfillment & Checksum Verification

### Business Invariants
1. **Direct Payment Invariant:** The buyer pays the supplier directly. Kovok does not hold money and never places an order without verified buyer signoff.
2. **Split Fulfillment Data Model:** A single buyer approval may authorize splitting a requirement (e.g., 20 tonnes required: 12 tonnes from Supplier A, 8 tonnes from Supplier B). Therefore, `UNIQUE (approval_id)` on `purchase_orders` is rejected because it would prevent the second PO.
3. **Approval Allocation Model:**
   - `Approval` records the buyer's authorized requirement and total quantity ceiling.
   - `ApprovalAllocation` records each specific supplier, material variant, quantity, unit price, and commercial terms.
   - `PurchaseOrder` references a unique `approval_allocation_id`: `UNIQUE (approval_allocation_id)`.
   - Request retries are guarded by `UNIQUE (workspace_id, idempotency_key)`.
   - The system validates that $\sum \text{Allocated Quantity} \le \text{Approved Quantity}$.

```sql
-- Buyer's approved purchase authorization
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    request_id UUID NOT NULL REFERENCES procurement_requests(id),
    approved_by_user_id UUID NOT NULL REFERENCES users(id),
    total_approved_quantity NUMERIC(12, 3) NOT NULL,
    total_approved_amount NUMERIC(14, 2) NOT NULL,
    approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED', -- 'APPROVED', 'SUPERSEDED', 'CANCELLED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Specific supplier allocation within the approved plan
CREATE TABLE approval_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    quotation_id UUID NOT NULL REFERENCES quotations(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    allocated_quantity NUMERIC(12, 3) NOT NULL,
    allocated_payable_amount NUMERIC(14, 2) NOT NULL,
    allocated_terms_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated Purchase Order referencing one unique allocation
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    po_number VARCHAR(32) NOT NULL,
    request_id UUID NOT NULL REFERENCES procurement_requests(id),
    approval_allocation_id UUID NOT NULL REFERENCES approval_allocations(id),
    idempotency_key VARCHAR(128) NOT NULL,
    approved_terms_snapshot JSONB NOT NULL,
    consistency_checksum VARCHAR(64) NOT NULL, -- SHA-256 consistency checksum of approved_terms_snapshot
    po_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'DISPATCHED', 'ARRIVED', 'INSPECTED', 'RECONCILED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce one PO per approved allocation
    CONSTRAINT uk_po_allocation UNIQUE (approval_allocation_id),
    -- Prevent duplicate submissions on network retries
    CONSTRAINT uk_po_idempotency UNIQUE (workspace_id, idempotency_key),
    CONSTRAINT uk_workspace_po_number UNIQUE (workspace_id, po_number)
);
```

### Consistency Checksum & Immutability
- The SHA-256 hash stored on the PO is a **consistency checksum**, not a cryptographic digital signature or non-repudiation mechanism.
- Immutability is enforced through application state machine guards, restricted database permissions (preventing direct updates to confirmed PO rows), and an append-only `audit_logs` table.
- Partial deliveries against a single PO are handled as a separate concept at gate receiving (`gate_receipts`).

---

## 8. Lean Modular Monolith (Redis Removed for Phase 1)

### Modular Monolith with Database Transactional Outbox
1. **No Mandatory Redis for Phase 1:** Redis is removed from Phase 1 requirements. Core business operations, approval validations, and background jobs run within the single application process using **PostgreSQL-backed transactional jobs** (Graphile Worker / Pg-Boss).
2. **Transactional Outbox Pattern:** When a quote is approved or a call scheduled, the job is committed in the *same ACID transaction* as the domain state update.
3. **Database-Authoritative Control:** Database transactions, row locking (`SELECT ... FOR UPDATE`), and unique constraints are the authoritative controls for purchase authorization; distributed locks must never be the authoritative control. Redis will be revisited only if future load/latency requirements justify it.

---

## 9. Data Retention, Calling Policies & Provider-Agnostic Hosting

### Configurable Data Retention & Calling Policy
- The 90-day transcript retention is a **proposed product default**, not a statutory default.
- Retention must be configurable per tenant and purpose.
- Prior to production launch, complete a formal legal and privacy review of supplier calls, AI disclosure, call recording, opt-out handling, and Indian TRAI / DoT calling restrictions (DND registry compliance, calling hour limits).

### Cloud Provider Selection
Hosting and database regions will be finalized upon provider selection (comparing AWS `ap-south-1` Mumbai, GCP `asia-south1` Mumbai, and Azure `centralindia` Pune) based on latency benchmarks, database pricing, and Indian DPDP Act compliance.
