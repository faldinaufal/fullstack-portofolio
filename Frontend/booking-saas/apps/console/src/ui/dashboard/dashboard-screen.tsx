// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  BarChart,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  HBarList,
  KpiCard,
  LineChart,
  Select,
} from '@tempora/ui';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { dateIn, STATUS, timeIn, useBookings } from '@/core/bookings/presentation/use-bookings';
import { useBranches } from '@/core/branches/presentation/use-branches';
import { useBusinessSettings } from '@/core/catalogue/presentation/use-catalogue';
import {
  toKpis,
  toNoShowChart,
  toRevenueChart,
  toServiceBars,
  toUtilizationBars,
} from '@/core/dashboard/presentation/dashboard.view-model';
import {
  presetRange,
  upNext,
  useDashboardReports,
  type DashboardPreset,
} from '@/core/dashboard/presentation/use-dashboard';
import { PLATFORM_TIME_ZONE } from '@/core/shared/presentation/time-zone';
import { SetupChecklist } from '@/ui/onboarding/onboarding-screen';

const PRESETS: { value: DashboardPreset; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
];

/**
 * FSD 2.2 Dashboard: figures, revenue, bookings per service, utilization and no-show rate for
 * a period, all branches or one (owner) or the manager's branch. Every chart is drawn by our
 * own components (PRD: no chart library) from the reports API (FSD 6.14).
 */
