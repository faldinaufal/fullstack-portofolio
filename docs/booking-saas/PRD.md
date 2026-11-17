# Tempora — Booking & Invoicing SaaS — PRD

**Status:** Approved

## 1. Overview
**Tempora** (fictional product name) is a **multi-tenant** booking and invoicing platform for appointment-based service businesses. Each business (tenant) signs up, sets up its branches, services and staff, takes online bookings from its customers, and gets paid through invoices (Stripe, test mode). A platform admin operates the SaaS itself.

The project is built to production standards rather than as a demo: tenant data isolation, conflict-free scheduling under concurrent load, an audit trail, layered automated tests, CI/CD and observability.

Two core promises:
1. **A tenant can never see or change another tenant's data.** Isolation is enforced in the API and again in the database.
2. **A confirmed booking can never collide with another one.** Availability and conflict rules are enforced by the backend and guaranteed by the database, not only by the UI.

All businesses, people, prices and data in this project are fictional.

### Demo tenants (fictional)
| Tenant | Type | Branches | Purpose in the demo |
|---|---|---|---|
| **Lumen Wellness Studio** | Massage & physiotherapy | Downtown, Riverside, Northgate | Main demo tenant with rich seed data |
| **Harbor Physio Clinic** | Physiotherapy | Harbor, Eastside | Second tenant to demonstrate data isolation |

Services have their own duration, price and buffer time, e.g. Swedish Massage (60 min), Deep Tissue (90 min), Sports Physio Assessment (45 min), Follow-up Physio (30 min). Each therapist works at one branch. Currency: USD.

Customers have **one platform account** and can book at any tenant on the platform.

### Applications
Tempora is one API serving three separate web apps. Each user type works in exactly one app.

| App | Users | Purpose |
|---|---|---|
| **Tempora Portal** (public) | `customer`, guests | Find a business, view its branches and services, sign up / log in, book and pay, reschedule, see booking and payment history. Hosts each tenant's public booking page. |
| **Tempora Console** | `owner`, `manager`, `staff` | Run the business. The navigation adapts to the role: owner sees the whole tenant, manager their branch, staff only their own schedule, time off and session status. The *Dashboard* (charts) is one page inside the Console. |
| **Tempora Platform Admin** | `platform_admin` | Operate the platform: tenants, onboarding, suspension, usage, platform-wide audit. Deployed separately from the Console so the most powerful access never shares an app with tenant users. |

- An app only lets in the roles it is built for: a customer cannot log in to the Console, and a tenant user cannot log in to Platform Admin. The API enforces this as well; the apps are not the security boundary.
- **Customer accounts and team accounts are separate identities.** The same email can have a customer account (Portal) and a team account (Console); they have separate passwords and sessions and are never linked. Platform admin accounts are separate from both.
- The three apps share one design system (components, light/dark theme) so they look like one product.

## 2. Target users
All roles are first-class: each one gets a complete, end-to-end flow.

| Persona | Role | Scope | Needs |
|---|---|---|---|
| **Sam, platform operator** | `platform_admin` | Whole platform | See and manage tenants (activate, suspend), platform-wide health and usage, support a tenant without editing its data silently (every action audited). |
| **Maya, owner of Lumen Wellness Studio** | `owner` | One tenant | Onboard the business; manage branches, opening hours, services, prices and staff; see every booking; issue and track invoices; read revenue and utilization per branch; review the audit log. |
| **Rina, manager of Lumen Downtown** | `manager` | One branch in one tenant | Run her branch day to day: its staff, schedules, bookings, invoices and dashboard; read the audit log for her branch. Cannot see or change any other branch, nor tenant-wide settings. |
| **Daniel, therapist at Lumen Downtown** | `staff` | Own schedule in one tenant | See his day/week schedule; block time off; mark sessions completed or no-show. |
| **Alya, customer** | `customer` | Own bookings, at any tenant | Find a business, then pick a branch, service, therapist and free slot; reschedule or cancel within policy; pay online; get email confirmations and reminders; see booking and payment history. |

### Owner vs. manager
A manager has nearly the same powers as the owner, but only inside the branch they are assigned to. Data from other branches is invisible to them, not just read-only.

