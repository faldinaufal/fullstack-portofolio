// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { createDemoPaymentProvider } from './demo-provider.js';
import { WebhookSignatureError } from './provider.js';

const metadata = {
  tenantId: 'fa1d0000-0000-4000-8000-000000000001',
  bookingId: 'fa1d0000-0000-4000-8000-000000000002',
  invoiceId: 'fa1d0000-0000-4000-8000-000000000003',
};

function provider(at = new Date('2026-11-23T15:00:00Z'), secret = 'demo-secret-4217') {
  return createDemoPaymentProvider({ secret, portalUrl: 'http://localhost:3000', now: () => at });
}

describe('demo payment provider', () => {
  it('points Checkout at the Portal demo page with the tenant and booking', async () => {
    const session = await provider().createCheckout({
      amountCents: 4217,
      description: 'Deep Tissue Massage',
      customerEmail: 'omar@veloria.test',
      expiresAt: new Date('2026-11-23T15:30:00Z'),
      successUrl: 'http://localhost:3000/ok',
      cancelUrl: 'http://localhost:3000/cancel',
      metadata,
    });
    expect(session.sessionId).toMatch(/^demo_cs_[0-9a-f]{24}$/);
    const url = new URL(session.url);
    expect(url.pathname).toBe(`/demo-checkout/${session.sessionId}`);
    expect(url.searchParams.get('tenant')).toBe(metadata.tenantId);
    expect(url.searchParams.get('booking')).toBe(metadata.bookingId);
  });

  it('accepts its own signed events', () => {
    const p = provider();
    const paid = p.signedEvent('paid', 'demo_cs_1', metadata);
    expect(p.parseWebhook(paid.rawBody, paid.signature)).toMatchObject({
      kind: 'checkout_completed',
      sessionId: 'demo_cs_1',
      paid: true,
      metadata,
    });
    const expired = p.signedEvent('expired', 'demo_cs_1', metadata);
    expect(p.parseWebhook(expired.rawBody, expired.signature)).toMatchObject({
      kind: 'checkout_expired',
    });
  });

  it('rejects a changed body, another secret, a missing header and old signatures', () => {
    const p = provider();
    const event = p.signedEvent('paid', 'demo_cs_1', metadata);
    expect(() => p.parseWebhook(event.rawBody.replace('true', 'false'), event.signature)).toThrow(
      WebhookSignatureError,
    );
    expect(() => provider(undefined, 'other').parseWebhook(event.rawBody, event.signature)).toThrow(
      WebhookSignatureError,
    );
    expect(() => p.parseWebhook(event.rawBody, undefined)).toThrow(WebhookSignatureError);
    const later = provider(new Date('2026-11-23T15:05:01Z'));
    expect(() => later.parseWebhook(event.rawBody, event.signature)).toThrow(/too old/);
  });
});
