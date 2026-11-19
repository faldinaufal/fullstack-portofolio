// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, BarChart, Card, CardContent, CardHeader, CardTitle, KpiCard } from '@tempora/ui';
import { useOverview } from '@/core/overview/presentation/use-overview';

/** FSD 2.3 Overview: tenants, daily activity and what needs attention. */
export function OverviewScreen() {
  const overview = useOverview();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[26px] font-extrabold">Overview</h1>
        <p className="mt-1 text-sm text-muted">The whole platform, the last 14 days.</p>
      </div>
      {overview.isError && <Alert tone="danger">The overview could not be loaded.</Alert>}
      {overview.isPending && <div className="h-64 animate-pulse rounded-card bg-surface-muted" />}
      {overview.data && (
        <>
          {overview.data.attention.length > 0 ? (
            <Alert tone="danger" title="Needs attention">
              <ul className="m-0 list-disc pl-5">
                {overview.data.attention.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="success">Nothing needs attention right now.</Alert>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px]">
            {overview.data.kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Activity per day</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart {...overview.data.chart} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
