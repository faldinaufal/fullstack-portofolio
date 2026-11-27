# Tempora API

Backend of **Tempora**, a multi-tenant booking and invoicing platform (fictional product, fictional data). Specs: [PRD](../../docs/booking-saas/PRD.md) · [FSD](../../docs/booking-saas/FSD.md). Frontend: [`Frontend/booking-saas`](../../Frontend/booking-saas).

**Status:** foundation, Console authentication, tenant isolation (row-level security), branches, team management, the service catalogue, therapist schedules and the audit log are in place. The public Portal API (directory, business pages, slot availability) is in place too. Customer accounts for the Portal are in place too. The booking core is in place: holding a slot, invoice numbering, payment (Stripe test mode or a built-in demo provider), webhooks and hold expiry. The Portal's booking pages are served too: booking detail, My bookings, resuming payment, cancelling unpaid bookings and guest links. Customers and guests can also reschedule (within the cut-off and limit), see their invoices, and get a reminder 24 hours before the session. The Console runs the bookings: table, calendar, detail with timeline, reschedule, reassign, cancel and marking, and schedule changes are blocked while bookings are in the way. Customers and invoices have their own Console pages, and every table exports to CSV. The dashboard reads real figures from the reports API. Platform Admin has its own login with email codes and step-up, tenants with assisted onboarding, suspension and a platform log. Owners can grant Tempora support access for 1, 24 or 72 hours: read-only views of their bookings, customers and invoices, each one logged. The Console reads its audit log (filters, cursor pages, CSV) and email log, with the managers' branch scope.

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
| My bookings & guest links | `GET /v1/portal/bookings` (across businesses, through the customer RLS policy), booking detail with allowed actions, resume payment, cancel unpaid (slot free at once, Checkout closed after). Guests and not-yet-verified accounts use a booking access token (`Authorization: Guest <token>`, HMAC stored, 7 days after the session); verifying an email links earlier guest bookings through a `SECURITY DEFINER` function and revokes their links. Bookings are attached to an account only once its email is verified |
| Bookings | `POST /v1/portal/bookings` for customers and guests (`Idempotency-Key` required): every availability rule re-checked inside the transaction with the same loader the availability endpoint uses, a per-therapist advisory lock, a PostgreSQL exclusion constraint as the last line of defence, a 32-minute hold, and the invoice number taken from a locked counter (gapless per business and year) |
| Payments | Behind a small `PaymentProvider` interface: Stripe Checkout in test mode when both Stripe keys are set, otherwise a demo provider that emits webhooks signed in Stripe's format. One webhook handler for both: signature checked over the raw body, each event processed once (`stripe_events` row written in the same transaction as its effects), late payments for released slots flagged `needs_attention` and emailed to the owner |
| Console bookings | `/v1/console/bookings*` and `/calendar` (FSD 5.4): table with filters (manager: own branch), detail with the audit timeline (staff: own bookings, name and notes only), reschedule and reassign by the team (no customer limit or lead time), cancel (paid: reason required, refund outside Tempora), completed / no-show with corrections by leads for 7 days; every change emails the customer. Access rules are pure functions with unit tests |
| Platform Admin | `/v1/admin` (FSD 5.5): its own accounts, cookie and session (1 h idle, 8 h maximum), an emailed code at every login and a fresh one for sensitive actions (step-up, 10 minutes). Login always answers with a challenge and a wrong code gets the same answer for real and decoy challenges, so neither step reveals whether a password was right. Tenants (search, usage), assisted onboarding (tenant + owner invitation), suspend / reactivate with the owner emailed; while suspended the Portal answers `423` and the Console is read only. Cross-tenant counts come from `SECURITY DEFINER` functions that return numbers only; platform log entries have their own RLS policy |
| Audit and email log | `/v1/console/audit-logs` pages by a keyset cursor on `(created_at, id)`, so new entries never shift a page; filters by actor, action or action group, record and dates; CSV export (audited). `/v1/console/emails` shows delivery status, attempts and errors, never the content. Managers see their branch only: no tenant-level entries and nothing about other managers; emails carry a `branch_id` for that |
| Support access | The owner grants it for 1, 24 or 72 hours (`/v1/console/support-grants`, replaces an active grant) and can revoke it at any time; the worker records expiries in the audit log. Support views (`/v1/admin/tenants/:id/support/*`) reuse the Console's queries but run with **only** the grant as RLS context (`app.support_grant`, never `app.tenant_id`): the support policies are `FOR SELECT`, and the one write allowed is the `support.viewed` audit entry, written before the data is read. A `SECURITY DEFINER` function checks revocation and expiry on the database clock, so an ended grant opens nothing even if the API forgot to check. One active grant per tenant is an exclusion constraint |
| Reports | `/v1/console/reports/*` (FSD 6.14): overview figures, revenue per day / week / month (paid invoices by payment day, without refunded bookings) with a branch comparison, bookings per service, utilization (booked minutes over working hours within opening hours, minus closures and time off; daylight-saving days count their real length) and no-show rate. Aggregation in SQL with `date_trunc` on the platform clock; gaps filled with zero; calculations as unit-tested pure functions |
| Customers & invoices | `/v1/console/customers*` (one aggregate query per page: booking count, last visit, next booking; a manager sees the customers of their branch with figures for it) and `/v1/console/invoices*` (filters, detail with every payment attempt) |
| CSV export | `?format=csv` on bookings, customers and invoices: same filters and scope, streamed page by page (at most 10,000 rows), protected against CSV injection (formula cells get a leading `'`), `Cache-Control: no-store`, and audited as `export.created` |
| Active bookings block changes | Time off, working hours, opening hours, closures, deactivating or moving a member and archiving a service or branch answer `409 HAS_ACTIVE_BOOKINGS` with the bookings in the way (FSD 6.8), under the same per-therapist lock as booking |
| Auto-complete | Worker job every hour: confirmed sessions not marked within 24 h of their end become `completed`, audited with the system as actor |
| Reschedule | `POST /v1/portal/bookings/:id/reschedule` for confirmed bookings (FSD 6.5): cut-off and limit checked, the booking moved in place (same invoice and payment), both therapists locked in ID order, the same availability rules as booking with the booking's own time not counted as taken, "booking moved" email |
| Invoices | `GET /v1/portal/invoices` (across businesses, filter by status and by invoice number, business or service), `GET /v1/portal/invoices/summary` (paid this year, still open) and `GET /v1/portal/bookings/:id/invoice` with the same access as the booking |
| Business images | Logo, cover photo and therapist photos (FSD 6.15), one shared upload path: presigned S3 `PUT` signed for the declared type and size, then the stored object is checked again (size, and its first bytes for the real type: PNG, JPEG or WebP, no SVG) before the key is saved with an audit entry; the replaced file is deleted. One `ObjectStorage` interface with an S3 client (Cloudflare R2, SeaweedFS locally) and an in-memory version for the integration tests |
| Reminders | Queued in the email outbox at payment with a future send time, naming the booking and the start time it was written for; the worker sends it only if the booking is still confirmed at that time, otherwise marks it `skipped` |
| Hold expiry | Worker job every minute: one SQL statement expires unpaid holds, voids their invoices, expires the Checkout record and audits it; safe to run twice or concurrently. The worker role may update only these tables and append to the audit log |
| Public API | `/v1/public`: directory (search by business or service), business and branch pages, availability; bookability decided by `SECURITY DEFINER` SQL functions so RLS stays intact |
| Authorization | Role check per route plus scope rules in one module (`console-auth/access.ts`); records outside the caller's scope answer `404`, not `403` |
| Audit log | Every change above writes an entry (actor, before/after, request ID) in the same transaction; the API role cannot update or delete entries |
| Email | Transactional outbox: the API queues emails in `email_messages` inside its own transactions; the worker sends them over SMTP (Mailpit locally) with retries and exponential back-off, then erases codes and links from the row |
| Background jobs | Worker process running the email outbox and pg-boss with an example scheduled job |
| Shutdown | Graceful shutdown for API and worker (finish in-flight work on deploy) |
| Tests | Unit tests (rules, access scopes, tokens, templates) and integration tests through HTTP against a real PostgreSQL with the restricted roles: sign-up, login, code expiry and attempt limits, trusted devices, session timeout, password reset, rate limits, RLS isolation between tenants, one owner per tenant, branch scope per role, invitations end to end, manager replacement, optimistic locking, append-only audit log, concurrent outbox workers, 20 parallel requests for one slot (exactly one wins), 50 parallel bookings with consecutive invoice numbers, idempotent booking create, webhook replay and forged signatures, hold expiry and late payments, customer-level RLS, guest links (wrong, expired, revoked), cancelling, My bookings across businesses, linking after email verification and an impostor account with someone else's email, rescheduling (next to its own time, another therapist, races for the same time, two reschedules of one booking at once, limit, cut-off), reminders and invoices, Console operations (table scope, detail for staff, team moves within the lead time, reassign, cancel paid and unpaid, marking and corrections, calendar), and every blocking rule of FSD 6.8, customers and invoices with manager scope, and CSV exports (filters, scope, audit, a formula in a customer name), Platform Admin login (decoys, attempts, idle timeout, disabled accounts, app gate), step-up (expiry, bound to its session), assisted onboarding, suspension end to end, and RLS for platform log entries, audit log (cursor pages against the table, filters, manager scope, CSV) and email log (no content, manager scope), support access (grant, replace, revoke, expiry, step-up on every view, no access to another tenant, and at the database level: no writes, nothing after revocation or expiry, one active grant). Key rules are mutation-checked: removing one makes a test fail |

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
└── docker/postgres/init/    database roles (runs once per database)

