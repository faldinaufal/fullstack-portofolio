# Tempora API

Backend of **Tempora**, a multi-tenant booking and invoicing platform (fictional product, fictional data). Specs: [PRD](../../docs/booking-saas/PRD.md) · [FSD](../../docs/booking-saas/FSD.md). Frontend: [`Frontend/booking-saas`](../../Frontend/booking-saas).

**Status:** foundation, Console authentication, tenant isolation (row-level security), branches, team management, the service catalogue, therapist schedules and the audit log are in place. The public Portal API (directory, business pages, slot availability) is in place too. Customer accounts for the Portal are in place too. The booking core is in place: holding a slot, invoice numbering, payment (Stripe test mode or a built-in demo provider), webhooks and hold expiry. The Portal screens for paying and managing bookings come next.

## Stack

Node.js 24 · TypeScript · Fastify 5 · Zod 4 · PostgreSQL 17 · Prisma 7 · pg-boss 12 · Vitest · Docker

## What exists today

| Area | Implemented |
|---|---|
| API skeleton | Fastify app factory with dependency injection, `GET /health` (liveness) and `GET /health/ready` (database + migrations) |
| Errors | Every error is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem response with a stable `code` and the `requestId` |
| Observability | Structured JSON logs (pino) with a request ID per request, propagated from `X-Request-Id` and returned to the client; credentials redacted from logs |
| Security | Security headers (helmet), CORS allow-list for the three apps only |
| API docs | OpenAPI 3.1 generated from the Zod schemas: `/v1/openapi.json`, Swagger UI at `/v1/docs` |
| Shared contract | `packages/contracts`: Zod schemas and types imported by both the API and the frontends |
| Database | Prisma schema and migrations; three database roles with least privilege (below) |
| Tenant isolation | PostgreSQL row-level security on tenant-owned tables. Every query runs in a transaction that first sets `app.tenant_id` / `app.team_account_id` with `set_config(..., true)`; without a context, policies match no rows (fails closed) |
| Console authentication | Sign-up (account + business + owner in one transaction), login with an emailed 6-digit code, "trust this device for 30 days", logout / logout everywhere, password reset, `GET /v1/console/me` |
| Session security | Server-side sessions (random token in an httpOnly cookie, only its HMAC stored), 12 h idle / 7 days maximum, CSRF double-submit token, Argon2id passwords, rate limits counted in PostgreSQL, same answer for unknown email and wrong password |
| Branches | Create, update (optimistic locking with `If-Match`), archive, weekly opening hours, closures; owner sees every branch, a manager only their own |
| Team | Invitations by email (7 days, resend, revoke), accept as a new or existing account, change role or branch, one manager per branch with an explicit decision about the current one, deactivate / reactivate (ends sessions at once), switch between businesses |
| Catalogue & schedules | Business booking settings (FSD 6.1), service catalogue (duration, buffer, price in integer cents, optimistic locking), therapist working hours checked against branch opening hours, services performed, time off; setup status derived for onboarding |
| Availability | Slot engine for FSD 6.2 as a pure, unit-tested function: 30-minute grid, lead time and horizon, opening and working hours, closures, time off and buffers, daylight-saving transitions of the platform time zone (`@date-fns/tz`) |
| Customer accounts | `/v1/portal`: sign-up (logs in, sends a verification link), login without 2FA (FSD 6.11), 30-day sessions renewed by activity, email verification, password reset and change, profile, active sessions with revoke; separate table, cookie and session check from the Console |
| Bookings | `POST /v1/portal/bookings` for customers and guests (`Idempotency-Key` required): every availability rule re-checked inside the transaction with the same loader the availability endpoint uses, a per-therapist advisory lock, a PostgreSQL exclusion constraint as the last line of defence, a 32-minute hold, and the invoice number taken from a locked counter (gapless per business and year) |
| Payments | Behind a small `PaymentProvider` interface: Stripe Checkout in test mode when both Stripe keys are set, otherwise a demo provider that emits webhooks signed in Stripe's format. One webhook handler for both: signature checked over the raw body, each event processed once (`stripe_events` row written in the same transaction as its effects), late payments for released slots flagged `needs_attention` and emailed to the owner |
| Hold expiry | Worker job every minute: one SQL statement expires unpaid holds, voids their invoices, expires the Checkout record and audits it; safe to run twice or concurrently. The worker role may update only these tables and append to the audit log |
| Public API | `/v1/public`: directory (search by business or service), business and branch pages, availability; bookability decided by `SECURITY DEFINER` SQL functions so RLS stays intact |
| Authorization | Role check per route plus scope rules in one module (`console-auth/access.ts`); records outside the caller's scope answer `404`, not `403` |
| Audit log | Every change above writes an entry (actor, before/after, request ID) in the same transaction; the API role cannot update or delete entries |
| Email | Transactional outbox: the API queues emails in `email_messages` inside its own transactions; the worker sends them over SMTP (Mailpit locally) with retries and exponential back-off, then erases codes and links from the row |
| Background jobs | Worker process running the email outbox and pg-boss with an example scheduled job |
| Shutdown | Graceful shutdown for API and worker (finish in-flight work on deploy) |
| Tests | Unit tests (rules, access scopes, tokens, templates) and integration tests through HTTP against a real PostgreSQL with the restricted roles: sign-up, login, code expiry and attempt limits, trusted devices, session timeout, password reset, rate limits, RLS isolation between tenants, one owner per tenant, branch scope per role, invitations end to end, manager replacement, optimistic locking, append-only audit log, concurrent outbox workers, 20 parallel requests for one slot (exactly one wins), 50 parallel bookings with consecutive invoice numbers, idempotent booking create, webhook replay and forged signatures, hold expiry and late payments, customer-level RLS. Key rules are mutation-checked: removing one makes a test fail |

