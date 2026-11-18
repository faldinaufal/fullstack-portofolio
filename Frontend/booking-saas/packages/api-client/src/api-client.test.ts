// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { HealthResponseSchema } from '@tempora/contracts';
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
});
