// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ErrorCode, FieldError, ProblemDetails } from '@tempora/contracts';

/** Errors that happen on the client side, before or after talking to the API. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE';

/**
 * The only error type the API client throws. Apps switch on `code` to show the right
 * message (FSD 6.13) and display `requestId` for unexpected errors (FSD 8.5).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | ClientErrorCode;
  readonly requestId: string | undefined;
  readonly fieldErrors: FieldError[];

  constructor(options: {
    status: number;
    code: ErrorCode | ClientErrorCode;
    message: string;
    requestId?: string | undefined;
    fieldErrors?: FieldError[] | undefined;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.fieldErrors = options.fieldErrors ?? [];
  }

  static fromProblem(problem: ProblemDetails): ApiError {
    return new ApiError({
      status: problem.status,
      code: problem.code,
      message: problem.detail ?? problem.title,
      requestId: problem.requestId,
      fieldErrors: problem.errors,
    });
  }
}
