# Kovok — Production Architecture Decisions (ADR)

**Document Status:** Approved Architecture Reference  
**Author:** Lead Software Engineer  
**Date:** October 30, 2026  
**Target Environment:** Production Construction Procurement (Indian Market)

---

## 1. Architectural Strategy & Guiding Principles

Kovok transforms from a front-end UI concept into a production-grade enterprise procurement platform. Construction procurement in India is high-value, operationally complex, and error-sensitive:
- Material orders routinely exceed ₹5,00,000 to ₹50,00,000 per transaction.
- Product specifications (TMT ductility, cement grade) have direct structural engineering consequences.
- Commercial quotes include volatile price components (basic rates, fluctuating freight, loading/unloading, 18%/28% GST).

### Guiding Principles
1. **Practicality Over Unnecessary Microservices:** A unified, modular TypeScript architecture (modular monolith) avoids premature distributed systems complexity while maintaining clean domain boundaries.
2. **Deterministic Commercial Integrity:** Kovok must calculate delivered costs deterministically. Calculations must never depend on non-deterministic LLM arithmetic.
3. **Strict Human-in-the-Loop Authorization:** The buyer pays the supplier directly. Kovok provides negotiation intelligence and operational tracking, but **never executes a commercial commitment or places an order without verified buyer signoff**.
4. **Resilient Asynchrony:** Phone calls, speech-to-text, webhook ingestion, and ERP synchronization must execute through fault-tolerant, idempotent background queues.
5. **Data Residency & Compliance:** All buyer data, audio recordings, and commercial ledgers must remain compliant with India's Digital Personal Data Protection (DPDP) Act and reside in Indian cloud regions (e.g., Mumbai/Delhi).

---

## 2. Technology Stack Selection

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Web Browser (Client)                          │
│   Next.js React Frontend · Custom Industrial UI · Web Audio API        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / WSS
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Application & API Layer (Server)                    │
│   Next.js App Router (Node.js 20+ TypeScript) · Zod Schemas            │
│   Domain Services: Catalog · Quotes · Approvals · Orders · Exceptions  │
└──────────────┬────────────────────┬────────────────────┬───────────────┘
               │                    │                    │
┌──────────────▼─────┐ ┌────────────▼─────────┐ ┌────────▼──────────────┐
│  PostgreSQL 16+    │ │    Redis 7 + BullMQ   │ │   Sarvam AI & Voice   │
│  - Prisma / Drizzle│ │  - Async Call Queue  │ │  - Indic Speech/Voice │
│  - Tenant RLS      │ │  - Webhook Retries   │ │  - Outbound Webhooks  │
│  - Audit Logs      │ │  - Rate Limiters     │ │  - Telephony Gateway  │
└────────────────────┘ └──────────────────────┘ └───────────────────────┘
```

| Component | Selected Technology | Justification & Architectural Fit |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18+ with Next.js (App Router)** | Full-stack TypeScript architecture; server components ensure server secrets never leak to the client; server actions streamline form interactions; preserves custom CSS design tokens from the prototype. |
| **Styling & Design System** | **Tailored CSS Modules / Vanilla CSS Tokens** | Preserves the calm, restrained industrial aesthetic developed in `index.html` (inter-spacing, table-first density, status chips, custom modal ergonomics) rather than degrading into a generic component library. |
| **Server-Side API Layer** | **Next.js Route Handlers / Fastify Services** | Strict typing across API contracts using Zod; unified TypeScript types shared across frontend and backend; high-throughput async I/O. |
| **Primary Database** | **PostgreSQL 16+ (AWS RDS / GCP Cloud SQL)** | ACID transactional guarantees for financial records; `pg_trgm` extension for full-text search across brands/SKUs/PIN codes; native JSONB for flexible category specifications; robust foreign-key constraints. |
| **ORM & Migrations** | **Prisma ORM / Drizzle ORM** | Type-safe query building, declarative schema modeling, automated deterministic migration scripts, and seed controls. |
| **Background Processing** | **BullMQ + Redis 7** | Reliable job queues for outbound call scheduling, webhook event retry processing, timeout monitors, and ERP synchronization. |
| **Voice & Speech Engine** | **Sarvam AI Indic Telephony & LLM APIs** | Market-leading Hindi, Hinglish, and Indian English speech recognition and natural conversational voice generation tuned for Indian accents and trade vocabulary. |
| **File / Object Storage** | **S3-Compatible Cloud Storage (GCS / S3 Mumbai)** | Secure, encrypted bucket storage for audio recordings, weighbridge challans, test certificates, and invoice snapshots with pre-signed URLs. |

---

## 3. Server-Side Secret Management

```
┌────────────────────────────────────────────────────────┐
│            GCP Secret Manager / AWS Secrets            │
│  SARVAM_API_KEY · DB_PASSWORD · WEBHOOK_SECRET · JWT   │
└───────────────────────────┬────────────────────────────┘
                            │ Injected at Container Startup
