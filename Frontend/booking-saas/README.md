# Tempora apps

Frontends of **Tempora**, a multi-tenant booking and invoicing platform (fictional product, fictional data). Specs: [PRD](../../docs/booking-saas/PRD.md) · [FSD](../../docs/booking-saas/FSD.md). Backend: [`Backend/booking-api`](../../Backend/booking-api).

**Status:** design system and app layouts in place; Console sign-up, login (with email code), onboarding, settings, branches, services, team management, schedules, bookings (table, detail with timeline and actions, calendar), customers, invoices, CSV exports, the dashboard and the staff "Today" page run against the real API. Platform Admin runs against the API too: login with an emailed code, overview, tenants, assisted onboarding, suspend / reactivate with a step-up code dialog, platform audit and account. The Portal's whole booking flow uses the API: directory, business pages, the three booking steps (service and therapist, free time, details or guest), payment (Stripe Checkout or a demo checkout page), confirmation that waits for the payment webhook, My bookings, booking detail with pay, cancel and reschedule, invoices (printable), the guest link and customer accounts. Still to come: the Console's audit log and email log screens, and support access in Platform Admin.

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
| Console | `auth`: sign-up, login with emailed code, trusted device, password reset, session guard, logout, business switcher | HTTP (`/v1/console/auth/*`, `/v1/console/me`) |
| Console | `branches`: list, create, details, opening hours editor, closures, archive | HTTP (`/v1/console/branches/*`) |
| Console | `team`: members, invitations, invite, change role or branch, deactivate, accept-invitation page, member schedule (working hours, services, time off), My schedule | HTTP (`/v1/console/members/*`, `/v1/console/invitations/*`) |
| Console | `catalogue`: business settings, service catalogue, onboarding wizard, setup checklist | HTTP (`/v1/console/tenant`, `/v1/console/services/*`) |
| Portal | `directory`: businesses on the home page, search | HTTP (`/v1/public/tenants`) |
| Portal | `booking`: business page, branch page, choose service and therapist, choose a free time | HTTP (`/v1/public/tenants/:slug/*`) |
| Portal | `reservation`: book and pay (keeps the booking's access token in the tab's `sessionStorage`), payment countdown, confirmation polling, My bookings, booking detail, cancel unpaid, guest link `/manage/[token]`, demo checkout, reschedule (therapist, day, time), invoices list and printable invoice | HTTP (`/v1/portal/bookings*`, `/v1/payments/demo/*`) |
| Portal | `account`: sign-up, log in, email verification, forgot / reset password, profile and security (details, password, sessions) | HTTP (`/v1/portal/*`) |
| Console | `bookings`: bookings table with filters, booking detail (timeline, reschedule, another therapist, cancel with reason, completed / no-show), calendar (day columns per therapist, week list), staff "Today"; schedule changes show the bookings in the way | HTTP (`/v1/console/bookings*`, `/v1/console/calendar`) |
| Console | `records`: customers (search, sort, detail with their bookings) and invoices (filters, detail with payment attempts); CSV export links for bookings, customers and invoices | HTTP (`/v1/console/customers*`, `/v1/console/invoices*`) |
| Console | `dashboard`: KPIs (bookings today, revenue this month, utilization, no-show rate, payments pending, therapists), revenue per day / week / month with the branch comparison, bookings per service, utilization per branch and therapist, no-show rate over time, up next and today's bookings; period presets and a branch filter | HTTP (`/v1/console/reports/*`, `/v1/console/bookings`) |
| Platform Admin | `auth`: login, code, session and step-up (a sensitive action that answers `STEP_UP_REQUIRED` asks for a code and runs again); `overview`: tenants by status, daily activity, what needs attention; `tenants`: list, detail, create (assisted onboarding), suspend / reactivate, platform audit | HTTP (`/v1/admin/*`) |

Demo repositories (`core/<feature>/data/demo-*-repository.ts`) implement the same domain interface as the HTTP ones will. When an endpoint ships, only that file is replaced; domain rules, view-models and screens stay as they are.

## Shared packages

| Package | Purpose |
|---|---|
| `packages/ui` | Design system: steel-blue theme tokens (light/dark), Button, Card, Badge, KPI card, bar chart, horizontal bar list, SVG line chart and month calendar (no chart library; every chart also renders its data as a table for screen readers), search field, icons, a mobile navigation drawer (native modal `<dialog>`), and the dashboard shell shared by Console and Platform Admin |
| `packages/api-client` | `fetch` wrapper: sends cookies, adds the CSRF token to state-changing requests (refreshed once when it expires), validates every response against the API contract, converts failures into `ApiError` with a stable code |
| `Backend/booking-api/packages/contracts` | API contract (Zod schemas and types), owned by the API |

## Run locally

```bash
# from the repository root
pnpm install
pnpm turbo run dev --filter=@tempora/portal    # or console / platform-admin
```

Each app reads `NEXT_PUBLIC_API_URL` (see its `.env.example`). To run everything, including the API, use `docker compose up --build` from the repository root.
