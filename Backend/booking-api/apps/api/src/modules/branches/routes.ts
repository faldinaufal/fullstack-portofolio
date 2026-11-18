// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  BranchDetailSchema,
  BranchListSchema,
  ClosureSchema,
  CreateBranchRequestSchema,
  CreateClosureRequestSchema,
  ProblemDetailsSchema,
  ReplaceOpeningHoursRequestSchema,
  UpdateBranchRequestSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { BranchService } from './service.js';

const problems = (...statuses: number[]) =>
  Object.fromEntries(statuses.map((status) => [status, ProblemDetailsSchema]));
const IdParams = z.object({ id: z.uuid() });
const ClosureParams = z.object({ id: z.uuid(), closureId: z.uuid() });
/** `If-Match: <version>` (FSD 5.1 optimistic locking). */
const IfMatchHeaders = z.object({
  'if-match': z.coerce.number().int().min(1).describe('Version of the branch you loaded'),
});
const NoContent = z.null().describe('No content');
const tags = ['console-branches'];

/** `/v1/console/branches/*` (FSD 5.4 Branches). Scope: owner all, manager own branch. */
export const branchRoutes: FastifyPluginAsyncZod<{
  service: BranchService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  app.get(
    '/branches',
    {
      preHandler: guard.require('owner', 'manager', 'staff'),
      schema: {
        tags,
        summary: 'Branches (manager and staff: own branch)',
        response: { 200: BranchListSchema, ...problems(401) },
      },
    },
    async (request) => service.list(guard.actor(request)),
  );

  app.post(
    '/branches',
    {
      preHandler: guard.require('owner'),
      schema: {
        tags,
        summary: 'Create a branch',
        body: CreateBranchRequestSchema,
        response: { 201: BranchDetailSchema, ...problems(400, 401, 403) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.create(guard.actor(request), request.body)),
  );

  app.get(
    '/branches/:id',
    {
      preHandler: guard.require('owner', 'manager', 'staff'),
      schema: {
        tags,
        summary: 'Branch detail with opening hours and upcoming closures',
        params: IdParams,
        response: { 200: BranchDetailSchema, ...problems(401, 404) },
      },
    },
    async (request) => service.get(guard.actor(request), request.params.id),
  );

  app.patch(
    '/branches/:id',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Update branch details (requires If-Match)',
        params: IdParams,
        headers: IfMatchHeaders,
        body: UpdateBranchRequestSchema,
        response: { 200: BranchDetailSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) =>
      service.update(
        guard.actor(request),
        request.params.id,
        request.headers['if-match'],
        request.body,
      ),
  );

  app.post(
    '/branches/:id/archive',
    {
      preHandler: guard.require('owner'),
      schema: {
        tags,
        summary: 'Archive a branch (rejected while members work there)',
        params: IdParams,
        response: { 200: BranchDetailSchema, ...problems(401, 403, 404, 409) },
      },
    },
    async (request) => service.archive(guard.actor(request), request.params.id),
  );

  app.put(
    '/branches/:id/opening-hours',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Replace weekly opening hours (a weekday left out is closed)',
        params: IdParams,
        body: ReplaceOpeningHoursRequestSchema,
        response: { 200: BranchDetailSchema, ...problems(400, 401, 403, 404) },
      },
    },
    async (request) =>
      service.replaceOpeningHours(guard.actor(request), request.params.id, request.body.hours),
  );

  app.post(
    '/branches/:id/closures',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Add a closure (holiday or one-off)',
        params: IdParams,
        body: CreateClosureRequestSchema,
        response: { 201: ClosureSchema, ...problems(400, 401, 403, 404) },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await service.addClosure(guard.actor(request), request.params.id, request.body)),
  );

  app.delete(
    '/branches/:id/closures/:closureId',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Remove a closure',
        params: ClosureParams,
        response: { 204: NoContent, ...problems(401, 403, 404) },
      },
    },
    async (request, reply) => {
      await service.removeClosure(
        guard.actor(request),
        request.params.id,
        request.params.closureId,
      );
      return reply.status(204).send(null);
    },
  );
};
