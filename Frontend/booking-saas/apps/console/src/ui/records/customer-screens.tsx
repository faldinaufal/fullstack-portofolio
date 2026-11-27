// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
} from '@tempora/ui';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { formatPrice, formatWhen, STATUS } from '@/core/bookings/presentation/use-bookings';
import {
  formatPhone,
  shortDate,
  returningShare,
  useCustomer,
  useCustomerSummary,
  useCustomers,
  useExportUrls,
  type CustomerFilters,
} from '@/core/records/presentation/use-records';
import { PageHeader } from '@/ui/common/page-header';

const SORTS: { value: CustomerFilters['sort']; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: '-lastVisit', label: 'Recent visit' },
];

const PANEL =
  'rounded-panel border border-border-subtle bg-surface shadow-[0_1px_3px_rgba(31,28,27,0.06)]';

/**
 * FSD 2.2 `/customers` (DESIGN 5.2, Figma `3:2231`): the business's customers (manager: who
 * booked at their branch). The design's "All / Active / New" and branch filters are not in
 * the API (`q`, `sort` only), so the segmented control switches the sort instead.
 */
export function CustomersScreen() {
  const member = useCurrentMember();
  const exports = useExportUrls();
  const [filters, setFilters] = useState<CustomerFilters>({ sort: 'name', page: 1 });
  const list = useCustomers(filters);
  const set = (changes: Partial<CustomerFilters>) =>
    setFilters((current) => ({ ...current, page: 1, ...changes }));
  const data = list.data;
  const first = data && data.total > 0 ? (filters.page - 1) * data.pageSize + 1 : 0;
  const last = data ? first + data.items.length - (data.items.length > 0 ? 1 : 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[30px] font-semibold tracking-tight">
            Customers
            {data && (
              <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-muted">
                {data.total} total
              </span>
            )}
          </h1>
          <p className="mt-1 text-muted">
            {member.role === 'owner'
              ? 'Everyone who booked at your business.'
              : 'Everyone who booked at your branch; figures are for your branch.'}
          </p>
        </div>
        <a
          href={exports.customers(filters)}
          className={buttonVariants({ variant: 'secondary', className: 'bg-surface' })}
        >
          <Icon name="download" size={18} /> Export CSV
        </a>
      </div>

      <SummaryCards owner={member.role === 'owner'} />

      <div className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-center ${PANEL}`}>
        <label className="flex min-h-11 flex-1 items-center gap-3 rounded-xl bg-surface-muted px-4 has-focus-visible:ring-2 has-focus-visible:ring-ring">
          <Icon name="search" size={18} className="text-muted" />
          <span className="sr-only">Search customers</span>
          <input
            type="search"
            placeholder="Search by name or email…"
            value={filters.q ?? ''}
            onChange={(e) => set({ q: e.target.value || undefined })}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          />
        </label>
        <div
          role="radiogroup"
          aria-label="Sort"
          className="inline-flex gap-1 self-start rounded-xl bg-surface-muted p-1 sm:self-auto"
        >
          {SORTS.map((sort) => {
            const active = filters.sort === sort.value;
            return (
              <button
                key={sort.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ sort: sort.value })}
                className={`min-h-9 rounded-lg px-4 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-surface text-foreground shadow-[0_1px_3px_rgba(31,28,27,0.12)]'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {sort.label}
              </button>
            );
          })}
        </div>
      </div>

      {list.isError && <Alert tone="danger">Customers could not be loaded.</Alert>}
      <div className={`overflow-hidden ${PANEL}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="bg-surface-muted text-left text-xs font-semibold tracking-wider text-muted uppercase">
                <th scope="col" className="px-6 py-4 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-3 py-4 font-semibold">
                  Phone
                </th>
                <th scope="col" className="px-3 py-4 font-semibold">
                  Bookings
                </th>
                <th scope="col" className="px-3 py-4 font-semibold">
                  Last visit
                </th>
                <th scope="col" className="px-3 py-4 font-semibold">
                  Next booking
                </th>
                <th scope="col" className="px-6 py-4 text-right font-semibold">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.isPending && (
                <tr>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-muted">
                    {filters.q ? 'No customers match this search.' : 'No customers yet.'}
                  </td>
                </tr>
              )}
              {data?.items.map((c, index) => (
                <tr key={c.id} className="border-t border-border-subtle">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <Initials name={c.name} accent={index % 2 === 0} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[17px] font-medium">
                          {c.name}
                          {!c.hasAccount && (
                            <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                              Guest
                            </span>
                          )}
                        </p>
                        <p className="truncate text-sm text-muted">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 tabular-nums">
                    {formatPhone(c.phone) ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-4">
                    <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-sm font-medium">
                      {c.bookingCount} {c.bookingCount === 1 ? 'booking' : 'bookings'}
                    </span>
                  </td>
                  <td className="px-3 py-4">{shortDate(c.lastVisitAt, data.timeZone)}</td>
                  <td className="px-3 py-4">{shortDate(c.nextBookingAt, data.timeZone)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/customers/${c.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-primary-text hover:underline"
                    >
                      View details<span className="sr-only"> of {c.name}</span>
                      <Icon name="arrow-right" size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.total > 0 && (
          <nav
            aria-label="Pages"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-6 py-4 text-sm"
          >
            <p className="text-muted">
              Showing{' '}
              <span className="font-semibold text-foreground">
                {first}–{last}
              </span>{' '}
              of <span className="font-semibold text-foreground">{data.total}</span> customers
            </p>
            <div className="flex items-center gap-3">
              <PageButton
                label="Previous page"
                icon="chevron-left"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              />
              <span>
                Page {filters.page} of {pages}
              </span>
              <PageButton
                label="Next page"
                icon="chevron-right"
                disabled={filters.page >= pages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              />
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

/**
 * The figure cards of Figma `3:1644`, filled with what the FSD tracks: lifetime spend and
 * intake forms are left out (DESIGN 4.2), so they show returning customers, bookings ahead
 * and recent no-shows instead.
 */
function SummaryCards({ owner }: Readonly<{ owner: boolean }>) {
  const summary = useCustomerSummary();
  if (summary.isError) return null; // the list below still works without the figures
  if (!summary.data) {
    return (
      <div role="status" aria-label="Loading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-panel bg-surface-muted" />
        ))}
      </div>
    );
  }
  const s = summary.data;
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Customers"
        icon="customers"
        value={s.total}
        extra={
          s.newThisMonth > 0 && (
            <span className="flex items-center gap-1 text-sm font-semibold text-success">
              <Icon name="arrow-right" size={14} className="-rotate-45" />+{s.newThisMonth} this
              month
            </span>
          )
        }
        note={owner ? 'Booked at any of your branches' : 'Booked at your branch'}
      />
      <SummaryCard
        label="Returning customers"
        icon="audit"
        value={s.returning}
        extra={<Pill>{returningShare(s)}% of customers</Pill>}
        note="Booked 2 or more times"
      />
      <SummaryCard
        label="Booked ahead"
        icon="calendar-check"
        value={s.bookedAhead}
        note={`${s.upcomingSessions} ${s.upcomingSessions === 1 ? 'session' : 'sessions'} in the next 7 days`}
      />
      <SummaryCard
        label="No-shows"
        icon="no-show"
        value={s.noShows}
        alert={s.noShows > 0}
        extra={s.noShows > 0 && <Pill alert>Follow up</Pill>}
        note="Customers who missed a session in the last 90 days"
      />
    </ul>
  );
}

function SummaryCard({
  label,
  icon,
  value,
  extra,
  note,
  alert = false,
}: Readonly<{
  label: string;
  icon: 'customers' | 'audit' | 'calendar-check' | 'no-show';
  value: number;
  extra?: ReactNode;
  note: string;
  alert?: boolean;
}>) {
  return (
    <li className={`flex flex-col gap-3 p-5 ${PANEL}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{label}</p>
        <span
          aria-hidden="true"
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
            alert ? 'bg-danger-soft text-danger' : 'bg-primary-container text-on-primary-container'
          }`}
        >
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p
          className={`text-[36px] leading-none font-semibold tracking-tight tabular-nums ${
            alert ? 'text-danger' : ''
          }`}
        >
          {value.toLocaleString('en-US')}
        </p>
        {extra}
      </div>
      <p className="text-sm text-muted">{note}</p>
    </li>
  );
}

function Pill({ children, alert = false }: Readonly<{ children: ReactNode; alert?: boolean }>) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        alert ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-muted'
      }`}
    >
      {children}
    </span>
  );
}

