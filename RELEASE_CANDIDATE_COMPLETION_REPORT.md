# KOVOK Construction Material Procurement — Release Candidate Sprint Report

**Version:** Release Candidate 1.0 (Phase 3 Complete)  
**Branch:** `phase-2-catalogue-intake`  
**Execution Date:** 2026-10-31  
**Target Environment:** Node.js 24.19.0 / Next.js 16.2.12 / PostgreSQL 16.15 / TypeScript 5.7+ / Prisma ORM

---

## 1. Executive Summary

The Kovok Construction Material Procurement platform has been taken from its Phase 2 catalogue and intake state to a functional, enterprise-grade **Release Candidate (RC1)**.

### Key Accomplishments:
1. **Design System & Emoji Removal:**
   - 100% of decorative emojis (e.g., `⚡`, `✓`, `⚠`, `📄`, `⚙`, `🤖`, `×`) were removed across all headers, sidebars, topbars, buttons, status badges, metrics, modals, and views.
   - Replaced with the clean `lucide-react` enterprise iconography system and crisp typography.
2. **Comprehensive End-to-End Database Schema & Migrations:**
   - Authored and applied additive migration `20261031000000_release_candidate_modules`.
   - Created 5 new enterprise database entities: `projects`, `supplier_voice_calls`, `quotations`, `delivery_milestones`, `procurement_exceptions`.
   - Enhanced `project_sites` with `project_id` and `is_default` flags.
   - Enforced strict PostgreSQL Row-Level Security (`ALTER TABLE ... FORCE ROW LEVEL SECURITY`) across all 16 tenant tables, with explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` grants to `kovok_app`.
3. **Sarvam AI Voice Telephony Integration:**
   - Created `src/lib/integrations/sarvam-voice.ts` implementing the documented Samvaad Voice Agents platform specifications.
   - Built server-side configuration validator (`getSarvamVoiceConfigStatus()`) reporting exact presence/absence of credentials without revealing secrets.
   - Implemented high-entropy cryptographic HMAC-SHA256 callback token verification with timing-safe comparison (`verifyCallbackToken`).
   - Authored official architectural setup guide: `docs/integrations/SARVAM_VOICE_SETUP.md`.
   - Idempotent webhook receiver (`/api/integrations/sarvam/webhook`) ingests voice call outcomes and auto-generates structured draft quotations (`PENDING_REVIEW`).
4. **All Functional Modules Implemented & Connected to Real PostgreSQL Storage:**
   - **Overview Dashboard:** Live operational statistics aggregated from real DB records (`/api/procurement/metrics`), with interactive filter shortcuts.
   - **Projects & Sites:** Multi-site delivery address management with default site selection and archiving (`/api/projects`, `/api/sites`).
   - **Procurement Intake:** Full 4-step wizard resolving against Indian statutory standards (IS 1786 / IS 269), with theoretical vs weighbridge TMT calculations and atomic sequence numbers (`KOV-REQ-XXXX`).
   - **Requests & Sourcing:** Sourcing status controls (Open, Hold, Cancel) and supplier telephony call dispatch modal (`/api/procurement/requests/[id]`, `/api/procurement/calls`).
   - **Quotations Comparison & Approval:** Normalized commercial basis (Ex-mill, GST, Freight, Unloading), missing terms detection, and transactional approval workflow generating Purchase Orders (`/api/procurement/quotations/[id]/approve`).
   - **Purchase Orders & Deliveries:** Real PO records with delivery milestones tracking (Order Placed, Dispatched, In-Transit, Gate Entry, Weighbridge Verified, Unloaded), and CSV PO export (`/api/procurement/orders`).
   - **Procurement Exceptions:** Auditable discrepancy management (weight variance, rate mismatch, damage) with mandatory resolution notes and immutable timeline (`/api/procurement/exceptions`).
   - **Settings:** Persistent workspace profile configuration and project site management (`/api/settings`).
5. **Quality Assurance & Zero Regression:**
   - **In-Memory Suite (`npm test`):** 64/64 tests passed (0 failures).
   - **Real PostgreSQL 16 Engine (`npm run test:real-postgres`):** 17/17 tests passed (0 failures).
   - **Production Build (`npm run build`):** Compiled 100% cleanly in Next.js 16 Turbopack with 0 TypeScript/linting errors.

---

## 2. Completed Modules & Architectural Implementation

| Module | Status | Real DB Persistence | Verification Method |
|---|---|---|---|
| **Design System & Emojis** | Completed | N/A | Unicode scan confirmed 0 decorative emojis across `src/` |
| **Auth & Workspace Isolation** | Completed | PostgreSQL RLS | 16 tenant tables verified under `kovok_app` role; cross-tenant reads/writes blocked |
| **Projects & Sites** | Completed | `projects`, `project_sites` | Tested `/api/projects`, `/api/sites`, default site switching & archiving |
| **Product Catalogue** | Completed | `canonical_products`, `variants` | 18 core verified specifications, 25 provisional, vector illustration disclaimers |
| **Supplier Directory** | Completed | `supplier_organizations` | Clean taxonomy: Corporate ID, Manufacturer Auth, Listing, Live Inventory |
| **Intake Wizard** | Completed | `procurement_requests` | Concurrency-safe atomic counter, 93.84 bars/MT TMT calculations, IS 456 advisories |
| **Sarvam Voice Sourcing** | Completed | `supplier_voice_calls` | Gateway validator, HMAC callback tokens, structured quotation webhook extraction |
| **Quotations & Comparison** | Completed | `quotations` | Normalized landed cost matrix, missing terms alert, transactional PO approval |
| **Orders & Milestones** | Completed | `purchase_orders`, `delivery_milestones` | Milestone progression, gate entry & weighbridge slip recording, CSV export |
| **Procurement Exceptions** | Completed | `procurement_exceptions` | Mandatory resolution action + notes audit logging |
| **Persistent Settings** | Completed | `workspace_rule_profiles` | Real read/write API for approval thresholds & statutory policies |

---

## 3. Database Changes & Migrations

### Migration Added:
`prisma/migrations/20261031000000_release_candidate_modules/migration.sql`

```sql
-- Creates 5 new tables:
CREATE TABLE IF NOT EXISTS "projects" (...);
CREATE TABLE IF NOT EXISTS "supplier_voice_calls" (...);
CREATE TABLE IF NOT EXISTS "quotations" (...);
CREATE TABLE IF NOT EXISTS "delivery_milestones" (...);
CREATE TABLE IF NOT EXISTS "procurement_exceptions" (...);

