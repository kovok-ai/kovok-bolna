# Kovok — Current State Technical & Domain Audit (Amended)

**Document Status:** Amended Technical Audit  
**Author:** Lead Software Engineer  
**Date:** October 30, 2026 (Amended)  
**Target Environment:** Production Construction Procurement (Indian Market)

---

## 1. Executive Summary & Audit Scope

Kovok is an AI-powered procurement operations platform for construction materials in India, initially focused on **TMT Steel** and **Cement**. It operates across two primary workflows:
1. **Connected Procurement:** Integrating with buyer ERPs, inventory systems, or accounting tools (e.g., ERPNext, TallyPrime, Zoho).
2. **Quick Source:** Guiding buyers without integrated procurement software through natural-language/voice specification, supplier matching, automated voice quoting via Sarvam AI, structured commercial comparison, explicit gated buyer approvals, and delivery/receipt tracking.

### Core Domain Invariant
> **Strict Business Rule:** The buyer pays the supplier directly. Kovok is an operations and intelligence layer; it does not escrow or hold buyer funds, and it **must never place an order or commit commercial terms without verified, explicit buyer authorization**.

### Current Baseline
The audited repository contains an HTML/CSS/JS frontend concept prototype (`Kovok_Construction_UI_Premium/index.html`), screen specifications (`UI_SCREEN_SPEC.md`), business onboarding guidelines (`ONBOARDING_QUESTIONS.md`), UI screenshots, and a Linux-based Playwright smoke test (`check_ui.py`).

While the prototype delivers a clean, restrained, table-first design inspired by industrial procurement systems (ERPNext, SAP Ariba, Procore, JSW One MSME), **it is strictly a client-side mockup**. All data is hardcoded in memory, no server or database exists, interactive forms do not persist, voice integrations are static buttons, and no security or multi-tenancy controls are implemented.

---

## 2. Codebase Structure & Source Inventory

```
Kovok_Construction_UI_Premium/
├── docs/                                # Canonical architecture & implementation documentation
│   ├── CURRENT_STATE_AUDIT.md           # This audit document
│   ├── ARCHITECTURE_DECISIONS.md        # Technical architecture specifications
│   └── IMPLEMENTATION_PLAN.md           # Phased roadmap and acceptance criteria
├── .env.example                         # Environment configuration template
├── Kovok_Construction_UI_Premium/        # Original prototype package (baseline preserved)
│   ├── index.html                       # Single-file HTML/CSS/JS prototype (83,949 bytes, 115 lines)
│   ├── UI_SCREEN_SPEC.md                # UI design direction and screen specs (7,099 bytes)
│   ├── ONBOARDING_QUESTIONS.md          # Progressive onboarding questionnaire (9,897 bytes)
│   ├── README.md                        # Prototype documentation and run instructions (2,429 bytes)
│   ├── preview_gallery.html             # Gallery page referencing prototype screenshots (4,428 bytes)
│   ├── check_ui.py                      # Playwright UI verification script (1,957 bytes)
│   └── preview_*.png                    # 11 full-page screenshot previews
```

### Target Runtime & Dependency Compatibility
- **Runtime Environment:** Must target a currently supported LTS release. **Node.js 24.x LTS** is selected. (Note: Node.js 20 reached End-of-Life on 24 March 2026 and is strictly rejected).
- **Framework:** **Next.js 16.0.x (Active LTS)** with React 19.x is selected. Pinned versions avoid compatibility drift and vague "15+" targets.

### File-by-File Technical Inspection

| File | Purpose | Tech Stack | Production Readiness | Gaps Identified |
| :--- | :--- | :--- | :--- | :--- |
| `index.html` | Core UI prototype | Vanilla HTML5, CSS3, ES6 JS | **Concept Prototype Only** | Monolithic single file; all logic in `document.addEventListener`; zero backend communication; hardcoded in-memory fixtures. |
| `check_ui.py` | UI test script | Python 3, Playwright | **Non-portable Script** | Hardcoded to Linux path `/mnt/data/Kovok_Construction_UI_Premium` and `/usr/bin/chromium`; fails on Windows/Mac without local Chromium configuration. |
| `UI_SCREEN_SPEC.md` | Specification | Markdown | **High Value Reference** | Lacks API contracts, HTTP response schemas, and error state specifications. |
| `ONBOARDING_QUESTIONS.md` | Onboarding spec | Markdown | **High Value Reference** | Lacks formal JSON schema definitions for workspace rule generation. |
| `preview_gallery.html` | Visual asset | Static HTML/CSS | **Documentation Only** | Visual artifact showcasing pre-rendered PNGs. |

