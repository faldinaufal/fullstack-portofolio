// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Badge, Button, Card } from '@tempora/ui';
import Link from 'next/link';
import { formatPrice } from '@/core/booking/presentation/use-booking';
import { useInvoice } from '@/core/reservation/presentation/use-reservation';
import { INVOICE_STATUS as STATUS } from './my-invoices-screen';
import { ReservationLoading, ReservationPage, ReservationUnavailable } from './reservation-parts';

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