-- Enhances project_sites:
ALTER TABLE "project_sites" ADD COLUMN IF NOT EXISTS "project_id" TEXT;
ALTER TABLE "project_sites" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;

-- Enforces Row-Level Security on all new tables:
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
... (all 5 tables forced RLS with app.current_workspace_id = workspace_id)

-- Grants app permissions to non-superuser role:
GRANT SELECT, INSERT, UPDATE, DELETE ON "projects" TO kovok_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "supplier_voice_calls" TO kovok_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotations" TO kovok_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "delivery_milestones" TO kovok_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "procurement_exceptions" TO kovok_app;
```

---

## 4. File Changes Summary

### New Files Created:
1. `docs/integrations/SARVAM_VOICE_SETUP.md` — Complete enterprise telephony integration guide.
2. `prisma/migrations/20261031000000_release_candidate_modules/migration.sql` — Additive schema & RLS policies.
3. `src/lib/integrations/sarvam-voice.ts` — Sarvam client, token generator, prompt template, status checks.
4. `src/app/api/integrations/status/route.ts` — Authoritative multi-system integration diagnostic endpoint.
5. `src/app/api/integrations/sarvam/webhook/route.ts` — Webhook handler with HMAC authentication.
6. `src/app/api/projects/route.ts` — Project listing & creation.
7. `src/app/api/sites/route.ts` — Project site listing & creation.
8. `src/app/api/sites/[id]/route.ts` — Site editing, archiving, default site setting.
9. `src/app/api/procurement/calls/route.ts` — Voice call dispatch & call queue list.
10. `src/app/api/procurement/quotations/route.ts` — Quotations comparison matrix & intake.
11. `src/app/api/procurement/quotations/[id]/route.ts` — Quotation details & patch.
12. `src/app/api/procurement/quotations/[id]/approve/route.ts` — Transactional buyer approval & PO generator.
13. `src/app/api/procurement/orders/route.ts` — Purchase order listing.
14. `src/app/api/procurement/orders/[id]/route.ts` — PO details & status update.
15. `src/app/api/procurement/orders/[id]/milestones/route.ts` — Delivery milestone logging.
16. `src/app/api/procurement/orders/[id]/export/route.ts` — PO CSV export generator.
17. `src/app/api/procurement/exceptions/route.ts` — Exception logging & listing.
18. `src/app/api/procurement/exceptions/[id]/route.ts` — Strict resolution & audit trail update.
19. `src/app/api/procurement/metrics/route.ts` — Live operational dashboard metrics.
20. `src/app/api/settings/route.ts` — Persistent rule profile settings.

### Existing Files Modified:
- `prisma/schema.prisma` — Added models and relation fields.
- `prisma/seed.ts` — Seeded default projects, sites, quotations, PO with milestones, and open exceptions.
- `package.json` & `package-lock.json` — Added `lucide-react`.
- `tests/run-all.ts` — Added Suite 14 covering all Phase 3 RLS, Sarvam tokens, and transactional operations.
- `src/components/layout/Sidebar.tsx` — Replaced emojis with Lucide icons.
- `src/components/layout/Topbar.tsx` — Replaced emojis with Lucide icons.
- `src/components/modals/NewRequestModal.tsx` — Replaced all emojis and Unicode characters with Lucide icons.
- `src/components/views/OverviewView.tsx` — Replaced static cards with live metrics and Lucide icons.
- `src/components/views/RequestsView.tsx` — Added hold/cancel actions, call modal, Lucide icons.
- `src/components/views/QuotationsView.tsx` — Connected to real database, comparison drawer, PO approval.
- `src/components/views/OrdersView.tsx` — Connected to real POs, delivery milestones modal, CSV export.
- `src/components/views/ExceptionsView.tsx` — Connected to real exceptions, resolution modal with audit log.
- `src/components/views/SettingsView.tsx` — Added projects/sites manager, persistent rule profiles.
- `src/components/views/SuppliersView.tsx` — Removed emojis, updated verification taxonomy.
- `src/components/views/CatalogView.tsx` — Added Lucide icons and vector asset disclaimers.
- `src/components/views/IntegrationsView.tsx` — Live status checking and Sarvam configuration inspection modal.
- `src/app/api/procurement/requests/[id]/route.ts` — Enriched GET/PATCH with related calls, quotes, and sites.

---

## 5. Automated Test Results

### 1. In-Memory Comprehensive Test Suite (`npm test`)
```
=================================================================
PHASE 1, PHASE 2 & RELEASE CANDIDATE TEST RUNNER SUMMARY:
  Total Executed Tests: 64
  Passed: 64
  Failed: 0
