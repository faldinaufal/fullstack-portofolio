-- Tempora: initial migration.
-- Runs as the migration (owner) role. The application role `tempora_app` and the jobs role
-- `tempora_jobs` are created once per database by `docker/postgres/init/01-roles.sh`
-- (see Backend/booking-api/README.md) because roles hold passwords and must not live in migrations.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tempora_app') THEN
    RAISE EXCEPTION 'Role tempora_app does not exist. Run docker/postgres/init/01-roles.sh first.';
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('active', 'suspended');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- Application role: data access only (no DDL), on every current and future table
-- created by this migration role in the public schema.
GRANT USAGE ON SCHEMA public TO tempora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tempora_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tempora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tempora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tempora_app;

-- The application may read the migration history (readiness check) but never change it.
REVOKE INSERT, UPDATE, DELETE ON "_prisma_migrations" FROM tempora_app;
