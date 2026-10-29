-- Kovok Construction Procurement: Initial Production Foundation Migration
-- PostgreSQL 16+ Migration with FORCE ROW LEVEL SECURITY (RLS)

-- CreateTable: workspaces
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "businessType" VARCHAR(128) NOT NULL,
    "serviceArea" VARCHAR(255) NOT NULL,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable: project_sites
CREATE TABLE "project_sites" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "siteName" VARCHAR(255) NOT NULL,
    "pinCode" VARCHAR(6) NOT NULL,
    "city" VARCHAR(128) NOT NULL,
    "address" TEXT NOT NULL,
    "contactName" VARCHAR(128),
    "contactPhone" VARCHAR(32),
    "gateTimings" VARCHAR(128),
    "unloadingRestrictions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32),
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workspace_roles
CREATE TABLE "workspace_roles" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "approvalLimitAmount" DECIMAL(14,2),
    "canCreateRequests" BOOLEAN NOT NULL DEFAULT true,
    "canApproveQuotes" BOOLEAN NOT NULL DEFAULT false,
    "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
    "canRecordReceipts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workspace_memberships
CREATE TABLE "workspace_memberships" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sessions
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "sessionToken" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "ipAddress" VARCHAR(64),
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workspace_rule_profiles
CREATE TABLE "workspace_rule_profiles" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "categories" JSONB NOT NULL,
    "requestSource" VARCHAR(128) NOT NULL,
    "sourcingStrategy" VARCHAR(128) NOT NULL,
    "competitiveThreshold" DECIMAL(14,2) NOT NULL DEFAULT 50000.00,
    "maxVendorsPerRfq" INTEGER NOT NULL DEFAULT 3,
    "callWindowStart" VARCHAR(8) NOT NULL DEFAULT '10:00',
    "callWindowEnd" VARCHAR(8) NOT NULL DEFAULT '18:00',
    "callLanguage" VARCHAR(16) NOT NULL DEFAULT 'hi-IN',
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "autoRetryUnanswered" BOOLEAN NOT NULL DEFAULT true,
    "autoClarifyMissing" BOOLEAN NOT NULL DEFAULT true,
    "allowSubstitutions" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_rule_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_rate_rules
CREATE TABLE "tax_rate_rules" (
    "id" UUID NOT NULL,
    "hsnSacCode" VARCHAR(16) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "cgstRate" DECIMAL(5,2) NOT NULL,
    "sgstRate" DECIMAL(5,2) NOT NULL,
    "igstRate" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "sourceCitation" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: approvals
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "requestCode" VARCHAR(64) NOT NULL,
    "approvedByUserId" UUID NOT NULL,
    "totalApprovedQuantity" DECIMAL(12,3) NOT NULL,
    "quantityUnit" VARCHAR(32) NOT NULL,
    "totalApprovedAmount" DECIMAL(14,2) NOT NULL,
    "approvedSpecifications" JSONB NOT NULL,
    "approvalStatus" VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: approval_allocations
CREATE TABLE "approval_allocations" (
    "id" UUID NOT NULL,
    "approvalId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "quotationReference" VARCHAR(64) NOT NULL,
    "supplierName" VARCHAR(255) NOT NULL,
    "allocatedQuantity" DECIMAL(12,3) NOT NULL,
    "allocatedPayableAmount" DECIMAL(14,2) NOT NULL,
    "allocatedTermsSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: purchase_orders
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "poNumber" VARCHAR(64) NOT NULL,
    "approvalAllocationId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "approvedTermsSnapshot" JSONB NOT NULL,
    "consistencyChecksum" VARCHAR(64) NOT NULL,
    "poStatus" VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(64) NOT NULL,
    "entityId" VARCHAR(128) NOT NULL,
    "payloadBefore" JSONB,
    "payloadAfter" JSONB,
    "clientIp" VARCHAR(64),
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
CREATE INDEX "project_sites_workspaceId_pinCode_idx" ON "project_sites"("workspaceId", "pinCode");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "workspace_roles_workspaceId_name_key" ON "workspace_roles"("workspaceId", "name");
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId");
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE INDEX "sessions_sessionToken_idx" ON "sessions"("sessionToken");
CREATE INDEX "sessions_userId_workspaceId_idx" ON "sessions"("userId", "workspaceId");
CREATE INDEX "tax_rate_rules_hsnSacCode_effectiveFrom_idx" ON "tax_rate_rules"("hsnSacCode", "effectiveFrom");
CREATE INDEX "approvals_workspaceId_requestCode_idx" ON "approvals"("workspaceId", "requestCode");
CREATE INDEX "approval_allocations_workspaceId_approvalId_idx" ON "approval_allocations"("workspaceId", "approvalId");
CREATE UNIQUE INDEX "purchase_orders_approvalAllocationId_key" ON "purchase_orders"("approvalAllocationId");
CREATE UNIQUE INDEX "purchase_orders_workspaceId_poNumber_key" ON "purchase_orders"("workspaceId", "poNumber");
CREATE UNIQUE INDEX "purchase_orders_workspaceId_idempotencyKey_key" ON "purchase_orders"("workspaceId", "idempotencyKey");
CREATE INDEX "audit_logs_workspaceId_action_idx" ON "audit_logs"("workspaceId", "action");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKeys
ALTER TABLE "project_sites" ADD CONSTRAINT "project_sites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "workspace_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_rule_profiles" ADD CONSTRAINT "workspace_rule_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_allocations" ADD CONSTRAINT "approval_allocations_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_allocations" ADD CONSTRAINT "approval_allocations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approvalAllocationId_fkey" FOREIGN KEY ("approvalAllocationId") REFERENCES "approval_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Scoped strictly to transaction-local setting: app.current_workspace_id
-- -----------------------------------------------------------------------------

ALTER TABLE "project_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_sites" FORCE ROW LEVEL SECURITY;

ALTER TABLE "workspace_rule_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_rule_profiles" FORCE ROW LEVEL SECURITY;

ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approvals" FORCE ROW LEVEL SECURITY;

ALTER TABLE "approval_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_allocations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders" FORCE ROW LEVEL SECURITY;

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "project_sites_isolation" ON "project_sites"
    FOR ALL USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY "workspace_rule_profiles_isolation" ON "workspace_rule_profiles"
    FOR ALL USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY "approvals_isolation" ON "approvals"
    FOR ALL USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY "approval_allocations_isolation" ON "approval_allocations"
    FOR ALL USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY "purchase_orders_isolation" ON "purchase_orders"
    FOR ALL USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY "audit_logs_isolation" ON "audit_logs"
    FOR ALL USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);
