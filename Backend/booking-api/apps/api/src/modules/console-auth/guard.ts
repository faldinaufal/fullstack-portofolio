// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import { safeEqual } from '../../lib/tokens.js';
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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Installs the protections shared by every `/v1/console/*` route and returns the guard
 * the feature modules use.
 *
 * CSRF (FSD 5.1): double-submit pattern. The token sits in an httpOnly cookie and must be
 * repeated in the `X-CSRF-Token` header of every state-changing request. Another site can
 * make the browser send the cookie, but it cannot read the token to put it in the header.
 */
export function installConsoleGuard(
  app: FastifyInstance,
  { service, cookies }: { service: ConsoleAuthService; cookies: CookieSettings },
): ConsoleGuard {
  app.decorateRequest('consoleAuth', null);

  app.addHook('onRequest', async (request) => {
    if (SAFE_METHODS.has(request.method)) return;
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies[CONSOLE_COOKIES.csrf];
    if (typeof header !== 'string' || !cookie || !safeEqual(header, cookie)) {
      throw new AppError({
        status: 403,
        code: 'CSRF_INVALID',
        title: 'Missing or invalid CSRF token',
        detail: 'Fetch a token from GET /v1/console/auth/csrf and send it in X-CSRF-Token.',
      });
    }
  });

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
