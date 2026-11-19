// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * The payment provider as the booking code sees it. Two implementations: Stripe Checkout
 * (test mode, FSD 0.2) and a demo provider used when no Stripe keys are configured, so the
 * whole flow works locally and in CI. Both deliver signed webhook events that run through
 * the same handler.
 */

/** Identifies the booking a Checkout session pays for (sent to the provider as metadata). */
export interface PaymentMetadata {
  tenantId: string;
  bookingId: string;
  invoiceId: string;
}

export interface CreateCheckoutInput {
  metadata: PaymentMetadata;
  amountCents: number;
  /** Shown on the payment page, e.g. "Deep Tissue Massage, 20 Nov 10:00". */
  description: string;
  customerEmail: string;
  /** The session must be expired by the provider at this time (FSD 6.3: 30 minutes). */
  expiresAt: Date;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

/** A verified webhook event, reduced to what the booking flow needs (FSD 6.4). */
export type PaymentEvent =
  | {
      id: string;
      kind: 'checkout_completed';
      sessionId: string;
      paymentIntentId: string | null;
      /** False for delayed payment methods that have not settled yet. */
      paid: boolean;
      metadata: PaymentMetadata;
    }
  | { id: string; kind: 'checkout_expired'; sessionId: string; metadata: PaymentMetadata }
  | { id: string; kind: 'ignored'; type: string };

export interface PaymentProvider {
  readonly name: 'stripe' | 'demo';
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /**
   * Verifies the signature of a webhook request and parses it. Throws
   * `WebhookSignatureError` when the signature is missing, wrong or too old.
   */
  parseWebhook(rawBody: string, signature: string | undefined): PaymentEvent;
  /**
   * Closes an open Checkout session so it can no longer be paid (cancelled booking, FSD 6.7).
   * Best effort: a payment that still arrives is caught by the safety net (FSD 6.4).
   */
  expireCheckout(sessionId: string): Promise<void>;
}

export class WebhookSignatureError extends Error {
  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/** The provider could not be reached or refused the request (FSD 6.3 step 7). */
export class PaymentProviderUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Payment provider unavailable', { cause });
    this.name = 'PaymentProviderUnavailableError';
  }
}

export function readMetadata(
  value: Record<string, string | undefined> | null | undefined,
): PaymentMetadata | null {
  const tenantId = value?.tenantId;
  const bookingId = value?.bookingId;
  const invoiceId = value?.invoiceId;
  return tenantId && bookingId && invoiceId ? { tenantId, bookingId, invoiceId } : null;
}
