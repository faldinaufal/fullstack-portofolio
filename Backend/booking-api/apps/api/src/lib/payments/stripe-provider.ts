// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import Stripe from 'stripe';
import {
  PaymentProviderUnavailableError,
  readMetadata,
  WebhookSignatureError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentProvider,
} from './provider.js';

/**
 * Stripe Checkout in test mode (FSD 0.2): a hosted payment page, so card data never touches
 * Tempora. Booking IDs travel as metadata and come back in the webhook.
 */
export function createStripePaymentProvider({
  secretKey,
  webhookSecret,
}: {
  secretKey: string;
  webhookSecret: string;
}): PaymentProvider {
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 1, timeout: 10_000 });

  return {
    name: 'stripe',

    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: input.customerEmail,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'usd',
                unit_amount: input.amountCents,
                product_data: { name: input.description },
              },
            },
          ],
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: { ...input.metadata },
          payment_intent_data: { metadata: { ...input.metadata } },
        });
        if (!session.url) throw new Error('Stripe returned no Checkout URL');
        return { sessionId: session.id, url: session.url };
      } catch (error) {
        throw new PaymentProviderUnavailableError(error);
      }
    },

    parseWebhook(rawBody: string, signature: string | undefined): PaymentEvent {
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature ?? '', webhookSecret);
      } catch {
        throw new WebhookSignatureError();
      }
      if (
        event.type !== 'checkout.session.completed' &&
        event.type !== 'checkout.session.expired'
      ) {
        return { id: event.id, kind: 'ignored', type: event.type };
      }
      const session = event.data.object;
      const metadata = readMetadata(session.metadata);
      if (!metadata) return { id: event.id, kind: 'ignored', type: event.type };
      if (event.type === 'checkout.session.expired') {
        return { id: event.id, kind: 'checkout_expired', sessionId: session.id, metadata };
      }
      return {
        id: event.id,
        kind: 'checkout_completed',
        sessionId: session.id,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        paid: session.payment_status === 'paid',
        metadata,
      };
    },
  };
}
