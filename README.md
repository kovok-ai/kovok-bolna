# Kovok — Construction Procurement Operations Platform

AI procurement operations platform for Indian construction materials, initially focused on **TMT steel** and **cement**.

Supports two operational modes:
1. **Connected Procurement**: Buyers connect existing ERP, accounting, or inventory software.
2. **Quick Source**: Buyers without software describe requirements; Kovok coordinates quotes, approvals, and order tracking.

> **Core Invariant**: The buyer pays the supplier directly. Kovok is an operations and intelligence layer; it must **never** place an order or commit commercial terms without verified, explicit buyer authorization.

---

## 1. System Requirements & Approved Technology Stack

| Component | Approved Specification |
| :--- | :--- |
| **Runtime** | **Node.js 24 LTS** (`>=24.0.0`) |
| **Application Framework** | **Next.js 16.2.x** (App Router, Turbopack, TypeScript 5.7+) |
| **UI Library** | **React 19** |
| **Database** | **PostgreSQL 16+** with Prisma ORM (`@prisma/client@6.19.3`) |
| **Zero-Daemon Engine** | **@electric-sql/pglite** (Embedded PostgreSQL 16 WASM for portable tests) |
| **Validation** | **Zod 3.24+** (Server-side input and environment validation) |
| **Authentication** | **Server-side sessions** using secure, `HttpOnly`, `SameSite=Lax` cookies; Scrypt password hashing with cryptographically random salts |
| **Multi-Tenancy** | **PostgreSQL Row-Level Security (RLS)** with `FORCE ROW LEVEL SECURITY` and transaction-local scoping (`SET LOCAL app.current_workspace_id`) |
| **Worker Design** | **PostgreSQL-backed transactional queue** (No Redis in Phase 1) |

---

## 2. Directory Structure

```text
├── .env.example              # Sanitized canonical environment template
├── .gitignore                # Production ignore rules (secrets, node_modules, build artifacts)
├── package.json              # Pinned dependencies & scripts
├── tsconfig.json             # TypeScript configuration (App Router paths, tests excluded from build)
├── next.config.js            # Next.js configuration
├── README.md                 # Setup, migrations, test commands, and limitations
│
├── prisma/
│   ├── schema.prisma         # Multi-tenant data model (Workspaces, Sites, Users, Roles, Approvals, POs, Tax Rules)
│   ├── seed.ts               # Reference data (GST rules, default workspace/admin, production guard)
│   └── migrations/
│       └── 20261030000000_init/
│           └── migration.sql # PostgreSQL 16 DDL with FORCE ROW LEVEL SECURITY and isolation policies
│
├── src/
│   ├── app/                  # Next.js 16 App Router
│   │   ├── api/auth/         # Route handlers: login, register, logout, session
│   │   ├── api/workspaces/   # RLS-scoped workspace & reference data endpoints
│   │   ├── login/page.tsx    # Styled authentication screen
│   │   ├── register/page.tsx # Workspace onboarding & admin provisioning
│   │   ├── layout.tsx        # Global HTML shell & CSS token imports
│   │   └── page.tsx          # Protected Server Component entry point (session enforcement)
│   ├── components/
│   │   ├── KovokAppClient.tsx # Client application shell (tab navigation & state)
│   │   ├── layout/           # Sidebar, Topbar
│   │   ├── modals/           # NewRequestModal (4-step wizard), ApprovalModal
│   │   └── views/            # 9 Modular views (Overview, Requests, Quotations, Orders, etc.)
│   ├── lib/
│   │   ├── auth.ts           # Scrypt hashing, constant-time verification, session token management
│   │   ├── db.ts             # Prisma client singleton & withTenantContext RLS helper
│   │   ├── env.ts            # Zod environment variable parsing & validation
│   │   ├── session.ts        # Server-side session verification & requireRole helper
│   │   └── validators/       # Zod schemas for auth and workspace provisioning
│   └── styles/
│       ├── tokens.css        # Exact CSS custom properties ported from prototype
│       └── globals.css       # Layout, typography, tables, badges, modals
│
├── tests/
│   ├── run-all.ts            # Portable 32-test runner (RLS, RBAC, crypto, DDL, split fulfillment)
│   └── check_ui_portable.py  # Portable Playwright smoke test (cross-platform, replaces Linux check_ui.py)
│
├── docs/                     # Canonical documentation (Single Source of Truth)
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── CURRENT_STATE_AUDIT.md
│   └── IMPLEMENTATION_PLAN.md
│
└── Kovok_Construction_UI_Premium/ # Untouched original prototype baseline
```

