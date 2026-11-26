// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, Icon, SearchField, type IconName } from '@tempora/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/core/booking/presentation/use-booking';
import {
  useInvoiceTotals,
  useMyInvoices,
  type InvoiceStatus,
} from '@/core/reservation/presentation/use-reservation';
import { AccountPage, useRequireCustomer } from './account-page';

export const INVOICE_STATUS = {
  open: { label: 'Unpaid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  void: { label: 'Void', tone: 'neutral' },
} as const;

const STATUS_FILTERS: { value: InvoiceStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'open', label: 'Unpaid' },
  { value: 'void', label: 'Void' },
];

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Waits until typing pauses, so a search is not sent on every key. */
function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * FSD 2.1 `/account/invoices` (DESIGN 5.1, Figma `1:1366`): totals, search, status filter and
 * the invoices from every business. "View" opens the printable invoice; there is no PDF
 * download, refund, HSA or tax line (DESIGN 4.2), so the design's footer note points to Print.
 */
export function MyInvoicesScreen() {
  const customer = useRequireCustomer('/account/invoices');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [text, setText] = useState('');
  const search = useDebounced(text);
  const list = useMyInvoices({ page, status: status || undefined, search });
  const totals = useInvoiceTotals().data;

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const filtered = status !== '' || search.trim() !== '';

  return (
    <AccountPage
      customer={customer}
      eyebrow={
        customer && (
          <>
            <span className="tracking-wide text-primary-text uppercase">Billing</span>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            <span>{customer.name}</span>
          </>
        )
      }
      title="Invoices"
      description="Every invoice from your bookings. Open one to print it or save it as a PDF."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Total
          icon="receipt"
          iconClass="bg-primary-container text-on-primary-container"
          label={totals ? `Paid in ${totals.year}` : 'Paid this year'}
          value={totals && formatPrice(totals.paid.amountCents)}
        />
        <Total
          icon="check-circle"
          iconClass="bg-success-soft text-success"
          label="Invoices paid"
          value={totals && String(totals.paid.count)}
          note="completed"
        />
        <Total
          icon="timer"
          iconClass={
            totals && totals.open.count > 0
              ? 'bg-warning-soft text-warning'
              : 'bg-surface-muted text-muted'
          }
          label="Waiting for payment"
          value={totals && formatPrice(totals.open.amountCents)}
          note={
            totals &&
            (totals.open.count === 0 ? 'Nothing to pay' : plural(totals.open.count, 'booking'))
          }
        />
      </div>

      <section
        aria-label="Invoice list"
        className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-[0_1px_3px_rgba(31,28,27,0.06)]"
      >
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <SearchField
            label="Search invoices"
            placeholder="Search invoice #, business or service…"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setPage(1); // a new search starts on page 1
            }}
            className="h-12 w-full flex-none rounded-xl lg:max-w-[460px] lg:flex-1"
          />
          <div
            role="group"
            aria-labelledby="invoice-status-label"
            className="flex flex-wrap items-center gap-1"
          >
            <span id="invoice-status-label" className="mr-1 text-sm font-semibold sm:mr-2">
              Status:
            </span>
            {STATUS_FILTERS.map((option) => {
              const active = status === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStatus(option.value);
                    setPage(1);
                  }}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors sm:px-4 ${
                    active
                      ? 'bg-surface-muted text-primary-text'
                      : 'text-muted hover:bg-surface-muted hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {list.isPending && (
          <div
            role="status"
            aria-label="Loading"
            className="flex flex-col gap-px border-t border-border-subtle"
          >
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-20 animate-pulse bg-surface-muted" />
            ))}
          </div>
        )}
        {list.isError && (
          <div className="border-t border-border-subtle p-5">
            <Alert tone="danger">Your invoices could not be loaded.</Alert>
          </div>
        )}
        {list.data?.items.length === 0 && (
          <div className="border-t border-border-subtle px-5 py-10 text-center">
            <p className="m-0 font-semibold">
              {filtered ? 'No invoices match your search.' : 'No invoices yet.'}
            </p>
            {!filtered && (
              <p className="mt-1 text-sm text-muted">
                An invoice is created when you book. Find a business to get started.
              </p>
            )}
          </div>
        )}

        {list.data && list.data.items.length > 0 && (
          <table className="w-full border-collapse text-sm sm:text-[15px]">
            <caption className="sr-only">
              Invoices{filtered ? ', filtered' : ''}, page {page} of {pages}
            </caption>
            <thead className="hidden border-y border-border-subtle bg-surface-muted text-left text-xs font-semibold tracking-wider uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-4">
                  Invoice #
                </th>
                <th scope="col" className="px-5 py-4">
                  Business and service
                </th>
                <th scope="col" className="px-5 py-4">
                  Date paid
                </th>
                <th scope="col" className="px-5 py-4">
                  Amount
                </th>
                <th scope="col" className="px-5 py-4">
                  Status
                </th>
                <th scope="col" className="px-5 py-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle border-t border-border-subtle md:border-t-0">
              {list.data.items.map((item) => {
                const state = INVOICE_STATUS[item.status];
                return (
                  // On small screens each row becomes a card (grid), on md+ a table row.
                  <tr
                    key={item.number}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 p-5 md:table-row md:p-0"
                  >
                    <th
                      scope="row"
                      className="text-left font-mono font-bold text-primary-text md:px-5 md:py-5"
                    >
                      {item.number}
                    </th>
                    <td className="font-semibold tabular-nums md:hidden">
                      {formatPrice(item.amountCents)}
                    </td>
                    <td className="col-span-2 md:px-5 md:py-5">
                      <span className="block">
                        {item.businessName} — {item.serviceName}
                      </span>
                    </td>
                    <td className="text-muted md:px-5 md:py-5 md:text-foreground">
                      <span className="md:hidden">Paid </span>
                      {item.paidAt ? (
                        dateFormat.format(item.paidAt)
                      ) : (
                        <span className="text-muted">Not paid</span>
                      )}
                    </td>
                    <td className="hidden font-semibold tabular-nums md:table-cell md:px-5 md:py-5">
                      {formatPrice(item.amountCents)}
                    </td>
                    <td className="justify-self-end md:px-5 md:py-5">
                      <Badge tone={state.tone} dot>
                        {state.label}
                      </Badge>
                    </td>
                    <td className="col-span-2 pt-2 md:px-5 md:py-5 md:pt-5 md:text-right">
                      <Link
                        href={`/bookings/${item.reservationId}/invoice`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-surface-muted px-4 font-semibold text-primary-text hover:bg-border-subtle"
                      >
                        <Icon name="eye" size={18} />
                        View<span className="sr-only"> invoice {item.number}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

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

      <div className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-surface-muted p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm sm:text-[15px]">
          <span className="font-semibold">Need a PDF?</span>{' '}
          <span className="text-muted">
            Open an invoice and choose Print to save it. Each invoice is issued by the business you
            booked with.
          </span>
        </p>
        <Link
          href="/account/bookings"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-text"
        >
          My bookings <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </AccountPage>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function Total({
  icon,
  iconClass,
  label,
  value,
  note,
}: Readonly<{
  icon: IconName;
  iconClass: string;
  label: string;
  value: string | undefined;
  note?: string | undefined;
}>) {
  return (
    <div className="flex items-center gap-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-[0_1px_3px_rgba(31,28,27,0.06)] sm:p-6">
      <span
        aria-hidden="true"
        className={`flex size-14 shrink-0 items-center justify-center rounded-card ${iconClass}`}
      >
        <Icon name={icon} size={24} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wider uppercase">{label}</p>
        {value === undefined ? (
          <div className="mt-1 h-8 w-28 animate-pulse rounded bg-surface-muted" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">
            {value}
            {note && <span className="ml-1.5 text-base font-normal text-muted">{note}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
