// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { AcceptedResponseSchema, HealthResponseSchema } from '@tempora/contracts';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './api-client.js';
import { ApiError } from './api-error.js';

function jsonResponse(status: number, body: unknown, contentType = 'application/json') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': contentType, 'x-request-id': 'req-42' },
  });
}

const health = {
  status: 'ok',
  service: 'tempora-api',
  version: '1.0.0',
  time: '2026-11-18T09:30:00.000Z',
};

describe('api client', () => {
  it('sends cookies and returns the validated body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, health));
    const client = createApiClient({ baseUrl: 'https://api.test/', fetch: fetchMock });

    await expect(client.get('/health', { schema: HealthResponseSchema })).resolves.toEqual(health);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/health',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('turns a problem response into an ApiError with code and request ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        409,
        {
          type: '/problems/slot-taken',
          title: 'Slot no longer available',
          status: 409,
          code: 'SLOT_TAKEN',
          requestId: 'req-42',
        },
        'application/problem+json',
      ),
    );
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock });

    const error = await client.get('/x', { schema: HealthResponseSchema }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'SLOT_TAKEN', requestId: 'req-42' });
  });

  it('reports a contract mismatch as INVALID_RESPONSE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'maybe' }));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock });

    await expect(client.get('/health', { schema: HealthResponseSchema })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      requestId: 'req-42',
    });
  });

  it('reports an unreachable API as NETWORK_ERROR', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock });

    await expect(client.get('/health', { schema: HealthResponseSchema })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  describe('CSRF', () => {
    const csrf = (token: string) => jsonResponse(200, { csrfToken: token });
    const problem = (code: string, status: number) =>
      jsonResponse(
        status,
        { type: '/problems/x', title: 'x', status, code, requestId: 'req-1' },
        'application/problem+json',
      );

    it('fetches the token once and sends it on every POST', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(csrf('tok-1'))
        // A Response body can be read once, so build a new one per call.
        .mockImplementation(async () => jsonResponse(202, { status: 'accepted' }));
      const client = createApiClient({
        baseUrl: 'https://api.test',
        fetch: fetchMock,
        csrfPath: '/v1/console/auth/csrf',
      });

      await client.post('/a', { schema: AcceptedResponseSchema, body: {} });
      await client.post('/b', { schema: AcceptedResponseSchema, body: {} });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[0]![0]).toBe('https://api.test/v1/console/auth/csrf');
      for (const call of fetchMock.mock.calls.slice(1)) {
        expect(call[1].headers).toMatchObject({ 'X-CSRF-Token': 'tok-1' });
      }
    });

    it('refreshes an invalid token and retries once', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(csrf('old'))
        .mockResolvedValueOnce(problem('CSRF_INVALID', 403))
        .mockResolvedValueOnce(csrf('new'))
        .mockResolvedValueOnce(jsonResponse(202, { status: 'accepted' }));
      const client = createApiClient({
        baseUrl: 'https://api.test',
        fetch: fetchMock,
        csrfPath: '/csrf',
      });

      await expect(
        client.post('/a', { schema: AcceptedResponseSchema, body: {} }),
      ).resolves.toEqual({ status: 'accepted' });
      expect(fetchMock.mock.calls[3]![1].headers).toMatchObject({ 'X-CSRF-Token': 'new' });
    });

    it('does not retry other errors', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(csrf('tok'))
        .mockResolvedValueOnce(problem('INVALID_CREDENTIALS', 401));
      const client = createApiClient({
        baseUrl: 'https://api.test',
        fetch: fetchMock,
        csrfPath: '/csrf',
      });

      await expect(
        client.post('/a', { schema: AcceptedResponseSchema, body: {} }),
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('accepts an empty 204 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock });
    await expect(client.post('/logout', { schema: z.undefined() })).resolves.toBeUndefined();
  });
});
