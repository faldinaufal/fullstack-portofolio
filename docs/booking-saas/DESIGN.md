# Booking & Invoicing SaaS — Design guide

**Status:** Approved · Applies to Tempora Portal and Tempora Console · Based on [FSD](FSD.md)

This guide is for whoever builds or rebuilds the Portal and Console UI, whether that is a person or an AI coding agent. It says which source decides what:

- **[FSD](FSD.md) decides what exists and how it behaves:** screens, fields, statuses, rules, copy that makes a promise.
- **The Figma file decides how it looks:** layout, spacing, colour, type, components, density.

When the two disagree, **the FSD wins**. Keep the Figma look, but replace the Figma content with what the FSD specifies. Never add a feature, field, status or promise only because it appears in Figma. If a Figma idea is worth building, change the FSD first in its own commit, then build it.

Platform Admin is out of scope for this guide for now. It has no Figma frames.

## 1. Order of precedence

1. [PRD](PRD.md) non-goals (section 4) and the FSD rules (sections 1, 6 and 7).
2. FSD screens (section 2), data model (section 4) and API (section 5).
3. This guide.
4. Figma frames: visual reference only.

## 2. Figma source

| | |
|---|---|
| File | "Tempora Web Design", file key `csSDEEvj1jtSQ0nizX4R23`, page "Page 1" |
| Portal frames (top row) | `1:615` Explore Practices · `1:1025` Lumen Wellness Practice & Services · `1:1751` Minimalist Booking · `1:2052` Booking Confirmation & Receipt · `1:2257` Reschedule · `1:1633` My Bookings · `1:1366` Invoices & Receipts · `1:2532` Sign In · `1:2614` Create Account |
| Console frames (second row) | `3:2549` Dashboard · `3:3081` Bookings · `3:3457` Calendar · `3:1644` Customers Directory · `3:2231` Customers (Simplified) · `3:802` Customer Details · `3:1354` Invoices (Simplified) · `3:375` Invoice Details · `3:3730` Team & Schedule · `3:4101` Schedule Tab · `3:2` Audit Log |

**Design tokens:** exported from the design into [design-tokens.json](design-tokens.json) (Tokens Studio format) and summarised in section 3. Build the shared UI package's tokens from that file (FSD 0.2: one design system with light and dark), so building screens never needs Figma access. To check layout details of a frame, use the Figma connector (`get_design_context`, `get_screenshot`). The Starter plan allows very few connector calls, so use them only for frames being built.

## 3. Visual language to follow

The look comes from the Figma file. Exact values are in [design-tokens.json](design-tokens.json); use token names in code, never raw hex values.

**Overall**
- Calm, warm and spacious in the Portal; denser and table-first in the Console.
- Style: soft modern SaaS, following the UI UX Pro Max "Soft UI Evolution" guidance. That means soft but clear shadows, rounded cards, visible focus rings and transitions of 150–300 ms that respect `prefers-reduced-motion`.

**Colour tokens.** The token file has three sets: `global` (fonts, radius, spacing), `light` and `dark` (colours, with the same names in both). There are two themes: Light = global + light, Dark = global + dark. Tokens marked * were added to the original export: the contrast fixes below and the danger status.