---

## 3. Comprehensive Sample Data Audit

Every data structure rendered in the UI is hardcoded in memory within `index.html`. Below is the complete catalog of hardcoded fixtures:

### 3.1 Client State Object (`index.html:L61`)
```javascript
const state = {
  page: 'overview',
  requestStep: 0,
  request: {
    mode: 'standalone',
    category: 'tmt',
    description: '',
    grade: 'Fe 550D',
    diameter: '12',
    brand: 'Open to approved brands',
    quantity: '20',
    unit: 'tonnes',
    site: 'Site A — Gurugram',
    pin: '122018',
    date: '2026-11-02',
    delivery: 'Delivered at site',
    budget: '',
    suppliers: '3',
    notes: ''
  },
  setupStep: 0,
  setup: {
    businessType: 'Contractor / Builder',
    company: 'Concrete & Co.',
    sites: '2',
    categories: ['TMT Steel','Cement'],
    source: 'Site engineer / project manager',
    frequency: 'Weekly',
    supplierList: 'Existing contacts + discover new',
    decision: 'Total delivered cost and delivery reliability',
    approval: 'Owner / project manager',
    orderValue: '₹50,000+',
    language: 'Hindi + English',
    systems: 'Excel / WhatsApp',
    retries: '2',
    substitutions: 'Only after approval'
  }
};
```
* **Audit Finding:** The workspace identity ("Concrete & Co.", "Delhi NCR · 2 sites"), user profile ("Shiwang Gupta, Workspace admin"), and pre-filled form fields are permanently baked into the client state. Any change made during a session is lost on browser refresh.

### 3.2 Navigation Counter Badges (`index.html:L42, L43, L45`)
* Requests badge: `<span class="count">6</span>`
* Quotations badge: `<span class="count">3</span>`
* Exceptions badge: `<span class="count">2</span>`
* **Audit Finding:** Badges are static hardcoded HTML spans; they do not calculate counts from active database records.

### 3.3 Procurement Requests Fixture (`index.html:L68-75`)
```javascript
const requests = [
  ['KOV-1028','TMT steel · Fe 550D · 12 mm','20 tonnes · Gurugram','Nov 2, 2026',status('Quotes ready','blue'),'3 offers'],
  ['KOV-1027','OPC 53 cement · 50 kg','300 bags · Dwarka','Oct 30, 2026',status('Awaiting approval','amber'),'2 offers'],
  ['KOV-1026','TMT steel · Fe 500D · 16 mm','8 tonnes · Noida','Oct 31, 2026',status('Supplier call pending','amber'),'1 of 3'],
  ['KOV-1025','PPC cement · 50 kg','500 bags · Gurugram','Nov 1, 2026',status('Order confirmed','green'),'Selected supplier'],
  ['KOV-1024','M-sand · Zone II','2 truckloads · Faridabad','Oct 29, 2026',status('Needs clarification','red'),'Quantity/unit'],
  ['KOV-1023','TMT steel · Fe 550D · 10 mm','5 tonnes · Delhi','Oct 28, 2026',status('Delivered · inspect','blue'),'Receipt pending']
];
```
* **Audit Finding:** Represented as untyped string arrays rather than normalized relational objects. Modifying the requests array does not propagate relational updates to quotations, orders, or exceptions.

### 3.4 Overview Metrics & Attention Queue (`index.html:L77-79`)
* Four metric cards hardcoded: `6` Open requests, `3` Quotes ready, `2` Orders at risk, `1` Awaiting approval.
* Needs Attention queue hardcoded:
  - Supplier shortfall: `KOV-1028 · 8 of 20 tonnes unconfirmed`
  - Delivery date changed: `KOV-1025 · ETA moved by one day`
* Next deliveries hardcoded:
  - `Sunrise Cement Traders · Today, 4:30 PM`
  - `Shakti Steel & Co. · Tomorrow, 9:00 AM`

### 3.5 Quotation Comparison Matrix (`index.html:L81`)
* Scope locked to a single static request: `KOV-1028 · TMT Fe 550D · 12 mm`.
* Fixed offers:
  1. **Shakti Steel & Co.:** Subtotal ₹9,80,000, Freight+Unloading ₹32,000, Total ₹10,12,000 (₹50,600/t), 20t available, ETA 1 Nov, Valid 24h.
  2. **Northline Metals:** Subtotal ₹9,86,000, Freight+Unloading ₹32,000, Total ₹10,18,000 (₹50,900/t), 20t available, ETA 2 Nov, Valid 12h.
  3. **Metro Build Supply:** Subtotal ₹9,96,000, Freight+Unloading: `Not confirmed`, Total: `—`, Status: `Incomplete`.
