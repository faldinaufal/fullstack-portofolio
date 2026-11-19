// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

export interface FieldProblem {
  field: string;
  message: string;
}

/** A booking that blocks a change (FSD 6.8): reassign or cancel it first. */
export interface BookingConflict {
  id: string;
  startsAt: Date;
  serviceName: string;
  therapist: string;
  customerName: string;
}

/**
 * Failure of a request, as the app sees it. `code` is the API's stable error code
 * (FSD 6.13) or `NETWORK_ERROR` / `UNEXPECTED`, so screens can react to specific cases
 * without knowing about HTTP.
 */
export class RequestError extends Error {
  readonly code: string;
  readonly fields: FieldProblem[];
  readonly requestId: string | undefined;
  readonly conflicts: BookingConflict[];

  constructor(
    code: string,
    message: string,
    {
      fields = [],
      requestId,
      conflicts = [],
    }: {
      fields?: FieldProblem[];
      requestId?: string | undefined;
      conflicts?: BookingConflict[];
    } = {},
  ) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
    this.conflicts = conflicts;
  }
}
