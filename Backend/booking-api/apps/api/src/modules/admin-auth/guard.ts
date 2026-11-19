// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import { cookieOptions, type CookieSettings } from '../../lib/cookies.js';
import { installCsrfProtection } from '../../lib/csrf.js';
import type { AdminAuth, AdminAuthService } from './service.js';

/** Own cookie names, so a Console or Portal session never works here (FSD 1.3 app gate). */
export const ADMIN_COOKIES = {
  session: 'tempora_admin_session',
  csrf: 'tempora_admin_csrf',
} as const;

declare module 'fastify' {
  interface FastifyRequest {
    adminAuth: AdminAuth | null;
  }
}

export interface AdminActor extends AdminAuth {
  requestId: string;
  ip: string;
}

export interface AdminGuard {
  /** preHandler: 401 without a live Platform Admin session. */
  require: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /** preHandler for sensitive actions: a session plus a step-up in the last 10 minutes. */
  requireStepUp: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  actor(request: FastifyRequest): AdminActor;
}

/** CSRF protection and session checks shared by every `/v1/admin/*` route. */
export function installAdminGuard(
  app: FastifyInstance,
  { service, cookies }: { service: AdminAuthService; cookies: CookieSettings },
): AdminGuard {
  app.decorateRequest('adminAuth', null);
  installCsrfProtection(app, ADMIN_COOKIES.csrf, '/v1/admin/auth/csrf');

  async function require(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies[ADMIN_COOKIES.session];
    const auth = token ? await service.authenticate(token) : null;
    if (!auth) {
      reply.clearCookie(ADMIN_COOKIES.session, cookieOptions(cookies));
      throw new AppError({
        status: 401,
        code: 'UNAUTHENTICATED',
        title: 'Authentication required',
        detail: 'Log in to continue.',
      });
    }
    request.adminAuth = auth;
  }

  return {
    require,
    async requireStepUp(request, reply) {
      await require(request, reply);
      service.assertFreshStepUp(request.adminAuth!);
    },
    actor(request) {
      if (!request.adminAuth) throw new Error('Admin route used without guard.require');
      return { ...request.adminAuth, requestId: request.id, ip: request.ip };
    },
  };
}
