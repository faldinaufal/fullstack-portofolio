import type { ApiClient } from '@tempora/api-client';
import { HealthResponseSchema } from '@tempora/contracts';
import type { ApiStatusRepository } from '../domain/api-status';
import { toApiStatus } from './api-status.mapper';

export function createHttpApiStatusRepository(client: ApiClient): ApiStatusRepository {
  return {
    async fetchStatus() {
      const dto = await client.get('/health', { schema: HealthResponseSchema });
      return toApiStatus(dto);
    },
  };
}
