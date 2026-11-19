// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { BookingConflict, ErrorCode, FieldError } from '@tempora/contracts';

export interface AppErrorOptions {
  status: number;
  code: ErrorCode;
  title: string;
  detail?: string;
  errors?: FieldError[];
  conflicts?: BookingConflict[];
}

/**
 * An expected, client-facing error. Services throw it; the error plugin turns it into
 * an RFC 9457 response. Anything that is not an AppError is treated as a bug (500).
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;
  readonly conflicts: BookingConflict[] | undefined;

  constructor(options: AppErrorOptions) {
    super(options.detail ?? options.title);
    this.name = 'AppError';
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.detail = options.detail;
    this.errors = options.errors;
    this.conflicts = options.conflicts;
  }
}
