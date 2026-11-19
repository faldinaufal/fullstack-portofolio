-- Bookings, invoices and payments (FSD 4.3 customers & bookings, billing; 6.3-6.4; 7.1-7.3).
-- Generated part: `prisma migrate diff`. Hand-written part: the expand step for the invoice
-- prefix, the exclusion constraint, data rules, RLS policies and grants.

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'expired', 'completed', 'no_show');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('open', 'paid', 'void');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'expired', 'failed', 'needs_attention');

-- AlterTable
-- Expand safely: existing tenants get a prefix from their slug ("lumen" -> "LUM", "LUM2" on
-- a clash) before the column becomes required (FSD 10.2 expand -> migrate -> contract).
ALTER TABLE "tenants" ADD COLUMN "invoice_prefix" VARCHAR(6);
WITH base AS (
  SELECT
    "id",
    upper(left(regexp_replace("slug", '[^a-z]', '', 'g') || 'xxx', 3)) AS prefix,
    row_number() OVER (
      PARTITION BY upper(left(regexp_replace("slug", '[^a-z]', '', 'g') || 'xxx', 3))
      ORDER BY "created_at"
    ) AS n
  FROM "tenants"
)
UPDATE "tenants" t
SET "invoice_prefix" = CASE WHEN base.n = 1 THEN base.prefix ELSE base.prefix || base.n END
FROM base
WHERE base."id" = t."id";
ALTER TABLE "tenants" ALTER COLUMN "invoice_prefix" SET NOT NULL;

-- CreateTable
CREATE TABLE "tenant_customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_account_id" UUID,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(16),
    "first_booked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "staff_membership_id" UUID NOT NULL,
    "tenant_customer_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "blocked_until" TIMESTAMPTZ(3) NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'pending_payment',
    "hold_expires_at" TIMESTAMPTZ(3),
    "service_name" VARCHAR(100) NOT NULL,
    "duration_minutes" SMALLINT NOT NULL,
    "buffer_minutes" SMALLINT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "customer_notes" VARCHAR(500),
    "customer_reschedule_count" SMALLINT NOT NULL DEFAULT 0,
    "cancel_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "number" VARCHAR(24) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'open',
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'usd',
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(3),
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" VARCHAR(200),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "tenant_id" UUID NOT NULL,
    "year" SMALLINT NOT NULL,
    "next_value" INTEGER NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("tenant_id","year")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "provider" VARCHAR(10) NOT NULL,
    "checkout_session_id" VARCHAR(255) NOT NULL,
    "checkout_url" VARCHAR(2000) NOT NULL,
    "payment_intent_id" VARCHAR(255),
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "amount_cents" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" UUID NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" SMALLINT NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key","subject")
);

