# Tempora apps

Frontends of **Tempora**, a multi-tenant booking and invoicing platform (fictional product, fictional data). Specs: [PRD](../../docs/booking-saas/PRD.md) · [FSD](../../docs/booking-saas/FSD.md). Backend: [`Backend/booking-api`](../../Backend/booking-api).

**Status:** design system and app layouts in place; home screens use fictional demo data until their API endpoints exist.

| App | Users | Local URL |
|---|---|---|
| `apps/portal` | Customers and guests | http://localhost:3000 |
| `apps/console` | Business owners, managers and staff | http://localhost:3001 |
| `apps/platform-admin` | Tempora operators | http://localhost:3002 |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query · Vitest + Testing Library

## Architecture

Every app separates **core** (logic) from **ui** (rendering). Each feature in `core` has three layers:

```
src/
├── app/                      Next.js routes (thin: compose ui components)
├── ui/                       components and screens; talk only to presentation
├── composition/              composition root: wires data implementations into the app
└── core/
    └── <feature>/
        ├── domain/           entities, pure rules, repository interfaces, use cases (plain TypeScript)
        ├── data/             repository implementations calling the API, DTO ⇄ entity mappers
        └── presentation/     hooks and view-models (no JSX)
```

Dependency direction: `ui → presentation → domain ← data`. It is **enforced by ESLint** (`eslint-plugin-boundaries` and restricted imports), so these fail the build:

- `ui` importing from `data`
- `domain` importing React, Next.js, TanStack Query or API types
- JSX inside `presentation`

Reference implementations:

| App | Feature | Data source today |
|---|---|---|
| all | `health`: API connection badge | HTTP (`GET /health`) |
| Portal | `directory`: featured businesses on the home page | demo repository |
| Console | `dashboard`: KPIs, bookings chart, calendar, today's bookings | demo repository |
| Platform Admin | `overview`: platform KPIs, system health, tenants | demo repository |

Demo repositories (`core/<feature>/data/demo-*-repository.ts`) implement the same domain interface as the HTTP ones will. When an endpoint ships, only that file is replaced; domain rules, view-models and screens stay as they are.

## Shared packages

| Package | Purpose |
|---|---|
| `packages/ui` | Design system: steel-blue theme tokens (light/dark), Button, Card, Badge, KPI card, bar chart and month calendar (no chart library), search field, icons, a mobile navigation drawer (native modal `<dialog>`), and the dashboard shell shared by Console and Platform Admin |
| `packages/api-client` | `fetch` wrapper: sends cookies, validates every response against the API contract, converts failures into `ApiError` with a stable code |
| `Backend/booking-api/packages/contracts` | API contract (Zod schemas and types), owned by the API |

## Run locally

```bash
# from the repository root
pnpm install
pnpm turbo run dev --filter=@tempora/portal    # or console / platform-admin
```

Each app reads `NEXT_PUBLIC_API_URL` (see its `.env.example`). To run everything, including the API, use `docker compose up --build` from the repository root.
