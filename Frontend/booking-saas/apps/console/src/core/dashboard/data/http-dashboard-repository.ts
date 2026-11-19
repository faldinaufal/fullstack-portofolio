// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  NoShowReportSchema,
  ReportOverviewSchema,
  RevenueReportSchema,
  ServiceReportSchema,
  UtilizationReportSchema,
} from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { DashboardRange, DashboardRepository } from '../domain/dashboard';

const R = '/v1/console/reports';

const query = (range: DashboardRange, withInterval: boolean) => {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (withInterval) params.set('interval', range.interval);
  if (range.branchId) params.set('branchId', range.branchId);
  return params;
};

/** `/v1/console/reports/*` (FSD 5.4 "Reporting"). */
export function createHttpDashboardRepository(client: ApiClient): DashboardRepository {
  return {
    overview: (branchId) =>
      request(() =>
        client.get(`${R}/overview${branchId ? `?branchId=${branchId}` : ''}`, {
          schema: ReportOverviewSchema,
        }),
      ),
    revenue: (range) =>
      request(() =>
        client.get(`${R}/revenue?${query(range, true)}`, { schema: RevenueReportSchema }),
      ),
    services: (range) =>
      request(
        async () =>
          (
            await client.get(`${R}/bookings-by-service?${query(range, false)}`, {
              schema: ServiceReportSchema,
            })
          ).items,
      ),
    utilization: (range) =>
      request(() =>
        client.get(`${R}/utilization?${query(range, false)}`, { schema: UtilizationReportSchema }),
      ),
    noShows: (range) =>
      request(() =>
        client.get(`${R}/no-show-rate?${query(range, true)}`, { schema: NoShowReportSchema }),
      ),
  };
}
