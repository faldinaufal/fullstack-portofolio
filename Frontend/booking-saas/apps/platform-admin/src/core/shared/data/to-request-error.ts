// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError } from '@tempora/api-client';
import { RequestError } from '../domain/request-error';

/** Converts any failure of an API call into the domain `RequestError`. */
export function toRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) return error;
  if (error instanceof ApiError) {
    return new RequestError(error.code, error.message, {
      fields: error.fieldErrors.map(({ path, message }) => ({ field: path, message })),
      requestId: error.requestId,
    });
  }
  return new RequestError('UNEXPECTED', 'Something went wrong.');
}

/** Runs an API call and rethrows failures as `RequestError`. */
export async function request<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toRequestError(error);
  }
}
