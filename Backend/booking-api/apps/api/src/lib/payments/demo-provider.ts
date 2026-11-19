// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createHmac, randomBytes } from 'node:crypto';
import { safeEqual } from '../tokens.js';
import {
  readMetadata,
  WebhookSignatureError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentMetadata,
  type PaymentProvider,
} from './provider.js';

/** Signatures older than this are rejected, like Stripe's default tolerance. */
const TOLERANCE_SECONDS = 300;

interface DemoEventBody {
  id: string;
  type: 'checkout.session.completed' | 'checkout.session.expired';
  data: { sessionId: string; paid: boolean; metadata: PaymentMetadata };
}

export interface DemoPaymentProvider extends PaymentProvider {
  /**
   * Builds the signed webhook request the demo checkout page triggers: the same shape the
   * real handler receives from Stripe (raw body + `t=…,v1=…` signature header).
   */
  signedEvent(
    outcome: 'paid' | 'expired',
    sessionId: string,
    metadata: PaymentMetadata,
  ): { rawBody: string; signature: string };
}

/**
 * Payment provider for local development, CI and the public demo without Stripe keys.
 * Checkout opens the Portal's demo payment page; its "Pay" button makes the API emit a
 * webhook signed with HMAC-SHA256 in Stripe's format, which goes through signature
 * verification and the same event handler as real Stripe events.
 */
export function createDemoPaymentProvider({
  secret,
  portalUrl,
  now = () => new Date(),
}: {
  secret: string;
  portalUrl: string;
  now?: () => Date;
}): DemoPaymentProvider {
  const sign = (timestamp: number, body: string) =>
    createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

  return {
    name: 'demo',

    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      const sessionId = `demo_cs_${randomBytes(12).toString('hex')}`;
      // Nothing is kept in memory (several API containers may run): the page sends the
      // tenant back, and the API finds the payment by session ID in that tenant.
      const url = new URL(`/demo-checkout/${sessionId}`, portalUrl);
      url.searchParams.set('tenant', input.metadata.tenantId);
      url.searchParams.set('booking', input.metadata.bookingId);
      return { sessionId, url: url.toString() };
    },

    // The demo page reads the payment's status from the API, so there is nothing to close.
    async expireCheckout() {},

    signedEvent(outcome, sessionId, metadata) {
      const body: DemoEventBody = {
        id: `demo_evt_${randomBytes(12).toString('hex')}`,
        type: outcome === 'paid' ? 'checkout.session.completed' : 'checkout.session.expired',
        data: { sessionId, paid: outcome === 'paid', metadata },
      };
      const rawBody = JSON.stringify(body);
      const timestamp = Math.floor(now().getTime() / 1000);
      return { rawBody, signature: `t=${timestamp},v1=${sign(timestamp, rawBody)}` };
    },

    parseWebhook(rawBody: string, signature: string | undefined): PaymentEvent {
      const parts = Object.fromEntries(
        (signature ?? '').split(',').map((part) => part.split('=') as [string, string]),
      );
      const timestamp = Number(parts.t);
      if (!parts.v1 || !Number.isFinite(timestamp)) throw new WebhookSignatureError();
      if (Math.abs(now().getTime() / 1000 - timestamp) > TOLERANCE_SECONDS) {
        throw new WebhookSignatureError('Webhook signature is too old');
      }
      if (!safeEqual(parts.v1, sign(timestamp, rawBody))) throw new WebhookSignatureError();

      const event = JSON.parse(rawBody) as DemoEventBody;
      const metadata = readMetadata(event.data.metadata as unknown as Record<string, string>);
      if (!metadata) return { id: event.id, kind: 'ignored', type: event.type };
      return event.type === 'checkout.session.completed'
        ? {
            id: event.id,
            kind: 'checkout_completed',
            sessionId: event.data.sessionId,
            paymentIntentId: null,
            paid: event.data.paid,
            metadata,
          }
        : { id: event.id, kind: 'checkout_expired', sessionId: event.data.sessionId, metadata };
    },
  };
}
