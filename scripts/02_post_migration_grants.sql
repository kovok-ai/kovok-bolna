-- ==============================================================================
-- Kovok Construction Procurement Platform — Database Verification
-- Stage C: Post-Migration Least-Privilege Role Grants
-- ==============================================================================
-- Reconciles all 28 tables across:
-- 1. 14 Shared Catalogue Tables: Read-Only to kovok_app, Full to catalogue_admin
-- 2.  1 Shared Tax Reference Table: Read-Only to kovok_app
-- 3.  1 Append-Only Audit Table: SELECT, INSERT only to kovok_app (Forced RLS)
-- 4.  2 Non-RLS Root Tables (workspaces, users): SELECT, INSERT, UPDATE (No DELETE)
-- 5. 10 Tenant-Scoped Operational Tables: Protected by Forced RLS
-- ==============================================================================

\c kovok_procurement_test

-- ------------------------------------------------------------------------------
-- 1. Shared Catalogue Tables (14 Tables)
-- Invariant: Application role (kovok_app) is strictly READ-ONLY.
-- Catalogue admin (kovok_catalogue_admin) has import / curation rights.
-- ------------------------------------------------------------------------------
GRANT SELECT ON TABLE
  "material_categories",
  "standards_registry",
  "canonical_products",
  "manufacturers",
  "product_variants",
  "technical_specifications",
  "source_registry",
  "product_evidence",
  "supplier_organizations",
  "supplier_listings",
  "product_images",
  "unresolved_records",
  "import_batches",
  "import_batch_records"
TO kovok_app;

GRANT ALL PRIVILEGES ON TABLE
  "material_categories",
  "standards_registry",
  "canonical_products",
  "manufacturers",
  "product_variants",
  "technical_specifications",
  "source_registry",
  "product_evidence",
  "supplier_organizations",
  "supplier_listings",
  "product_images",
  "unresolved_records",
  "import_batches",
  "import_batch_records"
TO kovok_catalogue_admin;

-- ------------------------------------------------------------------------------
-- 2. Shared Tax Reference Table (1 Table)
-- Invariant: Read-only reference table. No runtime modifications.
-- ------------------------------------------------------------------------------
GRANT SELECT ON TABLE "tax_rate_rules" TO kovok_app, kovok_catalogue_admin;

-- ------------------------------------------------------------------------------
-- 3. Append-Only Audit Logs (1 Table, Forced RLS)
-- Invariant: Runtime role can read and append, but NEVER update or delete audit trails.
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT ON TABLE "audit_logs" TO kovok_app;

-- ------------------------------------------------------------------------------
-- 4. Authentication & Workspace Root Tables (2 Tables, No RLS)
-- Invariant: Runtime role can read, create, and update; DELETE is strictly denied.
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON TABLE "workspaces", "users" TO kovok_app;

-- ------------------------------------------------------------------------------
-- 5. Tenant-Scoped Operational Tables (10 Tables, Forced RLS)
-- Invariant: Operations strictly bounded by FORCED Row-Level Security policies.
-- Catalogue admin is granted NO ACCESS to private customer tenant data.
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "project_sites",
  "workspace_roles",
  "workspace_memberships",
  "sessions",
  "workspace_rule_profiles",
  "approval_allocations"
TO kovok_app;

GRANT SELECT, INSERT, UPDATE ON TABLE
  "approvals",
  "purchase_orders",
  "workspace_request_counters",
  "procurement_requests"
TO kovok_app;

-- ------------------------------------------------------------------------------
-- 6. Sequences and Default Privileges
-- ------------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kovok_app, kovok_catalogue_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kovok_app, kovok_catalogue_admin;
