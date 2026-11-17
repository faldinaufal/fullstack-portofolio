import type { ApiStatus, ApiStatusRepository } from './api-status';

/**
 * Use case: find out whether the API is reachable.
 * Rule: any failure to reach or understand the API means "offline", never a crash.
 */
export function createGetApiStatus(
  repository: ApiStatusRepository,
  now: () => Date = () => new Date(),
) {
  return async function getApiStatus(): Promise<ApiStatus> {
    try {
      return await repository.fetchStatus();
    } catch {
      return { state: 'offline', version: null, checkedAt: now() };
    }
  };
}

export type GetApiStatus = ReturnType<typeof createGetApiStatus>;
