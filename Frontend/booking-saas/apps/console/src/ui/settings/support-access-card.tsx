// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
} from '@tempora/ui';
import { useState } from 'react';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import {
  durationLabel,
  SUPPORT_DURATIONS,
  timeLeft,
  useGrantSupport,
  useRevokeSupport,
  useSupportGrants,
  type SupportGrant,
} from '@/core/support/presentation/use-support';
import { PLATFORM_TIME_ZONE } from '@/core/shared/presentation/time-zone';
import { RequestErrorAlert } from '@/ui/common/request-error';

const when = (instant: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PLATFORM_TIME_ZONE,
  }).format(instant);

const STATUS: Record<SupportGrant['status'], { label: string; tone: 'success' | 'neutral' }> = {
  active: { label: 'Open', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
  revoked: { label: 'Revoked', tone: 'neutral' },
};

/**
 * FSD 1.4 / 3.10: the owner opens support access for 1, 24 or 72 hours and can close it at
 * any time. Tempora then reads bookings, customers and invoices, never changes them, and
 * every page it opens appears in the audit log.
 */
export function SupportAccessCard() {
  const grants = useSupportGrants();
  const grant = useGrantSupport();
  const revoke = useRevokeSupport();
  const [revoking, setRevoking] = useState(false);
  const active = grants.data?.active ?? null;
  const left = active && timeLeft(active, new Date());
  const error = toRequestErrorView(grant.error ?? revoke.error);

  return (
    <Card className="max-w-[720px]">
      <CardHeader>
        <CardTitle>Support access</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted">
          Lets the Tempora team look at your bookings, customers and invoices to help with a
          problem. They can read, never change anything, and every page they open is written to your
          audit log.
        </p>
        <RequestErrorAlert error={error} />
        {grants.isError && <Alert tone="danger">Support access could not be loaded.</Alert>}

        {active && left ? (
          <Alert tone="info" title={`Open until ${when(active.expiresAt)} (${left} left)`}>
            Granted by {active.grantedBy}. Granting again starts a new period from now.
          </Alert>
        ) : (
          grants.data && <p className="font-semibold">Closed: Tempora cannot see your data.</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {SUPPORT_DURATIONS.map((hours) => (
            <Button
              key={hours}
              variant="secondary"
              disabled={grant.isPending || !grants.data}
              onClick={() => grant.mutate(hours)}
            >
              {active ? 'Open for' : 'Grant for'} {durationLabel(hours)}
            </Button>
          ))}
          {active && (
            <Button variant="danger" disabled={revoke.isPending} onClick={() => setRevoking(true)}>
              Revoke now
            </Button>
          )}
        </div>

        {grants.data && grants.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <caption className="sr-only">Recent support grants</caption>
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  {['Status', 'From', 'Until', 'Granted by'].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grants.data.items.map((g) => (
                  <tr key={g.id} className="border-t border-border">
                    <td className="py-2 pr-4">
                      <Badge tone={STATUS[g.status].tone} dot>
                        {STATUS[g.status].label}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{when(g.startsAt)}</td>
                    <td className="py-2 pr-4">{when(g.revokedAt ?? g.expiresAt)}</td>
                    <td className="py-2 pr-4">{g.grantedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={revoking}
        title="Revoke support access?"
        confirmLabel="Revoke"
        destructive
        busy={revoke.isPending}
        onConfirm={() => {
          setRevoking(false);
          if (active) revoke.mutate(active.id);
        }}
        onCancel={() => setRevoking(false)}
      >
        Tempora loses access at once, also to pages already open.
      </ConfirmDialog>
    </Card>
  );
}
