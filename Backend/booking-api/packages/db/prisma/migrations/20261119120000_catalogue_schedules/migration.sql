-- Booking settings on tenants, the service catalogue and therapist schedules
-- (FSD 4.3 catalogue & schedules, 6.1 booking settings, 6.12 validation; 4.4 RLS).
-- Generated part: `prisma migrate diff`. Hand-written part: constraints and RLS.
-- New tenant columns have defaults, so existing rows stay valid (expand-only, FSD 10.2).

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "cancellation_cutoff_hours" SMALLINT NOT NULL DEFAULT 24,
ADD COLUMN     "max_advance_days" SMALLINT NOT NULL DEFAULT 30,
ADD COLUMN     "max_customer_reschedules" SMALLINT NOT NULL DEFAULT 2,
ADD COLUMN     "min_lead_hours" SMALLINT NOT NULL DEFAULT 4,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "duration_minutes" SMALLINT NOT NULL,
    "buffer_minutes" SMALLINT NOT NULL DEFAULT 0,
    "price_cents" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_services" (
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "staff_services_pkey" PRIMARY KEY ("membership_id","service_id")
);

-- CreateTable
CREATE TABLE "staff_working_hours" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "starts_at" TIME(0) NOT NULL,
    "ends_at" TIME(0) NOT NULL,

    CONSTRAINT "staff_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_time_off" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(500),
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_time_off_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_tenant_id_idx" ON "services"("tenant_id");

-- CreateIndex
CREATE INDEX "staff_services_tenant_id_idx" ON "staff_services"("tenant_id");

-- CreateIndex
CREATE INDEX "staff_services_service_id_idx" ON "staff_services"("service_id");

-- CreateIndex
CREATE INDEX "staff_working_hours_tenant_id_idx" ON "staff_working_hours"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_working_hours_membership_id_weekday_key" ON "staff_working_hours"("membership_id", "weekday");

-- CreateIndex
CREATE INDEX "staff_time_off_tenant_id_membership_id_starts_at_idx" ON "staff_time_off"("tenant_id", "membership_id", "starts_at");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_working_hours" ADD CONSTRAINT "staff_working_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_working_hours" ADD CONSTRAINT "staff_working_hours_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data rules (FSD 6.1, 6.12). The API validates the same rules and explains them;
-- these constraints keep the data valid whatever writes to the table.
-- ---------------------------------------------------------------------------

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_booking_settings_valid" CHECK (
  "min_lead_hours" BETWEEN 0 AND 72
  AND "max_advance_days" BETWEEN 1 AND 180
  AND "cancellation_cutoff_hours" BETWEEN 0 AND 168
  AND "max_customer_reschedules" BETWEEN 0 AND 10
);

ALTER TABLE "services" ADD CONSTRAINT "services_values_valid" CHECK (
  "duration_minutes" BETWEEN 15 AND 480 AND "duration_minutes" % 15 = 0
  AND "buffer_minutes" BETWEEN 0 AND 60 AND "buffer_minutes" % 5 = 0
  AND "price_cents" BETWEEN 0 AND 1000000
);

ALTER TABLE "staff_working_hours" ADD CONSTRAINT "staff_working_hours_valid"
  CHECK ("weekday" BETWEEN 0 AND 6 AND "starts_at" < "ends_at");

ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_valid_range"
  CHECK ("starts_at" < "ends_at");

-- ---------------------------------------------------------------------------
-- Row-level security (FSD 4.4): tenant policy on every new tenant-owned table.
-- ---------------------------------------------------------------------------

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "services" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

ALTER TABLE "staff_services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_services" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

ALTER TABLE "staff_working_hours" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_working_hours" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());

ALTER TABLE "staff_time_off" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_time_off" TO tempora_app
  USING ("tenant_id" = app_tenant_id())
  WITH CHECK ("tenant_id" = app_tenant_id());
