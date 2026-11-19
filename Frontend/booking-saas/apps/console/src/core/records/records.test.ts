// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import { describe, expect, it } from 'vitest';
import { createHttpBookingRepository } from '../bookings/data/http-booking-repository';
import { createHttpRecordsRepository, toCustomer, toInvoice } from './data/http-records-repository';

const API = 'http://localhost:4000';
const client = {} as ApiClient;

describe('CSV export links (FSD 5.1)', () => {
  it('carry the table filters but not the page, and ask for CSV', () => {
    const records = createHttpRecordsRepository(client, API);
    expect(records.customersExportUrl({ q: 'lena', sort: '-lastVisit', page: 3 })).toBe(
      `${API}/v1/console/customers?q=lena&sort=-lastVisit&format=csv`,
    );
    expect(records.invoicesExportUrl({ status: 'paid', q: undefined, page: 1 })).toBe(
      `${API}/v1/console/invoices?status=paid&format=csv`,
    );
    const bookings = createHttpBookingRepository(client, API);
    expect(
      bookings.exportUrl({ sort: 'startsAt', page: 2, from: '2026-11-23', to: '2026-11-23' }),
    ).toBe(`${API}/v1/console/bookings?sort=startsAt&from=2026-11-23&to=2026-11-23&format=csv`);
  });
});

describe('records mapping', () => {
  it('turns API dates into dates and keeps empty ones empty', () => {
    const customer = toCustomer({
      id: 'fa1d0000-0000-4000-8000-000000004217',
      name: 'Omar Haddad',
      email: 'omar@veloria.test',
      phone: null,
      hasAccount: false,
      bookingCount: 2,
      lastVisitAt: null,
      nextBookingAt: '2026-11-23T15:00:00.000Z',
    });
    expect(customer.lastVisitAt).toBeNull();
    expect(customer.nextBookingAt).toEqual(new Date('2026-11-23T15:00:00Z'));

    const invoice = toInvoice({
      id: 'fa1d0000-0000-4000-8000-000000000021',
      number: 'LUM-2026-000001',
      status: 'paid',
      amountCents: 4217,
      currency: 'usd',
      issuedAt: '2026-11-20T10:00:00.000Z',
      paidAt: '2026-11-20T10:05:00.000Z',
      voidedAt: null,
      bookingId: 'fa1d0000-0000-4000-8000-000000000022',
      serviceName: 'Deep Tissue Massage',
      branch: { id: 'fa1d0000-0000-4000-8000-000000000023', name: 'Downtown' },
      customer: { id: 'fa1d0000-0000-4000-8000-000000004217', name: 'Omar Haddad' },
    });
    expect(invoice.paidAt).toEqual(new Date('2026-11-20T10:05:00Z'));
    expect(invoice.voidedAt).toBeNull();
  });
});