The images (api, worker, migrate and the three apps) come from the `Dockerfile` at the
repository root.
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
docker compose up --build     # PostgreSQL, migrations, API, worker, the three apps, Mailpit, storage
```

The first build takes about a minute and a half (it downloads the dependencies once); after
that, `docker compose up --build` takes seconds when nothing changed and well under a minute
after a change. All six images come from one Dockerfile and share one dependency install; the
backend and the apps build separately, so changing one side does not rebuild the other.

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

### Database on a new machine without Docker

No dump is needed: the schema, row-level security and functions all come from the migrations, and every record is demo data. Any PostgreSQL 17 server works (the official installer, Postgres.app, a package manager):

```bash
# 1. As a superuser: the owner role and the database. Local development only: the owner is a
#    superuser here, like the Docker image's POSTGRES_USER (it creates the other roles).
psql -U postgres -c "CREATE ROLE tempora LOGIN SUPERUSER PASSWORD 'local-owner'" \
                 -c "CREATE DATABASE tempora OWNER tempora"

# 2. The API and worker roles, with the same script the Docker image runs (needs `sh` and `psql`).
TEMPORA_APP_PASSWORD=local-app TEMPORA_JOBS_PASSWORD=local-jobs \
POSTGRES_USER=tempora POSTGRES_DB=tempora PGHOST=localhost PGPASSWORD=local-owner \
  sh Backend/booking-api/docker/postgres/init/01-roles.sh

