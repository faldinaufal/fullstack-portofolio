# Full-Stack Portfolio

Three independent full-stack projects, each built from scratch with fictional data. Each project pairs a Next.js frontend with a different backend stack.

| # | Project | Frontend | Backend | Status | Live demo |
|---|---|---|---|---|---|
| 1 | **Tempora — Booking & Invoicing SaaS**: multi-tenant, roles, conflict-free booking, invoices, Stripe (test mode), dashboard charts | [`Frontend/booking-saas`](Frontend/booking-saas) · Next.js, TypeScript, Tailwind (3 apps) | [`Backend/booking-api`](Backend/booking-api) · Node.js (TypeScript), Fastify, PostgreSQL, Prisma, Docker | In progress | - |
| 2 | **Company Website**: landing, services, blog, contact form, content admin, animations | [`Frontend/company-website`](Frontend/company-website) · Next.js, TypeScript, Tailwind, Framer Motion | [`Backend/company-website-supabase`](Backend/company-website-supabase) · Supabase (Postgres, Auth, RLS, Storage, Edge Functions) | Planned | - |
| 3 | **AI Document Chat (RAG)**: upload documents, streaming answers with sources, chat history | [`Frontend/ai-chat`](Frontend/ai-chat) · Next.js, TypeScript, Tailwind | [`Backend/ai-chat-api`](Backend/ai-chat-api) · Python FastAPI, PostgreSQL + pgvector | Planned | - |

## Repository layout

```
docs/                 PRD + FSD per project
Frontend/             frontends, one folder per project
Backend/              backends, one folder per project
package.json          pnpm workspace + Turborepo (TypeScript projects)
docker-compose.yml    runs Tempora locally
.github/workflows/    CI
```

Each project folder has its own README with features, setup and screenshots. Product and technical specs live in [`docs/`](docs).

## Working on the TypeScript projects

Requirements: Node.js 24+, pnpm 10, Docker.

```bash
pnpm install
pnpm lint                              # ESLint, including architecture rules
pnpm turbo run build typecheck test    # every package, in dependency order, cached
cp .env.example .env                   # local database passwords
docker compose up --build              # Tempora: database, API, worker and the three apps
```

CI runs the same checks on every pull request, plus migrations and a smoke test against a real PostgreSQL, and builds every Docker image.
