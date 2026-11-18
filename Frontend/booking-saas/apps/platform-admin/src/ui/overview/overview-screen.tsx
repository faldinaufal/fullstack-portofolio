// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Badge,
  BarChart,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  KpiCard,
} from '@tempora/ui';
import Link from 'next/link';
import { usePlatformOverview } from '@/core/overview/presentation/use-platform-overview';
import type { PlatformOverviewViewModel } from '@/core/overview/presentation/platform-overview.view-model';

export function OverviewScreen() {
  const state = usePlatformOverview();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold">Platform overview</h1>
          {state.status === 'ready' && (
            <p className="mt-1 text-sm text-muted">{state.overview.dateLabel} · all tenants</p>
          )}
        </div>
        <Link href="/tenants/new" className={buttonVariants()}>
          <Icon name="plus" size={18} strokeWidth={2.2} />
          Create tenant
        </Link>
      </div>

      {state.status === 'loading' && (
        <div aria-busy="true" aria-label="Loading overview" className="grid gap-[18px]">
          <div className="h-[200px] animate-pulse rounded-card bg-surface-muted" />
          <div className="h-[320px] animate-pulse rounded-card bg-surface-muted" />
        </div>
      )}
      {state.status === 'error' && (
        <p role="alert" className="rounded-card bg-danger-soft p-5 text-sm text-danger">
          The overview could not be loaded. Please refresh the page.
        </p>
      )}
      {state.status === 'ready' && <OverviewContent overview={state.overview} />}
    </>
  );
}

function OverviewContent({ overview }: Readonly<{ overview: PlatformOverviewViewModel }>) {
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px]">
        {overview.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <Card className="min-w-0 flex-[999_1_560px]">
          <CardHeader>
            <CardTitle>Bookings per day · last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart {...overview.chart} />
          </CardContent>
        </Card>

        <Card className="flex-[1_1_300px]">
          <CardHeader>
            <CardTitle>System health</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="m-0 flex list-none flex-col p-0">
              {overview.services.map((service) => (
                <li
                  key={service.name}
                  className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-bold">{service.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{service.detail}</p>
                  </div>
                  <Badge tone={service.tone}>{service.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <Link href="/tenants" className="text-sm font-bold text-primary-text">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  {[
                    'Tenant',
                    'Status',
                    'Branches',
                    'Members',
                    'Bookings (30 d)',
                    'Support access',
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="border-b border-border px-3 py-2.5 font-bold"
                    >
                      {heading}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-border px-3 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="border-b border-border p-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-9 items-center justify-center rounded-[10px] bg-surface-muted font-extrabold text-primary-text"
                        >
                          {tenant.initial}
                        </span>
                        <span>
                          <span className="block font-bold">{tenant.name}</span>
                          <span className="block text-xs text-muted">{tenant.slug}</span>
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-border p-3">
                      <Badge tone={tenant.tone}>{tenant.status}</Badge>
                    </td>
                    <td className="border-b border-border p-3">{tenant.branches}</td>
                    <td className="border-b border-border p-3">{tenant.members}</td>
                    <td className="border-b border-border p-3 font-bold">{tenant.bookings}</td>
                    <td className="border-b border-border p-3 text-muted">{tenant.support}</td>
                    <td className="border-b border-border p-3 text-right">
                      <Link href={`/tenants/${tenant.id}`} className="font-bold text-primary-text">
                        View<span className="sr-only"> {tenant.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
