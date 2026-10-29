-- Kovok Phase 1: Corrective Security and Data Invariant Migration
-- 1. Complete Row-Level Security for Roles, Memberships, and Sessions
-- 2. Concurrency-Safe Split-Allocation Invariant Triggers

-- -----------------------------------------------------------------------------
-- 1. ROW-LEVEL SECURITY FOR ROLES, MEMBERSHIPS, SESSIONS
-- -----------------------------------------------------------------------------

ALTER TABLE "workspace_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_roles" FORCE ROW LEVEL SECURITY;

ALTER TABLE "workspace_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_memberships" FORCE ROW LEVEL SECURITY;

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;

-- Workspace Roles Isolation: strictly scoped to active workspace
CREATE POLICY "workspace_roles_isolation" ON "workspace_roles"
    FOR ALL USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

-- Workspace Memberships Isolation: scoped to workspace context OR authenticated user context
CREATE POLICY "workspace_memberships_isolation" ON "workspace_memberships"
    FOR ALL USING (
        "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
        OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    );

-- Sessions Isolation: scoped to workspace context, user context, OR exact sessionToken during handshake
CREATE POLICY "sessions_isolation" ON "sessions"
    FOR ALL USING (
        "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
        OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR "sessionToken" = NULLIF(current_setting('app.current_session_token', true), '')
    );

-- -----------------------------------------------------------------------------
-- 2. SPLIT-ALLOCATION INVARIANT TRIGGERS
-- Sum of allocated quantities for an approval must never exceed the approved quantity.
-- Uses FOR UPDATE on the parent approval row to serialize concurrent allocations.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_enforce_split_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_approved_qty NUMERIC(12, 3);
    v_total_allocated NUMERIC(12, 3);
    v_target_approval_id UUID;
BEGIN
    v_target_approval_id := NEW."approvalId";

    -- Concurrency Protection: Lock the parent approval row with FOR UPDATE.
    -- Any concurrent allocation attempt for this approval will block until this transaction completes.
    SELECT "totalApprovedQuantity" INTO v_approved_qty
    FROM "approvals"
    WHERE id = v_target_approval_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent approval % not found', v_target_approval_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Calculate sum of existing allocations for this approval (excluding current row if update)
    SELECT COALESCE(SUM("allocatedQuantity"), 0) INTO v_total_allocated
    FROM "approval_allocations"
    WHERE "approvalId" = v_target_approval_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

    v_total_allocated := v_total_allocated + NEW."allocatedQuantity";

    IF v_total_allocated > v_approved_qty THEN
        RAISE EXCEPTION 'Total allocated quantity (%) exceeds approved quantity (%) for approval %',
            v_total_allocated, v_approved_qty, v_target_approval_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_approval_allocation_limit ON "approval_allocations";

CREATE TRIGGER trg_check_approval_allocation_limit
BEFORE INSERT OR UPDATE OF "allocatedQuantity", "approvalId"
ON "approval_allocations"
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_split_allocation_limit();

-- Prevent reducing approved quantity below currently allocated quantity
CREATE OR REPLACE FUNCTION fn_enforce_approval_reduction_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_total_allocated NUMERIC(12, 3);
BEGIN
    IF NEW."totalApprovedQuantity" < OLD."totalApprovedQuantity" THEN
        SELECT COALESCE(SUM("allocatedQuantity"), 0) INTO v_total_allocated
        FROM "approval_allocations"
        WHERE "approvalId" = NEW.id;

        IF NEW."totalApprovedQuantity" < v_total_allocated THEN
            RAISE EXCEPTION 'Cannot reduce approved quantity to % because existing allocations total %',
                NEW."totalApprovedQuantity", v_total_allocated
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_approval_quantity_reduction ON "approvals";

CREATE TRIGGER trg_check_approval_quantity_reduction
BEFORE UPDATE OF "totalApprovedQuantity"
ON "approvals"
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_approval_reduction_limit();
