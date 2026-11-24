// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createHash } from 'node:crypto';
import type { BookingCreated, CreateBookingRequest } from '@tempora/contracts';
import { withDbContext, type Prisma, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit, type AuditActor } from '../../lib/audit.js';
import type { DemoPaymentProvider } from '../../lib/payments/demo-provider.js';
import {
  PaymentProviderUnavailableError,
  WebhookSignatureError,
  type PaymentEvent,
  type PaymentProvider,
} from '../../lib/payments/provider.js';
import { calendarDateOf, slotProblem } from '../availability/engine.js';
import { loadAvailabilityInput } from '../availability/load.js';
import { notFound } from '../console-auth/access.js';
import type { CustomerAuth } from '../portal-auth/service.js';
import type { TokenHasher } from '../../lib/tokens.js';
import { issueAccessToken } from './access.js';
import { queueConfirmation } from './emails.js';
import { formatInvoiceNumber } from './invoice-number.js';
import {
  expireBooking,
  expireStaleHolds,
  isOverlapViolation,
  lockTherapists,
  slotError,
} from './rules.js';
import { portalBooking } from './views.js';
import type { ObjectStorage } from '../../lib/storage/storage.js';

const MINUTE = 60_000;

/** FSD 6.3: the slot is held 32 minutes; Checkout expires after 30, always before the hold. */
export const BOOKING_POLICY = {
  holdMs: 32 * MINUTE,
  checkoutMs: 30 * MINUTE,
  idempotencyTtlMs: 24 * 60 * MINUTE,
} as const;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

interface Contact {
  name: string;
  email: string;
  phone: string | null;
  /** The logged-in customer (actor, idempotency scope), even if the email is not verified. */
  customerAccountId: string | null;
  /** The account to attach the business's customer record to: verified accounts only. */
  linkAccountId: string | null;
}

export interface BookingServiceDeps {
  prisma: PrismaClient;
  payments: PaymentProvider;
  hashToken: TokenHasher;
  timeZone: string;
  portalUrl: string;
  /** Builds therapist photo URLs (FSD 6.15); null without storage. */
  storage?: ObjectStorage | null;
  now?: () => Date;
}

