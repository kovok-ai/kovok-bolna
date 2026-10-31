-- ==============================================================================
-- Kovok Construction Procurement Platform — Database Verification
-- Stage A: Bootstrap Test Database & Service Roles
-- ==============================================================================
-- Run as superuser (postgres) against default 'postgres' database:
--   psql -U postgres -d postgres -f scripts/01_bootstrap_test_db.sql
-- ==============================================================================

-- 1. Stop if target database already exists (NEVER silently reuse or overwrite)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_database WHERE datname = 'kovok_procurement_test') THEN
    RAISE EXCEPTION 'Target test database "kovok_procurement_test" already exists. Aborting bootstrap to prevent reusing or modifying an existing database. Drop the disposable database manually if recreation is intended.';
  END IF;
END $$;

-- 2. Create the clean disposable test database
CREATE DATABASE kovok_procurement_test;

-- 3. Connect to the test database
\c kovok_procurement_test

-- 4. Create Service Roles with dedicated local test-only credentials
DO $$
BEGIN
  -- Application Runtime Role (NOBYPASSRLS is mandatory for tenant isolation)
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kovok_app') THEN
    CREATE ROLE kovok_app WITH LOGIN PASSWORD 'kovok_test_app_pass' NOBYPASSRLS;
  ELSE
    ALTER ROLE kovok_app WITH LOGIN PASSWORD 'kovok_test_app_pass' NOBYPASSRLS;
  END IF;

  -- Catalogue Administrator Role (used for research data imports)
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kovok_catalogue_admin') THEN
    CREATE ROLE kovok_catalogue_admin WITH LOGIN PASSWORD 'kovok_test_cat_admin_pass' NOBYPASSRLS;
  ELSE
    ALTER ROLE kovok_catalogue_admin WITH LOGIN PASSWORD 'kovok_test_cat_admin_pass' NOBYPASSRLS;
  END IF;
END
$$;

-- 5. Schema-Level Access (DO NOT grant table-level access here; tables do not exist yet)
GRANT USAGE, CREATE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO kovok_app, kovok_catalogue_admin;

-- Revoke dangerous default permissions on schema public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