## Layout

```
Backend/booking-api/
├── apps/
│   ├── api/                 Fastify server
│   │   └── src/
│   │       ├── plugins/     errors, security, OpenAPI
│   │       └── modules/
│   │           └── <feature>/
│   │               ├── routes.ts      HTTP: validation and mapping only
│   │               ├── service.ts     business rules and transactions
│   │               └── repository.ts  database queries (Prisma)
│   └── worker/              pg-boss job runner
├── packages/
│   ├── contracts/           Zod schemas + types shared with the frontends
│   └── db/                  Prisma schema, SQL migrations, client factory
├── docker/postgres/init/    database roles (runs once per database)
└── Dockerfile               api, worker and migrate images
```

## Database roles

Each process connects with the least privilege it needs:

| Role | Can do | Used by |
|---|---|---|
| `tempora` (owner) | Owns the `public` schema, runs migrations | `prisma migrate deploy` (release step) |
| `tempora_app` | Read and write data only; no schema changes; cannot modify the migration history; does not bypass row-level security | API |
| `tempora_jobs` | Owns only the `pgboss` schema, where pg-boss manages its own tables; may read and update `email_messages` (the outbox) and nothing else in `public`. Has the database-level `CREATE` right because pg-boss runs `CREATE SCHEMA IF NOT EXISTS` on start (it can create schemas of its own, not touch others) | Worker |

Roles hold passwords, so they are created by [`docker/postgres/init/01-roles.sh`](docker/postgres/init/01-roles.sh), not by migrations. CI verifies that `tempora_app` cannot create tables or change `_prisma_migrations`.

## Run locally

Requirements: Node.js 24+, pnpm 10, Docker.

```bash
# from the repository root
cp .env.example .env          # choose local passwords
docker compose up --build     # PostgreSQL, migrations, API, worker, the three apps, Mailpit
```

API: http://localhost:4000/health · Docs: http://localhost:4000/v1/docs · Emails (codes, reset links): http://localhost:8025

Run the API outside Docker (database still in Docker):

```bash
docker compose up -d postgres
cp Backend/booking-api/packages/db/.env.example Backend/booking-api/packages/db/.env   # fill in the owner password
cp Backend/booking-api/apps/api/.env.example Backend/booking-api/apps/api/.env         # fill in the tempora_app password
pnpm install
pnpm --filter @tempora/db migrate:deploy
pnpm --filter @tempora/api dev
```

## Scripts

| Command (from the repo root) | Does |
|---|---|
| `pnpm turbo run build --filter=./Backend/**` | Build contracts, db, API and worker |
| `pnpm turbo run test --filter=./Backend/**` | Run backend unit tests (no database) |
| `pnpm --filter @tempora/api test:integration` | API integration tests; needs `TEST_DATABASE_URL` (tempora_app) and `TEST_DATABASE_OWNER_URL` (owner) on a migrated database |
| `pnpm --filter @tempora/worker test:integration` | Worker integration tests; needs `TEST_JOBS_DATABASE_URL` and `TEST_DATABASE_OWNER_URL` |
| `pnpm --filter @tempora/db migrate:status` | Show migration state (`DATABASE_MIGRATION_URL` required) |
