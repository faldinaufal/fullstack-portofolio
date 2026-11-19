// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ErrorCode, ProblemDetails } from '@tempora/contracts';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../lib/app-error.js';

const BY_STATUS: Record<number, { code: ErrorCode; title: string }> = {
  400: { code: 'VALIDATION_FAILED', title: 'Invalid request' },
  401: { code: 'UNAUTHENTICATED', title: 'Authentication required' },
  403: { code: 'FORBIDDEN', title: 'Not allowed' },
  404: { code: 'NOT_FOUND', title: 'Not found' },
  429: { code: 'RATE_LIMITED', title: 'Too many requests' },
};

const FALLBACK_4XX = { code: 'VALIDATION_FAILED', title: 'Invalid request' } as const;

type ProblemInput = Omit<ProblemDetails, 'type' | 'requestId' | 'instance'>;

function problemType(code: ErrorCode): string {
  return `/problems/${code.toLowerCase().replaceAll('_', '-')}`;
}

function sendProblem(request: FastifyRequest, reply: FastifyReply, problem: ProblemInput) {
  const body: ProblemDetails = {
    type: problemType(problem.code),
    instance: request.url,
    requestId: request.id,
    ...problem,
  };
  return reply.status(problem.status).type('application/problem+json').send(body);
}

/**
 * Turns every error into an RFC 9457 problem response with a stable `code` (FSD 6.13).
 * - AppError: expected business errors, returned as they are.
 * - Schema validation errors: 400 VALIDATION_FAILED with one entry per invalid field.
 * - Other 4xx raised by Fastify (malformed JSON, unsupported media type): mapped by status.
 * - Everything else: logged with the request ID and returned as a generic 500,
 *   so internal details never leak to the client.
 */
export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      return sendProblem(request, reply, {
        status: error.status,
        code: error.code,
        title: error.title,
        ...(error.detail !== undefined && { detail: error.detail }),
        ...(error.errors !== undefined && { errors: error.errors }),
        ...(error.conflicts !== undefined && { conflicts: error.conflicts }),
      });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return sendProblem(request, reply, {
        status: 400,
        code: 'VALIDATION_FAILED',
        title: 'Invalid request',
        detail: `The request ${error.validationContext ?? 'input'} is invalid.`,
        errors: error.validation.map((issue) => ({
          path: issue.instancePath.replace(/^\//, '').replaceAll('/', '.'),
          message: issue.message ?? 'Invalid value',
        })),
      });
    }

    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      const mapped = BY_STATUS[status] ?? FALLBACK_4XX;
      return sendProblem(request, reply, {
        status,
        code: mapped.code,
        title: mapped.title,
        detail: error.message,
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return sendProblem(request, reply, {
      status: 500,
      code: 'INTERNAL_ERROR',
      title: 'Something went wrong',
      detail: 'An unexpected error occurred. Quote the request ID when reporting it.',
    });
  });

  app.setNotFoundHandler((request, reply) =>
    sendProblem(request, reply, {
      status: 404,
      code: 'NOT_FOUND',
      title: 'Not found',
      detail: `No route for ${request.method} ${request.url}.`,
    }),
  );
}
