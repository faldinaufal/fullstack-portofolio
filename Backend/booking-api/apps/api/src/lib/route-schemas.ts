// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ProblemDetailsSchema } from '@tempora/contracts';
import { z } from 'zod';
import { AppError } from './app-error.js';

/** Response schemas for the listed error statuses (all RFC 9457 problems). */
export const problems = (...statuses: number[]) =>
  Object.fromEntries(statuses.map((status) => [status, ProblemDetailsSchema]));

export const NoContent = z.null().describe('No content');

export const IdParams = z.object({ id: z.uuid() });

/** `If-Match: <version>` on updates of versioned records (FSD 5.1 optimistic locking). */
export const IfMatchHeaders = z.object({
  'if-match': z.coerce.number().int().min(1).describe('Version of the record you loaded'),
});

export function versionConflict(what: string): AppError {
  return new AppError({
    status: 409,
    code: 'VERSION_CONFLICT',
    title: 'Changed by someone else',
    detail: `This ${what} was changed since you opened it. Reload and try again.`,
  });
}
