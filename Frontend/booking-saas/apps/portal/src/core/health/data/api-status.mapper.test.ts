import { describe, expect, it } from 'vitest';
import { toApiStatus } from './api-status.mapper';

describe('toApiStatus', () => {
  it('maps the health DTO to an online status', () => {
    expect(
      toApiStatus({
        status: 'ok',
        service: 'tempora-api',
        version: '2.1.0',
        time: '2026-11-18T09:30:00.000Z',
      }),
    ).toEqual({
      state: 'online',
      version: '2.1.0',
      checkedAt: new Date('2026-11-18T09:30:00.000Z'),
    });
  });
});
