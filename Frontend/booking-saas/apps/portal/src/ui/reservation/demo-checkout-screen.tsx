// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card, Icon } from '@tempora/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCompleteDemoCheckout,
  useCountdown,
  useDemoCheckout,
} from '@/core/reservation/presentation/use-reservation';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { ReservationLoading, ReservationPage } from './reservation-parts';

/**
 * Stand-in for Stripe's hosted Checkout when the API has no Stripe keys (FSD 0.2). Choosing
 * an outcome makes the API emit a signed webhook event, exactly like Stripe would.
 */
export function DemoCheckoutScreen({ sessionId }: Readonly<{ sessionId: string }>) {
  const router = useRouter();
  const params = useSearchParams();
  const tenantId = params.get('tenant');
  const bookingId = params.get('booking');
  const checkout = useDemoCheckout(sessionId, tenantId);
  const complete = useCompleteDemoCheckout(sessionId, tenantId);
  const countdown = useCountdown(checkout.data?.expiresAt ?? null);

  if (checkout.isPending && tenantId) return <ReservationLoading />;
  if (!tenantId || checkout.isError) {
    return (
      <ReservationPage>
        <Card className="flex flex-col gap-3 p-6">
          <h1 className="text-2xl font-extrabold">Payment page unavailable</h1>
          <p className="m-0 text-muted">
            This demo payment does not exist, or the API is connected to Stripe.
          </p>
        </Card>
      </ReservationPage>
    );
  }
  const data = checkout.data!;
  const reservationId = data.reservationId ?? bookingId;
  const open = data.status === 'pending' && !countdown.expired;
  const finish = (outcome: 'paid' | 'expired') =>
    complete.mutate(outcome, {
      onSuccess: () => router.push(`/bookings/${reservationId}/confirmation`),
    });

  return (
    <ReservationPage>
      <Alert tone="info" title="Demo payment">
        No real money is involved. Without Stripe keys, this page plays the role of Stripe Checkout:
        your choice is sent to the API as a signed webhook.
      </Alert>
      <Card className="flex flex-col gap-4 p-6">
        <span className="flex items-center gap-2 text-sm text-muted">
          <Icon name="card" size={18} /> {data.businessName}
        </span>
        <h1 className="m-0 text-2xl font-extrabold">{data.description}</h1>
        <p className="m-0 text-[32px] font-extrabold">{data.amount}</p>
        {open ? (
          <p className="m-0 text-sm text-muted" aria-live="polite">
            This payment page closes in{' '}
            <span className="font-semibold tabular-nums">{countdown.label}</span>
          </p>
        ) : (
          <Alert tone="info">This payment page is closed.</Alert>
        )}
        <RequestErrorAlert error={toRequestErrorView(complete.error)} />
        <div className="flex flex-wrap gap-3">
          <Button size="lg" disabled={!open || complete.isPending} onClick={() => finish('paid')}>
            {complete.isPending ? 'Processing…' : `Pay ${data.amount}`}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            disabled={!open || complete.isPending}
            onClick={() => finish('expired')}
          >
            Simulate expiry
          </Button>
        </div>
        <Link
          href={`/bookings/${reservationId}/pay`}
          className="text-sm font-semibold text-primary-text"
        >
          Back without paying
        </Link>
      </Card>
    </ReservationPage>
  );
}
