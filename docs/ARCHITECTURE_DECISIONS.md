# Kovok — Production Architecture Decisions (ADR) (Amended)

**Document Status:** Amended Architecture Reference  
**Author:** Lead Software Engineer  
**Date:** October 30, 2026 (Amended)  
**Target Environment:** Production Construction Procurement (Indian Market)

---

## 1. Architectural Strategy & Guiding Principles

Kovok transforms from a front-end UI concept into a production-grade enterprise procurement platform for construction materials in India (TMT steel, cement, aggregates, RMC).

### Core Architectural Invariants
1. **Practical Modular Monolith:** A unified, modular TypeScript codebase avoiding premature microservices overhead while maintaining strict domain separation (Catalog, Suppliers, Requests, Voice, Quotes, Approvals, Orders, Gate Receiving, Exceptions, Integrations).
2. **Deterministic Commercial Integrity:** Kovok validates and compares quotes deterministically via mathematical models. Calculations never rely on non-deterministic LLM arithmetic.
3. **Strict Human-in-the-Loop Authorization:** The buyer pays the supplier directly. Kovok is an operations and intelligence layer; it **never executes a commercial commitment or generates a Purchase Order without verified, explicit buyer authorization**.
4. **Resilient Transactional Asynchrony:** Outbound calls, webhook processing, deadline alarms, and ERP sync are managed through durable, transactional background jobs.
5. **India Data Residency & DPDP Compliance:** All buyer data, audio recordings, and commercial ledgers must comply with India's Digital Personal Data Protection (DPDP) Act. Cloud provider and region selection will be finalized based on verified data residency and latency in India.

---

## 2. Technology Stack & Runtime Specification

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Web Browser (Client)                          │
│   Next.js 16.0.x App Router · Custom Industrial UI · CSS Tokens        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Secure HttpOnly Session Cookies)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Application & API Layer (Server)                    │
│   Node.js 24.x LTS · Next.js 16.0.x (Active LTS) · Zod Contracts       │
│   Domain Services: Catalog · Quotes · Approvals · Orders · Exceptions  │
└──────────────┬────────────────────┬────────────────────┬───────────────┘
               │                    │                    │
┌──────────────▼─────┐ ┌────────────▼─────────┐ ┌────────▼──────────────┐
│  PostgreSQL 16+    │ │ PostgreSQL-backed    │ │   Sarvam AI Voice     │
│  - Prisma / Drizzle│ │ Transactional Worker │ │  - Outbound Telephony │
│  - Transaction RLS │ │ (Graphile / Pg-Boss) │ │  - Tokenized Webhooks │
│  - Audit Trail     │ │ [Optional: Redis]    │ │  - Server Verification│
└────────────────────┘ └──────────────────────┘ └───────────────────────┘
```

| Component | Pinned / Selected Technology | Architectural Rationale & Compatibility |
| :--- | :--- | :--- |
| **Runtime Environment** | **Node.js 24.x LTS** | Node.js 20 reached End-of-Life on 24 March 2026. Node.js 24 LTS is the current actively supported LTS runtime. |
| **Web Framework** | **Next.js 16.0.x (Active LTS)** | Pinned to Next.js 16.0.x with React 19.x. Next.js 16 is Active LTS (Next.js 15 is Maintenance LTS). Server Components strictly prevent credentials from reaching client bundles. |
| **Styling & UI Tokens** | **Tailored CSS Modules / Vanilla Tokens** | Retains the calm, industrial table-first layout from `index.html` (`--bg: #f7f8fa`, `--panel: #fff`, `--blue: #315c9b`, `--green: #236b4a`, `--amber: #855d1c`, etc.) without generic UI component library bloat. |
| **Database & Persistence** | **PostgreSQL 16+** | ACID transactional guarantees; `pg_trgm` extension for fuzzy brand/SKU/PIN search; native JSONB for flexible specifications; transaction-local Row-Level Security (RLS). |
| **ORM & Migrations** | **Prisma ORM / Drizzle ORM** | Declarative schema definitions, type-safe queries, deterministic forward migrations, and isolated development seeds. |
| **Async Job Engine** | **PostgreSQL-backed Worker (Graphile Worker / Pg-Boss)** | Durability with transactional outbox pattern: jobs are committed in the *same database transaction* as domain state changes. Avoids external Redis dependency for core operations. Optional Redis may be introduced if distributed rate limiting requires it. |
| **Voice & Speech Engine** | **Sarvam AI APIs** | Indian Indic conversational voice agents tuned for Hindi, Hinglish, and Indian English trade vocabulary. |
| **Authentication** | **Server-side Sessions with HttpOnly Cookies** | Maintained session library (e.g. Lucia Auth or iron-session) utilizing secure, HttpOnly, SameSite=Lax cookies. JWTs are avoided for the primary web app and reserved exclusively for external machine API clients. |
| **Object Storage** | **S3-Compatible Cloud Storage (India Region)** | Encrypted private bucket storage for weighbridge challans, test certificates, and invoice snapshots with pre-signed URLs. |

---

## 3. Construction Domain & Dynamic Tax Architecture

### 3.1 Versioned Standards Reference Data (IS 1786 & Cement)
- **IS 1786:2008 (High Strength Deformed Steel Bars):**
  - Canonical grades: `Fe 415`, `Fe 415D`, `Fe 500`, `Fe 500D`, `Fe 550`, `Fe 550D`, and `Fe 600`.
  - Nominal diameters: `4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 25, 28, 32, 36, 40, 45, 50 mm`.
  - Nominal mass per meter tolerances: Governed by IS 1786 Table 1.
  - **Draft Standards Handling:** BIS published a 2025 draft revision of IS 1786. *Architectural rule:* Draft standards are stored in `standard_revisions` with status `DRAFT_UNDER_REVIEW`. They must **never** be activated as binding production standards until officially promulgated in the Gazette of India.
