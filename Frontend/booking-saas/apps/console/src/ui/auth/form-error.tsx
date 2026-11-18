// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { Alert } from '@tempora/ui';
import type { ErrorView } from '@/core/auth/presentation/auth-messages';

/** Error summary at the top of a form (FSD 8.4), with a support reference when unexpected. */
export function FormError({ error }: Readonly<{ error: ErrorView | null }>) {
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
