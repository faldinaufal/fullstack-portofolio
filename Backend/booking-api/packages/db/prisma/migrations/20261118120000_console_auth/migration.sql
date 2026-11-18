-- Console authentication and tenant isolation (FSD 4.3 identity, tenancy and operations tables; 4.4 RLS).
-- Generated part: `prisma migrate diff`. Hand-written part (after the generated SQL): constraints
-- Prisma cannot express, row-level security policies and grants.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tempora_app')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tempora_jobs') THEN
    RAISE EXCEPTION 'Roles tempora_app and tempora_jobs must exist. Run docker/postgres/init/01-roles.sh first.';
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('owner', 'manager', 'staff');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('active', 'deactivated');

-- CreateEnum
CREATE TYPE "session_app" AS ENUM ('portal', 'console', 'admin');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('login', 'step_up');

-- CreateEnum
CREATE TYPE "auth_token_purpose" AS ENUM ('password_reset', 'email_verify');

-- CreateEnum
CREATE TYPE "email_status" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(300),
    "phone" VARCHAR(16),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_accounts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email_verified_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "team_account_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL,
    "branch_id" UUID,
    "status" "membership_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "app" "session_app" NOT NULL,
    "team_account_id" UUID,
    "membership_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(300),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "team_account_id" UUID,
    "code_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "ip" VARCHAR(45),

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL,
    "team_account_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "purpose" "auth_token_purpose" NOT NULL,
    "team_account_id" UUID,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "to_email" VARCHAR(254) NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "payload" JSONB,
    "status" "email_status" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(500),
    "provider_message_id" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "id" BIGSERIAL NOT NULL,
    "bucket" VARCHAR(40) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_accounts_email_key" ON "team_accounts"("email");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "memberships_branch_id_idx" ON "memberships"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_team_account_id_tenant_id_key" ON "memberships"("team_account_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_team_account_id_idx" ON "sessions"("team_account_id");

-- CreateIndex
CREATE INDEX "sessions_membership_id_idx" ON "sessions"("membership_id");

-- CreateIndex
CREATE INDEX "otp_challenges_team_account_id_idx" ON "otp_challenges"("team_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");

-- CreateIndex
CREATE INDEX "trusted_devices_team_account_id_idx" ON "trusted_devices"("team_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_team_account_id_idx" ON "auth_tokens"("team_account_id");

-- CreateIndex
CREATE INDEX "email_messages_tenant_id_created_at_idx" ON "email_messages"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "email_messages_status_next_attempt_at_idx" ON "email_messages"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "rate_limit_hits_bucket_key_hash_created_at_idx" ON "rate_limit_hits"("bucket", "key_hash", "created_at");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_team_account_id_fkey" FOREIGN KEY ("team_account_id") REFERENCES "team_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_team_account_id_fkey" FOREIGN KEY ("team_account_id") REFERENCES "team_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_team_account_id_fkey" FOREIGN KEY ("team_account_id") REFERENCES "team_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_team_account_id_fkey" FOREIGN KEY ("team_account_id") REFERENCES "team_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_team_account_id_fkey" FOREIGN KEY ("team_account_id") REFERENCES "team_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data rules Prisma cannot express
-- ---------------------------------------------------------------------------

-- Owners belong to the whole tenant; managers and staff belong to exactly one branch.
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_branch_matches_role"
  CHECK (("role" = 'owner') = ("branch_id" IS NULL));

-- Exactly one active owner per tenant and at most one active manager per branch (FSD 4.3).
-- Enforced by the database, so two concurrent requests can never both succeed.
CREATE UNIQUE INDEX "memberships_one_active_owner"
  ON "memberships" ("tenant_id") WHERE "role" = 'owner' AND "status" = 'active';
CREATE UNIQUE INDEX "memberships_one_active_manager_per_branch"
  ON "memberships" ("branch_id") WHERE "role" = 'manager' AND "status" = 'active';

-- Emails are compared case-insensitively by storing them lowercased (FSD 6.12).
ALTER TABLE "team_accounts" ADD CONSTRAINT "team_accounts_email_lowercase"
  CHECK ("email" = lower("email"));

-- A Console session always belongs to a team account and one of its memberships.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_console_subject"
  CHECK ("app" <> 'console' OR ("team_account_id" IS NOT NULL AND "membership_id" IS NOT NULL));

-- ---------------------------------------------------------------------------
-- Row-level security (FSD 4.4)
-- The API sets these values per transaction with set_config(..., true). When a value is not
-- set, the function returns NULL, every comparison is NULL and no row matches: a forgotten
-- context fails closed instead of leaking another tenant's data.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

CREATE FUNCTION app_team_account_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.team_account_id', true), '')::uuid $$;

-- branches: tenant policy.
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "branches" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

-- memberships: tenant policy, plus read access to the signed-in account's own memberships
-- in every tenant (login, tenant switcher).
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "memberships" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());
CREATE POLICY "own_memberships" ON "memberships" FOR SELECT TO tempora_app
  USING ("team_account_id" = app_team_account_id());

-- email_messages: tenants see their own emails (email log); account emails (codes, password
-- reset) have no tenant and can only be inserted by the API, never read back by it.
-- The worker delivers every message.
ALTER TABLE "email_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "email_messages" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());
CREATE POLICY "account_emails_insert" ON "email_messages" FOR INSERT TO tempora_app
  WITH CHECK ("tenant_id" IS NULL);
CREATE POLICY "worker_delivery" ON "email_messages" TO tempora_jobs
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- The email log is a record: the API may add messages but never delete them.
REVOKE DELETE ON "email_messages" FROM tempora_app;

-- The worker reads the outbox and records delivery results, nothing else in this schema.
GRANT USAGE ON SCHEMA public TO tempora_jobs;
GRANT SELECT, UPDATE ON "email_messages" TO tempora_jobs;
