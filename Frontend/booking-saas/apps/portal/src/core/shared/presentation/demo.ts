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
  { role: 'Customer', local: 'customer', scope: 'Bookings at both demo businesses' },
].map(({ local, ...account }) => ({ ...account, email: `${local}@${DEMO_EMAIL_DOMAIN}` }));

/** Shortcuts on the demo inbox: every demo account, whichever app it logs in to. */
export const DEMO_INBOX_SHORTCUTS = [
  { role: 'Owner', local: 'owner' },
  { role: 'Manager', local: 'manager' },
  { role: 'Staff', local: 'therapist' },
  { role: 'Customer', local: 'customer' },
  { role: 'Platform admin', local: 'admin' },
].map(({ local, role }) => ({ role, email: `${local}@${DEMO_EMAIL_DOMAIN}` }));
