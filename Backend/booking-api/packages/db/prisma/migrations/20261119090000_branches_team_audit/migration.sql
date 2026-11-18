-- Branches (opening hours, closures), team invitations and the audit log
-- (FSD 4.3 tenancy, catalogue and operations tables; 4.4 RLS; 9.2 audit).
-- Generated part: `prisma migrate diff`. Hand-written part: constraints, RLS and grants.

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('team_member', 'platform_admin', 'customer', 'system');

-- CreateTable
CREATE TABLE "branch_opening_hours" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "opens_at" TIME(0) NOT NULL,
    "closes_at" TIME(0) NOT NULL,

    CONSTRAINT "branch_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_closures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "membership_role" NOT NULL,
    "branch_id" UUID,
    "token_hash" CHAR(64) NOT NULL,
    "invited_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "branch_id" UUID,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_id" UUID,
    "actor_label" VARCHAR(150) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(500),
    "request_id" VARCHAR(128),
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_opening_hours_tenant_id_idx" ON "branch_opening_hours"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_opening_hours_branch_id_weekday_key" ON "branch_opening_hours"("branch_id", "weekday");

-- CreateIndex
CREATE INDEX "branch_closures_tenant_id_branch_id_starts_on_idx" ON "branch_closures"("tenant_id", "branch_id", "starts_on");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_email_idx" ON "invitations"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "branch_opening_hours" ADD CONSTRAINT "branch_opening_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_opening_hours" ADD CONSTRAINT "branch_opening_hours_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_closures" ADD CONSTRAINT "branch_closures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_closures" ADD CONSTRAINT "branch_closures_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_membership_id_fkey" FOREIGN KEY ("invited_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data rules Prisma cannot express
-- ---------------------------------------------------------------------------

ALTER TABLE "branch_opening_hours" ADD CONSTRAINT "branch_opening_hours_valid"
  CHECK ("weekday" BETWEEN 0 AND 6 AND "opens_at" < "closes_at");

ALTER TABLE "branch_closures" ADD CONSTRAINT "branch_closures_valid_range"
  CHECK ("starts_on" <= "ends_on");

-- Same rule as memberships: owners belong to the whole tenant, others to one branch.
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_branch_matches_role"
  CHECK (("role" = 'owner') = ("branch_id" IS NULL));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_lowercase"
  CHECK ("email" = lower("email"));

-- At most one open invitation per email and tenant; a new one requires revoking or resending.
CREATE UNIQUE INDEX "invitations_one_open_per_email"
  ON "invitations" ("tenant_id", "email") WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;

-- ---------------------------------------------------------------------------
-- Row-level security (FSD 4.4): tenant policy on every new tenant-owned table.
-- ---------------------------------------------------------------------------

ALTER TABLE "branch_opening_hours" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "branch_opening_hours" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

ALTER TABLE "branch_closures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "branch_closures" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invitations" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

-- An invitation link is opened before any login: the row whose token hash matches the link
-- is readable (and only that row); the API then switches to the invitation's tenant context.
CREATE FUNCTION app_invitation_token_hash() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.invitation_token_hash', true), '') $$;
CREATE POLICY "invitation_by_token" ON "invitations" FOR SELECT TO tempora_app
  USING ("token_hash" = app_invitation_token_hash());

-- Audit log: tenants read and write their own entries; platform entries have no tenant and
-- are written without a tenant context (Platform Admin, later).
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "audit_logs" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Append-only (FSD 4.3): the API can add and read entries but never change or remove them.
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_logs" FROM tempora_app;
