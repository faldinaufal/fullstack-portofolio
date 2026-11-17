# Tempora apps

Frontends of **Tempora**, a multi-tenant booking and invoicing platform (fictional product, fictional data). Specs: [PRD](../../docs/booking-saas/PRD.md) · [FSD](../../docs/booking-saas/FSD.md). Backend: [`Backend/booking-api`](../../Backend/booking-api).

**Status:** foundation in place (no business screens yet; UI designs pending).

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

The `health` feature is the reference implementation of all layers: domain use case → HTTP repository → view-model hook → status card.

## Shared packages

| Package | Purpose |
|---|---|
| `packages/ui` | Design system: theme tokens (light/dark), base components (Button, Card, Badge, theme toggle) |
| `packages/api-client` | `fetch` wrapper: sends cookies, validates every response against the API contract, converts failures into `ApiError` with a stable code |
| `Backend/booking-api/packages/contracts` | API contract (Zod schemas and types), owned by the API |

## Run locally

```bash
# from the repository root
pnpm install
pnpm turbo run dev --filter=@tempora/portal    # or console / platform-admin
```

Each app reads `NEXT_PUBLIC_API_URL` (see its `.env.example`). To run everything, including the API, use `docker compose up --build` from the repository root.
