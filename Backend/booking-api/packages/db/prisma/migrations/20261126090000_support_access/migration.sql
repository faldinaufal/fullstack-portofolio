-- Support access (FSD 1.4, 3.10, 4.4): the owner grants platform admins read-only access to
-- the business's data for 1, 24 or 72 hours. Support requests run with `app.support_grant`
-- only (never `app.tenant_id`), so the database itself keeps them read only.

-- CreateTable
CREATE TABLE "support_grants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "granted_by_membership_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "expiry_recorded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_grants_tenant_id_starts_at_idx" ON "support_grants"("tenant_id", "starts_at");

-- CreateIndex
CREATE INDEX "support_grants_granted_by_membership_id_idx" ON "support_grants"("granted_by_membership_id");

-- AddForeignKey
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_granted_by_membership_id_fkey" FOREIGN KEY ("granted_by_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Grant rules (FSD 4.3, 6.11)
-- ---------------------------------------------------------------------------

ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_duration"
  CHECK ("expires_at" - "starts_at" IN (interval '1 hour', interval '24 hours', interval '72 hours'));
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_revoked_in_window"
  CHECK ("revoked_at" IS NULL OR ("revoked_at" >= "starts_at" AND "revoked_at" < "expires_at"));
-- At most one active grant per tenant: the periods a grant was usable never overlap
-- (a revoked grant ends at `revoked_at`). Half-open ranges, so a grant replaced at 10:00
-- and its successor starting at 10:00 do not clash.
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_one_active"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    tstzrange("starts_at", coalesce("revoked_at", "expires_at"), '[)') WITH &&
  );

-- Grants are history: revoked or expired, never deleted.
REVOKE DELETE ON "support_grants" FROM tempora_app;

-- ---------------------------------------------------------------------------
-- Row-level security (FSD 4.4)
-- ---------------------------------------------------------------------------

ALTER TABLE "support_grants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "support_grants" TO tempora_app
  USING ("tenant_id" = app_tenant_id()) WITH CHECK ("tenant_id" = app_tenant_id());

-- The tenant whose data the current support grant unlocks, or null. Runs as the owner so it
-- can read the grant without tenant context; it checks revocation and expiry on the database
-- clock, so a revoked or expired grant stops working even if the API forgot to check.
CREATE FUNCTION app_support_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT g.tenant_id FROM support_grants g
    WHERE g.id = nullif(current_setting('app.support_grant', true), '')::uuid
      AND g.revoked_at IS NULL
      AND g.expires_at > now()
  $$;

-- The active grant of a tenant (ID and period only), for the Platform Admin: whether support
-- access is open, and which grant to put in `app.support_grant`.
CREATE FUNCTION active_support_grant(p_tenant_id uuid, p_at timestamptz)
  RETURNS TABLE (id uuid, starts_at timestamptz, expires_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT g.id, g.starts_at, g.expires_at FROM support_grants g
    WHERE g.tenant_id = p_tenant_id AND g.revoked_at IS NULL
      AND g.starts_at <= p_at AND g.expires_at > p_at
    ORDER BY g.starts_at DESC
    LIMIT 1
  $$;

REVOKE ALL ON FUNCTION app_support_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION active_support_grant(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_support_tenant_id() TO tempora_app;
GRANT EXECUTE ON FUNCTION active_support_grant(uuid, timestamptz) TO tempora_app;

-- Support policy: read only (`FOR SELECT`), on the tables the support views read.
CREATE POLICY "support_read" ON "branches" FOR SELECT TO tempora_app
  USING ("tenant_id" = app_support_tenant_id());
CREATE POLICY "support_read" ON "memberships" FOR SELECT TO tempora_app
  USING ("tenant_id" = app_support_tenant_id());
CREATE POLICY "support_read" ON "tenant_customers" FOR SELECT TO tempora_app
  USING ("tenant_id" = app_support_tenant_id());
CREATE POLICY "support_read" ON "bookings" FOR SELECT TO tempora_app
  USING ("tenant_id" = app_support_tenant_id());
CREATE POLICY "support_read" ON "invoices" FOR SELECT TO tempora_app
  USING ("tenant_id" = app_support_tenant_id());
CREATE POLICY "support_read" ON "payments" FOR SELECT TO tempora_app
  USING ("tenant_id" = app_support_tenant_id());

-- Every support view is written to the tenant's log (FSD 1.4). This is the only write a
-- support context can make: a `support.viewed` entry by a platform admin, in that tenant.
CREATE POLICY "support_viewed" ON "audit_logs" FOR INSERT TO tempora_app
  WITH CHECK (
    "tenant_id" = app_support_tenant_id()
    AND "actor_type" = 'platform_admin'
    AND "action" = 'support.viewed'
  );

-- ---------------------------------------------------------------------------
-- Worker: records each grant's expiry in the tenant's log (FSD 1.4), once. It may read the
-- grants and set `expiry_recorded_at`, nothing else.
-- ---------------------------------------------------------------------------

GRANT SELECT ON "support_grants" TO tempora_jobs;
GRANT UPDATE ("expiry_recorded_at") ON "support_grants" TO tempora_jobs;
CREATE POLICY "worker_expiry" ON "support_grants" TO tempora_jobs USING (true) WITH CHECK (true);