| Group | Token | Light | Dark | Use |
|---|---|---|---|---|
| Brand | `primary` | `#df5a49` | `#ef7a69` | Lotus Terracotta: accent, icons, large text, focus ring |
| | `primary-strong` * | `#c2412f` | `#ef7a69` | Primary button fill, primary-coloured small text |
| | `on-primary` / `on-primary-strong` * | `#ffffff` | `#1f1c1b` | Text and icons on the two above (dark mode uses dark text on light terracotta) |
| | `primary-container` | `#fdeee9` | `#4a201a` | Active tags, selected slot, soft highlights |
| | `on-primary-container` | `#9c3022` | `#ffd9d2` | Text on `primary-container` |
| Surface | `surface` / `surface-bright` | `#fbf9f7` | `#1a1716` | Page background |
| | `surface-container-lowest` | `#ffffff` | `#221e1c` | Cards and sheets |
| | `surface-container-low` | `#f5f3f1` | `#262220` | Muted sections |
| | `surface-container` | `#eeebe8` | `#2d2826` | Default container |
| | `surface-container-high` | `#e8e5e2` | `#36302d` | Hover, high emphasis |
| | `surface-dim` | `#dbdad8` | `#3a3532` | Subtle dividers |
| Text | `on-surface` | `#1f1c1b` | `#f3eeeb` | Main text |
| | `on-surface-variant` | `#73706e` | `#b0a9a5` | Labels, captions, secondary text |
| Lines | `outline` | `#dbdad8` | `#3a3532` | Card borders (decorative) |
| | `outline-variant` | `#eceae7` | `#2b2725` | Hairline separators |
| | `outline-strong` * | `#8a8582` | `#7a726e` | Form-field borders (3:1) |
| Success | `status.success` / `-bg` / `-text` * | `#10b981` / `#ecfdf5` / `#047857` | `#34d399` / `#0f2e24` / `#6ee7b7` | `confirmed`, `paid`, `succeeded`, `completed` |
| Warning | `status.warning` / `-bg` / `-text` * | `#f59e0b` / `#fffbeb` / `#b45309` | `#fbbf24` / `#33260a` / `#fcd34d` | `pending_payment`, `open`, `pending` |
| Neutral | `status.neutral` / `-bg` / `-text` * | `#6b7280` / `#f3f4f6` / `#4b5563` | `#9ca3af` / `#2a2b2e` / `#d1d5db` | `expired`, `void`, `cancelled` |
| Danger * | `status.danger` / `-bg` / `-text` | `#dc2626` / `#fef2f2` / `#b91c1c` | `#f87171` / `#3b1414` / `#fca5a5` | `no_show`, `failed`, `needs_attention`; destructive buttons |

For status pills, the tone colours the dot or icon, `-bg` is the pill background and `-text` is the label. Colour is never the only signal: the status name is always written.

| Type | Value |
|---|---|
| Heading and body font | Plus Jakarta Sans |
| Mono font (IDs, request IDs, JSON diff) | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` |
| Radius | `none` 0 · `sm` 4 · `base` 8 · `md` 12 · `lg` 16 · `full` 9999 (px) |
| Spacing | `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `2xl` 32 · `3xl` 48 (px) |

The design has no teal or secondary colour; emphasis uses `primary` and `primary-container` only.

**Contrast check (WCAG 2.2 AA, FSD 8.4).** Text needs 4.5:1 (3:1 for large text: 24 px, or 18.66 px bold). Form-field borders and focus rings need 3:1. Measured ratios:

| Pair | Light | Dark | Rule |
|---|---|---|---|
| `on-surface` on `surface` | 16.1 | 15.5 | OK |
| `on-surface-variant` on `surface` / card | 4.7 / 4.9 | 7.7 / 7.1 | OK. In light mode it is only 4.1 on `surface-container`, so do not put small grey text there |
| `on-primary-strong` on `primary-strong` (button) | 5.1 | 6.2 | OK |
| `on-primary` on `primary` | 3.7 | 6.2 | Light: large text and icons only, never a button label |
| `primary` as text on `surface` | 3.5 | 6.5 | Light: use `primary-strong` for small text links |
| `on-primary-container` on `primary-container` | 6.5 | 10.7 | OK |
| `status.*-text` on `status.*-bg` | 5.2 · 4.8 · 6.9 · 5.9 | 9.6 · 10.2 · 9.6 · 8.5 | OK (success · warning · neutral · danger) |
| `status.success` / `warning` tone on its `-bg` | 2.4 / 2.1 | — | Dot or icon only, never text |
| Destructive button label on `status.danger` | 4.8 (white) | 6.1 (`#1f1c1b`) | OK. Dark mode uses dark text, like the primary button |
| `outline-strong` on card | 3.7 | 3.5 | OK for form fields |
| `outline` on card | 1.4 | 1.4 | Decorative card borders only |
| `primary` focus ring on `surface` | 3.5 | 6.5 | OK |

**Additions** (marked * above) are not in the Figma file yet. Add them to the design file too, so Figma and code stay the same. The dark theme is derived from the light one: warm dark surfaces stepping up in lightness, a lighter terracotta, and dark-tinted status pills. UI UX Pro Max advises against dark mode for this style; the FSD requires it, so the FSD wins.

**Layout patterns to reuse**
- **Portal shell:** top navigation with brand, directory search and account menu, plus the footer from the Figma Portal frames. Remove footer links to pages the FSD does not have (see section 4).
- **Console shell:** left sidebar, a header with the tenant switcher and the branch filter, and a page title row with the primary action on the right. The sidebar shows only what the active role may use (FSD 2.2).
- **Cards and tables:**
  - Booking and invoice cards from My Bookings and Invoices & Receipts.
  - KPI tiles from the Dashboard.
  - Data tables with filter chips, search and pagination from Bookings.
