-- Customer accounts for the Portal (FSD 4.3 identity, 5.3, 6.11).
-- Generated part: `prisma migrate diff`. Hand-written part: constraints.
-- Customer accounts are platform-wide (one login for every business), so they are not
-- tenant-owned and have no RLS; a customer's records at a business are linked later through
-- `tenant_customers` (bookings).

-- AlterTable
ALTER TABLE "auth_tokens" ADD COLUMN     "customer_account_id" UUID;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "customer_account_id" UUID;

-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(16),
    "email_verified_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_email_key" ON "customer_accounts"("email");

-- CreateIndex
CREATE INDEX "auth_tokens_customer_account_id_idx" ON "auth_tokens"("customer_account_id");

-- CreateIndex
CREATE INDEX "sessions_customer_account_id_idx" ON "sessions"("customer_account_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data rules
-- ---------------------------------------------------------------------------

ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_email_lowercase"
  CHECK ("email" = lower("email"));

-- Exactly one subject per session and per emailed token (FSD 4.3), and the subject must
-- match the app: a Portal session belongs to a customer, a Console session to a team member.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_one_subject"
  CHECK (num_nonnulls("team_account_id", "customer_account_id") = 1);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_portal_subject"
  CHECK ("app" <> 'portal' OR "customer_account_id" IS NOT NULL);

ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_one_subject"
  CHECK (num_nonnulls("team_account_id", "customer_account_id") = 1);
