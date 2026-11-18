// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Badge } from '@tempora/ui';
import { useApiStatus } from '@/core/health/presentation/use-api-status';

/** Live API connection indicator (top bar). */
export function ApiStatusBadge() {
  const status = useApiStatus();
  return (
    <span aria-live="polite" title={status.detail}>
      <Badge tone={status.tone} dot>
        {status.label}
      </Badge>
    </span>
  );
}