# 3. Schema and RLS, then a platform admin.
DATABASE_MIGRATION_URL=postgresql://tempora:local-owner@localhost:5432/tempora \
  pnpm --filter @tempora/db migrate:deploy
DATABASE_URL=postgresql://tempora_app:local-app@localhost:5432/tempora \
  pnpm --filter @tempora/api admin:create --email you@example.com --name "Your Name"
```

Then put the same URLs in `packages/db/.env` and `apps/api/.env`. For the integration tests, set `TEST_DATABASE_URL` (the `tempora_app` URL), `TEST_DATABASE_OWNER_URL` (the owner URL) and `TEST_JOBS_DATABASE_URL` (`tempora_jobs`); the tests empty the tables they use, so keep a separate database for data you want to keep.

### Demo data

`docker compose up` seeds two fictional businesses (Lumen Wellness Studio with three branches,
Harbor Physio Clinic with two): services, therapists and their hours, customers, about 2,200
bookings over the last 90 days and the next 14 with invoices, payments and their history.
It seeds once; your local changes survive a restart. To start again:

```bash
docker compose run --rm seed node dist/scripts/seed-demo.js --reset
# or, outside Docker (owner role):
DATABASE_MIGRATION_URL=postgresql://tempora:<owner password>@localhost:5432/tempora \
  pnpm --filter @tempora/api demo:seed --reset
```

| Role | App | Email | Who |
|---|---|---|---|
| Owner | Console | `owner@veloria.test` | Ines Halvorsen, Lumen Wellness Studio |
| Manager | Console | `manager@veloria.test` | Daniel Kim, Downtown branch |
| Staff (therapist) | Console | `therapist@veloria.test` | Mira Santos, Downtown branch |
| Customer | Portal | `customer@veloria.test` | Lena Fischer, books at both businesses |
| Platform admin | Platform Admin | `admin@veloria.test` | Noah Castellanos |

Password for all of them: `tempora-demo-2026`. The Console and Platform Admin ask for an emailed
code at login: locally it arrives in Mailpit (http://localhost:8025). On the live demo the addresses
end in `@demo.<domain>` (`DEMO_EMAIL_DOMAIN`) and, with `DEMO_MODE=true`, the worker stores their
emails in `demo_emails` instead of sending them. The Portal shows them at `/demo-inbox`
(`GET /v1/public/demo-inbox`). The worker may only add and delete those rows and the API may only
read them (separate database roles), and the worker keeps just the last 24 hours, at most 500 emails. Every other team login
(each manager and therapist of both businesses) is listed in
[DEMO-ACCOUNTS.md](../../docs/booking-saas/DEMO-ACCOUNTS.md).

### Create a platform admin

Platform admins are created only by a server command, never through the API:

```bash
pnpm --filter @tempora/api admin:create --email you@example.com --name "Your Name"
# asks for the password (or set PLATFORM_ADMIN_PASSWORD); DATABASE_URL must be set
```

## Scripts

| Command (from the repo root) | Does |
|---|---|
| `pnpm turbo run build --filter=./Backend/**` | Build contracts, db, API and worker |
| `pnpm turbo run test --filter=./Backend/**` | Run backend unit tests (no database) |
| `pnpm --filter @tempora/api test:integration` | API integration tests; needs `TEST_DATABASE_URL` (tempora_app) and `TEST_DATABASE_OWNER_URL` (owner) on a migrated database |
| `pnpm --filter @tempora/worker test:integration` | Worker integration tests; needs `TEST_JOBS_DATABASE_URL` and `TEST_DATABASE_OWNER_URL` |
| `pnpm --filter @tempora/db migrate:status` | Show migration state (`DATABASE_MIGRATION_URL` required) |
