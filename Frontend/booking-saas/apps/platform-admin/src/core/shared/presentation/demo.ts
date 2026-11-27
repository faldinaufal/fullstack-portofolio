// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * The public demo (FSD 10.3). Build-time settings: the live site is built with
 * NEXT_PUBLIC_DEMO_MODE=true and the same email domain and password as the seed.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const DEMO_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_DEMO_EMAIL_DOMAIN || 'veloria.test';
export const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'tempora-demo-2026';

/** This app's demo accounts (seed: modules/demo/world.ts), shown on the login page. */
export const DEMO_ACCOUNTS = [
  { role: 'Platform admin', local: 'admin', scope: 'The whole platform' },
].map(({ local, ...account }) => ({ ...account, email: `${local}@${DEMO_EMAIL_DOMAIN}` }));

/** The Portal's public demo inbox, where the emailed codes of demo accounts arrive. */
export const DEMO_INBOX_URL = `${process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3000'}/demo-inbox`;

/** Whether a (masked) address belongs to the demo domain, so its code is in the demo inbox. */
export const isDemoAddress = (address: string) =>
  DEMO_MODE && address.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
