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
  KpiCard,
  MonthCalendar,
} from '@tempora/ui';
import Link from 'next/link';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { useBusinessSettings } from '@/core/catalogue/presentation/use-catalogue';
import { useDashboard } from '@/core/dashboard/presentation/use-dashboard';
import type { DashboardViewModel } from '@/core/dashboard/presentation/dashboard.view-model';
import { SetupChecklist } from '@/ui/onboarding/onboarding-screen';

export function DashboardScreen() {
  const state = useDashboard();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold">Dashboard</h1>
          {state.status === 'ready' && (
            <p className="mt-1 text-sm text-muted">
              {state.dashboard.dateLabel} · {state.dashboard.scopeLabel}
            </p>
          )}
        </div>
      </div>

      <SetupCard />
      {state.status === 'loading' && <DashboardSkeleton />}
      {state.status === 'error' && (
        <p role="alert" className="rounded-card bg-danger-soft p-5 text-sm text-danger">
          The dashboard could not be loaded. Please refresh the page.
        </p>
      )}
      {state.status === 'ready' && <DashboardContent dashboard={state.dashboard} />}
    </>
  );
}

function DashboardContent({ dashboard }: Readonly<{ dashboard: DashboardViewModel }>) {
  return (
    <>
      <div className="flex flex-wrap gap-[18px]">
        <Card className="flex flex-[1_1_260px] flex-col items-center gap-3 p-5 text-center">
          {dashboard.upNext ? (
            <>
              <h2 className="text-[15px] font-extrabold text-primary-text">
                {dashboard.upNext.title}
              </h2>
              <span
                aria-hidden="true"
                className="flex size-[84px] items-center justify-center rounded-full bg-surface-muted text-[26px] font-extrabold text-primary-text ring-2 ring-primary ring-offset-4 ring-offset-surface"
              >
                {dashboard.upNext.initials}
              </span>
              <p className="text-base font-extrabold">{dashboard.upNext.customer}</p>
              <p className="text-[13px] text-muted">{dashboard.upNext.detail}</p>
              <Badge tone={dashboard.upNext.tone}>{dashboard.upNext.status}</Badge>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-extrabold text-primary-text">Up next</h2>
              <p className="text-sm text-muted">No more bookings today.</p>
            </>
          )}
        </Card>

        <div className="grid min-w-0 flex-[999_1_520px] grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[18px]">
          {dashboard.kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <Card className="min-w-0 flex-[999_1_560px]">
          <CardHeader>
            <CardTitle>Bookings per month</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart {...dashboard.chart} />
          </CardContent>
        </Card>

        <Card className="flex-[1_1_300px]">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthCalendar {...dashboard.calendar} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s bookings</CardTitle>
          <Link href="/bookings" className="text-sm font-bold text-primary-text">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  {['Time', 'Customer', 'Service', 'Therapist', 'Branch', 'Status'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="border-b border-border px-3 py-2.5 font-bold"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {dashboard.todaysBookings.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-border p-3 font-bold">{row.time}</td>
                    <td className="border-b border-border p-3">{row.customer}</td>
                    <td className="border-b border-border p-3">{row.service}</td>
                    <td className="border-b border-border p-3">{row.therapist}</td>
                    <td className="border-b border-border p-3 text-muted">{row.branch}</td>
                    <td className="border-b border-border p-3">
                      <Badge tone={row.tone}>{row.status}</Badge>
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

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="grid gap-[18px]">
      <div className="h-[220px] animate-pulse rounded-card bg-surface-muted" />
      <div className="h-[320px] animate-pulse rounded-card bg-surface-muted" />
    </div>
  );
}

/** Shown to the owner until the business can take bookings (FSD 3.4 step 3). */
function SetupCard() {
  const me = useCurrentMember();
  const settings = useBusinessSettings(me.role === 'owner');
  if (me.role !== 'owner' || !settings.data || settings.data.setup.complete) return null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-5 border-primary/40 p-5">
      <div className="flex flex-col gap-3">
        <p className="text-lg font-extrabold">Finish setting up {settings.data.name}</p>
        <SetupChecklist setup={settings.data.setup} />
      </div>
      <Link href="/onboarding" className={buttonVariants()}>
        Continue setup
      </Link>
    </Card>
  );
}
