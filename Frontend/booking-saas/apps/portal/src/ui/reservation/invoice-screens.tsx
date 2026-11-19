// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, Card } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCustomer } from '@/core/account/presentation/use-account';
import { formatPrice } from '@/core/booking/presentation/use-booking';
import { useInvoice, useMyInvoices } from '@/core/reservation/presentation/use-reservation';
import { ReservationLoading, ReservationPage, ReservationUnavailable } from './reservation-parts';

const STATUS = {
  open: { label: 'Unpaid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  void: { label: 'Void', tone: 'neutral' },
} as const;

const dateOnly = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone }).format(instant);

/** FSD 2.1 `/bookings/[id]/invoice`: the invoice, ready to print or save as PDF. */
export function InvoiceScreen({ id }: Readonly<{ id: string }>) {
  const invoice = useInvoice(id);
  if (invoice.isPending) return <ReservationLoading />;
  if (invoice.isError) return <ReservationUnavailable />;
  const data = invoice.data;
  const status = STATUS[data.status];
  const sessionAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: data.timeZone,
  }).format(data.line.startsAt);

  return (
    <ReservationPage>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/bookings/${id}`} className="font-semibold text-primary-text">
          Back to the booking
        </Link>
        <Button variant="secondary" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>

      <Card className="flex flex-col gap-6 p-6 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="m-0 text-sm text-muted">Invoice</p>
            <h1 className="m-0 text-2xl font-extrabold">{data.number}</h1>
          </div>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="m-0 text-sm text-muted">From</p>
            <p className="m-0 font-semibold">{data.business.name}</p>
            <p className="m-0 text-sm">
              {data.branch.name}
              {data.branch.address && `, ${data.branch.address}`}
            </p>
          </div>
          <div>
            <p className="m-0 text-sm text-muted">Billed to</p>
            <p className="m-0 font-semibold">{data.billedTo.name}</p>
            <p className="m-0 text-sm">{data.billedTo.email}</p>
          </div>
        </div>

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Issued</dt>
          <dd className="m-0">{dateOnly(data.issuedAt, data.timeZone)}</dd>
          {data.paidAt && (
            <>
              <dt className="text-muted">Paid</dt>
              <dd className="m-0">{dateOnly(data.paidAt, data.timeZone)}</dd>
            </>
          )}
          {data.voidedAt && (
            <>
              <dt className="text-muted">Void</dt>
              <dd className="m-0">
                {dateOnly(data.voidedAt, data.timeZone)}
                {data.voidReason && ` · ${data.voidReason}`}
              </dd>
            </>
          )}
        </dl>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-border text-left text-muted">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-3">
                <span className="block font-semibold">{data.line.description}</span>
                <span className="block text-muted">
                  {sessionAt} · {data.line.durationMinutes} min · with {data.line.therapist}
                </span>
              </td>
              <td className="py-3 text-right">{formatPrice(data.amountCents)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th className="pt-3 text-left">Total ({data.currency.toUpperCase()})</th>
              <td className="pt-3 text-right text-lg font-extrabold">
                {formatPrice(data.amountCents)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="m-0 text-xs text-muted">Prices exclude tax. Fictional demo business.</p>
      </Card>
    </ReservationPage>
  );
}

/** FSD 2.1 `/account/invoices`: invoices from every business, newest first. */
export function MyInvoicesScreen() {
  const router = useRouter();
  const customer = useCustomer();
  const [page, setPage] = useState(1);
  const list = useMyInvoices(page);
  useEffect(() => {
    if (customer.isSuccess && customer.data === null) {
      router.replace('/login?next=/account/invoices');
    }
  }, [customer.isSuccess, customer.data, router]);
  if (!customer.data) return <ReservationLoading />;

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  return (
    <ReservationPage>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[32px] leading-tight font-extrabold">Invoices</h1>
        <Link href="/account/bookings" className="font-semibold text-primary-text">
          My bookings
        </Link>
      </div>
      {list.isPending && <div className="h-40 animate-pulse rounded-card bg-surface-muted" />}
      {list.isError && <Alert tone="danger">Your invoices could not be loaded.</Alert>}
      {list.data?.items.length === 0 && (
        <Card className="p-6">
          <p className="m-0 font-semibold">No invoices yet.</p>
        </Card>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {list.data.items.map((item) => (
            <li key={item.number}>
              <Link
                href={`/bookings/${item.reservationId}/invoice`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-border bg-surface p-4 hover:border-primary"
              >
                <span>
                  <span className="block font-extrabold">{item.number}</span>
                  <span className="block text-sm text-muted">
                    {item.businessName} · {item.serviceName}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{formatPrice(item.amountCents)}</span>
                  <Badge tone={STATUS[item.status].tone} dot>
                    {STATUS[item.status].label}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </ReservationPage>
  );
}
