// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Separate cookie names per app, so a Portal session can never be used on Console routes. */
export const CONSOLE_COOKIES = {
  session: 'tempora_console_session',
  trustedDevice: 'tempora_console_device',
  csrf: 'tempora_console_csrf',
} as const;

export { cookieOptions, type CookieSettings } from '../../lib/cookies.js';
