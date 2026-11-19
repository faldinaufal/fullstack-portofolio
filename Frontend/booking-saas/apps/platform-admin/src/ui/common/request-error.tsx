// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { Alert } from '@tempora/ui';
import type { RequestErrorView } from '@/core/shared/presentation/error-view';

/** Error summary for a failed action, with a support reference when unexpected. */
export function RequestErrorAlert({ error }: Readonly<{ error: RequestErrorView | null }>) {
  if (!error) return null;
  return (
    <Alert tone="danger">
      {error.message}
      {error.reference && (
        <span className="mt-1 block text-xs text-muted">Reference: {error.reference}</span>
      )}
    </Alert>
  );
}
