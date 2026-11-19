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
  SelectField,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { formatPrice, formatWhen, STATUS } from '@/core/bookings/presentation/use-bookings';
import {
  shortDate,
  useCustomer,
  useCustomers,
  useExportUrls,
  type CustomerFilters,
} from '@/core/records/presentation/use-records';
import { PageHeader } from '@/ui/common/page-header';
import { Pagination } from './pagination';

/** FSD 2.2 `/customers`: the business's customers (manager: who booked at their branch). */
export function CustomersScreen() {
  const member = useCurrentMember();
  const exports = useExportUrls();
  const [filters, setFilters] = useState<CustomerFilters>({ sort: 'name', page: 1 });
  const list = useCustomers(filters);
  const set = (changes: Partial<CustomerFilters>) =>
    setFilters((current) => ({ ...current, page: 1, ...changes }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description={
          member.role === 'owner'
            ? 'Everyone who booked at your business.'
            : 'Everyone who booked at your branch; figures are for your branch.'
        }
        actions={
          <a href={exports.customers(filters)} className={buttonVariants({ variant: 'secondary' })}>
            Export CSV
          </a>
        }
      />
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
          <TextField
            label="Search"
            placeholder="Name or email"
            value={filters.q ?? ''}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
          <SelectField
            label="Sort"
            options={[
              { value: 'name', label: 'Name' },
              { value: '-lastVisit', label: 'Last visit, newest first' },
            ]}
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as CustomerFilters['sort'] })}
          />
        </CardContent>
      </Card>

      {list.isError && <Alert tone="danger">Customers could not be loaded.</Alert>}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Bookings
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Last visit
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Next booking
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-muted">
                    No customers yet.
                  </td>
                </tr>
              )}
              {list.data?.items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-bold text-foreground hover:text-primary-text"
                    >
                      {c.name}
                    </Link>
                    <span className="block text-[13px] text-muted">{c.email}</span>
                  </td>
                  <td className="px-3 py-3">{c.bookingCount}</td>
                  <td className="px-3 py-3">{shortDate(c.lastVisitAt, list.data.timeZone)}</td>
                  <td className="px-5 py-3">{shortDate(c.nextBookingAt, list.data.timeZone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {list.data && (
        <Pagination
          page={filters.page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          onPage={(page) => setFilters({ ...filters, page })}
        />
      )}
    </div>
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