* Notice: Hardcoded banner warning that Metro Build Supply is non-comparable due to missing freight/unloading.

### 3.6 Orders & Deliveries Table (`index.html:L82`)
* Static array of 3 purchase orders:
  - `PO-0261`: 20t TMT Fe 550D from Shakti Steel, ETA Tomorrow 9:00 AM, `Confirmed`.
  - `PO-0260`: 500 bags PPC from Sunrise Cement, ETA Today 4:30 PM, `Dispatch confirmed`.
  - `PO-0259`: 8t TMT Fe 500D from Northline Metals, `At risk` (Recovery open).

### 3.7 Exceptions Queue (`index.html:L83`)
* Fixed metrics: `2` Open, `1` Awaiting supplier, `1` Awaiting buyer, `4` Closed today.
* Static items:
  - `EX-008`: Supplier shortfall on PO-0259 (8t not confirmed).
  - `EX-007`: ETA changed on PO-0260 (moved by 1 day).
  - `EX-006`: Incomplete quote on KOV-1028 (unloading charge missing).

### 3.8 Product Catalogue Table (`index.html:L84-85`)
* Static array of 6 catalogue items:
  - `TMT Steel · Fe 550D` (12 mm, Verified, 2 supplier mappings)
  - `Cement · OPC 53` (50 kg bag, Verified, 4 supplier mappings)
  - `Cement · PPC` (50 kg bag, Partially verified, 3 supplier mappings)
  - `RMC · M25` (Grade & pour-slot configured, Schema only)
  - `M-sand · Zone II` (Grading & delivered quantity required, Provisional)
  - `Waterproofing membrane` (Needs review)

### 3.9 Supplier Directory (`index.html:L86`)
* 4 hardcoded suppliers:
  - `Shakti Steel & Co.` (Gurugram 122001, Hindi/English, 12 verified orders, Preferred)
  - `Sunrise Cement Traders` (Dwarka 110075, Hindi/English, 21 verified orders, Active)
  - `Northline Metals` (Delhi NCR, Hindi/English, 4 orders, Active)
  - `Metro Build Supply` (Faridabad 121001, Hindi, 0 orders, New)

### 3.10 Integrations & Settings (`index.html:L87-88`)
* Hardcoded connectors: CSV/Excel (`Available in prototype`), ERPNext (`Not connected`), TallyPrime (`Planned`).
* Settings form options are plain HTML elements; saving invokes an alert modal stating "This prototype has no persistent backend."

---

## 4. UI Elements: Functional vs Non-Functional Audit