- **Booking flow:** the step indicator and slot-chip grid from Minimalist Booking. The FSD order of steps still applies (section 5).
- **Audit view:** the before/after diff panel and the cursor "Load more" pattern from Audit Log.
- **Charts:** the chart style from the Dashboard frame. The charts themselves are built without a chart library (project rule).

**Responsive.** Every screen works from 360 px wide (FSD 2). Figma frames are desktop-only. On small screens:
- Collapse the sidebar into a menu.
- Stack cards into one column.
- Turn tables into card lists.

**Interactive states.** Every list screen needs loading, empty and error states, and destructive actions ask for confirmation (FSD 2). Figma has few of these, so build them from the same cards, buttons and type.

## 4. Figma content to replace

These parts of Figma contradict the PRD or FSD, or go beyond them. Keep the visual slot when it helps the layout, and fill it with the FSD content in the right-hand column.

### 4.1 Contradicts a rule (must change)

| In Figma | Replace with | Source |
|---|---|---|
| "Cancel" on a paid / confirmed booking (My Bookings), "free cancellation up to 24h" copy | Customers can only **reschedule** a confirmed booking. "Cancel" appears only on `pending_payment` bookings | FSD 6.7, PRD |
| Invoice status "Refunded"; audit reason "refund processed to card on file"; `refundable` diff field | Invoice statuses `open` / `paid` / `void` only. For a paid cancellation, show the note "Refund handled outside the app" (`refund_handled_externally`) | FSD 4.3, 6.7, 7.2; PRD non-goals |
| "No upfront charge on standard reservation holds" | Payment happens at booking. An unpaid booking is held for 30 minutes, then expires | FSD 6.3, 6.4 |
| "Held for 29:44" countdown on the slot-picking page | The countdown appears only on Payment pending (`/bookings/[id]/pay`), after the details step | FSD 2.1, 6.3 |
| "Any Available Specialist" in Reschedule | Pick a specific therapist of the same branch who performs the service | FSD 6.5 |
| Password "Min. 8 characters" | "At least 12 characters; must not contain your email" | FSD 6.11 |
| Google / Apple sign-in, "Remember me" | Email + password only. The Portal session lasts 30 days anyway | FSD 6.11 |
| SMS reminders, phone "for notifications" | Email only. Phone is an optional contact field (E.164) | PRD non-goals, FSD 6.12 |
| "Add to Google Calendar / Apple Wallet" | Remove | PRD non-goals |
| Taxes, "Healthcare Surcharges", CPT/NPI codes, superbill, HSA/FSA, insurance | Amount = service price snapshot, tax-exclusive, USD. No tax line | PRD non-goals, FSD 6.10 |
| Full therapist names in the Portal ("Elena Rostova, LMT") | First name + last initial ("Ines H.") in the Portal. Full names only in the Console | FSD (Portal privacy) |
| Calendar "Month" view | Day and week views only (range at most 14 days) | FSD 2.2, 5.4 |
| "Checked In", "In Session" statuses | Booking statuses: `pending_payment`, `confirmed`, `expired`, `cancelled`, `completed`, `no_show` | FSD 7.1 |
| Buffer set per therapist ("30m rest buffer configured") | Buffer belongs to the **service** (`buffer_minutes`) | FSD 4.3 |
| Booking filters without Expired / No-show | Filters cover every booking status | FSD 7.1 |
| Booking slots off the 30-minute grid | Start times on the hour and half hour only | FSD 6.1 |

### 4.2 Not in the FSD (leave out)