| Area | `owner` (whole tenant) | `manager` (own branch only) |
|---|---|---|
| Bookings, schedules, time off | All branches | Own branch |
| Team & roles | Invite, change role, move between branches, revoke access for managers and staff in any branch; transfer ownership | Invite, deactivate and reactivate staff in own branch only; cannot grant or change the `manager` or `owner` role |
| Invoices | All branches | Own branch |
| Dashboard & CSV export | All branches, plus cross-branch comparison | Own branch |
| Branch opening hours | All branches | Own branch |
| Services & prices (tenant-wide catalogue) | Create, edit, archive | Read only |
| Create/archive branches, business profile, cancellation policy | Yes | No |
| Audit log | Entire tenant | Entries for own branch only; no tenant-level entries and no owner actions on managers |

### How roles are granted
Nobody can choose their own role, and nobody can grant a role higher than their own scope allows.

| Role | How a user gets it | Granted by |
|---|---|---|
| `platform_admin` | Created with a server-side command during deployment; there is no sign-up or UI to grant it | System operator |
| `owner` | (a) Signs up a new business: the person who signs up becomes the owner of the new tenant; or (b) accepts an email invitation after a platform admin creates the tenant for them (assisted onboarding) | Self sign-up, or `platform_admin` |
| `manager` | Accepts an email invitation for a specific branch, or an existing staff member is promoted | `owner` |
| `staff` | Accepts an email invitation for a specific branch | `owner` (any branch), `manager` (own branch) |
| `customer` | Signs up once (from any tenant's booking page) and can then book at every tenant on the platform | Self sign-up |

Rules:
- **Exactly one owner per tenant.** Ownership can be transferred to another active member of the tenant; the transfer requires confirmation (re-entering the password) and the previous owner becomes a manager or leaves. A tenant can never be left without an owner.
- **Exactly one manager per branch.** Assigning a new manager to a branch that already has one requires choosing what happens to the current manager (demote to staff, move to another branch without a manager, or revoke).
- **Invitations** are tied to one email, one tenant, one role and one branch (for managers and staff); they expire and can be revoked or re-sent.
- **Role changes and revocations take effect immediately:** revoking access ends all of that user's active sessions.
- Every grant, change, transfer and revocation is recorded in the audit log.
- **Customers are platform-wide, staff roles are per tenant.** A tenant sees a customer's contact details and the bookings made *with that tenant* only, never the customer's bookings at other tenants.

### Booking and payment rules
- **Payment is required at booking time.** Choosing a slot creates a booking in `pending payment` status and holds the slot for **30 minutes**.
- A held slot counts as taken: nobody else can book it while the hold is active.
- If payment is not completed within 30 minutes, the booking becomes `expired` and the slot is free again. The Stripe payment page always closes before the hold ends, so a late payment for an expired booking cannot happen.
- The booking becomes `confirmed` only when Stripe's webhook reports the payment as successful.
- **Guest booking is allowed, with the same payment rule.** A guest enters name, email and phone, pays within 30 minutes, and receives an email with a secure link to view or manage the booking. If the guest later signs up with the same email, past guest bookings are linked to the new account.
- **A paid booking cannot be cancelled by the customer, only rescheduled** (before the cancellation cut-off). The payment moves to the new time slot. An unpaid booking can be cancelled at any time.
- The owner or the branch manager can still cancel a paid booking manually with a required reason; the app marks it as "refund handled outside the app" and records it in the audit log.
- The customer must choose a specific therapist; there is no automatic assignment.
- **Time:** all times are stored in UTC and shown in one platform-wide time zone set in configuration. Per-tenant and per-branch time zones are out of scope.

## 3. Goals
1. **Real end-to-end full stack, built like a production system.** A separate API (Node.js + TypeScript, PostgreSQL, Prisma, Docker) owns all business logic, authentication and role-based authorization. Three frontends (Portal, Console, Platform Admin) are built with Next.js, TypeScript and Tailwind CSS in one monorepo with a shared design system. The frontends never decide what a user is allowed to do.
2. **True multi-tenancy with branch-level scoping.** Tenants sign up and onboard themselves. Every record belongs to a tenant, every query is scoped to it, and the database enforces the same isolation as a second line of defence. Inside a tenant, managers are further restricted to their own branch. Both levels of isolation are proven by automated tests.
3. **A clear, working booking flow from start to finish.** Book → confirmed → invoice generated → paid via Stripe (test mode) → status updated from the Stripe webhook → session completed. Rescheduling and cancelling keep the booking, invoice and emails consistent.
4. **Zero double bookings (top priority).** A therapist can never have two overlapping active sessions, even when two customers submit the same slot at the same moment. Bookings also respect branch opening hours, therapist working hours, time off, and the buffer between sessions. Invalid requests are rejected with a clear, specific error. Covered by automated tests, including concurrency tests.
5. **Enterprise-grade engineering, visible to the reader.** Audit log, soft delete, layered tests in CI, automated deployment, rate limiting, idempotent payment and booking requests, session management, OpenAPI docs, structured logs and error tracking. The README documents each of these with evidence (links, screenshots, test output).

## 4. Non-goals
Deliberately out of scope; listed so the scope is explicit:
- **No calendar integration** (no Google Calendar sync, no .ics files).
- **No SMS or push notifications.** Email only.
- **No refunds, partial payments, deposits or tax handling.** Tax and refund rules differ per country and business; invoices are full payment, tax-exclusive, one currency (USD). Stripe test mode only.
- **No payouts to tenants.** All test payments go to one platform Stripe account and are tagged with the tenant they belong to (no Stripe Connect).
- **No multiple time zones** and no automatic therapist assignment.
- **No recurring bookings, packages, memberships or waitlists.** One booking = one session.
- **No custom roles or per-user permissions.** Fixed roles per tenant (`owner`, `manager`, `staff`, `customer`) plus `platform_admin`.
- **No SaaS subscription billing** for tenants (no plans or charging tenants for using the platform).
- No native mobile app (the web app is responsive instead).
- No real customer data or production payments.

## 5. Features

### 5.1 Platform & tenancy
| Priority | Feature | Notes |
|---|---|---|
| Must | Tenant sign-up and onboarding | Open self sign-up: the person who signs up becomes the owner, then a guided setup: business profile, first branch, services, team invites. |
| Must | Assisted onboarding | A platform admin creates a tenant and invites its owner by email. |
| Must | Tenant data isolation | Enforced in the API and in the database; a request can never read or write another tenant's data. |
| Must | Platform admin console | List tenants, view usage, suspend/reactivate a tenant. Suspended tenants cannot take bookings. |
| Should | Tenant-branded booking page | Each tenant has its own public booking URL with its name and logo. |

### 5.2 Identity & access
| Priority | Feature | Notes |
|---|---|---|
| Must | Auth with roles | `platform_admin`, and per tenant `owner`, `manager`, `staff`, `customer`. Authorization (role **and** tenant/branch scope) checked on every endpoint. |
| Must | Branch-scoped access for managers | Each branch has exactly one manager, and a manager is assigned to exactly one branch. A manager can only read or change that branch's data (see *Owner vs. manager*). |
| Must | Team invitations | The owner invites managers and staff; a manager invites staff for their own branch. Invitations expire and can be revoked or re-sent; invitees set their own password. |
| Must | Role management | Owner promotes/demotes between staff and manager, moves members between branches and revokes access; manager deactivates/reactivates staff in their branch. See *How roles are granted*. |
| Must | Ownership transfer | Owner hands the tenant to another active member, with password confirmation. |
| Must | Session management | Server-side sessions in httpOnly cookies, separate per app; log out of all devices; revoking access or changing a role takes effect immediately. |
| Must | Password reset by email | |
| Must | Two-factor authentication (Console and Platform Admin) | One-time code sent to the account's email after the password. Console users can trust a device for 30 days; Platform Admin asks for a code at every login and again before sensitive actions. Customers (Portal) do not use 2FA. |

### 5.3 Scheduling & booking
| Priority | Feature | Notes |
|---|---|---|
| Must | Branch, service and staff management | Branch opening hours and closed days; service duration, price and buffer; therapist working hours. |
| Must | Business directory | Customers browse or search active tenants on the platform and open a tenant's booking page. |
| Must | Availability search | Customer picks branch → service → therapist → date and sees only bookable slots. |
| Must | Slot hold | Unpaid bookings hold the slot for 30 minutes, then expire automatically and release it (see *Booking and payment rules*). |
| Must | Guest booking | Book and pay without an account; manage the booking from a secure email link; guest bookings link to an account later signed up with the same email. |
| Must | Booking lifecycle | Create, reschedule, cancel; statuses: pending payment, expired, confirmed, completed, cancelled, no-show. Each role sees and changes only what it is allowed to. |
| Must | Double-booking prevention | Backend validation **plus** a database-level guarantee against overlapping bookings for the same therapist; safe under concurrent requests. |
| Must | Staff schedule and time off | Day/week schedule; blocked time is not bookable; mark completed or no-show. |
| Must | Cancellation policy | Per-tenant cut-off (e.g. 24 h before the session) for customer reschedules; customers cancel only unpaid bookings; owner/manager can cancel a paid booking with a reason. Every override is audited. |

### 5.4 Invoicing & payments
| Priority | Feature | Notes |
|---|---|---|
| Must | Invoices from bookings | Created from the booking with a sequential invoice number per tenant; voided automatically when a booking is cancelled before payment. |
| Must | Stripe payment (test mode) | One platform Stripe account; each payment is tagged with its tenant and booking. Stripe's hosted payment page (Checkout) expires together with the 30-minute hold; payment status is confirmed by the webhook, never by the browser redirect; webhook processing is idempotent. |
| Should | Invoice PDF download | |

### 5.5 Notifications
| Priority | Feature | Notes |
|---|---|---|
| Must | Transactional email | Booking confirmed, rescheduled, cancelled, payment received, reminder before the session, staff invite, password reset. Sent by a background job with retries; failures are visible to the owner. |

### 5.6 Reporting & administration
| Priority | Feature | Notes |
|---|---|---|
| Must | Dashboard with custom charts (no chart library) | Revenue over time, bookings per service, utilization per branch and therapist, no-show rate; filter by branch and date range. |
| Must | Tables with filter, sort, pagination, CSV export | Bookings, invoices, customers, audit log. |
| Must | Audit log | Who did what and when, with before/after values, for bookings, invoices, staff, settings and platform-admin actions. The owner sees the whole tenant; a manager sees only entries for their branch. |
| Must | Soft delete | Business records are archived, not permanently deleted; history and invoices stay intact. |

### 5.7 Engineering & operations
| Priority | Feature | Notes |
|---|---|---|
| Must | Layered automated tests | Unit, API integration tests against a real PostgreSQL, tenant-isolation tests, double-booking concurrency tests, end-to-end browser tests for each role's main flow. |
| Must | CI/CD | Lint, type check, tests and build on every pull request; automatic deploy from `main`. |
| Must | API reliability & security | Input validation, rate limiting, idempotency keys for booking and payment requests, consistent error format, versioned API (`/v1`), OpenAPI documentation. |
| Must | Observability | Structured logs with request IDs, error tracking, health check endpoint, basic metrics (latency, error rate). |
| Must | Seeded fictional data and demo accounts | One demo login per role on the live site; demo data can be reset. |

Priority: **Must** / **Should** / **Could**.

## 6. Success criteria
- All three apps (Portal, Console, Platform Admin) are deployed with a public live demo, seeded fictional data and a demo account for every role.
- Responsive (mobile-first), light/dark mode, accessible; screenshots in the project README.
- Every role can complete its main flow on the live demo, and each flow is covered by an end-to-end test.
- A user of one tenant cannot access another tenant's data through any endpoint, a manager cannot access another branch's data, and no user can grant a role beyond their own scope, proven by automated tests.
- Overlapping bookings for the same therapist are impossible, proven by automated tests that fire simultaneous requests for the same slot.
- An unpaid booking releases its slot automatically after 30 minutes, proven by automated tests.
- A booking paid with a Stripe test card shows as paid only after the webhook arrives; replaying the same webhook does not change the result.
- Every booking, invoice and settings change appears in the audit log.
- CI runs all tests on every pull request, and `main` deploys automatically.
- The API runs locally with one `docker compose up`, including migrations and seed data.
- The README explains the architecture and the main backend decisions, and only claims what is actually implemented.

## 7. Open questions
None at the moment. All earlier questions are resolved in the sections above.