| Component / Screen | Element | Expected Behavior | Current Prototype Status | Remediation Required |
| :--- | :--- | :--- | :--- | :--- |
| **Global Topbar** | Search Input (`#globalSearch`) | Server-side / fuzzy entity search across requests, quotes, suppliers, and items. | **Fake Navigation:** Checks keyword substring (`quote`, `supplier`, `catalog`) and redirects page tab with a mock toast. | Implement PostgreSQL `pg_trgm` full-text search API endpoint `/api/v1/search`. |
| **Global Topbar** | Help Button (`#helpBtn`) | Contextual help documentation / support drawer. | **Non-functional:** Emits a static toast message. | Integrate help drawer with guided workflow tips. |
| **Global Topbar** | `+ New Request` Button | Opens interactive request wizard. | **Partial:** Opens modal wizard, captures input in memory, but submittal only triggers a toast and resets on reload. | Connect to backend `POST /api/v1/requests` with schema validation. |
| **Requests Screen** | Filter Dropdown (`#reqFilter`) | Filters table rows by status. | **Broken:** Element exists in DOM, but no `change` event listener is attached. Selecting an option does nothing. | Wire reactive filter state to paginated API query params (`?status=...`). |
| **Requests Screen** | Import Button | Opens CSV/Excel file upload wizard. | **Placeholder:** Displays an informational modal with mock text. | Implement multipart upload API with preview & column mapping. |
| **Requests Screen** | Row Action `Open ->` | Opens full procurement request details. | **Placeholder:** Opens static `infoModal('open-request')`. | Create full-page / drawer view with quote history, audit timeline, and live status. |
| **Quotations Screen** | Table Actions (`Clarify`, `Review`) | Initiates supplier clarification call/message; prepares approval packet. | **Placeholder:** Triggers static mock modal or toast. | Implement Sarvam voice clarification dispatch and approval workflow triggers. |
| **Quotations Screen** | `Select for approval` | Submits selected quote to authorized buyer for formal signoff. | **Placeholder:** Displays `approve-quote` static modal. | Create formal Approval entity with versioned quote snapshot and cryptographic/session token. |
| **Orders Screen** | Export Button | Downloads CSV/PDF of active purchase orders. | **Placeholder:** Displays static `infoModal('export-orders')`. | Implement streaming CSV/PDF generation endpoint. |
| **Orders Screen** | Filter Dropdown | Filters orders by status (`At risk`, `Awaiting receipt`). | **Broken:** No event listener attached. | Implement reactive status filtering. |
| **Product Catalogue** | Search & Filters | Searches items by IS standard, brand, SKU, and category. | **Broken:** Input and selects are un-wired. | Connect to catalogue query API with attribute facet filtering. |
| **Product Catalogue** | `Add product` Form | Creates new canonical or provisional product. | **Mock Only:** Saves nothing; only displays a toast. | Connect to `POST /api/v1/products` with duplicate checking and provisional flags. |
| **Suppliers Screen** | Search & Filter Inputs | Filters suppliers by PIN code, material, rating. | **Broken:** No event listeners attached. | Connect to supplier query API with spatial / PIN code serviceability filter. |
| **Suppliers Screen** | `Add supplier` Button | Opens form to create supplier record. | **Placeholder:** Opens static info modal. | Create interactive multi-step supplier onboarding form. |
| **Integrations Screen** | Connector Action Buttons | Initiates OAuth or API token configuration for ERPNext. | **Placeholder:** Displays static info modal stating connector is not implemented. | Build credential storage, sync configuration, and field mapping engine. |
| **Settings Screen** | `Save` Button | Persists tenant procurement policy and calling rules. | **Placeholder:** Opens modal stating "This prototype has no persistent backend." | Wire to `PUT /api/v1/workspaces/:id/settings`. |
| **New Request Wizard** | Voice Button (`voice-demo`) | Activates microphone or speech input via Sarvam AI. | **Placeholder:** Shows static modal stating Sarvam is not connected. | Integrate browser Web Audio API / MediaRecorder and Sarvam STT API. |
| **Workspace Setup Wizard**| 6-step Onboarding | Configures rules, material policies, and call thresholds. | **Mock Only:** Generates client preview; clicking "Approve" shows a toast and discards data on refresh. | Store workspace configuration profile in PostgreSQL. |

---

## 5. Construction Domain & Standards Realities

### 5.1 Standards Reference Data (IS 1786 & Cement)
- **TMT Reinforcement Steel (IS 1786:2008):**
  - Official BIS standard specifies grades: `Fe 415`, `Fe 415D`, `Fe 500`, `Fe 500D`, `Fe 550`, `Fe 550D`, and `Fe 600`.
  - Nominal diameters: `4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 25, 28, 32, 36, 40, 45, 50 mm`.
  - **Draft Standards:** BIS published a 2025 draft revision of IS 1786. *Rule:* Draft standards must be stored as versioned reference data with status `DRAFT_UNDER_REVIEW`. They must **never** be activated as binding production standards until officially promulgated and published in the Gazette of India.
- **Documentation & Mill Test Certificates (MTC):**
  - Quality documentation (such as MTC with heat numbers, chemical composition, and yield strength) must **not** be globally hardcoded as an unconditional requirement.
  - Requirement for MTC derives from:
    1. Applicable IS standard requirements.
    2. Buyer/project engineering specifications (e.g., CPWD, NHAI, DMRC, or private structural consultants).
    3. Purchase contract clauses.
    4. Configured project site receiving policy.
- **Cement Standards & Packaging:**
  - Governed by **IS 269:2015** (OPC 33, 43, 53), **IS 1489:2015** (PPC fly ash / calcined clay), **IS 455** (PSC), and **IS 16415** (Composite).
  - Bag sizes (50 kg HDPE/paper, 25 kg, 1-tonne jumbo bags, bulk tankers) and batch age/freshness (manufacturing week) are source-backed lot and order attributes, not global constants.