| In Figma | Do instead |
|---|---|
| Clinical / medical data: allergies, contraindications, intake consent, chief complaint, date of birth, emergency contact, mobility score, care team, HIPAA trail, "patient ID", "Needs intake form" | Customer detail shows only name, email, phone, whether they have a Portal account, first booked date, and their bookings at this tenant (FSD 4.3 `tenant_customers`, 2.2). Staff see only the customer name and booking notes |
| Medical wording: "patient", "clinical", "practitioner", "care modality", "treatment suite" | Use "customer", "therapist", "service", "session", "branch" |
| Ratings, reviews, "Validated Practice #042", "Certified practitioners", "Available Today" | Leave out. The directory shows name, type, branches and a "Book" action |
| Rooms / suites ("Suite 402", "Studio 2A"), parking, arrival notes, concierge phone | Show the branch name, address and phone (`branches`) and opening hours |
| Photos and hero images of the business | Tenant logo only (`logo_url`), with an initials fallback |
| Booking reference "#BK-9842" | No separate booking number. Show the invoice number (`LUM-2026-000412`) and the date / service |
| "Download PDF receipt", "Download all invoices", "Send receipt by email" | Printable invoice page (`/bookings/[id]/invoice`, print stylesheet). The confirmation email is sent automatically |
| Card on file, card brand and last 4 digits, auth code | Payment status and Stripe IDs only (Console invoice detail) |
| Lifetime spend, memberships, packages, deposits | Booking count and last visit (FSD 2.2 Customers) |
| Shift coverage requests, target clinical hours, "Coverage sync" | Working hours, time off and services per therapist (FSD 2.2 Team member detail, My schedule) |
| Team invite field "Full name" | Invite by email, role and branch. The invitee sets their own name when accepting (FSD 3.6, `invitations`) |
| Footer links: Help Center, Patient Portal Access, Cancellation & Hold Policy page | Keep only links to FSD screens: directory, "For businesses", log in / sign up. Policy text appears inline where it applies |
| Internal labels printed in the design ("FSD 5.3 Dynamic Ledger") | Remove |

### 4.3 Figma items that match the FSD (keep)

- Reschedule shows "1 of 2 free reschedules remaining" and the 24-hour cut-off.
- Invoice numbers in the format `LUM-2026-000123`.
- Console invoice detail shows the Stripe Checkout session, the payment intent and the webhook timeline.
- Audit log:
  - Actor, `action.entity`, request ID, reason.
  - JSON before/after diff.
  - Cursor pagination.
- Dashboard KPIs: revenue, bookings, utilization, no-show rate, with branch and date filters.
- Bookings and Invoices tables with filters, search, pagination and **CSV export** (in the FSD).
- Tenant switcher and branch filter in the Console header; "Test mode" label for Stripe.

## 5. Screen map

Every FSD screen with its visual reference. "Compose" means there is no frame: build it from the named patterns.

### 5.1 Portal

| FSD screen | Route | Figma reference |
|---|---|---|
| Home / directory | `/` | `1:615` Explore Practices (without ratings or insurance) |
| For businesses | `/for-business` | Compose: Portal shell + hero and feature sections in the `1:615` style |
| Business page | `/[tenant]` | `1:1025` Lumen Wellness. Add branches with address and **opening hours**, and the service list with duration and price |
| Branch page | `/[tenant]/branches/[branch]` | Compose from `1:1025`: branch details, therapists ("Ines H."), services |
| Book: service and therapist | `/[tenant]/book` | `1:1751` Minimalist Booking, step 1: **branch → service → therapist** |
| Book: choose time | `/[tenant]/book/time` | `1:1751` / `1:2257` date strip and slot chips, 30-minute grid, horizon limited |
| Book: details | `/[tenant]/book/details` | Compose: log in / sign up / continue as guest, notes, summary with price, "Continue to payment" |
| Payment pending | `/bookings/[id]/pay` | Compose: 30-minute countdown, "Pay now" (Stripe Checkout), "Cancel booking" |
| Payment result | `/bookings/[id]/confirmation` | `1:2052` Booking Confirmation. Add a "waiting for payment confirmation" state and an expired state |
| Sign up / log in | `/signup`, `/login` | `1:2614`, `1:2532` (fixes from 4.1) |
| Verify email, forgot / reset password | `/verify-email`, `/forgot-password`, `/reset-password` | Compose from the `1:2532` card layout |
| My bookings | `/account/bookings` | `1:1633`. Add status chips for every status, "Pay now" on `pending_payment` |
| Booking detail | `/account/bookings/[id]`, `/bookings/[id]` | Compose from `1:2052`: details, reschedule (with remaining count or the reason it is hidden), cancel if unpaid, invoice link |
| Reschedule | `/bookings/[id]/reschedule` | `1:2257` (without "Any specialist") |
| Invoices | `/account/invoices` | `1:1366` (statuses open / paid / void) |
| Invoice | `/bookings/[id]/invoice` | Compose: printable invoice from the receipt part of `1:2052` |
| Profile and security | `/account/profile` | Compose: name, phone, password, active sessions, "Log out everywhere" |
| Guest booking | `/manage/[token]` | Same as Booking detail, without the account menu |
| Demo inbox | `/demo-inbox` | Compose: simple email list + reader. Only when `DEMO_MODE` is on |
| Tenant suspended | all tenant pages | Compose: "This business is not taking bookings right now" (FSD 6.9) |

