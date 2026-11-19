// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AcceptedResponseSchema,
  ChangePasswordRequestSchema,
  CsrfResponseSchema,
  CustomerLoginRequestSchema,
  CustomerProfileSchema,
  CustomerSignupRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  SessionListSchema,
  UpdateCustomerProfileRequestSchema,
  VerifyEmailRequestSchema,
} from '@tempora/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { cookieOptions, type CookieSettings } from '../../lib/cookies.js';
import { issueCsrfToken } from '../../lib/csrf.js';
import { IdParams, NoContent, problems } from '../../lib/route-schemas.js';
import type { IssuedToken, RequestMeta } from '../console-auth/service.js';
import { PORTAL_COOKIES, type PortalGuard } from './guard.js';
import type { CustomerAuth, PortalAuthService } from './service.js';

const tags = ['portal-auth'];
const meta = (request: FastifyRequest): RequestMeta => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

/** `/v1/portal/auth/*` and `/v1/portal/me*` (FSD 5.3). */
export const portalAuthRoutes: FastifyPluginAsyncZod<{
  service: PortalAuthService;
  cookies: CookieSettings;
  guard: PortalGuard;
}> = async (app, { service, cookies, guard }) => {
  const setSession = (reply: FastifyReply, session: IssuedToken) =>
    reply.setCookie(
      PORTAL_COOKIES.session,
      session.token,
      cookieOptions(cookies, session.expiresAt),
    );
  const clearSession = (reply: FastifyReply) =>
    reply.clearCookie(PORTAL_COOKIES.session, cookieOptions(cookies));

  const requireCustomer = guard.require;
  const authOf = (request: FastifyRequest) => guard.customer(request) as CustomerAuth;

  app.get(
    '/auth/csrf',
    { schema: { tags, summary: 'Issue a CSRF token', response: { 200: CsrfResponseSchema } } },
    async (_request, reply) => ({ csrfToken: issueCsrfToken(reply, PORTAL_COOKIES.csrf, cookies) }),
  );

  app.post(
    '/auth/signup',
    {
      schema: {
        tags,
        summary: 'Create a customer account and log in; a verification email follows',
        body: CustomerSignupRequestSchema,
        response: { 201: CustomerProfileSchema, ...problems(400, 403, 409, 429) },
      },
    },
    async (request, reply) => {
      const { profile, session } = await service.signup(request.body, meta(request));
      setSession(reply, session);
      return reply.status(201).send(profile);
    },
  );

  app.post(
    '/auth/login',
    {
      schema: {
        tags,
        summary: 'Log in with email and password (no second factor for customers)',
        body: CustomerLoginRequestSchema,
        response: { 200: CustomerProfileSchema, ...problems(401, 403, 429) },
      },
    },
    async (request, reply) => {
      const { profile, session } = await service.login(request.body, meta(request));
      setSession(reply, session);
      return profile;
    },
  );

  app.post(
    '/auth/logout',
    {
      preHandler: requireCustomer,
      schema: { tags, summary: 'End this session', response: { 204: NoContent, ...problems(401) } },
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
      preHandler: requireCustomer,
      schema: {
        tags,
        summary: 'End every session',
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
    '/auth/verify-email',
    {
      schema: {
        tags,
        summary: 'Confirm the email address with the emailed token',
        body: VerifyEmailRequestSchema,
        response: { 200: CustomerProfileSchema, ...problems(400, 410) },
      },
    },
    async (request) => service.verifyEmail(request.body.token),
  );

  app.post(
    '/auth/forgot-password',
    {
      schema: {
        tags,
        summary: 'Email a reset link (same answer whether or not the email exists)',
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
        tags,
        summary: 'Set a new password with the emailed token; ends every session',
        body: ResetPasswordRequestSchema,
        response: { 200: AcceptedResponseSchema, ...problems(400, 410) },
      },
    },
    async (request) => {
      await service.resetPassword(request.body);
      return { status: 'accepted' as const };
    },
  );

  app.get(
    '/me',
    {
      preHandler: requireCustomer,
      schema: {
        tags,
        summary: 'Profile',
        response: { 200: CustomerProfileSchema, ...problems(401) },
      },
    },
    async (request) => service.getProfile(authOf(request)),
  );

  app.patch(
    '/me',
    {
      preHandler: requireCustomer,
      schema: {
        tags,
        summary: 'Update name and phone',
        body: UpdateCustomerProfileRequestSchema,
        response: { 200: CustomerProfileSchema, ...problems(400, 401) },
      },
    },
    async (request) => service.updateProfile(authOf(request), request.body),
  );

  app.post(
    '/me/password',
    {
      preHandler: requireCustomer,
      schema: {
        tags,
        summary: 'Change password (current password required; other sessions end)',
        body: ChangePasswordRequestSchema,
        response: { 204: NoContent, ...problems(400, 401) },
      },
    },
    async (request, reply) => {
      await service.changePassword(authOf(request), request.body);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/me/verification-email',
    {
      preHandler: requireCustomer,
      schema: {
        tags,
        summary: 'Send the verification email again',
        response: { 202: AcceptedResponseSchema, ...problems(401, 429) },
      },
    },
    async (request, reply) => {
      await service.resendVerification(authOf(request));
      return reply.status(202).send({ status: 'accepted' });
    },
  );

  app.get(
    '/me/sessions',
    {
      preHandler: requireCustomer,
      schema: {
        tags,
        summary: 'Active sessions',
        response: { 200: SessionListSchema, ...problems(401) },
      },
    },
    async (request) => service.listSessions(authOf(request)),
  );

  app.delete(
    '/me/sessions/:id',
    {
      preHandler: requireCustomer,
      schema: {
        tags,
        summary: 'Revoke one session',
        params: IdParams,
        response: { 204: NoContent, ...problems(401, 404) },
      },
    },
    async (request, reply) => {
      await service.revokeSession(authOf(request), request.params.id);
      return reply.status(204).send(null);
    },
  );
};