┌───────────────────────────▼────────────────────────────┐
│                  Server Runtime (Node.js)              │
│  - process.env parsed through server-only Zod config   │
│  - Environment variables NEVER prefixed with NEXT_PUBLIC│
│  - Client bundle contains ZERO credentials             │
└────────────────────────────────────────────────────────┘
```

### Architectural Controls
1. **Server/Client Boundary:** No API credentials or signing secrets may use the `NEXT_PUBLIC_` prefix. Environment configuration is parsed in a dedicated `server/config.ts` module using Zod:
   ```typescript
   import { z } from 'zod';
   
   const serverConfigSchema = z.object({
     DATABASE_URL: z.string().url(),
     SARVAM_API_KEY: z.string().min(1),
     SARVAM_WEBHOOK_SECRET: z.string().min(32),
     JWT_SECRET: z.string().min(32),
     REDIS_URL: z.string().url(),
   });
   
   export const env = serverConfigSchema.parse(process.env);
   ```
2. **Production Secret Injection:** In production, secrets are injected via cloud provider secret managers (Google Cloud Secret Manager or AWS Secrets Manager) directly into container environment variables at runtime.
3. **No Conversational Credentials:** During workspace setup or onboarding conversations, users are **never** prompted for ERP passwords or API secrets in chat. Integrations use dedicated server-authenticated OAuth or secured setting forms with encrypted at-rest storage (AES-256-GCM).

---

## 4. Business Record Persistence & Data Architecture

All business operations persist in PostgreSQL with strict relational constraints:

```sql
-- Core Procurement Request
CREATE TABLE procurement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    request_code VARCHAR(32) NOT NULL, -- e.g. KOV-1028
    category VARCHAR(32) NOT NULL,     -- 'tmt', 'cement', etc.
    status VARCHAR(32) NOT NULL,       -- 'DRAFT', 'SOURCING', 'QUOTES_READY', 'ORDERED', 'CLOSED'
    specifications JSONB NOT NULL,     -- Grade, diameter, standard, pack size
    quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(16) NOT NULL,         -- 'tonnes', 'bags'
    delivery_site VARCHAR(255) NOT NULL,
    delivery_pin_code VARCHAR(6) NOT NULL,
    required_by_date DATE NOT NULL,
    delivery_basis VARCHAR(64) NOT NULL,
    budget_limit NUMERIC(14, 2),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_workspace_request_code UNIQUE (workspace_id, request_code)
);

