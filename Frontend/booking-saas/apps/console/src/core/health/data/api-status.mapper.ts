import type { HealthResponse } from '@tempora/contracts';
import type { ApiStatus } from '../domain/api-status';

/** DTO (API contract) → domain entity. The only place that knows both shapes. */
export function toApiStatus(dto: HealthResponse): ApiStatus {
  return {
    state: 'online',
    version: dto.version,
    checkedAt: new Date(dto.time),
  };
}
