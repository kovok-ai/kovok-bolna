-- Kovok Phase 3 / Release Candidate Modules Migration
-- Adds Projects, Supplier Voice Calls, Quotations, Delivery Milestones, and Procurement Exceptions
-- Applies strict Row-Level Security (RLS) isolation and privileges for kovok_app role.

-- -----------------------------------------------------------------------------
-- 1. PROJECTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_workspaceId_code_key" ON "projects"("workspaceId", "code");
CREATE INDEX "projects_workspaceId_status_idx" ON "projects"("workspaceId", "status");

ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 2. UPDATE PROJECT SITES (Add Project Reference & Default Flag)
-- -----------------------------------------------------------------------------
ALTER TABLE "project_sites" ADD COLUMN "projectId" UUID;
ALTER TABLE "project_sites" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "project_sites" ADD CONSTRAINT "project_sites_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 3. SUPPLIER VOICE CALLS (Sarvam Voice Telephony Records)
-- -----------------------------------------------------------------------------
CREATE TABLE "supplier_voice_calls" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "procurementRequestId" UUID NOT NULL,
    "supplierId" VARCHAR(64) NOT NULL,
    "initiatedByUserId" UUID NOT NULL,
    "sarvamAttemptId" VARCHAR(128),
    "sarvamInteractionId" VARCHAR(128),
    "callStatus" VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    "supplierPhoneNumber" VARCHAR(32) NOT NULL,
    "callbackTokenHash" VARCHAR(64) NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "extractedVariables" JSONB,
    "transcript" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_voice_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_voice_calls_workspaceId_callStatus_idx" ON "supplier_voice_calls"("workspaceId", "callStatus");
CREATE INDEX "supplier_voice_calls_procurementRequestId_idx" ON "supplier_voice_calls"("procurementRequestId");
CREATE INDEX "supplier_voice_calls_supplierId_idx" ON "supplier_voice_calls"("supplierId");

ALTER TABLE "supplier_voice_calls" ADD CONSTRAINT "supplier_voice_calls_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_voice_calls" ADD CONSTRAINT "supplier_voice_calls_procurementRequestId_fkey"
    FOREIGN KEY ("procurementRequestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_voice_calls" ADD CONSTRAINT "supplier_voice_calls_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "supplier_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_voice_calls" ADD CONSTRAINT "supplier_voice_calls_initiatedByUserId_fkey"
    FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 4. COMMERCIAL QUOTATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "procurementRequestId" UUID NOT NULL,
    "supplierId" VARCHAR(64) NOT NULL,
    "callId" UUID,
    "quotationReference" VARCHAR(64) NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    "materialSpecification" VARCHAR(255) NOT NULL,
    "canonicalProductId" VARCHAR(64),
    "brand" VARCHAR(128),
    "grade" VARCHAR(64),
    "diameterMm" DECIMAL(5,2),
    "quantityValue" DECIMAL(12,3) NOT NULL,
    "quantityUnit" VARCHAR(32) NOT NULL,
    "quotedBaseRate" DECIMAL(14,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "gstType" VARCHAR(32) DEFAULT 'CGST_SGST',
    "freightCharges" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "unloadingCharges" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "otherCharges" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "totalDeliveredAmount" DECIMAL(14,2) NOT NULL,
    "leadTimeDays" INTEGER,
    "deliveryEta" VARCHAR(128),
    "paymentTerms" VARCHAR(255),
    "validityDays" INTEGER,
    "validityDate" DATE,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
    "isComparable" BOOLEAN NOT NULL DEFAULT true,
    "missingTerms" JSONB,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quotations_workspaceId_status_idx" ON "quotations"("workspaceId", "status");
CREATE INDEX "quotations_procurementRequestId_idx" ON "quotations"("procurementRequestId");
CREATE INDEX "quotations_supplierId_idx" ON "quotations"("supplierId");

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_procurementRequestId_fkey"
    FOREIGN KEY ("procurementRequestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "supplier_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_callId_fkey"
    FOREIGN KEY ("callId") REFERENCES "supplier_voice_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_canonicalProductId_fkey"
    FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 5. DELIVERY MILESTONES (Order Receipts & Inspection Tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE "delivery_milestones" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "milestoneCode" VARCHAR(64) NOT NULL,
    "milestoneTitle" VARCHAR(128) NOT NULL,
    "milestoneStatus" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "targetDate" TIMESTAMPTZ(6),
    "actualDate" TIMESTAMPTZ(6),
    "quantityDelivered" DECIMAL(12,3),
    "unit" VARCHAR(32),
    "notes" TEXT,
    "recordedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_milestones_workspaceId_purchaseOrderId_idx" ON "delivery_milestones"("workspaceId", "purchaseOrderId");

ALTER TABLE "delivery_milestones" ADD CONSTRAINT "delivery_milestones_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_milestones" ADD CONSTRAINT "delivery_milestones_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_milestones" ADD CONSTRAINT "delivery_milestones_recordedByUserId_fkey"
    FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 6. PROCUREMENT EXCEPTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE "procurement_exceptions" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "exceptionCode" VARCHAR(64) NOT NULL,
    "exceptionType" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "relatedEntityType" VARCHAR(64),
    "relatedEntityId" VARCHAR(128),
    "relatedCode" VARCHAR(64),
    "assignedUserId" UUID,
    "resolutionAction" VARCHAR(128),
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMPTZ(6),
    "resolvedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "procurement_exceptions_workspaceId_status_severity_idx" ON "procurement_exceptions"("workspaceId", "status", "severity");
CREATE INDEX "procurement_exceptions_relatedCode_idx" ON "procurement_exceptions"("relatedCode");

ALTER TABLE "procurement_exceptions" ADD CONSTRAINT "procurement_exceptions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "procurement_exceptions" ADD CONSTRAINT "procurement_exceptions_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "procurement_exceptions" ADD CONSTRAINT "procurement_exceptions_resolvedByUserId_fkey"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY (RLS) FOR NEW TENANT TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;

CREATE POLICY "projects_isolation" ON "projects"
    FOR ALL
    USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
    WITH CHECK ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

ALTER TABLE "supplier_voice_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_voice_calls" FORCE ROW LEVEL SECURITY;

CREATE POLICY "supplier_voice_calls_isolation" ON "supplier_voice_calls"
    FOR ALL
    USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
    WITH CHECK ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

ALTER TABLE "quotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "quotations_isolation" ON "quotations"
    FOR ALL
    USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
    WITH CHECK ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

ALTER TABLE "delivery_milestones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_milestones" FORCE ROW LEVEL SECURITY;

CREATE POLICY "delivery_milestones_isolation" ON "delivery_milestones"
    FOR ALL
    USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
    WITH CHECK ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

ALTER TABLE "procurement_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "procurement_exceptions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "procurement_exceptions_isolation" ON "procurement_exceptions"
    FOR ALL
    USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
    WITH CHECK ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

-- -----------------------------------------------------------------------------
-- 8. GRANT PRIVILEGES TO RUNTIME APPLICATION ROLE (kovok_app)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kovok_app') THEN
        GRANT ALL ON
            "projects",
            "supplier_voice_calls",
            "quotations",
            "delivery_milestones",
            "procurement_exceptions"
        TO kovok_app;
    END IF;
END $$;

