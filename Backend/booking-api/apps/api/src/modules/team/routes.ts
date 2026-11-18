// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AcceptedResponseSchema,
  AcceptInvitationRequestSchema,
  CreateInvitationRequestSchema,
  InvitationListSchema,
  InvitationPreviewSchema,
  InvitationSchema,
  MemberListSchema,
  MemberSchema,
  ProblemDetailsSchema,
  UpdateMemberRequestSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { TeamService } from './service.js';

const problems = (...statuses: number[]) =>
  Object.fromEntries(statuses.map((status) => [status, ProblemDetailsSchema]));
const IdParams = z.object({ id: z.uuid() });
const TokenParams = z.object({ token: z.string().min(20).max(200) });
const NoContent = z.null().describe('No content');
const tags = ['console-team'];

/** `/v1/console/members/*` and `/v1/console/invitations/*` (FSD 5.4 Team). */
export const teamRoutes: FastifyPluginAsyncZod<{
  service: TeamService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  app.get(
    '/members',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Members (manager: own branch)',
        response: { 200: MemberListSchema, ...problems(401, 403) },
      },
    },
    async (request) => service.listMembers(guard.actor(request)),
  );

  app.get(
    '/members/:id',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Member detail (staff: self only)',
        params: IdParams,
        response: { 200: MemberSchema, ...problems(401, 404) },
      },
    },
    async (request) => service.getMember(guard.actor(request), request.params.id),
  );

  app.patch(
    '/members/:id',
    {
      preHandler: guard.require('owner'),
      schema: {
        tags,
        summary: 'Change role or branch; say what happens to a replaced manager',
        params: IdParams,
        body: UpdateMemberRequestSchema,
        response: { 200: MemberSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) => service.updateMember(guard.actor(request), request.params.id, request.body),
  );

  app.post(
    '/members/:id/deactivate',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Deactivate (ends their sessions and trusted devices)',
        params: IdParams,
        response: { 200: MemberSchema, ...problems(401, 403, 404) },
      },
    },
    async (request) => service.deactivate(guard.actor(request), request.params.id),
  );

  app.post(
    '/members/:id/reactivate',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Reactivate a deactivated member',
        params: IdParams,
        response: { 200: MemberSchema, ...problems(401, 403, 404, 409) },
      },
    },
    async (request) => service.reactivate(guard.actor(request), request.params.id),
  );

  app.get(
    '/invitations',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Open invitations (manager: own branch)',
        response: { 200: InvitationListSchema, ...problems(401, 403) },
      },
    },
    async (request) => service.listInvitations(guard.actor(request)),
  );

  app.post(
    '/invitations',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Invite by email (owner: manager or staff; manager: staff of own branch)',
        body: CreateInvitationRequestSchema,
        response: { 201: InvitationSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.invite(guard.actor(request), request.body)),
  );

  app.post(
    '/invitations/:id/resend',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Send a new link with a fresh 7-day validity',
        params: IdParams,
        response: { 200: InvitationSchema, ...problems(401, 403, 404) },
      },
    },
    async (request) => service.resendInvitation(guard.actor(request), request.params.id),
  );

  app.delete(
    '/invitations/:id',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Revoke an invitation',
        params: IdParams,
        response: { 204: NoContent, ...problems(401, 403, 404) },
      },
    },
    async (request, reply) => {
      await service.revokeInvitation(guard.actor(request), request.params.id);
      return reply.status(204).send(null);
    },
  );

  // Public: opened from the invitation email, before the invitee has a session.
  app.get(
    '/invitation-links/:token',
    {
      schema: {
        tags,
        summary: 'Invitation preview from the emailed link (no login)',
        params: TokenParams,
        response: { 200: InvitationPreviewSchema, ...problems(410) },
      },
    },
    async (request) => service.previewInvitation(request.params.token),
  );

  app.post(
    '/invitation-links/:token/accept',
    {
      schema: {
        tags,
        summary: 'Accept: create an account (or confirm an existing one) and join',
        params: TokenParams,
        body: AcceptInvitationRequestSchema,
        response: { 200: AcceptedResponseSchema, ...problems(400, 401, 409, 410, 429) },
      },
    },
    async (request) => {
      await service.acceptInvitation(request.params.token, request.body, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return { status: 'accepted' as const };
    },
  );
};
