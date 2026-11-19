// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bookableBusiness,
  bookingBody,
  expectBooked,
  GUEST,
  nextWeekday,
  nyTime,
  paidBooking,
  portalBrowser,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C, consoleFlows, PEOPLE } from '../../test/console-flows.js';
import { createHarness, type Harness, type TestBrowser } from '../../test/harness.js';

let h: Harness;
let b: BookableBusiness;
let monday: string;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
  b = await bookableBusiness(h);
  monday = nextWeekday(1);
});

const at = (time: string) => nyTime(monday, time);
const LENA = { name: 'Lena Fischer', email: 'lena@veloria.test', phone: '+15550147003' };

/** A manager at another branch, Harbor (no bookings there). */
async function harborManager() {
  const flows = consoleFlows(h);
  const harbor = await flows.createBranch(b.owner, 'Harbor');
  return (await flows.addMember(b.owner, PEOPLE.omar, 'manager', harbor.id)).browser;
}

interface Customer {
  id: string;
  name: string;
  bookingCount: number;
  nextBookingAt: string | null;
  hasAccount: boolean;
}

describe('customers (FSD 2.2, 5.4)', () => {
  it('lists each customer once with booking figures; search; manager scope', async () => {
    await paidBooking(h, b, at('10:00'));
    await paidBooking(h, b, at('14:00')); // Omar again
    await expectBooked(portalBrowser(h), bookingBody(b, at('16:00'), { guest: LENA })); // unpaid

    const list = (await b.owner.get(`${C}/customers`)).json<{ items: Customer[]; total: number }>();
    expect(list.total).toBe(2);
    expect(list.items.map((c) => [c.name, c.bookingCount])).toEqual([
      ['Lena Fischer', 0], // a hold is not a booking yet
      ['Omar Haddad', 2],
    ]);
    expect(list.items[1]!.nextBookingAt).toBe(at('10:00'));

    const found = (await b.owner.get(`${C}/customers?q=fisch`)).json<{ items: Customer[] }>();
    expect(found.items.map((c) => c.name)).toEqual(['Lena Fischer']);

    const manager = await harborManager();
    expect((await manager.get(`${C}/customers`)).json()).toMatchObject({ total: 0 });
    expect((await manager.get(`${C}/customers/${list.items[1]!.id}`)).statusCode).toBe(404);
    expect((await b.staff.get(`${C}/customers`)).statusCode).toBe(403);
  });

  it('a customer’s detail lists their bookings at this business', async () => {
    const first = await paidBooking(h, b, at('10:00'));
    const second = await paidBooking(h, b, at('14:00'));
    const [omar] = (await b.owner.get(`${C}/customers`)).json<{ items: Customer[] }>().items;
    const detail = (await b.owner.get(`${C}/customers/${omar!.id}`)).json<{
      email: string;
      bookings: { id: string; invoice: { id: string } }[];
    }>();
    expect(detail.email).toBe(GUEST.email);
    expect(detail.bookings.map((x) => x.id)).toEqual([second.booking.id, first.booking.id]);
  });
});

describe('invoices (FSD 2.2, 5.4)', () => {
  it('lists with filters; the detail shows the booking and payment attempts', async () => {
    const paid = await paidBooking(h, b, at('10:00'));
    await expectBooked(portalBrowser(h), bookingBody(b, at('16:00'), { guest: LENA }));
    const list = async (query = '') =>
      (await b.owner.get(`${C}/invoices${query}`)).json<{
        items: { id: string; number: string; status: string; customer: { name: string } }[];
        total: number;
      }>();

    expect((await list()).total).toBe(2);
    expect((await list('?status=paid')).items.map((i) => i.number)).toEqual([
      paid.booking.invoiceNumber,
    ]);
    expect((await list('?q=lena')).items.map((i) => i.customer.name)).toEqual(['Lena Fischer']);
    expect((await list(`?q=${paid.booking.invoiceNumber.toLowerCase()}`)).total).toBe(1);

    const id = (await list('?status=paid')).items[0]!.id;
    const detail = (await b.owner.get(`${C}/invoices/${id}`)).json<{
      booking: { id: string; therapist: string };
      payments: { status: string; provider: string }[];
      customer: { email: string };
    }>();
    expect(detail).toMatchObject({
      booking: { id: paid.booking.id, therapist: 'Ines H.' },
      payments: [{ status: 'succeeded', provider: 'demo' }],
      customer: { email: GUEST.email },
    });

    const manager = await harborManager();
    expect((await manager.get(`${C}/invoices`)).json()).toMatchObject({ total: 0 });
    expect((await manager.get(`${C}/invoices/${id}`)).statusCode).toBe(404);
  });
});

describe('CSV export (FSD 5.1)', () => {
  const download = (browser: TestBrowser, path: string) => browser.get(path);

  it('bookings: every row, same filters, a download, audited', async () => {
    await paidBooking(h, b, at('10:00'));
    await paidBooking(h, b, at('14:00'));
    await paidBooking(h, b, nyTime(nextWeekday(2), '10:00'));

    const response = await download(
      b.owner,
      `${C}/bookings?format=csv&from=${monday}&to=${monday}&pageSize=1`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="bookings-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(response.headers['cache-control']).toBe('no-store');
    const lines = response.body.trim().split('\r\n');
    expect(lines[0]).toContain('Booking ID,Starts,Ends,Status');
    expect(lines).toHaveLength(3); // header + the two Monday bookings, despite pageSize=1
    expect(lines[1]).toContain(`${monday} 10:00`);

    const audit = await h.owner.auditLog.findFirstOrThrow({ where: { action: 'export.created' } });
    expect(audit.after).toMatchObject({ list: 'bookings', rows: 2, filters: { from: monday } });
  });

  it('a customer name cannot run as a formula in a spreadsheet', async () => {
    await paidBooking(h, b, at('10:00'));
    await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('14:00'), {
        guest: { name: '=HYPERLINK("http://evil.test","Click")', email: 'evil@veloria.test' },
      }),
    );
    const csv = (await download(b.owner, `${C}/customers?format=csv`)).body;
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"",""Click"")"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('customers and invoices; managers export their branch only; staff cannot', async () => {
    await paidBooking(h, b, at('10:00'));
    const customers = (await download(b.owner, `${C}/customers?format=csv`)).body
      .trim()
      .split('\r\n');
    expect(customers).toHaveLength(2);
    expect(customers[1]).toContain('Omar Haddad,omar@veloria.test');

    const invoices = (await download(b.owner, `${C}/invoices?format=csv`)).body
      .trim()
      .split('\r\n');
    expect(invoices[1]).toContain(',paid,');
    expect(invoices[1]).toContain(',42.17,USD,');

    const manager = await harborManager();
    expect(
      (await download(manager, `${C}/bookings?format=csv`)).body.trim().split('\r\n'),
    ).toHaveLength(1);
    expect((await download(b.staff, `${C}/bookings?format=csv`)).statusCode).toBe(403);
  });
});