### 5.2 Dynamic Tax Architecture & GST Rationalisation
- **GST Rate Reality:**
  - **Cement GST Rate Change:** On 22 September 2025, the Government of India reduced cement GST from 28% to 18% under comprehensive GST rationalisation (PIB Press Release).
  - **Strict Architecture Rule:** Never hard-code global 18% or 28% tax rates. Tax rates must be resolved through an **effective-dated, source-backed tax configuration table** (`tax_rate_rules`):
    - HSN 7214 (TMT steel): 18% GST (CGST 9% + SGST 9% or IGST 18%).
    - HSN 2523 (Cement): Historically 28% (pre-22 Sept 2025), currently 18% (post-22 Sept 2025).
    - System must record transaction date, supplier-provided tax treatment, tax-inclusive vs tax-exclusive status, and jurisdiction.
    - If tax classification or rate is ambiguous, the system must flag classification uncertainty for human review.

---

## 6. Sarvam Voice Agent Integration & Webhook Security

The technical audit cross-referenced Sarvam AI's public developer documentation for Instant Outbound Voice calls:

### Documented Sarvam Webhook Realities
1. **Webhook Payload Contract:**
   - Sarvam's outbound webhook transmits: `attempt_id`, `status` (`completed`, `failed`, `in_progress`), `interaction_id`, `final_agent_variables` (extracted key-value pairs), `transcript` (multi-turn dialogue array), `error_message`, and user-provided `metadata`.
   - **No Documented HMAC Signature Header:** The public Sarvam documentation does **not** specify an `x-sarvam-signature` or HMAC-SHA256 signature contract.
   - **No Global Timestamp:** The payload does not include a root-level ISO event timestamp.
2. **Defensive Webhook Security Architecture (Until Cryptographic Contract is Confirmed):**
   - **Endpoint Tokenization:** Each tenant/environment uses a high-entropy secret path token (e.g. `POST /api/v1/webhooks/sarvam/events?token=${SARVAM_WEBHOOK_INGESTION_TOKEN}`) or secret Bearer token in webhook metadata.
   - **Strict Correlation:** Webhook callbacks are accepted **only** if the incoming `attempt_id` matches an open, active call attempt initiated by Kovok. Un-correlated callbacks are immediately logged as suspicious and discarded.
   - **Server-Side Verification:** Upon receiving a callback, Kovok optionally verifies status by querying Sarvam's Outbound Call API (`GET /voice-agents/outbound/:attempt_id`).
   - **Deduplication:** Deduped via `attempt_id` and internal call correlation.
   - **State Machine Protection:** Protect status transitions against out-of-order callbacks (`INITIATED` $\rightarrow$ `RINGING` $\rightarrow$ `COMPLETED`).
   - **Non-Authority Rule:** A webhook callback updates call logs and quote candidate evidence, but **never independently authorizes an order or generates a PO**.

---

## 7. Authentication, Multi-Tenancy & Order Integrity Gaps

1. **Authentication Strategy:**
   - Instead of a hybrid JWT + session system, implement **one primary strategy**: Secure server-side sessions with `HttpOnly`, `Secure`, and `SameSite=Lax/Strict` cookies using a battle-tested library. JWTs are reserved exclusively for external machine-to-machine API integrations.
2. **PostgreSQL RLS & Connection Pool Bleed:**
   - Setting session-level variables (`SET app.current_workspace_id = ...`) in pooled database connections (PgBouncer) can cause tenant leakage across reused connections.
   - *Fix:* Must use **transaction-local settings** (`SET LOCAL app.current_workspace_id = ...`) within atomic database transactions and verify with cross-tenant isolation test cases.
3. **Duplicate Order Prevention & Split Fulfillment:**
   - A single `UNIQUE (quotation_id)` database constraint is overly restrictive because it forbids legitimate split orders (e.g. 20 tonnes required, Supplier A fulfills 12 tonnes on PO-1; balance 8 tonnes fulfilled via PO-2).
   - *Fix:* Enforce business invariant: **One order submission per approved approval record / approval version** (`UNIQUE (approval_id)`), combined with client-supplied submission idempotency keys.
4. **Lean Modular Monolith & Job Engine:**
   - Prefer a **PostgreSQL-backed transactional job worker** (e.g., Graphile Worker or Pg-Boss) for call scheduling and retries. This ensures outbox jobs are committed in the exact same ACID transaction as the procurement state, avoiding external Redis dependencies unless high-throughput rate-limiting explicitly requires it.

---

## 8. Conclusion & Action Items

This amended audit provides the factual, verified foundation for the revised architecture decisions in `docs/ARCHITECTURE_DECISIONS.md` and implementation phases in `docs/IMPLEMENTATION_PLAN.md`.
