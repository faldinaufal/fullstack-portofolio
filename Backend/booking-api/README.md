# Tempora API

Backend of **Tempora**, a multi-tenant booking and invoicing platform (fictional product, fictional data). Specs: [PRD](../../docs/booking-saas/PRD.md) · [FSD](../../docs/booking-saas/FSD.md). Frontend: [`Frontend/booking-saas`](../../Frontend/booking-saas).

**Status:** foundation in place (no business features yet).

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
| Database | Prisma schema and first migration; three database roles with least privilege (below) |
| Background jobs | Worker process running pg-boss with an example scheduled job |
| Shutdown | Graceful shutdown for API and worker (finish in-flight work on deploy) |
| Tests | Unit tests for services and HTTP tests through `app.inject` without a network or database |

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
| `tempora_jobs` | Owns only the `pgboss` schema, where pg-boss manages its own tables | Worker |

Roles hold passwords, so they are created by [`docker/postgres/init/01-roles.sh`](docker/postgres/init/01-roles.sh), not by migrations. CI verifies that `tempora_app` cannot create tables or change `_prisma_migrations`.

## Run locally

Requirements: Node.js 24+, pnpm 10, Docker.

```bash
# from the repository root
cp .env.example .env          # choose local passwords
docker compose up --build     # PostgreSQL, migrations, API, worker, the three apps, Mailpit
```

API: http://localhost:4000/health · Docs: http://localhost:4000/v1/docs

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
| `pnpm turbo run test --filter=./Backend/**` | Run backend tests |
| `pnpm --filter @tempora/db migrate:status` | Show migration state (`DATABASE_MIGRATION_URL` required) |
