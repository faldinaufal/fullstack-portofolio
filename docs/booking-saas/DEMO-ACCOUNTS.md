# Tempora — Demo accounts

Every login created by the demo seed (`Backend/booking-api/apps/api/src/modules/demo/world.ts`). All people, businesses and email addresses are fictional. Locally they end in `@veloria.test`: `.test` is a reserved domain, so no email ever leaves your machine.

## Live demo

The live site uses the same accounts. Only the domain is different: `owner@veloria.test` is `owner@demo.tempora.faldinaufal.web.id` there, and so on for every address on this page.

| App | Live URL |
|---|---|
| Portal (customers) | https://tempora.faldinaufal.web.id/login |
| Console (owner, manager, staff) | https://console.tempora.faldinaufal.web.id/login |
| Platform Admin | https://admin.tempora.faldinaufal.web.id/login |
| Demo inbox (codes, reset links, booking emails) | https://tempora.faldinaufal.web.id/demo-inbox |

Every login page lists its demo accounts with a **Use** button that fills in the form. Emails to demo addresses are not sent. They appear in the public demo inbox, newest first, and stay there for 24 hours. The inbox refreshes on its own and has a copy button for login codes. Everything you do on the live demo is visible to other visitors, so do not enter real personal data.

## Locally

**Password for every account:** `tempora-demo-2026` (set `DEMO_PASSWORD` before seeding to change it).

| App | Local URL | Login |
|---|---|---|
| Portal (customers) | http://localhost:3000/login | Email + password |
| Console (owner, manager, staff) | http://localhost:3001/login | Email + password, then a 6-digit code |
| Platform Admin | http://localhost:3002/login | Email + password, then a 6-digit code (and again before sensitive actions) |
| Mailpit (codes, reset links, booking emails) | http://localhost:8025 | No login |

Console and Platform Admin send the 6-digit code by email. Locally, open Mailpit and use the newest message. To try the live setup locally, set `DEMO_MODE=true` for the API and worker and `NEXT_PUBLIC_DEMO_MODE=true` for the apps (see their `.env.example`); emails then go to http://localhost:3000/demo-inbox. In the Console you can tick "Trust this device for 30 days" to skip the code next time.

## Main accounts (one per role)

| Role | App | Email | Name | Scope |
|---|---|---|---|---|
| Customer | Portal | `customer@veloria.test` | Lena Fischer | Own bookings at both businesses |
| Owner | Console | `owner@veloria.test` | Ines Halvorsen | Lumen Wellness Studio, all branches |
| Manager | Console | `manager@veloria.test` | Daniel Kim | Lumen, Downtown branch (also takes sessions) |
| Staff (therapist) | Console | `therapist@veloria.test` | Mira Santos | Lumen, Downtown: own schedule only |
| Platform admin | Platform Admin | `admin@veloria.test` | Noah Castellanos | Whole platform |

## Every team account

"Takes sessions" means the person has working hours and services, so customers can book them.

### Lumen Wellness Studio (`/lumen`)

| Role | Branch | Name | Email | Takes sessions |
|---|---|---|---|---|
| Owner | All branches | Ines Halvorsen | `owner@veloria.test` | No |
| Manager | Downtown | Daniel Kim | `manager@veloria.test` | Yes: Mon, Wed, Fri 12:00–18:00 |
| Manager | Riverside | Priya Raman | `priya.raman@veloria.test` | No |
| Manager | Northgate | Sofia Lindqvist | `sofia.lindqvist@veloria.test` | Yes: Tue, Thu 09:00–13:00 |
| Staff | Downtown | Mira Santos | `therapist@veloria.test` | Yes: Mon–Fri 09:00–17:00 |
| Staff | Downtown | Theo Brandt | `theo.brandt@veloria.test` | Yes: Tue–Sat 10:00–18:00 |
| Staff | Riverside | Lucas Moreau | `lucas.moreau@veloria.test` | Yes: Mon–Fri 09:00–17:00 |
| Staff | Riverside | Hana Sato | `hana.sato@veloria.test` | Yes: Mon, Tue, Thu, Fri, Sat 10:00–18:00 |
| Staff | Northgate | Jonas Weber | `jonas.weber@veloria.test` | Yes: Mon–Fri 11:00–19:00 |

### Harbor Physio Clinic (`/harbor`)

| Role | Branch | Name | Email | Takes sessions |
|---|---|---|---|---|
| Owner | All branches | Jonah Reed | `jonah@veloria.test` | No |
| Staff | Harbor | Clara Nguyen | `clara.nguyen@veloria.test` | Yes: Mon–Fri 08:00–16:00 |
| Staff | Eastside | Mateo Rossi | `mateo.rossi@veloria.test` | Yes: Mon–Thu 10:00–18:00 |

Harbor has no manager: its owner runs both branches. Use it to check that one business never sees another's data.

## Customers

- **Portal account:** only `customer@veloria.test` (Lena Fischer). She has bookings at both businesses.
- **The other 64 customers** (46 at Lumen, 18 at Harbor) exist only as booking records in the Console. They booked as guests and have no password.
- **Need another customer?** Sign up at http://localhost:3000/signup with any `@veloria.test` address. The verification link arrives in Mailpit.

## Reset

The seed is also the reset: it recreates the two demo businesses and gives every demo account the demo password again. Anyone signed in with a demo account is logged out.

```bash
docker compose run --rm seed node dist/scripts/seed-demo.js --reset
```

Accounts created during testing (other sign-ups and their businesses) are not demo accounts. The reset leaves them alone, and they are not listed here.
