// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  dollars,
  useSupportBooking,
  useSupportBookings,
  useSupportCustomer,
  useSupportCustomers,
  useSupportInvoice,
  useSupportInvoices,
  type SupportBooking,
  type SupportQuery,
} from '@/core/support/presentation/use-support';
import { SupportGate } from './support-frame';

const when = (instant: Date | null, timeZone: string) =>
  instant
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).format(instant)
    : '—';

const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
  'expired',
] as const;
const label = (status: string) => status.replace('_', ' ');

/** Search, an optional status filter, and the page number. */
function useListQuery() {
  const [query, setQuery] = useState<SupportQuery>({ page: 1 });
  const set = (changes: Partial<SupportQuery>) => setQuery((q) => ({ ...q, page: 1, ...changes }));
  return { query, set, setPage: (page: number) => setQuery((q) => ({ ...q, page })) };
}

function Filters({
  search,
  statuses,
  list,
}: Readonly<{
  search: string;
  statuses?: readonly string[];
  list: ReturnType<typeof useListQuery>;
}>) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
        <TextField
          label="Search"
          placeholder={search}
          value={list.query.q ?? ''}
          onChange={(e) => list.set({ q: e.target.value || undefined })}
        />
        {statuses && (
          <Select
            label="Status"
            options={[
              { value: '', label: 'All' },
              ...statuses.map((s) => ({ value: s, label: label(s) })),
            ]}
            value={list.query.status ?? ''}
            onValueChange={(value) => list.set({ status: value || undefined })}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Table({
  caption,
  headers,
  empty,
  children,
}: Readonly<{ caption: string; headers: string[]; empty: boolean; children: ReactNode }>) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left text-[13px] text-muted">
              {headers.map((h) => (
                <th key={h} scope="col" className="px-5 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty && (
              <tr>
                <td colSpan={headers.length} className="px-5 py-6 text-muted">
                  Nothing matches.
                </td>
              </tr>
            )}
            {children}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

const Cell = ({ children }: Readonly<{ children: ReactNode }>) => (
  <td className="px-5 py-3">{children}</td>
);

function Pager({
  page,
  total,
  pageSize,
  onPage,
}: Readonly<{ page: number; total: number; pageSize: number; onPage: (page: number) => void }>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted">
        Page {page} of {pages}
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

/** Label and value pairs of a detail card. */
function Facts({ title, facts }: Readonly<{ title: string; facts: [string, ReactNode][] }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-muted">{term}</dt>
              <dd className="font-semibold">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

const linkClass = 'font-bold hover:text-primary-text';

function BookingRows({
  tenantId,
  rows,
  timeZone,
}: Readonly<{ tenantId: string; rows: SupportBooking[]; timeZone: string }>) {
  return rows.map((b) => (
    <tr key={b.id} className="border-t border-border">
      <Cell>
        <Link href={`/tenants/${tenantId}/support/bookings/${b.id}`} className={linkClass}>
          {when(b.startsAt, timeZone)}
        </Link>
      </Cell>
      <Cell>
        <Badge tone="neutral">{label(b.status)}</Badge>
      </Cell>
      <Cell>{b.serviceName}</Cell>
      <Cell>{b.therapist}</Cell>
      <Cell>{b.branch}</Cell>
      <Cell>{b.customer.name}</Cell>
      <Cell>{dollars(b.priceCents)}</Cell>
    </tr>
  ));
}

const BOOKING_HEADERS = ['Starts', 'Status', 'Service', 'Therapist', 'Branch', 'Customer', 'Price'];

export function SupportBookingsScreen({ tenantId }: Readonly<{ tenantId: string }>) {
  const list = useListQuery();
  const bookings = useSupportBookings(tenantId, list.query);
  return (
    <>
      <Filters search="Customer name or email" statuses={BOOKING_STATUSES} list={list} />
      <SupportGate query={bookings}>
        {(page) => (
          <>
            <Table caption="Bookings" headers={BOOKING_HEADERS} empty={page.items.length === 0}>
              <BookingRows tenantId={tenantId} rows={page.items} timeZone={page.timeZone} />
            </Table>
            <Pager {...page} onPage={list.setPage} />
          </>
        )}
      </SupportGate>
    </>
  );
}

export function SupportBookingScreen({ tenantId, id }: Readonly<{ tenantId: string; id: string }>) {
  const booking = useSupportBooking(tenantId, id);
  return (
    <SupportGate query={booking}>
      {(b) => (
        <div className="grid gap-5 lg:grid-cols-2">
          <Facts
            title={`${b.serviceName} · ${label(b.status)}`}
            facts={[
              ['Starts', when(b.startsAt, b.timeZone)],
              ['Ends', when(b.endsAt, b.timeZone)],
              ['Duration', `${b.durationMinutes} min + ${b.bufferMinutes} min buffer`],
              ['Therapist', b.therapist],
              ['Branch', b.branch],
              ['Price', dollars(b.priceCents)],
              ['Invoice', `${b.invoice.number} (${b.invoice.status})`],
              ['Cancel reason', b.cancelReason],
            ]}
          />
          <Facts
            title="Customer"
            facts={[
              [
                'Name',
                <Link
                  key="name"
                  href={`/tenants/${tenantId}/support/customers/${b.customerId}`}
                  className="text-primary-text"
                >
                  {b.customer.name}
                </Link>,
              ],
              ['Email', b.customer.email],
              ['Phone', b.customerPhone],
              ['Notes', b.notes],
            ]}
          />
        </div>
      )}
    </SupportGate>
  );
}

export function SupportCustomersScreen({ tenantId }: Readonly<{ tenantId: string }>) {
  const list = useListQuery();
  const customers = useSupportCustomers(tenantId, list.query);
  return (
    <>
      <Filters search="Name or email" list={list} />
      <SupportGate query={customers}>
        {(page) => (
          <>
            <Table
              caption="Customers"
              headers={['Name', 'Email', 'Phone', 'Bookings', 'Last visit', 'Next booking']}
              empty={page.items.length === 0}
            >
              {page.items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <Cell>
                    <Link
                      href={`/tenants/${tenantId}/support/customers/${c.id}`}
                      className={linkClass}
                    >
                      {c.name}
                    </Link>
                  </Cell>
                  <Cell>{c.email}</Cell>
                  <Cell>{c.phone ?? '—'}</Cell>
                  <Cell>{c.bookingCount}</Cell>
                  <Cell>{when(c.lastVisitAt, page.timeZone)}</Cell>
                  <Cell>{when(c.nextBookingAt, page.timeZone)}</Cell>
                </tr>
              ))}
            </Table>
            <Pager {...page} onPage={list.setPage} />
          </>
        )}
      </SupportGate>
    </>
  );
}

export function SupportCustomerScreen({
  tenantId,
  id,
}: Readonly<{ tenantId: string; id: string }>) {
  const customer = useSupportCustomer(tenantId, id);
  return (
    <SupportGate query={customer}>
      {(c) => (
        <>
          <Facts
            title={c.name}
            facts={[
              ['Email', c.email],
              ['Phone', c.phone],
              ['Portal account', c.hasAccount ? 'Yes' : 'No'],
              ['Bookings', c.bookingCount],
              ['Last visit', when(c.lastVisitAt, c.timeZone)],
              ['Next booking', when(c.nextBookingAt, c.timeZone)],
            ]}
          />
          <Table caption="Their bookings" headers={BOOKING_HEADERS} empty={c.bookings.length === 0}>
            <BookingRows tenantId={tenantId} rows={c.bookings} timeZone={c.timeZone} />
          </Table>
        </>
      )}
    </SupportGate>
  );
}

const INVOICE_STATUSES = ['open', 'paid', 'void'] as const;

export function SupportInvoicesScreen({ tenantId }: Readonly<{ tenantId: string }>) {
  const list = useListQuery();
  const invoices = useSupportInvoices(tenantId, list.query);
  return (
    <>
      <Filters search="Invoice number or customer" statuses={INVOICE_STATUSES} list={list} />
      <SupportGate query={invoices}>
        {(page) => (
          <>
            <Table
              caption="Invoices"
              headers={['Number', 'Status', 'Amount', 'Issued', 'Paid', 'Customer', 'Service']}
              empty={page.items.length === 0}
            >
              {page.items.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <Cell>
                    <Link
                      href={`/tenants/${tenantId}/support/invoices/${i.id}`}
                      className={linkClass}
                    >
                      {i.number}
                    </Link>
                  </Cell>
                  <Cell>
                    <Badge tone="neutral">{i.status}</Badge>
                  </Cell>
                  <Cell>{dollars(i.amountCents)}</Cell>
                  <Cell>{when(i.issuedAt, page.timeZone)}</Cell>
                  <Cell>{when(i.paidAt, page.timeZone)}</Cell>
                  <Cell>{i.customer}</Cell>
                  <Cell>{i.serviceName}</Cell>
                </tr>
              ))}
            </Table>
            <Pager {...page} onPage={list.setPage} />
          </>
        )}
      </SupportGate>
    </>
  );
}

export function SupportInvoiceScreen({ tenantId, id }: Readonly<{ tenantId: string; id: string }>) {
  const invoice = useSupportInvoice(tenantId, id);
  return (
    <SupportGate query={invoice}>
      {(i) => (
        <>
          <Facts
            title={`Invoice ${i.number}`}
            facts={[
              ['Status', i.status],
              ['Amount', dollars(i.amountCents)],
              ['Issued', when(i.issuedAt, i.timeZone)],
              ['Paid', when(i.paidAt, i.timeZone)],
              ['Void reason', i.voidReason],
              ['Customer', `${i.customer}${i.customerEmail ? ` · ${i.customerEmail}` : ''}`],
              [
                'Booking',
                <Link
                  key="booking"
                  href={`/tenants/${tenantId}/support/bookings/${i.bookingId}`}
                  className="text-primary-text"
                >
                  {i.serviceName} at {i.branch}
                </Link>,
              ],
            ]}
          />
          <Table
            caption="Payment attempts"
            headers={['When', 'Provider', 'Status', 'Amount']}
            empty={i.payments.length === 0}
          >
            {i.payments.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <Cell>{when(p.createdAt, i.timeZone)}</Cell>
                <Cell>{p.provider}</Cell>
                <Cell>{label(p.status)}</Cell>
                <Cell>{dollars(p.amountCents)}</Cell>
              </tr>
            ))}
          </Table>
        </>
      )}
    </SupportGate>
  );
}