/** Customers have no photo in the FSD, so the list shows their initials. */
function Initials({ name, accent }: Readonly<{ name: string; accent: boolean }>) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-base font-medium ${
        accent
          ? 'bg-primary-container text-on-primary-container'
          : 'bg-surface-sunken text-foreground'
      }`}
    >
      {letters}
    </span>
  );
}

function PageButton({
  label,
  icon,
  disabled,
  onClick,
}: Readonly<{
  label: string;
  icon: 'chevron-left' | 'chevron-right';
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-xl bg-surface-muted transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/** `/customers/[id]`: contact and their bookings at this business. */
export function CustomerDetailScreen({ id }: Readonly<{ id: string }>) {
  const customer = useCustomer(id);
  if (customer.isPending)
    return <div className="h-64 animate-pulse rounded-card bg-surface-muted" />;
  if (customer.isError) {
    return (
      <Alert tone="danger">
        This customer does not exist or did not book at your branch.{' '}
        <Link href="/customers" className="font-semibold underline">
          Back to customers
        </Link>
      </Alert>
    );
  }
  const c = customer.data;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={c.name}
        description={`${c.bookingCount} booking${c.bookingCount === 1 ? '' : 's'} · last visit ${shortDate(c.lastVisitAt, c.timeZone)}`}
        actions={c.hasAccount ? <Badge tone="info">Portal account</Badge> : <Badge>Guest</Badge>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <a href={`mailto:${c.email}`} className="text-primary-text">
            {c.email}
          </a>
          {c.phone && <span>{c.phone}</span>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="m-0 list-none p-0">
            {c.bookings.map((b) => (
              <li key={b.id} className="border-t border-border first:border-t-0">
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted"
                >
                  <span>
                    <span className="block font-semibold">{formatWhen(b, c.timeZone)}</span>
                    <span className="text-[13px] text-muted">
                      {b.serviceName} · {b.therapist.name} · {b.branch.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {formatPrice(b.priceCents)}
                    <Badge tone={STATUS[b.status].tone} dot>
                      {STATUS[b.status].label}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
