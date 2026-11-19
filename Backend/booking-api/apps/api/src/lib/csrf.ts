// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { FastifyInstance, FastifyReply } from 'fastify';
import { cookieOptions, type CookieSettings } from './cookies.js';
import { AppError } from './app-error.js';
import { generateToken, safeEqual } from './tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60_000;

/**
 * CSRF protection for one route group (FSD 5.1), double-submit pattern: the token sits in an
 * httpOnly cookie and must be repeated in the `X-CSRF-Token` header of every state-changing
 * request. Another site can make the browser send the cookie, but it cannot read the token
 * to put it in the header. Each app has its own cookie, so tokens never cross apps.
 */
export function installCsrfProtection(app: FastifyInstance, cookieName: string, issuePath: string) {
  app.addHook('onRequest', async (request) => {
    if (SAFE_METHODS.has(request.method)) return;
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies[cookieName];
    if (typeof header !== 'string' || !cookie || !safeEqual(header, cookie)) {
      throw new AppError({
        status: 403,
        code: 'CSRF_INVALID',
        title: 'Missing or invalid CSRF token',
        detail: `Fetch a token from GET ${issuePath} and send it in X-CSRF-Token.`,
      });
    }
  });
}

/** Sets a fresh token cookie and returns the token for the response body. */
export function issueCsrfToken(
  reply: FastifyReply,
  cookieName: string,
  settings: CookieSettings,
): string {
  const token = generateToken();
  reply.setCookie(
    cookieName,
    token,
    cookieOptions(settings, new Date(Date.now() + TOKEN_LIFETIME_MS)),
  );
  return token;
}
