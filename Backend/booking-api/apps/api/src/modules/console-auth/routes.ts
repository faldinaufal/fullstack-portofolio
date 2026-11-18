// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AcceptedResponseSchema,
  AuthenticatedSchema,
  ConsoleLoginRequestSchema,
  ConsoleLoginResponseSchema,
  ConsoleMeResponseSchema,
  ConsoleSignupRequestSchema,
  CsrfResponseSchema,
  ForgotPasswordRequestSchema,
  OtpChallengeSchema,
  ProblemDetailsSchema,
  ResendOtpRequestSchema,
  ResetPasswordRequestSchema,
  SwitchMembershipRequestSchema,
  VerifyOtpRequestSchema,
} from '@tempora/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { generateToken } from '../../lib/tokens.js';
import { CONSOLE_COOKIES, cookieOptions, type CookieSettings } from './cookies.js';
import type { ConsoleGuard } from './guard.js';
import { addMs, CONSOLE_AUTH_POLICY } from './policy.js';
import type { ConsoleAuthService, IssuedToken, RequestMeta } from './service.js';

export interface ConsoleAuthRoutesOptions {
  service: ConsoleAuthService;
  cookies: CookieSettings;
  guard: ConsoleGuard;
}
const NoContent = z.null().describe('No content');
const problems = (...statuses: number[]) =>
  Object.fromEntries(statuses.map((status) => [status, ProblemDetailsSchema]));

function meta(request: FastifyRequest): RequestMeta {
  return { ip: request.ip, userAgent: request.headers['user-agent'] };
}

/** `/v1/console/auth/*` and `/v1/console/me`: sign-up, login with email code, sessions. */
export const consoleAuthRoutes: FastifyPluginAsyncZod<ConsoleAuthRoutesOptions> = async (
  app,
  { service, cookies, guard },
) => {
  const setSession = (reply: FastifyReply, session: IssuedToken) =>
    reply.setCookie(
      CONSOLE_COOKIES.session,
      session.token,
      cookieOptions(cookies, session.expiresAt),
    );
  const clearSession = (reply: FastifyReply) =>
    reply.clearCookie(CONSOLE_COOKIES.session, cookieOptions(cookies));

  const requireConsoleSession = guard.require();
  const authOf = (request: FastifyRequest) => guard.actor(request);

  app.get(
    '/auth/csrf',
    {
      schema: {
        tags: ['console-auth'],
        summary: 'Issue a CSRF token (send it as X-CSRF-Token on POST/PUT/PATCH/DELETE)',
        response: { 200: CsrfResponseSchema },
      },
    },
    async (_request, reply) => {
      const token = generateToken();
      const expires = addMs(new Date(), CONSOLE_AUTH_POLICY.sessionMaxMs);
      reply.setCookie(CONSOLE_COOKIES.csrf, token, cookieOptions(cookies, expires));
      return { csrfToken: token };
    },
  );

  app.post(
    '/auth/signup',
    {
      schema: {
        tags: ['console-auth'],
        summary: 'Create a team account, a business and its owner membership; emails a code',
        body: ConsoleSignupRequestSchema,
        response: { 201: OtpChallengeSchema, ...problems(400, 403, 409, 429) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.signup(request.body, meta(request))),
  );

  app.post(
    '/auth/login',
    {
      schema: {
        tags: ['console-auth'],
        summary: 'Check email and password; a trusted device gets a session, others a code',
        body: ConsoleLoginRequestSchema,
        response: { 200: ConsoleLoginResponseSchema, ...problems(401, 403, 429) },
      },
    },
    async (request, reply) => {
      const result = await service.login(
        request.body,
        meta(request),
        request.cookies[CONSOLE_COOKIES.trustedDevice],
      );
      if (result.session) setSession(reply, result.session);
      return result.response;
    },
  );

  app.post(
    '/auth/verify-otp',
    {
      schema: {
        tags: ['console-auth'],
        summary: 'Verify the emailed code and start the session',
        body: VerifyOtpRequestSchema,
        response: { 200: AuthenticatedSchema, ...problems(401, 403, 410) },
      },
    },
    async (request, reply) => {
      const result = await service.verifyOtp(request.body, meta(request));
      setSession(reply, result.session);
      if (result.device) {
        reply.setCookie(
          CONSOLE_COOKIES.trustedDevice,
          result.device.token,
          cookieOptions(cookies, result.device.expiresAt),
        );
      }
      return { status: 'authenticated' as const };
    },
  );

  app.post(
    '/auth/resend-otp',
    {
      schema: {
        tags: ['console-auth'],
        summary: 'Email a new code for the same login',
        body: ResendOtpRequestSchema,
        response: { 200: OtpChallengeSchema, ...problems(410, 429) },
      },
    },
    async (request) => service.resendOtp(request.body),
  );

  app.post(
    '/auth/logout',
    {
      preHandler: requireConsoleSession,
      schema: {
        tags: ['console-auth'],
        summary: 'End this session',
        response: { 204: NoContent, ...problems(401) },
      },
    },
    async (request, reply) => {
      await service.logout(authOf(request));
      clearSession(reply);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/auth/logout-all',
    {
      preHandler: requireConsoleSession,
      schema: {
        tags: ['console-auth'],
        summary: 'End every session of this account',
        response: { 204: NoContent, ...problems(401) },
      },
    },
    async (request, reply) => {
      await service.logoutAll(authOf(request));
      clearSession(reply);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/auth/forgot-password',
    {
      schema: {
        tags: ['console-auth'],
        summary: 'Email a password-reset link (same answer whether or not the email exists)',
        body: ForgotPasswordRequestSchema,
        response: { 202: AcceptedResponseSchema, ...problems(429) },
      },
    },
    async (request, reply) => {
      await service.forgotPassword(request.body, meta(request));
      return reply.status(202).send({ status: 'accepted' });
    },
  );

  app.post(
    '/auth/reset-password',
    {
      schema: {
        tags: ['console-auth'],
        summary: 'Set a new password; ends every session and trusted device',
        body: ResetPasswordRequestSchema,
        response: { 200: AcceptedResponseSchema, ...problems(400, 410) },
      },
    },
    async (request) => {
      await service.resetPassword(request.body);
      return { status: 'accepted' as const };
    },
  );

  app.post(
    '/me/active-membership',
    {
      preHandler: requireConsoleSession,
      schema: {
        tags: ['console-auth'],
        summary: 'Switch to another business of this account (new session)',
        body: SwitchMembershipRequestSchema,
        response: { 200: AuthenticatedSchema, ...problems(401, 404) },
      },
    },
    async (request, reply) => {
      const session = await service.switchMembership(
        authOf(request),
        request.body.membershipId,
        meta(request),
      );
      setSession(reply, session);
      return { status: 'authenticated' as const };
    },
  );

  app.get(
    '/me',
    {
      preHandler: requireConsoleSession,
      schema: {
        tags: ['console-auth'],
        summary: 'Signed-in account, active membership and all memberships',
        response: { 200: ConsoleMeResponseSchema, ...problems(401) },
      },
    },
    async (request) => service.getMe(authOf(request)),
  );
};
