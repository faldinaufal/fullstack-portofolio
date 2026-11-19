// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AvailabilityQuerySchema,
  AvailabilitySchema,
  DirectoryQuerySchema,
  DirectorySchema,
  PublicBranchDetailSchema,
  PublicTenantSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { problems } from '../../lib/route-schemas.js';
import type { PublicCatalogue } from './service.js';

const tags = ['public'];
const SlugParams = z.object({ slug: z.string().min(1).max(40) });
const BranchParams = SlugParams.extend({ branchId: z.uuid() });

/** `/v1/public/*`: no login, read-only (FSD 5.2). */
export const publicRoutes: FastifyPluginAsyncZod<{ service: PublicCatalogue }> = async (
  app,
  { service },
) => {
  app.get(
    '/tenants',
    {
      schema: {
        tags,
        summary: 'Directory: businesses that take bookings, searchable by name or service',
        querystring: DirectoryQuerySchema,
        response: { 200: DirectorySchema },
      },
    },
    async (request) => service.directory(request.query.q || undefined),
  );

  app.get(
    '/tenants/:slug',
    {
      schema: {
        tags,
        summary: 'Business page: branches with opening hours, services with prices',
        params: SlugParams,
        response: { 200: PublicTenantSchema, ...problems(404) },
      },
    },
    async (request) => service.tenant(request.params.slug),
  );

  app.get(
    '/tenants/:slug/branches/:branchId',
    {
      schema: {
        tags,
        summary: 'Branch page: therapists (first name and initial) and the services they perform',
        params: BranchParams,
        response: { 200: PublicBranchDetailSchema, ...problems(404) },
      },
    },
    async (request) => service.branch(request.params.slug, request.params.branchId),
  );

  app.get(
    '/tenants/:slug/availability',
    {
      schema: {
        tags,
        summary: 'Free 30-minute start times for a therapist, service and date (FSD 6.2)',
        params: SlugParams,
        querystring: AvailabilityQuerySchema,
        response: { 200: AvailabilitySchema, ...problems(400, 404, 409, 423) },
      },
    },
    async (request) => service.availability(request.params.slug, request.query),
  );
};
