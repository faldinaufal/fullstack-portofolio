#!/bin/sh
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Creates the database roles Tempora needs (FSD 0.2, 4.4). Runs once, as the database owner:
# - automatically by the postgres container on its first start (docker-entrypoint-initdb.d);
# - manually against a hosted database before the first deploy:
#     TEMPORA_APP_PASSWORD=... TEMPORA_JOBS_PASSWORD=... \
#     POSTGRES_USER=... POSTGRES_DB=... PGHOST=... PGPASSWORD=... sh 01-roles.sh
#
# Roles:
#   <owner>       runs migrations, owns the public schema
#   tempora_app   used by the API: reads/writes data only, cannot change the schema,
#                 does not bypass row-level security
#   tempora_jobs  used by the worker: owns only the pgboss schema (pg-boss manages its tables)
set -eu

: "${TEMPORA_APP_PASSWORD:?TEMPORA_APP_PASSWORD is required}"
: "${TEMPORA_JOBS_PASSWORD:?TEMPORA_JOBS_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_password="$TEMPORA_APP_PASSWORD" \
  -v jobs_password="$TEMPORA_JOBS_PASSWORD" <<'SQL'
CREATE ROLE tempora_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE tempora_jobs LOGIN PASSWORD :'jobs_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Nobody but the owner may create objects in public.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- The job queue lives in its own schema, owned by the jobs role.
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION tempora_jobs;

-- The API enqueues jobs inside its own transactions (FSD 0.2), so it needs
-- data access to the pg-boss tables, but no right to change their structure.
GRANT USAGE ON SCHEMA pgboss TO tempora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tempora_jobs IN SCHEMA pgboss
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tempora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tempora_jobs IN SCHEMA pgboss
  GRANT USAGE, SELECT ON SEQUENCES TO tempora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tempora_jobs IN SCHEMA pgboss
  GRANT EXECUTE ON FUNCTIONS TO tempora_app;
SQL
