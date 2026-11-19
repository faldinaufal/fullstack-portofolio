// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { ConfirmDialog, TextField } from '@tempora/ui';
import { useState } from 'react';
import type { useStepUp } from '@/core/auth/presentation/use-admin-auth';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from './request-error';

/**
 * FSD 2.3 "Verify code … shown as a dialog before sensitive actions": asks for the emailed
 * code; once verified, the action that needed it runs again by itself.
 */
export function StepUpDialog({ stepUp }: Readonly<{ stepUp: ReturnType<typeof useStepUp> }>) {
  const [code, setCode] = useState('');
  const open = stepUp.challenge !== null;
  return (
    <ConfirmDialog
      open={open}
      title="Confirm it is you"
      confirmLabel={stepUp.verify.isPending ? 'Verifying…' : 'Verify and continue'}
      busy={stepUp.verify.isPending || code.length !== 6}
      onConfirm={() => stepUp.verify.mutate({ code }, { onSuccess: () => setCode('') })}
      onCancel={() => {
        setCode('');
        stepUp.cancel();
      }}
    >
      <span className="flex flex-col gap-3">
        <span>
          This change needs a fresh code. We emailed one to {stepUp.challenge?.sentTo}; it is valid
          for 10 minutes, and so is the verification.
        </span>
        <RequestErrorAlert error={toRequestErrorView(stepUp.verify.error)} />
        <TextField
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </span>
    </ConfirmDialog>
  );
}