-- CreateIndex
CREATE INDEX "tenant_customers_customer_account_id_idx" ON "tenant_customers"("customer_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_customers_tenant_id_email_key" ON "tenant_customers"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_starts_at_idx" ON "bookings"("tenant_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_staff_membership_id_starts_at_idx" ON "bookings"("staff_membership_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_tenant_customer_id_idx" ON "bookings"("tenant_customer_id");

-- CreateIndex
CREATE INDEX "bookings_status_hold_expires_at_idx" ON "bookings"("status", "hold_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_booking_id_key" ON "invoices"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_number_key" ON "invoices"("tenant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_checkout_session_id_key" ON "payments"("checkout_session_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_invoice_prefix_key" ON "tenants"("invoice_prefix");

-- AddForeignKey
ALTER TABLE "tenant_customers" ADD CONSTRAINT "tenant_customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_customers" ADD CONSTRAINT "tenant_customers_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_membership_id_fkey" FOREIGN KEY ("staff_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_customer_id_fkey" FOREIGN KEY ("tenant_customer_id") REFERENCES "tenant_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Double-booking guarantee (FSD 4.3, 0.2): the database rejects a second active booking whose
-- blocked range overlaps another one of the same therapist, even if two requests passed the
-- API checks at the same moment. `[)` includes the start and excludes the end, so a session
-- ending (with buffer) at 10:00 does not collide with one starting at 10:00.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "staff_membership_id" WITH =,
    tstzrange("starts_at", "blocked_until", '[)') WITH &&
  )
  WHERE ("status" IN ('pending_payment', 'confirmed'));

-- ---------------------------------------------------------------------------
-- Data rules
-- ---------------------------------------------------------------------------

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_times_valid"
  CHECK ("starts_at" < "ends_at" AND "ends_at" <= "blocked_until");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hold_when_pending"
  CHECK ("status" <> 'pending_payment' OR "hold_expires_at" IS NOT NULL);
ALTER TABLE "tenant_customers" ADD CONSTRAINT "tenant_customers_email_lowercase"
  CHECK ("email" = lower("email"));
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_valid" CHECK ("amount_cents" >= 0);
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_invoice_prefix_format"
  CHECK ("invoice_prefix" ~ '^[A-Z]{3}[0-9]{0,3}$');

-- ---------------------------------------------------------------------------
-- Row-level security (FSD 4.4)
-- Tenant policy on every new tenant-owned table, plus the customer policy: a logged-in
-- customer reads their own records at any business ("My bookings"), through
-- `app.customer_account_id`.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_customer_account_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.customer_account_id', true), '')::uuid $$;

ALTER TABLE "tenant_customers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tenant_customers" TO tempora_app
  USING ("tenant_id" = app_tenant_id()) WITH CHECK ("tenant_id" = app_tenant_id());
CREATE POLICY "own_customer_records" ON "tenant_customers" FOR SELECT TO tempora_app
  USING ("customer_account_id" = app_customer_account_id());

ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bookings" TO tempora_app
  USING ("tenant_id" = app_tenant_id()) WITH CHECK ("tenant_id" = app_tenant_id());
CREATE POLICY "own_bookings" ON "bookings" FOR SELECT TO tempora_app
  USING ("tenant_customer_id" IN (
    SELECT "id" FROM "tenant_customers" WHERE "customer_account_id" = app_customer_account_id()
  ));

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invoices" TO tempora_app
  USING ("tenant_id" = app_tenant_id()) WITH CHECK ("tenant_id" = app_tenant_id());
CREATE POLICY "own_invoices" ON "invoices" FOR SELECT TO tempora_app
  USING ("booking_id" IN (SELECT "id" FROM "bookings"));

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "payments" TO tempora_app
  USING ("tenant_id" = app_tenant_id()) WITH CHECK ("tenant_id" = app_tenant_id());
CREATE POLICY "own_payments" ON "payments" FOR SELECT TO tempora_app
  USING ("invoice_id" IN (SELECT "id" FROM "invoices"));

ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invoice_counters" TO tempora_app
  USING ("tenant_id" = app_tenant_id()) WITH CHECK ("tenant_id" = app_tenant_id());

-- ---------------------------------------------------------------------------
-- Worker: releases unpaid holds (FSD 6.4 hold-expiry job). It may read and update bookings,
-- invoices and payments and append audit entries; nothing else of the business data.
-- ---------------------------------------------------------------------------

GRANT SELECT, UPDATE ON "bookings", "invoices", "payments" TO tempora_jobs;
GRANT INSERT ON "audit_logs" TO tempora_jobs;
CREATE POLICY "worker_hold_expiry" ON "bookings" TO tempora_jobs USING (true) WITH CHECK (true);
CREATE POLICY "worker_hold_expiry" ON "invoices" TO tempora_jobs USING (true) WITH CHECK (true);
CREATE POLICY "worker_hold_expiry" ON "payments" TO tempora_jobs USING (true) WITH CHECK (true);
CREATE POLICY "worker_audit" ON "audit_logs" FOR INSERT TO tempora_jobs WITH CHECK (true);

-- Business records are never deleted (FSD 4.1).
REVOKE DELETE ON "bookings", "invoices", "payments" FROM tempora_app;