/** Booking creation, payment webhooks and the demo checkout (FSD 6.3, 6.4). */
export function createBookingService({
  prisma,
  payments,
  hashToken,
  timeZone,
  portalUrl,
  storage = null,
  now = () => new Date(),
}: BookingServiceDeps) {
  const inTenant = <T>(tenantId: string, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId }, work, { timeoutMs: 15_000 });
  const view = { timeZone, storage };
  const emailContext = { hashToken, portalUrl, timeZone };

  /** A new access token for a booking created earlier (idempotent replay by the same sender). */
  async function reissueAccessToken(tenantSlug: string, bookingId: string): Promise<string> {
    const tenant = await prisma.tenant.findFirstOrThrow({ where: { slug: tenantSlug } });
    return inTenant(tenant.id, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      return issueAccessToken(tx, hashToken, booking);
    });
  }

  /** The next gapless invoice number: the counter row is locked until the transaction ends. */
  async function nextInvoiceNumber(tx: Tx, tenantId: string, prefix: string) {
    const year = Number(calendarDateOf(now(), timeZone).slice(0, 4));
    const [row] = await tx.$queryRaw<{ value: number }[]>`
      INSERT INTO invoice_counters (tenant_id, year, next_value)
      VALUES (${tenantId}::uuid, ${year}, 2)
      ON CONFLICT (tenant_id, year) DO UPDATE SET next_value = invoice_counters.next_value + 1
      RETURNING next_value - 1 AS value
    `;
    return formatInvoiceNumber(prefix, year, Number(row!.value));
  }

  async function createHoldAndInvoice(
    input: CreateBookingRequest,
    contact: Contact,
    actor: AuditActor,
  ) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: input.tenantSlug, archivedAt: null },
    });
    if (!tenant) throw notFound('Business');
    if (tenant.status !== 'active') {
      throw new AppError({
        status: 423,
        code: 'TENANT_SUSPENDED',
        title: 'Business temporarily unavailable',
        detail: 'This business is not taking bookings at the moment.',
      });
    }
    const startsAt = new Date(input.startsAt);

    return inTenant(tenant.id, async (tx) => {
      // Step 2: one booking at a time per therapist; other therapists are not affected.
      await lockTherapists(tx, [input.staffId]);
      await expireStaleHolds(tx, input.staffId, now());

      // Step 4: the same rules and data the availability endpoint uses (FSD 6.2).
      const {
        input: slotInput,
        branch,
        service,
        therapist,
      } = await loadAvailabilityInput(
        tx,
        { ...input, date: calendarDateOf(startsAt, timeZone) },
        {
          timeZone,
          now: now(),
          settings: { minLeadHours: tenant.minLeadHours, maxAdvanceDays: tenant.maxAdvanceDays },
        },
      );
      const problem = slotProblem(slotInput, startsAt);
      if (problem) throw slotError(problem);

      // Step 5: customer record, booking (with the service snapshot), invoice, audit.
      const existing = await tx.tenantCustomer.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: contact.email } },
      });
      const customer =
        existing ??
        (await tx.tenantCustomer.create({
          data: {
            tenantId: tenant.id,
            customerAccountId: contact.linkAccountId,
            email: contact.email,
            name: contact.name,
            phone: contact.phone,
            firstBookedAt: now(),
          },
        }));
      if (existing && contact.linkAccountId && !existing.customerAccountId) {
        await tx.tenantCustomer.update({
          where: { id: existing.id },
          data: { customerAccountId: contact.linkAccountId },
        });
      }

      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * MINUTE);
      const booking = await tx.booking.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          serviceId: service.id,
          staffMembershipId: therapist.id,
          tenantCustomerId: customer.id,
          startsAt,
          endsAt,
          blockedUntil: new Date(endsAt.getTime() + service.bufferMinutes * MINUTE),
          status: 'pending_payment',
          holdExpiresAt: new Date(now().getTime() + BOOKING_POLICY.holdMs),
          serviceName: service.name,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
          priceCents: service.priceCents,
          customerNotes: input.notes?.length ? input.notes : null,
        },
      });
      const invoice = await tx.invoice.create({
        data: {
          tenantId: tenant.id,
          bookingId: booking.id,
          number: await nextInvoiceNumber(tx, tenant.id, tenant.invoicePrefix),
          amountCents: service.priceCents,
          issuedAt: now(),
        },
      });
      await recordAudit(tx, actor, {
        tenantId: tenant.id,
        branchId: branch.id,
        action: 'booking.created',
        entityType: 'booking',
        entityId: booking.id,
        after: { status: booking.status, startsAt, staffId: therapist.id, invoice: invoice.number },
      });
      // Access for the pages right after booking (guests, unverified accounts; FSD 5.3).
      const accessToken = await issueAccessToken(tx, hashToken, booking);
      return { tenant, booking, invoice, branch, contact, accessToken };
    });
  }

  const service = {
    /**
     * FSD 6.3. Steps 2–6 run in one transaction; step 7 (Checkout) after the commit. A retried
     * request with the same `Idempotency-Key` returns the original response.
     */
    async create(
      input: CreateBookingRequest,
      customerAuth: CustomerAuth | null,
      idempotencyKey: string,
      ip: string,
    ): Promise<BookingCreated> {
      let contact: Contact;
      if (customerAuth) {
        const account = await prisma.customerAccount.findUniqueOrThrow({
          where: { id: customerAuth.customerAccountId },
        });
        contact = {
          name: account.name,
          email: account.email,
          phone: account.phone,
          customerAccountId: account.id,
          // Linked to the account only once its email is verified (FSD 3.2 step 6): anyone can
          // sign up with someone else's address, and must not see that person's bookings.
          linkAccountId: account.emailVerifiedAt ? account.id : null,
        };
      } else if (input.guest) {
        contact = {
          name: input.guest.name,
          email: input.guest.email,
          phone: input.guest.phone ?? null,
          customerAccountId: null,
          linkAccountId: null,
        };
      } else {
        throw new AppError({
          status: 400,
          code: 'GUEST_DETAILS_REQUIRED',
          title: 'Contact details required',
          detail: 'Log in or enter your name and email to book as a guest.',
          errors: [{ path: 'guest', message: 'Required when not logged in.' }],
        });
      }

      // Step 1: idempotency, per sender so two people's keys never collide.
      const subject = contact.customerAccountId
        ? `customer:${contact.customerAccountId}`
        : `guest:${contact.email}`;
      const requestHash = sha256(JSON.stringify(input));
      const stored = await prisma.idempotencyKey.findUnique({
        where: { key_subject: { key: idempotencyKey, subject } },
      });
      if (stored && stored.expiresAt > now()) {
        if (stored.requestHash !== requestHash) {
          throw new AppError({
            status: 422,
            code: 'IDEMPOTENCY_KEY_REUSED',
            title: 'Idempotency key reused',
            detail: 'This Idempotency-Key was already used for a different request.',
          });
        }
        // The access token is never stored with the response: a retry gets a fresh one.
        const replay = stored.responseBody as unknown as Omit<BookingCreated, 'accessToken'>;
        return {
          ...replay,
          accessToken: await reissueAccessToken(input.tenantSlug, replay.booking.id),
        };
      }

      const actor: AuditActor = {
        type: 'customer',
        id: contact.customerAccountId,
        label: contact.customerAccountId ? contact.name : `${contact.name} (guest)`,
        ip,
      };
      let held: Awaited<ReturnType<typeof createHoldAndInvoice>>;
      try {
        held = await createHoldAndInvoice(input, contact, actor);
      } catch (error) {
        // Step 6: the exclusion constraint is the last line of defence.
        if (isOverlapViolation(error)) throw slotError('SLOT_TAKEN');
        throw error;
      }

      // Step 7: Checkout after the commit; if the provider fails, release the slot at once.
      const { tenant, booking, invoice, branch, accessToken } = held;
      let checkout;
      try {
        checkout = await payments.createCheckout({
          metadata: { tenantId: tenant.id, bookingId: booking.id, invoiceId: invoice.id },
          amountCents: booking.priceCents,
          description: `${booking.serviceName} at ${tenant.name} (${branch.name})`,
          customerEmail: contact.email,
          expiresAt: new Date(now().getTime() + BOOKING_POLICY.checkoutMs),
          successUrl: `${portalUrl}/bookings/${booking.id}/confirmation`,
          cancelUrl: `${portalUrl}/bookings/${booking.id}/pay`,
        });
      } catch (error) {
        await inTenant(tenant.id, (tx) =>
          expireBooking(tx, booking, 'Payment provider unavailable', actor, now()),
        );
        if (error instanceof PaymentProviderUnavailableError) {
          throw new AppError({
            status: 503,
            code: 'PAYMENT_PROVIDER_UNAVAILABLE',
            title: 'Payments unavailable',
            detail:
              'Payments are not available right now, so the time was released. Please try again shortly.',
          });
        }
        throw error;
      }

      const response = await inTenant(tenant.id, async (tx) => {
        await tx.payment.create({
          data: {
            tenantId: tenant.id,
            invoiceId: invoice.id,
            provider: payments.name,
            checkoutSessionId: checkout.sessionId,
            checkoutUrl: checkout.url,
            amountCents: booking.priceCents,
            expiresAt: new Date(now().getTime() + BOOKING_POLICY.checkoutMs),
          },
        });
        return {
          booking: await portalBooking(tx, booking.id, now(), view),
          checkoutUrl: checkout.url,
        };
      });

      await prisma.idempotencyKey
        .create({
          data: {
            key: idempotencyKey,
            subject,
            requestHash,
            responseStatus: 201,
            responseBody: response as unknown as Prisma.InputJsonValue, // without the token
            createdAt: now(),
            expiresAt: new Date(now().getTime() + BOOKING_POLICY.idempotencyTtlMs),
          },
        })
        .catch(() => undefined); // a concurrent retry stored it first: same response
      return { ...response, accessToken };
    },

    /**
     * FSD 6.4. The event ID is recorded in the same transaction as its effects: a duplicate
     * delivery finds the ID and changes nothing, and a failed attempt leaves no trace, so
     * the provider's retry processes it again.
     */
    async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
      let event: PaymentEvent;
      try {
        event = payments.parseWebhook(rawBody, signature);
      } catch (error) {
        if (error instanceof WebhookSignatureError) {
          throw new AppError({
            status: 400,
            code: 'VALIDATION_FAILED',
            title: 'Invalid signature',
            detail: error.message,
          });
        }
        throw error;
      }
      if (event.kind === 'ignored') return;
      const actor: AuditActor = {
        type: 'system',
        id: null,
        label: `Payment provider (${payments.name})`,
      };

      await inTenant(event.metadata.tenantId, async (tx) => {
        const recorded = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO stripe_events (id, type, received_at)
          VALUES (${event.id}, ${event.kind}, ${now()})
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        if (recorded.length === 0) return; // processed before

        const payment = await tx.payment.findUnique({
          where: { checkoutSessionId: event.sessionId },
        });
        const booking = await tx.booking.findUnique({ where: { id: event.metadata.bookingId } });
        if (!payment || !booking) return;

        if (event.kind === 'checkout_completed' && event.paid) {
          if (booking.status === 'pending_payment') {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'succeeded', paymentIntentId: event.paymentIntentId },
            });
            await tx.invoice.update({
              where: { id: payment.invoiceId },
              data: { status: 'paid', paidAt: now() },
            });
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: 'confirmed', holdExpiresAt: null, version: { increment: 1 } },
            });
            await recordAudit(tx, actor, {
              tenantId: booking.tenantId,
              branchId: booking.branchId,
              action: 'booking.confirmed',
              entityType: 'booking',
              entityId: booking.id,
              before: { status: 'pending_payment' },
              after: { status: 'confirmed' },
            });
            await queueConfirmation(tx, booking.id, emailContext, now());
          } else {
            // Safety net (FSD 6.4): money arrived for a booking that no longer waits for it.
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'needs_attention', paymentIntentId: event.paymentIntentId },
            });
            await recordAudit(tx, actor, {
              tenantId: booking.tenantId,
              branchId: booking.branchId,
              action: 'payment.needs_attention',
              entityType: 'payment',
              entityId: payment.id,
              after: { bookingStatus: booking.status },
              reason: 'Payment received for a booking that is no longer pending payment',
            });
            await queueNeedsAttention(tx, booking.tenantId, booking.id);
          }
        } else if (event.kind === 'checkout_expired') {
          await tx.payment.updateMany({
            where: { id: payment.id, status: 'pending' },
            data: { status: 'expired' },
          });
          await expireBooking(tx, booking, 'Payment hold expired', actor, now());
        }
        await tx.stripeEvent.update({ where: { id: event.id }, data: { processedAt: now() } });
      });
    },

    /** Demo provider only: the payment page's details. */
    async demoCheckout(sessionId: string, tenantId: string) {
      demoOnly();
      return inTenant(tenantId, async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { checkoutSessionId: sessionId },
          include: {
            invoice: { include: { booking: { include: { tenant: true, branch: true } } } },
          },
        });
        if (!payment) throw notFound('Checkout session');
        const booking = payment.invoice.booking;
        return {
          businessName: booking.tenant.name,
          description: `${booking.serviceName} (${booking.branch.name})`,
          amountCents: payment.amountCents,
          status: payment.status,
          expiresAt: payment.expiresAt.toISOString(),
          bookingId: booking.id,
        };
      });
    },

    /**
     * Demo provider only: the payment page reports the outcome; the API emits the signed
     * webhook event and processes it through `handleWebhook`, exactly like a Stripe event.
     */
    async completeDemoCheckout(sessionId: string, tenantId: string, outcome: 'paid' | 'expired') {
      const demo = demoOnly();
      const payment = await inTenant(tenantId, (tx) =>
        tx.payment.findUnique({
          where: { checkoutSessionId: sessionId },
          include: { invoice: true },
        }),
      );
      if (!payment) throw notFound('Checkout session');
      const { rawBody, signature } = demo.signedEvent(outcome, sessionId, {
        tenantId,
        bookingId: payment.invoice.bookingId,
        invoiceId: payment.invoiceId,
      });
      await service.handleWebhook(rawBody, signature);
    },
  };
  return service;

  function demoOnly(): DemoPaymentProvider {
    if (payments.name !== 'demo') throw notFound('Checkout session');
    return payments as DemoPaymentProvider;
  }

  async function queueNeedsAttention(tx: Tx, tenantId: string, bookingId: string) {
    const owner = await tx.membership.findFirst({
      where: { tenantId, role: 'owner', status: 'active' },
      include: { teamAccount: true },
    });
    if (!owner) return;
    await tx.emailMessage.createMany({
      data: [
        {
          tenantId,
          toEmail: owner.teamAccount.email,
          template: 'console.payment_needs_attention',
          payload: { name: owner.teamAccount.name, bookingId },
        },
      ],
    });
  }
}

export type BookingService = ReturnType<typeof createBookingService>;