### 5.2 Console

| FSD screen | Route | Figma reference |
|---|---|---|
| Sign up business | `/signup` | Compose from the `1:2614` card layout, inside the Console look |
| Log in / reset password | `/login`, `/forgot-password`, `/reset-password` | Compose from `1:2532` |
| Verify code | `/login/verify` | Compose: 6-digit code, resend with countdown, "Trust this device for 30 days" |
| Accept invitation | `/invite/[token]` | Compose: set name and password, join tenant |
| Onboarding | `/onboarding` | Compose: 4-step wizard (business profile → first branch and hours → services → invite team) using the booking step indicator |
| Dashboard | `/` | `3:2549` (without Checked In / In Session, shift coverage or SMS). Charts: revenue over time, bookings per service, utilization, no-show rate |
| Today (staff) | `/` (staff) | Compose from the `3:2549` "Today" list: sessions with customer name and notes, "Mark completed" / "Mark no-show" |
| Calendar | `/calendar` | `3:3457` day / week only. Columns per therapist; staff see only their own column |
| Bookings | `/bookings` | `3:3081` (all statuses, CSV export) |
| Booking detail | `/bookings/[id]` | Compose: audit timeline, reschedule, reassign, cancel with reason (paid → "refund handled outside the app"), mark completed / no-show, invoice link |
| Customers | `/customers` | `3:2231` / `3:1644` (booking count, last visit; no spend or intake columns) |
| Customer detail | `/customers/[id]` | `3:802` layout, stripped to the FSD fields (4.2) |
| Invoices | `/invoices` | `3:1354` |
| Invoice detail | `/invoices/[id]` | `3:375` (without tax, CPT, card details, room) |
| Branches | `/branches` | Compose: list, create / archive (owner), detail with opening hours and closures |
| Services | `/services` | Compose: catalogue table with duration, **buffer**, price; create / edit / archive |
| Team | `/team` | `3:3730` (invite by email, role and branch; pending invitations) |
| Team member detail | `/team/[id]` | `3:4101` Schedule tab: working hours, services, time off, upcoming bookings |
| My schedule | `/schedule` | Compose from `3:4101`, read-only working hours plus time off |
| Audit log | `/audit` | `3:2` |
| Email log | `/emails` | Compose: table in the `3:3081` style (status `queued` / `sent` / `failed` / `skipped`, error, retry) |
| Settings | `/settings` | Compose: business profile, logo, booking settings (lead time 0–72 h, horizon 1–180 days, cut-off 0–168 h, reschedules 0–10), support access (1 / 24 / 72 h), ownership transfer |
| Account | `/account` | Compose: name, password, active sessions, trusted devices (revoke) |
| Suspended tenant | all pages | Read-only banner with the suspension reason (FSD 6.9) |

## 6. Content and demo data

- Use the demo world from the seed (`Backend/booking-api/apps/api/src/modules/demo/world.ts`) for names, services, branches and prices. Do not use the names shown in Figma. Example: Lumen Wellness Studio with Downtown, Riverside and Northgate, and services such as Swedish Massage and Deep Tissue Massage.
- Money: USD, two decimals, no tax line. Dates and times: one platform time zone.
- Error messages map to the FSD error codes (FSD 6.13), for example `SLOT_TAKEN` → "That time was just taken. Please pick another."

## 7. Checklist before a screen is done

- [ ] Every field, status and action on the screen exists in the FSD; nothing from section 4 slipped in.
- [ ] Light and dark mode, each with 4.5:1 text contrast.
- [ ] Works at 360, 768, 1024 and 1440 px with no horizontal scroll.
- [ ] Loading, empty and error states; confirmation before destructive actions.
- [ ] Keyboard reachable, visible focus, labelled icon buttons, form errors next to the field (WCAG 2.2 AA, FSD 8.4).
- [ ] Touch targets at least 44 × 44 px; SVG icons, no emoji.
- [ ] The visual style matches the Figma frame named in section 5.
