// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * The demo payment page, used when the API runs without Stripe keys (FSD 0.2). It stands in
 * for Stripe's hosted Checkout: the API turns the choice into a signed webhook event.
 */
export interface DemoCheckout {
  businessName: string;
  description: string;
  amountCents: number;
  /** `pending` while it can still be paid. */
  status: string;
  expiresAt: Date;
  reservationId: string;
}

export interface DemoCheckoutRepository {
  get(sessionId: string, tenantId: string): Promise<DemoCheckout>;
  complete(sessionId: string, tenantId: string, outcome: 'paid' | 'expired'): Promise<void>;
}
