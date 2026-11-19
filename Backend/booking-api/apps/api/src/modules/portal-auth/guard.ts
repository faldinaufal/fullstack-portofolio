// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import { cookieOptions, type CookieSettings } from '../../lib/cookies.js';
import { installCsrfProtection } from '../../lib/csrf.js';
import type { CustomerAuth, PortalAuthService } from './service.js';

/** Portal cookies: separate names, so a Console session never works here and vice versa. */
export const PORTAL_COOKIES = {
  session: 'tempora_portal_session',
  csrf: 'tempora_portal_csrf',
} as const;

declare module 'fastify' {
  interface FastifyRequest {
    customerAuth: CustomerAuth | null;
  }
}

export interface PortalGuard {
  /** preHandler: 401 without a live Portal session. */
  require: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /** preHandler: attaches the customer when logged in, lets guests through (guest booking). */
  optional: (request: FastifyRequest) => Promise<void>;
  /** The customer of a route protected by `require` (or null after `optional`). */
  customer(request: FastifyRequest): CustomerAuth | null;
}

/** CSRF protection and session checks shared by every `/v1/portal/*` route. */
export function installPortalGuard(
  app: FastifyInstance,
  { service, cookies }: { service: PortalAuthService; cookies: CookieSettings },
): PortalGuard {
  app.decorateRequest('customerAuth', null);
  installCsrfProtection(app, PORTAL_COOKIES.csrf, '/v1/portal/auth/csrf');

  const resolve = async (request: FastifyRequest) => {
    const token = request.cookies[PORTAL_COOKIES.session];
    request.customerAuth = token ? await service.authenticate(token) : null;
  };

  return {
    async require(request, reply) {
      await resolve(request);
      if (!request.customerAuth) {
        reply.clearCookie(PORTAL_COOKIES.session, cookieOptions(cookies));
        throw new AppError({
          status: 401,
          code: 'UNAUTHENTICATED',
          title: 'Authentication required',
          detail: 'Log in to continue.',
        });
      }
    },
    optional: resolve,
    customer: (request) => request.customerAuth,
  };
}
