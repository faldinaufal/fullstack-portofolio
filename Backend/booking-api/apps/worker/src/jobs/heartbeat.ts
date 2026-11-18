// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Job } from 'pg-boss';
import type { Logger } from 'pino';

export interface HeartbeatData {
  scheduledBy: 'cron';
}

/**
 * Example job: proves that scheduling, delivery and logging work end to end.
 * Runs every 5 minutes; its log line shows the worker is alive and processing jobs.
 */
export function createHeartbeatHandler(logger: Logger, now: () => Date = () => new Date()) {
  return async (jobs: Job<HeartbeatData>[]) => {
    for (const job of jobs) {
      logger.info(
        { jobId: job.id, queue: job.name, attempt: job.retryCount + 1, at: now().toISOString() },
        'Worker heartbeat',
      );
    }
  };
}
