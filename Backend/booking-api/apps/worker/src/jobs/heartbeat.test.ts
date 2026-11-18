// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Job } from 'pg-boss';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createHeartbeatHandler, type HeartbeatData } from './heartbeat.js';

function job(id: string, retryCount = 0): Job<HeartbeatData> {
  return {
    id,
    name: 'system.heartbeat',
    data: { scheduledBy: 'cron' },
    expireInSeconds: 60,
    heartbeatSeconds: null,
    retryCount,
    signal: new AbortController().signal,
  };
}

describe('heartbeat job', () => {
  it('logs one line per job with the attempt number', async () => {
    const logger = pino({ level: 'silent' });
    const info = vi.spyOn(logger, 'info');
    const handler = createHeartbeatHandler(logger, () => new Date('2026-11-18T10:00:00.000Z'));

    await handler([job('a'), job('b', 2)]);

    expect(info).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenNthCalledWith(
      2,
      { jobId: 'b', queue: 'system.heartbeat', attempt: 3, at: '2026-11-18T10:00:00.000Z' },
      'Worker heartbeat',
    );
  });
});
