// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  AuditLogPageSchema,
  EmailLogPageSchema,
  type AuditLogEntry,
  type EmailLogEntry,
} from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { AuditEntry, AuditFilters, EmailEntry, LogRepository } from '../domain/logs';

const C = '/v1/console';
const date = (value: string | null) => (value ? new Date(value) : null);

export const toAuditEntry = (dto: AuditLogEntry): AuditEntry => ({ ...dto, at: new Date(dto.at) });

export const toEmailEntry = (dto: EmailLogEntry): EmailEntry => ({
  ...dto,
  createdAt: new Date(dto.createdAt),
  sentAt: date(dto.sentAt),
  nextAttemptAt: date(dto.nextAttemptAt),
});

function params(filters: object): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') result.set(key, String(value));
  }
  return result;
}

/** `/v1/console/audit-logs` and `/v1/console/emails` (FSD 5.4). */
export function createHttpLogRepository(client: ApiClient, apiUrl: string): LogRepository {
  return {
    audit: (filters: AuditFilters, cursor) =>
      request(async () => {
        const query = params({ ...filters, limit: 50, cursor: cursor ?? undefined });
        const dto = await client.get(`${C}/audit-logs?${query}`, { schema: AuditLogPageSchema });
        return { ...dto, items: dto.items.map(toAuditEntry) };
      }),
    auditExportUrl: (filters) =>
      `${apiUrl}${C}/audit-logs?${params({ ...filters, format: 'csv' })}`,
    emails: (filters) =>
      request(async () => {
        const dto = await client.get(`${C}/emails?${params({ ...filters, pageSize: 25 })}`, {
          schema: EmailLogPageSchema,
        });
        return { ...dto, items: dto.items.map(toEmailEntry) };
      }),
  };
}
