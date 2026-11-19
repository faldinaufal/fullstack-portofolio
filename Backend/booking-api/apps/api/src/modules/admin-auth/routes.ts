// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AdminCodeRequestSchema,
  AdminLoginRequestSchema,
  AdminMeSchema,
  CsrfResponseSchema,
  OtpChallengeSchema,
  ResendOtpRequestSchema,
} from '@tempora/contracts';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { cookieOptions, type CookieSettings } from '../../lib/cookies.js';
import { issueCsrfToken } from '../../lib/csrf.js';
import { NoContent, problems } from '../../lib/route-schemas.js';
import { ADMIN_COOKIES, type AdminGuard } from './guard.js';
import type { AdminAuthService, RequestMeta } from './service.js';

const tags = ['admin-auth'];
const meta = (request: FastifyRequest): RequestMeta => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

/** `/v1/admin/auth/*` and `/v1/admin/me` (FSD 5.5). */
export const adminAuthRoutes: FastifyPluginAsyncZod<{
  service: AdminAuthService;
  guard: AdminGuard;
  cookies: CookieSettings;
}> = async (app, { service, guard, cookies }) => {
  app.get(
    '/auth/csrf',
    {
      schema: {
        tags,
        summary: 'Issue a CSRF token (send it as X-CSRF-Token on state-changing requests)',
        response: { 200: CsrfResponseSchema },
      },
    },
    async (_request, reply) => ({ csrfToken: issueCsrfToken(reply, ADMIN_COOKIES.csrf, cookies) }),
  );

  app.post(
    '/auth/login',
    {
      schema: {
        tags,
        summary: 'Check email and password; always answers with a challenge (code by email)',
        body: AdminLoginRequestSchema,
        response: { 200: OtpChallengeSchema, ...problems(400, 429) },
      },
    },
    async (request) => service.login(request.body, meta(request)),
  );

  app.post(
    '/auth/verify-otp',
    {
      schema: {
        tags,
        summary: 'Verify the emailed code and start the session (1 h idle, 8 h maximum)',
        body: AdminCodeRequestSchema,
        response: { 204: NoContent, ...problems(400, 401) },
      },
    },
    async (request, reply) => {
      const session = await service.verifyLogin(request.body, meta(request));
      reply.setCookie(
        ADMIN_COOKIES.session,
        session.token,
        cookieOptions(cookies, session.expiresAt),
      );
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/auth/resend-otp',
    {
      schema: {
        tags,
        summary: 'Send a new code for the same challenge (once a minute)',
        body: ResendOtpRequestSchema,
        response: { 200: OtpChallengeSchema, ...problems(400, 429) },
      },
    },
    async (request) => service.resend(request.body.challengeId),
  );

  app.post(
    '/auth/step-up',
    {
      preHandler: guard.require,
      schema: {
        tags,
        summary: 'Email a code that re-verifies this session before a sensitive action',
        response: { 200: OtpChallengeSchema, ...problems(401) },
      },
    },
    async (request) => service.startStepUp(guard.actor(request), meta(request)),
  );

  app.post(
    '/auth/step-up/verify',
    {
      preHandler: guard.require,
      schema: {
        tags,
        summary: 'Verify the step-up code; sensitive actions work for 10 minutes',
        body: AdminCodeRequestSchema,
        response: { 200: AdminMeSchema, ...problems(400, 401) },
      },
    },
    async (request) => service.verifyStepUp(guard.actor(request), request.body),
  );

  app.post(
    '/auth/logout',
    {
      preHandler: guard.require,
      schema: { tags, summary: 'End this session', response: { 204: NoContent, ...problems(401) } },
    },
    async (request, reply) => {
      await service.logout(guard.actor(request));
      reply.clearCookie(ADMIN_COOKIES.session, cookieOptions(cookies));
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/me',
    {
      preHandler: guard.require,
      schema: {
        tags,
        summary: 'The signed-in platform admin and whether a step-up is still fresh',
        response: { 200: AdminMeSchema, ...problems(401) },
      },
    },
    async (request) => service.me(guard.actor(request)),
  );
};
