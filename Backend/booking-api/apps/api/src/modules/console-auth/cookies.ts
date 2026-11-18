// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { CookieSerializeOptions } from '@fastify/cookie';

/** Separate cookie names per app, so a Portal session can never be used on Console routes. */
export const CONSOLE_COOKIES = {
  session: 'tempora_console_session',
  trustedDevice: 'tempora_console_device',
  csrf: 'tempora_console_csrf',
} as const;

export interface CookieSettings {
  /** HTTPS only. Off for plain-http local development. */
  secure: boolean;
  /** Parent domain shared by the apps and the API (FSD 10.4 `COOKIE_DOMAIN`). */
  domain: string | undefined;
}

/**
 * - `httpOnly`: JavaScript cannot read the token, which limits the damage of an XSS bug.
 * - `sameSite: 'lax'`: other sites cannot make the browser send it with their requests
 *   (state-changing requests additionally need the CSRF header).
 */
export function cookieOptions(settings: CookieSettings, expires?: Date): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: 'lax',
    path: '/',
    ...(settings.domain !== undefined && { domain: settings.domain }),
    ...(expires !== undefined && { expires }),
  };
}
