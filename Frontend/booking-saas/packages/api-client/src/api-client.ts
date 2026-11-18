// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { CsrfResponseSchema, ProblemDetailsSchema } from '@tempora/contracts';
import type { z } from 'zod';
import { ApiError } from './api-error.js';

export interface ApiClientOptions {
  /** API origin, e.g. `https://api.example.com`. */
  baseUrl: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * Endpoint that issues the CSRF token of this app's route group, e.g.
   * `/v1/console/auth/csrf`. When set, every state-changing request sends the token in
   * `X-CSRF-Token` (FSD 5.1); the token is fetched on first use and refreshed once if the
   * API reports it as invalid.
   */
  csrfPath?: string;
}

export interface RequestOptions<TSchema extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Schema the response body must match; a mismatch throws `INVALID_RESPONSE`. */
  schema: TSchema;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Thin wrapper around `fetch` used by every app's data layer.
 * - Sends cookies (`credentials: 'include'`) because sessions live in httpOnly cookies.
 * - Validates every response against its contract schema, so a backend change that
 *   breaks the contract fails loudly here instead of rendering wrong data.
 * - Converts every failure into an `ApiError` with a stable code.
 */
export function createApiClient({ baseUrl, fetch: fetchImpl = fetch, csrfPath }: ApiClientOptions) {
  const origin = baseUrl.replace(/\/+$/, '');
  let csrfToken: Promise<string> | undefined;

  function getCsrfToken(): Promise<string> {
    csrfToken ??= send(csrfPath ?? '', { schema: CsrfResponseSchema })
      .then((response) => response.csrfToken)
      .catch((error: unknown) => {
        csrfToken = undefined; // do not cache a failure
        throw error;
      });
    return csrfToken;
  }

  async function request<TSchema extends z.ZodType>(
    path: string,
    options: RequestOptions<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const method = options.method ?? 'GET';
    if (!csrfPath || method === 'GET') return send(path, options);

    const withToken = async () =>
      send(path, {
        ...options,
        headers: { ...options.headers, 'X-CSRF-Token': await getCsrfToken() },
      });
    try {
      return await withToken();
    } catch (error) {
      // The token cookie can expire or be cleared; fetch a fresh token and retry once.
      if (!(error instanceof ApiError) || error.code !== 'CSRF_INVALID') throw error;
      csrfToken = undefined;
      return withToken();
    }
  }

  async function send<TSchema extends z.ZodType>(
    path: string,
    { method = 'GET', schema, body, headers, signal }: RequestOptions<TSchema>,
  ): Promise<z.infer<TSchema>> {
    let response: Response;
    try {
      response = await fetchImpl(`${origin}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        ...(signal && { signal }),
      });
    } catch (cause) {
      throw new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'The API could not be reached.',
        cause,
      });
    }

    const requestId = response.headers.get('x-request-id') ?? undefined;
    // 204 No Content (and any empty body) is read as `undefined`.
    const payload: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(payload);
      if (problem.success) throw ApiError.fromProblem(problem.data);
      throw new ApiError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: `Unexpected ${response.status} response from the API.`,
        requestId,
      });
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: 'The API response does not match the expected contract.',
        requestId,
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  return {
    request,
    get: <TSchema extends z.ZodType>(
      path: string,
      options: Omit<RequestOptions<TSchema>, 'method' | 'body'>,
    ) => request(path, { ...options, method: 'GET' }),
    post: <TSchema extends z.ZodType>(
      path: string,
      options: Omit<RequestOptions<TSchema>, 'method'>,
    ) => request(path, { ...options, method: 'POST' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
