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
import { formatPrice, formatWhen } from '@/core/bookings/presentation/use-bookings';
import { useBranches } from '@/core/branches/presentation/use-branches';
import {
  INVOICE_STATUS,
  shortDate,
  useExportUrls,
  useInvoice,
  useInvoices,
  type InvoiceFilters,
  type InvoiceStatus,
} from '@/core/records/presentation/use-records';
import { PageHeader } from '@/ui/common/page-header';
import { Pagination } from './pagination';

const PAYMENT_STATUS: Record<string, string> = {
  pending: 'Checkout open',
  succeeded: 'Paid',
  expired: 'Checkout expired',
  failed: 'Failed',
  needs_attention: 'Needs attention: paid after the booking ended',
};

/** FSD 2.2 `/invoices`: owner (every branch) and manager (own branch). */
export function InvoicesScreen() {
  const member = useCurrentMember();
  const branches = useBranches();
  const exports = useExportUrls();
  const [filters, setFilters] = useState<InvoiceFilters>({ page: 1 });
  const list = useInvoices(filters);
  const set = (changes: Partial<InvoiceFilters>) =>
    setFilters((current) => ({ ...current, page: 1, ...changes }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Invoices"
        description="One invoice per booking, numbered without gaps."
        actions={
          <a href={exports.invoices(filters)} className={buttonVariants({ variant: 'secondary' })}>
            Export CSV
          </a>
        }
      />
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <TextField
            label="Search"
            placeholder="Number or customer"
            value={filters.q ?? ''}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
          <SelectField
            label="Status"
            options={[
              { value: '', label: 'All statuses' },
              ...(Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((value) => ({
                value,
                label: INVOICE_STATUS[value].label,
              })),
            ]}
            value={filters.status ?? ''}
            onChange={(e) => set({ status: (e.target.value || undefined) as InvoiceStatus })}
          />
          {member.role === 'owner' && (
            <SelectField
              label="Branch"
              options={[
                { value: '', label: 'All branches' },
                ...(branches.data ?? []).map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={filters.branchId ?? ''}
              onChange={(e) => set({ branchId: e.target.value || undefined })}
            />
          )}
          <TextField
            label="Issued from"
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => set({ from: e.target.value || undefined })}
          />
          <TextField
            label="Issued to"
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => set({ to: e.target.value || undefined })}
          />
        </CardContent>
      </Card>

      {list.isError && <Alert tone="danger">Invoices could not be loaded.</Alert>}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Invoice
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Issued
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-muted">
                    No invoices match these filters.
                  </td>
                </tr>
              )}
              {list.data?.items.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-bold text-foreground hover:text-primary-text"
                    >
                      {inv.number}
                    </Link>
                    <span className="block text-[13px] text-muted">
                      {inv.serviceName} · {inv.branch.name}
                    </span>
                  </td>
                  <td className="px-3 py-3">{inv.customer.name}</td>
                  <td className="px-3 py-3">{shortDate(inv.issuedAt, list.data.timeZone)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={INVOICE_STATUS[inv.status].tone} dot>
                      {INVOICE_STATUS[inv.status].label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">{formatPrice(inv.amountCents)}</td>
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

/** `/invoices/[id]`: the invoice, its booking, customer and every payment attempt. */
export function InvoiceDetailScreen({ id }: Readonly<{ id: string }>) {
  const invoice = useInvoice(id);
  if (invoice.isPending)
    return <div className="h-64 animate-pulse rounded-card bg-surface-muted" />;
  if (invoice.isError) {
    return (
      <Alert tone="danger">
        This invoice does not exist or belongs to another branch.{' '}
        <Link href="/invoices" className="font-semibold underline">
          Back to invoices
        </Link>
      </Alert>
    );
  }
  const inv = invoice.data;
  const tz = inv.timeZone;
  const status = INVOICE_STATUS[inv.status];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Invoice ${inv.number}`}
        description={`${formatPrice(inv.amountCents)} ${inv.currency.toUpperCase()} · issued ${shortDate(inv.issuedAt, tz)}`}
        actions={
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        }
      />
      {inv.voidReason && <Alert tone="info">Void: {inv.voidReason}</Alert>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <Link href={`/bookings/${inv.booking.id}`} className="font-semibold text-primary-text">
              {formatWhen(inv.booking, tz)}
            </Link>
            <span>
              {inv.serviceName} · {inv.booking.therapist} · {inv.branch.name}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Billed to</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <Link
              href={`/customers/${inv.customer.id}`}
              className="font-semibold text-primary-text"
            >
              {inv.customer.name}
            </Link>
            <span>{inv.customer.email}</span>
            {inv.customer.phone && <span>{inv.customer.phone}</span>}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payment attempts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="m-0 list-none p-0 text-sm">
            {inv.payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap justify-between gap-3 border-t border-border px-5 py-3 first:border-t-0"
              >
                <span>
                  {PAYMENT_STATUS[p.status] ?? p.status}{' '}
                  <span className="text-muted">
                    ({p.provider === 'demo' ? 'demo checkout' : 'Stripe'})
                  </span>
                </span>
                <span className="text-muted">
                  {formatPrice(p.amountCents)} · {shortDate(p.createdAt, tz)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