---

## 3. Getting Started

### 3.1 Prerequisites
- **Node.js 24 LTS** installed. Verify with `node -v`.
- **npm** (v10+ or v11+).

### 3.2 Installation
```bash
# Clone the repository and switch to Phase 1 branch
git checkout phase-1-foundation

# Install dependencies
npm install
```

### 3.3 Environment Setup
Create a local `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Ensure `.env` contains:
```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kovok_dev?schema=public"
SESSION_SECRET="kovok_phase_1_foundation_super_secure_session_secret_2026_at_least_32_chars"
```

---

## 4. Database Migrations & Seeding

### 4.1 Generate Prisma Client
```bash
npm run db:generate
```

### 4.2 Run Database Migrations
```bash
npm run db:migrate
```
*Applies `prisma/migrations/20261030000000_init/migration.sql`, establishing 12 tables and PostgreSQL Row-Level Security policies.*

### 4.3 Seed Development Fixtures
```bash
npm run db:seed
```
*Seeds dynamic GST tax rate rules (cement pre/post-rationalisation and steel) and default development workspace "Concrete & Co." with admin user `admin@concrete-co.in` / `AdminSecurePass#2026`.*

> **Production Safety Guard**: The seed script checks `process.env.NODE_ENV === 'production'` and immediately aborts with a fatal error if executed in production.

---

## 5. Running the Test Suite

Phase 1 provides a fully automated, portable test suite executed using `@electric-sql/pglite` (Node.js WASM PostgreSQL 16 engine). It requires **no external PostgreSQL daemon or Docker setup** to run locally.

### 5.1 Run Comprehensive Foundation Tests
```bash
npm test
```
Executes all **32 acceptance tests** across 8 test suites:
1. **Environment Validation**: Rejection of missing/invalid `DATABASE_URL` and `SESSION_SECRET`.
2. **Cryptographic Primitives**: Scrypt unique salting, constant-time verification, malformed hash rejection.
3. **Database DDL Migration & Rollback**: Clean schema creation and transaction rollback/recovery.
4. **Workspace & Auth Workflows**: Provisioning Tenant A & B, login, active session issuance, logout revocation.
5. **Role-Based Access Control**: Permissions enforcement for Admin vs Site Engineer roles.
6. **PostgreSQL Row-Level Security (RLS)**: Transaction-local isolation between workspaces, preventing cross-tenant visibility or record forgery.
7. **Split Fulfillment Data Model**: Multiple `approval_allocations` under one approval; `purchase_orders` uniqueness on `approval_allocation_id`; quantity constraint validation ($\sum \text{Allocated} \le \text{Approved}$).
8. **Dynamic Tax Rate Rules**: Effective-dated GST resolution for Cement (28% before 22 Sept 2025; 18% thereafter) and Steel (18%).

### 5.2 Run Portable UI Smoke Test
```bash
python tests/check_ui_portable.py
```
*Replaces the previous Linux-only prototype smoke test (`/usr/bin/chromium` and `/mnt/data/` hardcodes) with a cross-platform test verifying all 9 navigation tabs, modals, and responsive mobile behavior with 0 page errors.*

---

## 6. Running the Application

### 6.1 Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 6.2 Production Build & Execution
```bash
npm run build
npm run start
```

---

## 7. Known Limitations & Phase Boundaries

1. **Sarvam AI Voice Integration**: Voice call dispatching and telephony webhooks are strictly scoped for Phase 4. Webhook endpoints are designed but inactive in Phase 1.
2. **Live Supplier Quotation Processing**: Live quote ingestion and automated parsing are out of scope for Phase 1. Development fixtures and mock data are isolated from production.
3. **External ERP Integrations**: Connected procurement webhooks (e.g., Tally, SAP, Zoho) are UI placeholders in Phase 1 and will be connected in Phase 5.
4. **Prototype Baseline Integrity**: The original HTML prototype files in `Kovok_Construction_UI_Premium/` are preserved untouched as reference artifacts on `master`.