- **Documentation & Mill Test Certificates (MTC):**
  - MTC is **not** an unconditional global prerequisite.
  - MTC requirement is dynamic, derived from: (a) applicable standard clauses, (b) buyer/project engineering specifications, (c) purchase contract terms, or (d) site receiving policies.
- **Cement Standards & Attributes:**
  - Governed by **IS 269:2015** (OPC 33, 43, 53), **IS 1489:2015** (PPC), **IS 455** (PSC), and **IS 16415** (Composite).
  - Bag size (50 kg HDPE, 25 kg, bulk tankers) and manufacturing freshness (batch week) are modeled as source-backed product/lot/order attributes and buyer policies.

### 3.2 Dynamic, Source-Backed Tax Configuration
- **GST Rationalisation Reality:** On 22 September 2025, cement GST was reduced from 28% to 18% (PIB Backgrounder).
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
│ 1. Validate Secret Endpoint Ingestion Token                            │
│    (Return HTTP 401 if invalid or absent)                              │
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
│    ├── NO  ──► Log as suspicious, return HTTP 404/200 (Drop event)     │
│    └── YES ──► Proceed                                                 │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Transactional Deduplication & State Machine Guard:                  │
│    INSERT INTO webhook_events (attempt_id, status) ON CONFLICT DO ...  │
│    Is event duplicate or out-of-order?                                 │
│    ├── DUPLICATE/STALE ──► Return HTTP 200 (No re-execution)           │
│    └── NEW TRANSITION  ──► Update call log & quote candidate evidence  │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. Optional Server Verification: Query Sarvam API GET /outbound/:id   │
│ 6. Note: Webhook NEVER places orders or creates POs independently.     │
└────────────────────────────────────────────────────────────────────────┘
```

### Non-Authority Rule
A webhook payload is untrusted external evidence. It updates call transcripts and candidate quote details, but **never independently authorizes a purchase or creates a Purchase Order**.

---

## 6. Authentication, Multi-Tenancy & Transaction-Local RLS

### Single Primary Authentication Strategy
- Web application uses **secure server-side sessions** with `HttpOnly`, `Secure`, and `SameSite=Lax` cookies.
- Avoids custom JWT and session duplication. JWTs are reserved exclusively for machine-to-machine API integrations.

### Transaction-Local Row-Level Security (RLS)
To prevent connection-pool bleed in connection poolers (PgBouncer):
```sql
ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_policy ON procurement_requests
    FOR ALL
    USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', TRUE), '')::uuid);
```

In application transaction middleware, tenant context is set **transaction-locally**:
```typescript
await prisma.$transaction(async (tx) => {
  // SET LOCAL scopes the variable strictly to this transaction boundary
  await tx.$executeRawUnsafe(
    `SET LOCAL app.current_workspace_id = '${currentWorkspaceId}';`
  );
  
  // Queries execute within verified workspace scope
  return tx.procurementRequest.findMany({ ... });
});
```

---

## 7. Duplicate Order Prevention & Split Fulfillment

### Business Invariants
1. **Direct Payment Invariant:** The buyer pays the supplier directly. Kovok does not hold money and never places an order without verified buyer signoff.
2. **One Order Per Approved Approval Version:** A quotation may undergo split fulfillment (e.g. 20 tonnes needed, Supplier A provides 12 tonnes on PO-1; Supplier B provides 8 tonnes on PO-2). Therefore, `UNIQUE (quotation_id)` is rejected as overly restrictive.
3. **Idempotency Invariant:** Every order creation requires a client-provided `idempotency_key` and unique `approval_id`:

```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    po_number VARCHAR(32) NOT NULL,
    request_id UUID NOT NULL REFERENCES procurement_requests(id),
    quotation_id UUID NOT NULL REFERENCES quotations(id),
    approval_id UUID NOT NULL REFERENCES approvals(id),
    idempotency_key VARCHAR(128) NOT NULL,
    split_index INT NOT NULL DEFAULT 0,
    total_approved_amount NUMERIC(14, 2) NOT NULL,
    approved_terms_snapshot JSONB NOT NULL, -- Full immutable snapshot of approved commercial terms
    snapshot_checksum VARCHAR(64) NOT NULL, -- SHA-256 hash of approved_terms_snapshot
    po_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_po_approval UNIQUE (approval_id),
    CONSTRAINT uk_po_idempotency UNIQUE (workspace_id, idempotency_key),
    CONSTRAINT uk_workspace_po_number UNIQUE (workspace_id, po_number)
);
```

### Approved Terms Snapshot Verification
Before persisting the PO, the system normalizes the approved commercial terms (supplier, items, quantities, basic rates, GST breakdown, freight/unloading terms, ETA, payment terms) into a canonical JSON snapshot, computes its SHA-256 checksum, and stores both on the PO. Any discrepancy during delivery reconciliation triggers an audit alert.

---

## 8. Lean Modular Monolith & Provider-Agnostic Infrastructure

### Modular Monolith with Transactional Outbox
Rather than requiring separate microservices or mandatory Redis clusters:
- Core business logic and background jobs run within the single application process using **PostgreSQL-backed transactional jobs** (e.g., Graphile Worker / Pg-Boss).
- When a quote is approved or a call is scheduled, the job is inserted into the database within the *same ACID transaction* as the domain state update.
- Redis remains an optional, non-blocking enhancement for distributed rate-limiting.

### Cloud Provider Selection
Hosting and database regions will be finalized upon provider selection (comparing AWS `ap-south-1` Mumbai, GCP `asia-south1` Mumbai, and Azure `centralindia` Pune) based on latency benchmarks, database pricing, and Indian DPDP Act compliance.