export function DashboardScreen() {
  const member = useCurrentMember();
  const branches = useBranches();
  const [preset, setPreset] = useState<DashboardPreset>('30d');
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [today] = useState(() => dateIn(PLATFORM_TIME_ZONE, new Date()));
  const range = { ...presetRange(preset, today), branchId };
  const reports = useDashboardReports(range);
  const allBranches = member.role === 'owner' && !branchId;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {member.tenantName} ·{' '}
            {member.role === 'owner' ? 'all branches unless you pick one' : 'your branch'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1" role="group" aria-label="Period">
            {PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={preset === p.value ? 'primary' : 'secondary'}
                aria-pressed={preset === p.value}
                onClick={() => setPreset(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {member.role === 'owner' && (branches.data?.length ?? 0) > 1 && (
            <div className="min-w-[180px]">
              <Select
                label="Branch"
                options={[
                  { value: '', label: 'All branches' },
                  ...(branches.data ?? []).map((b) => ({ value: b.id, label: b.name })),
                ]}
                value={branchId ?? ''}
                onValueChange={(value) => setBranchId(value || undefined)}
              />
            </div>
          )}
        </div>
      </div>

      <SetupCard />

      <div className="flex flex-wrap gap-[18px]">
        <UpNextCard today={today} branchId={branchId} />
        <div className="grid min-w-0 flex-[999_1_520px] grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[18px]">
          {reports.overview.data
            ? toKpis(reports.overview.data).map((kpi) => <KpiCard key={kpi.label} {...kpi} />)
            : Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-[118px] animate-pulse rounded-card bg-surface-muted" />
              ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <ChartCard title="Revenue" query={reports.revenue} className="flex-[999_1_560px]">
          {(revenue) => {
            const chart = toRevenueChart(revenue);
            return (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-2xl font-extrabold">{chart.total}</p>
                <BarChart {...chart} />
              </div>
            );
          }}
        </ChartCard>
        {allBranches && (
          <ChartCard title="Revenue by branch" query={reports.revenue} className="flex-[1_1_300px]">
            {(revenue) => (
              <HBarList
                items={toRevenueChart(revenue).branches}
                summary="Revenue of each branch in this period."
              />
            )}
          </ChartCard>
        )}
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <ChartCard
          title="Bookings per service"
          query={reports.services}
          className="flex-[1_1_340px]"
        >
          {(services) => (
            <HBarList
              items={toServiceBars(services)}
              summary="Bookings and revenue of each service in this period."
              empty="No bookings in this period."
            />
          )}
        </ChartCard>
        <ChartCard title="Utilization" query={reports.utilization} className="flex-[1_1_340px]">
          {(use) => (
            <div className="flex flex-col gap-5">
              {allBranches && use.branches.length > 1 && (
                <HBarList
                  items={toUtilizationBars(use.branches)}
                  max={1}
                  summary="Booked share of the available hours per branch."
                />
              )}
              <HBarList
                items={toUtilizationBars(use.therapists)}
                max={1}
                summary="Booked share of the available hours per therapist."
                empty="No therapists with working hours yet."
              />
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="No-show rate" query={reports.noShows}>
        {(series) => {
          const chart = toNoShowChart(series);
          return chart.empty ? (
            <p className="text-sm text-muted">No sessions were marked in this period.</p>
          ) : (
            <LineChart {...chart} max={1} />
          );
        }}
      </ChartCard>

      <TodaysBookings today={today} branchId={branchId} />
    </div>
  );
}

/** A card that shows its own loading and error state, so one failing report does not hide the rest. */
function ChartCard<T>({
  title,
  query,
  className,
  children,
}: Readonly<{
  title: string;
  query: { data: T | undefined; isError: boolean };
  className?: string;
  children: (data: T) => ReactNode;
}>) {
  return (
    <Card className={`min-w-0 ${className ?? ''}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isError && <Alert tone="danger">This report could not be loaded.</Alert>}
        {!query.isError && query.data === undefined && (
          <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
        )}
        {query.data !== undefined && children(query.data)}
      </CardContent>
    </Card>
  );
}

function useToday(today: string, branchId: string | undefined) {
  return useBookings({ from: today, to: today, branchId, sort: 'startsAt', page: 1 });
}

function UpNextCard({
  today,
  branchId,
}: Readonly<{ today: string; branchId: string | undefined }>) {
  const list = useToday(today, branchId);
  const next = list.data ? upNext(list.data.items, new Date()) : null;
  const tz = list.data?.timeZone ?? PLATFORM_TIME_ZONE;
  return (
    <Card className="flex flex-[1_1_260px] flex-col items-center gap-3 p-5 text-center">
      <h2 className="text-[15px] font-extrabold text-primary-text">Up next</h2>
      {next ? (
        <>
          <span
            aria-hidden="true"
            className="flex size-[84px] items-center justify-center rounded-full bg-surface-muted text-[26px] font-extrabold text-primary-text ring-2 ring-primary ring-offset-4 ring-offset-surface"
          >
            {next.customer.name
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join('')}
          </span>
          <Link href={`/bookings/${next.id}`} className="text-base font-extrabold">
            {next.customer.name}
          </Link>
          <p className="text-[13px] text-muted">
            {timeIn(next.startsAt, tz)} · {next.serviceName} · {next.therapist.name}
          </p>
          <Badge tone={STATUS[next.status].tone}>{STATUS[next.status].label}</Badge>
        </>
      ) : (
        <p className="text-sm text-muted">No more bookings today.</p>
      )}
    </Card>
  );
}

function TodaysBookings({
  today,
  branchId,
}: Readonly<{ today: string; branchId: string | undefined }>) {
  const list = useToday(today, branchId);
  const tz = list.data?.timeZone ?? PLATFORM_TIME_ZONE;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s bookings</CardTitle>
        <Link href="/bookings" className="text-sm font-bold text-primary-text">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {list.data?.items.length === 0 && <p className="text-sm text-muted">No bookings today.</p>}
        {list.data && list.data.items.length > 0 && (
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
                {list.data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-border p-3 font-bold">
                      <Link href={`/bookings/${row.id}`}>{timeIn(row.startsAt, tz)}</Link>
                    </td>
                    <td className="border-b border-border p-3">{row.customer.name}</td>
                    <td className="border-b border-border p-3">{row.serviceName}</td>
                    <td className="border-b border-border p-3">{row.therapist.name}</td>
                    <td className="border-b border-border p-3 text-muted">{row.branch.name}</td>
                    <td className="border-b border-border p-3">
                      <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
