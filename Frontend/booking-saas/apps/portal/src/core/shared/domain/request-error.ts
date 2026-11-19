// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

export interface FieldProblem {
  field: string;
  message: string;
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

  constructor(
    code: string,
    message: string,
    { fields = [], requestId }: { fields?: FieldProblem[]; requestId?: string | undefined } = {},
  ) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}
