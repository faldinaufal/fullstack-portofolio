// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import { installCsrfProtection } from '../../lib/csrf.js';
import { CONSOLE_COOKIES, cookieOptions, type CookieSettings } from './cookies.js';
import type { ConsoleAuth, ConsoleAuthService } from './service.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the Console guard on authenticated routes. */
    consoleAuth: ConsoleAuth | null;
  }
}

export type ConsoleRole = ConsoleAuth['role'];

/** What every authenticated Console handler knows about the caller and the request. */
export interface ConsoleActor extends ConsoleAuth {
  requestId: string;
  ip: string;
}

export interface ConsoleGuard {
  /**
   * preHandler: 401 without a live session; 403 when the role is not listed
   * (FSD 1.3 steps 1–2). No roles = any Console role.
   */
  require(...roles: ConsoleRole[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /** The caller of a route protected by `require`. */
  actor(request: FastifyRequest): ConsoleActor;
}

/**
 * FSD 6.9: while the business is suspended, the Console is read only. Logging out and
 * switching to another business still work (their routes do not use `require`, or are
 * listed here).
 */
const STILL_ALLOWED = ['/v1/console/me/active-membership'];
function isWrite(request: FastifyRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  const path = request.url.split('?')[0] ?? '';
  return !path.startsWith('/v1/console/auth/') && !STILL_ALLOWED.includes(path);
}

/**
 * Installs the protections shared by every `/v1/console/*` route (CSRF, see lib/csrf.ts)
 * and returns the guard the feature modules use.
 */
export function installConsoleGuard(
  app: FastifyInstance,
  { service, cookies }: { service: ConsoleAuthService; cookies: CookieSettings },
): ConsoleGuard {
  app.decorateRequest('consoleAuth', null);

  installCsrfProtection(app, CONSOLE_COOKIES.csrf, '/v1/console/auth/csrf');

  return {
    require:
      (...roles) =>
      async (request, reply) => {
        const token = request.cookies[CONSOLE_COOKIES.session];
        const auth = token ? await service.authenticate(token) : null;
        if (!auth) {
          reply.clearCookie(CONSOLE_COOKIES.session, cookieOptions(cookies));
          throw new AppError({
            status: 401,
            code: 'UNAUTHENTICATED',
            title: 'Authentication required',
            detail: 'Log in to continue.',
          });
        }
        if (auth.tenantSuspended && isWrite(request)) {
          throw new AppError({
            status: 423,
            code: 'TENANT_SUSPENDED',
            title: 'Business suspended',
            detail: 'This business is suspended, so the Console is read only. Contact Tempora.',
          });
        }
        if (roles.length > 0 && !roles.includes(auth.role)) {
          throw new AppError({
            status: 403,
            code: 'FORBIDDEN',
            title: 'Not allowed',
            detail: 'Your role cannot do this.',
          });
        }
        request.consoleAuth = auth;
      },

    actor(request) {
      if (!request.consoleAuth) throw new Error('Console route used without guard.require()');
      return { ...request.consoleAuth, requestId: request.id, ip: request.ip };
    },
  };
}
