-- Platform Admin (FSD 1.1, 2.3, 4.3, 5.5, 6.9, 6.11): operator accounts, their sessions and
-- email codes (login and step-up), tenant suspension, platform-level audit entries and the
-- cross-tenant metrics the overview needs.

-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN     "platform_admin_id" UUID,
ADD COLUMN     "session_id" UUID;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "platform_admin_id" UUID,
ADD COLUMN     "step_up_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "suspended_at" TIMESTAMPTZ(3),
ADD COLUMN     "suspension_reason" VARCHAR(500);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE INDEX "otp_challenges_platform_admin_id_idx" ON "otp_challenges"("platform_admin_id");

-- CreateIndex
CREATE INDEX "otp_challenges_session_id_idx" ON "otp_challenges"("session_id");

-- CreateIndex
CREATE INDEX "sessions_platform_admin_id_idx" ON "sessions"("platform_admin_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Sessions and codes: exactly one subject, matching the app (FSD 4.3)
-- ---------------------------------------------------------------------------

ALTER TABLE "sessions" DROP CONSTRAINT "sessions_one_subject";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_one_subject"
  CHECK (num_nonnulls("team_account_id", "customer_account_id", "platform_admin_id") = 1);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_subject"
  CHECK (("app" = 'admin') = ("platform_admin_id" IS NOT NULL));
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_step_up_admin_only"
  CHECK ("step_up_at" IS NULL OR "app" = 'admin');

ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_one_subject"
  CHECK (num_nonnulls("team_account_id", "platform_admin_id") = 1);
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_step_up_session"
  CHECK (("purpose" = 'step_up') = ("session_id" IS NOT NULL));

ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_email_lowercase"
  CHECK ("email" = lower("email"));
-- Accounts are disabled, never deleted (their actions stay in the audit log).
REVOKE DELETE ON "platform_admins" FROM tempora_app;

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_suspension_recorded"
  CHECK (("status" = 'suspended') = ("suspended_at" IS NOT NULL AND "suspension_reason" IS NOT NULL));

-- ---------------------------------------------------------------------------
-- Platform-level audit entries (FSD 4.4): no tenant; written and read only in a platform
-- admin context (`app.platform_admin_id`). Tenant entries keep the tenant policy.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_platform_admin_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.platform_admin_id', true), '')::uuid $$;

CREATE POLICY "platform_events" ON "audit_logs" TO tempora_app
  USING ("tenant_id" IS NULL AND app_platform_admin_id() IS NOT NULL)
  WITH CHECK ("tenant_id" IS NULL AND app_platform_admin_id() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Cross-tenant metrics (FSD 2.3, 4.4). Like the public directory, these run as the owner and
-- return numbers only, never rows of tenant-owned tables; `search_path` is pinned and only
-- the API role may call them. The API calls them for platform admins only.
-- ---------------------------------------------------------------------------

-- Per tenant: active members, bookings that take place since a date, setup complete.
CREATE FUNCTION platform_tenant_usage(p_since timestamptz)
  RETURNS TABLE (tenant_id uuid, members integer, recent_bookings integer, setup_complete boolean)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT t.id,
      (SELECT count(*)::int FROM memberships m WHERE m.tenant_id = t.id AND m.status = 'active'),
      (SELECT count(*)::int FROM bookings b
        WHERE b.tenant_id = t.id AND b.status IN ('confirmed', 'completed', 'no_show')
          AND b.starts_at >= p_since),
      tenant_is_bookable(t.id)
    FROM tenants t
    WHERE t.archived_at IS NULL
  $$;

-- Per day (platform clock): bookings made, invoices paid and their amount.
CREATE FUNCTION platform_daily_activity(p_since timestamptz, p_time_zone text)
  RETURNS TABLE (day date, bookings integer, payments integer, revenue_cents bigint)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    WITH made AS (
      SELECT (created_at AT TIME ZONE p_time_zone)::date AS d, count(*)::int AS n
      FROM bookings WHERE created_at >= p_since GROUP BY 1
    ), paid AS (
      SELECT (paid_at AT TIME ZONE p_time_zone)::date AS d, count(*)::int AS n,
             sum(amount_cents)::bigint AS cents
      FROM invoices WHERE status = 'paid' AND paid_at >= p_since GROUP BY 1
    )
    SELECT coalesce(made.d, paid.d), coalesce(made.n, 0), coalesce(paid.n, 0), coalesce(paid.cents, 0)
    FROM made FULL JOIN paid ON paid.d = made.d
  $$;

-- Health: payments needing attention, emails waiting and emails that failed recently.
CREATE FUNCTION platform_health(p_failed_since timestamptz)
  RETURNS TABLE (payments_needing_attention integer, emails_queued integer, emails_failed integer)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT
      (SELECT count(*)::int FROM payments WHERE status = 'needs_attention'),
      (SELECT count(*)::int FROM email_messages WHERE status = 'queued'),
      (SELECT count(*)::int FROM email_messages WHERE status = 'failed' AND created_at >= p_failed_since)
  $$;

REVOKE ALL ON FUNCTION platform_tenant_usage(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_daily_activity(timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_health(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_tenant_usage(timestamptz) TO tempora_app;
GRANT EXECUTE ON FUNCTION platform_daily_activity(timestamptz, text) TO tempora_app;
GRANT EXECUTE ON FUNCTION platform_health(timestamptz) TO tempora_app;