-- Quotations Received & Normalized
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    request_id UUID NOT NULL REFERENCES procurement_requests(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    status VARCHAR(32) NOT NULL, -- 'CONFIRMED', 'PARTIAL', 'INCOMPLETE', 'EXPIRED', 'REJECTED'
    base_subtotal NUMERIC(14, 2) NOT NULL,
    discount_amount NUMERIC(14, 2) DEFAULT 0,
    gst_rate_percent NUMERIC(4, 2) NOT NULL, -- 18.00 or 28.00
    gst_amount NUMERIC(14, 2) NOT NULL,
    freight_charges NUMERIC(14, 2),
    unloading_charges NUMERIC(14, 2),
    other_charges NUMERIC(14, 2) DEFAULT 0,
    delivered_total NUMERIC(14, 2), -- Calculated deterministically; NULL if non-comparable
    unit_cost_normalized NUMERIC(14, 2),
    is_comparable BOOLEAN NOT NULL DEFAULT FALSE,
    available_quantity NUMERIC(12, 3) NOT NULL,
    promised_eta TIMESTAMPTZ,
    valid_until TIMESTAMPTZ NOT NULL,
    supplier_terms TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### ACID Transactions
Multi-entity state transitions are wrapped in atomic database transactions:
- When a quote is approved, a database transaction validates quote validity, locks the quotation record (`FOR UPDATE`), creates the Purchase Order, creates an Approval Record, transitions the Request state to `ORDER_CONFIRMED`, and appends an entry to `audit_logs`.

---

## 5. Idempotent Sarvam Webhook Processing

Sarvam voice agents transmit call updates, transcripts, and structured quote extractions asynchronously via webhooks. Networks may produce duplicate deliveries, out-of-order deliveries, or retries.

```
Incoming Webhook
      │
      ▼
┌──────────────────────────────────────────────┐
│  1. Verify HMAC-SHA256 Signature Header      │
│     (Reject with 401 if invalid)             │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  2. Extract Event ID & Timestamp             │
│     (Reject if timestamp > 5 min old)        │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  3. Database Check: webhook_events Table     │
│     INSERT INTO webhook_events (provider,    │
│       event_id, payload_hash)                │
│     ON CONFLICT DO NOTHING                   │
└──────────────────────┬───────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │ Record Already Exists?    │
         ├─── YES ────────────── NO ─┤
         ▼                           ▼
┌──────────────────┐       ┌────────────────────────────────┐
│ Return HTTP 200  │       │ 4. Execute Business Logic:     │
│ (Acknowledge     │       │    - Parse quote extraction    │
│  duplicate)      │       │    - Update call session       │
└──────────────────┘       │    - Recalculate quote matrix  │
                           │ 5. Mark Event PROCESSED        │
                           │ 6. Return HTTP 200             │
                           └────────────────────────────────┘
```

### Database Deduplication Schema
```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL DEFAULT 'sarvam',
    event_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'PROCESSED', 'FAILED'
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uk_provider_event UNIQUE (provider, event_id)
);
```

---

## 6. Duplicate Order Prevention & Strict Order Authorization

Kovok enforces a strict authorization boundary: **The buyer pays the supplier directly; Kovok must never generate a purchase order without explicit, verified buyer authorization**.

```
Buyer Clicks "Select for Approval"
                │
                ▼
┌──────────────────────────────────────────────┐
│  1. Check User Permissions (RBAC)            │
│     Is user authorized for amount ₹X?        │
└──────────────────────┬───────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  2. Validate Quotation Freshness             │
│     Is quote expired? Is delivered cost valid│
└──────────────────────┬───────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  3. Generate Cryptographic Snapshot Hash     │
│     SHA-256(supplier_id + items + total + ETA│
└──────────────────────┬───────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  4. Acquire Distributed Lock (Redis)         │
│     Key: lock:approval:request:<request_id>  │
└──────────────────────┬───────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  5. Atomic DB Transaction:                   │
│     - Verify no existing PO for this quote   │
│     - Insert into approvals table            │
│     - Insert into purchase_orders            │
│     - Set request.status = 'ORDERED'         │
└──────────────────────┬───────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  6. Release Lock & Return PO Confirmation    │
└──────────────────────────────────────────────┘
```

### Database Anti-Duplicate Constraints
```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    po_number VARCHAR(32) NOT NULL, -- e.g. PO-0261
    request_id UUID NOT NULL REFERENCES procurement_requests(id),
    quotation_id UUID NOT NULL REFERENCES quotations(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    approval_id UUID NOT NULL REFERENCES approvals(id),
    commercial_terms_hash VARCHAR(64) NOT NULL, -- Tamper proof snapshot
    total_approved_amount NUMERIC(14, 2) NOT NULL,
    po_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'DISPATCHED', 'ARRIVED', 'INSPECTED', 'RECONCILED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce single PO per approved quotation
    CONSTRAINT uk_po_quotation UNIQUE (quotation_id),
    CONSTRAINT uk_workspace_po_number UNIQUE (workspace_id, po_number)
);
```

---

## 7. Multi-Tenant Isolation & Immutable Audit History

### Multi-Tenancy Architecture
1. **Workspace Boundary:** Every enterprise organization operates within an isolated `workspace_id`.
2. **Row-Level Security (RLS):**
   ```sql
   ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY workspace_isolation_policy ON procurement_requests
       FOR ALL
       USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
   ```
3. **Session Context Middleware:** Database connections set the session variable before executing queries:
   ```typescript
   await prisma.$executeRawUnsafe(
     `SET LOCAL app.current_workspace_id = '${currentWorkspaceId}';`
   );
   ```

### Immutable Audit Trail
Any commercial decision, call trigger, approval, or exception modification generates an immutable audit record:
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    actor_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(64) NOT NULL, -- 'REQUEST_CREATED', 'CALL_DISPATCHED', 'QUOTE_APPROVED', 'EXCEPTION_RAISED'
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    payload_before JSONB,
    payload_after JSONB,
    client_ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 8. Separation of Development Fixtures from Production Data

1. **Strict Environment Segregation:**
   - Development/Test fixtures reside in `prisma/fixtures/` and are only loaded via `npm run db:seed`.
   - Seed scripts strictly check `process.env.NODE_ENV !== 'production'`. Attempting to run seeds in production halts with an error.
2. **Visual Prototype Mode Flag:**
   - In production, real database data is rendered.
   - If a tenant runs in demo/sandbox mode, the UI explicitly displays the topbar banner: `<span class="sample">SANDBOX / SAMPLE DATA</span>`.
3. **Mock Voice Provider:**
   - During local development and automated testing, a `MockSarvamVoiceProvider` simulates voice call progression (queued $\rightarrow$ ringing $\rightarrow$ completed) and returns realistic test fixtures without consuming Sarvam telephony credits or dialling real supplier numbers.

---

## 9. Deployment & Infrastructure Architecture

```
                                  Internet
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │  Cloudflare / Cloud Armor WAF   │
                    │  - DDoS Protection & SSL Term   │
                    │  - Rate Limiting on Webhooks    │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │     GCP Cloud Run / AWS ECS     │
                    │     (Next.js App Containers)    │
                    │     Located in Mumbai (India)   │
                    └───────┬─────────────────┬───────┘
                            │                 │
              ┌─────────────▼────┐       ┌────▼─────────────┐
              │  GCP Cloud SQL   │       │ GCP Memorystore  │
              │  PostgreSQL 16   │       │ Redis (Queues)   │
              │  (Multi-AZ HA)   │       │ (Mumbai Region)  │
              └──────────────────┘       └──────────────────┘
```

- **Cloud Region:** Mumbai (`asia-south1`) or Delhi (`asia-south2`) to guarantee low latency for Indian users and enforce full compliance with Indian data protection legislation.
- **Stateless Containers:** Scaled horizontally on Google Cloud Run or AWS ECS Fargate.
- **Managed Database & Cache:** Cloud SQL PostgreSQL with automated daily backups and point-in-time recovery; Cloud Memorystore for Redis handling queue persistence.