=================================================================
SUCCESS: All Phase 1, Phase 2, and Phase 3 acceptance tests passed!
```

### 2. Real PostgreSQL 16 Engine Integration Suite (`npm run test:real-postgres`)
```
=================================================================
REAL POSTGRESQL 16+ INTEGRATION VERIFICATION SUMMARY:
  Total Checks: 17
  Passed: 17
  Failed: 0
=================================================================
SUCCESS: All 17 database checks passed against local PostgreSQL 16.15.
```

### 3. Production Compilation (`npm run build`)
```
▲ Next.js 16.2.12 (Turbopack)
✓ Compiled successfully in 2.8s
✓ TypeScript type checking passed (0 errors)
✓ Generating static pages (23/23)
✓ Finalizing page optimization
```

---

## 6. Sarvam Voice Integration & Configuration Status

The integration adheres to Sarvam Voice Agents platform (Samvaad) requirements:
- **Model API vs Voice Agents API Separation:**
  The existing `SARVAM_API_KEY` is preserved for Model API calls. The voice agent client strictly requires the dedicated workspace credentials for outbound telephony.
- **Config Audit (Live Server-Side Status):**
  - `SARVAM_API_KEY`: Configured (Model API)
  - `SARVAM_VOICE_WORKSPACE_API_KEY`: Not configured
  - `SARVAM_ORG_ID`: Not configured
  - `SARVAM_WORKSPACE_ID`: Not configured
  - `SARVAM_AGENT_APP_ID`: Not configured
  - `SARVAM_AGENT_APP_VERSION`: Not configured
  - `SARVAM_CONNECTION_ID`: Not configured
  - `SARVAM_AGENT_PHONE_NUMBER`: Not configured
  - `SARVAM_WEBHOOK_SECRET`: Not configured
  - `APP_BASE_URL`: Configured (`http://localhost:3000`)
- **Safety Invariant:**
  When configuration keys are missing, the system gracefully halts outbound calls with an explicit message listing the missing environment variables. No simulated or artificial browser phone calls are triggered, and zero secret values are exposed.

---

## 7. Known External Dependencies & Launch Checklist

To transition this Release Candidate to live production phone calling:
1. Obtain official Sarvam Samvaad Voice Agent workspace credentials and assign them in `.env`:
   - `SARVAM_VOICE_WORKSPACE_API_KEY`
   - `SARVAM_ORG_ID`
   - `SARVAM_WORKSPACE_ID`
   - `SARVAM_AGENT_APP_ID`
   - `SARVAM_AGENT_APP_VERSION`
   - `SARVAM_CONNECTION_ID`
   - `SARVAM_AGENT_PHONE_NUMBER`
   - `SARVAM_WEBHOOK_SECRET`
2. Configure a public tunnel or production domain for `APP_BASE_URL` (e.g., `https://procure.kovok.in`) so Sarvam can deliver webhook callbacks to `/api/integrations/sarvam/webhook`.
3. Run `npm run db:seed` on the target database to populate initial reference projects, sites, and statutory rules.
4. Start the application:
   ```bash
   npm run start
   ```

---

## 8. Git Status & Approval Note

In compliance with project directives:
- All changes are local on branch `phase-2-catalogue-intake`.
- **No commits (`git commit`) and no pushes (`git push`) have been executed.**
- The workspace is ready for final user inspection and review.

