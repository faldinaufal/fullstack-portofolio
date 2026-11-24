// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  Select,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import {
  formatPrice,
  formatWhen,
  STATUS,
  useBookings,
  useBookingsExportUrl,
  type BookingFilters,
  type BookingStatus,
} from '@/core/bookings/presentation/use-bookings';
import { useBranches } from '@/core/branches/presentation/use-branches';
import { PageHeader } from '@/ui/common/page-header';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...(Object.keys(STATUS) as BookingStatus[]).map((value) => ({
    value,
    label: STATUS[value].label,
  })),
];

/** FSD 2.2 `/bookings`: owner (all branches) and manager (own branch). CSV export in 6b. */
export function BookingsScreen() {
  const member = useCurrentMember();
  const branches = useBranches();
  const [filters, setFilters] = useState<BookingFilters>({ sort: 'startsAt', page: 1 });
  const list = useBookings(filters);
  const exportUrl = useBookingsExportUrl(filters);
  const set = (changes: Partial<BookingFilters>) =>
    setFilters((current) => ({ ...current, page: 1, ...changes }));
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bookings"
        description={member.role === 'owner' ? 'Every branch.' : 'Bookings at your branch.'}
        actions={
          <a href={exportUrl} className={buttonVariants({ variant: 'secondary' })}>
            Export CSV
          </a>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <TextField
            label="Customer"
            placeholder="Name or email"
            value={filters.q ?? ''}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={filters.status ?? ''}
            onValueChange={(value) => set({ status: (value || undefined) as BookingStatus })}
          />
          {member.role === 'owner' && (
            <Select
              label="Branch"
              options={[
                { value: '', label: 'All branches' },
                ...(branches.data ?? []).map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={filters.branchId ?? ''}
              onValueChange={(value) => set({ branchId: value || undefined })}
            />
          )}
          <TextField
            label="From"
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => set({ from: e.target.value || undefined })}
          />
          <TextField
            label="To"
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => set({ to: e.target.value || undefined })}
          />
        </CardContent>
      </Card>

      {list.isError && <Alert tone="danger">Bookings could not be loaded.</Alert>}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  <button
                    type="button"
                    className="font-semibold"
                    onClick={() =>
                      set({ sort: filters.sort === 'startsAt' ? '-startsAt' : 'startsAt' })
                    }
                  >
                    When {filters.sort === 'startsAt' ? '↑' : '↓'}
                  </button>
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Service
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Therapist
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {list.isPending && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {list.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-muted">
                    No bookings match these filters.
                  </td>
                </tr>
              )}
              {list.data?.items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link
                      href={`/bookings/${row.id}`}
                      className="font-bold text-foreground hover:text-primary-text"
                    >
                      {formatWhen(row, list.data.timeZone)}
                    </Link>
                    {member.role === 'owner' && (
                      <span className="block text-[13px] text-muted">{row.branch.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.customer.name}
                    {row.customer.email && (
                      <span className="block text-[13px] text-muted">{row.customer.email}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{row.serviceName}</td>
                  <td className="px-3 py-3">{row.therapist.name}</td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS[row.status].tone} dot>
                      {STATUS[row.status].label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">{formatPrice(row.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {filters.page} of {pages} · {list.data?.total} bookings
          </span>
          <Button
            variant="secondary"
            disabled={filters.page >= pages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
