// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TherapistPhoto,
} from '@tempora/ui';
import { useId, useState, type ChangeEvent } from 'react';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PHOTO_RULE, photoProblem, useMemberPhoto } from '@/core/team/presentation/use-team';
import { RequestErrorAlert } from '@/ui/common/request-error';

const ERRORS = {
  UPLOAD_INVALID: 'This file is not a PNG, JPEG or WebP image, or it is larger than 1 MB.',
  UPLOAD_MISSING: 'The upload did not finish. Choose the file again.',
  UPLOAD_FAILED: 'The file could not be uploaded. Check your connection and try again.',
  STORAGE_UNAVAILABLE: 'Uploads are not available on this installation.',
};

/**
 * FSD 2.2 Team member detail, 6.15: the therapist photo customers see on the business page
 * and in their bookings. Shown to whoever may manage the therapist's time off.
 */
export function MemberPhotoCard({
  id,
  name,
  photoUrl,
  mine,
}: Readonly<{ id: string; name: string; photoUrl: string | null; mine: boolean }>) {
  const inputId = useId();
  const { upload, remove } = useMemberPhoto(id);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;
  const error = toRequestErrorView(upload.error ?? remove.error, ERRORS);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // choosing the same file again still fires `change`
    if (!file) return;
    const found = photoProblem(file);
    setProblem(found);
    upload.reset();
    remove.reset();
    if (!found) upload.mutate(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <TherapistPhoto name={name} url={photoUrl} className="size-24 text-2xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm text-muted">
              {mine ? 'Customers see your photo' : 'Customers see this photo'} on the booking page
              and in their bookings. A square portrait works best. PNG, JPEG or WebP, at most 1 MB.
              Without a photo, customers see the initials.
            </p>
            <div className="flex flex-wrap gap-2">
              {/* A styled label opens the native picker; the input stays keyboard-reachable. */}
              <input
                id={inputId}
                type="file"
                accept={PHOTO_RULE.types.join(',')}
                className="peer sr-only"
                onChange={choose}
                disabled={busy}
              />
              <label
                htmlFor={inputId}
                aria-disabled={busy}
                className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-60`}
              >
                {upload.isPending ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload photo'}
              </label>
              {photoUrl && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate()}>
                  {remove.isPending ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </div>
          </div>
        </div>
        <div aria-live="polite">
          {problem && <Alert tone="danger">{problem}</Alert>}
          <RequestErrorAlert error={error} />
          {upload.isSuccess && <Alert tone="success">Photo saved.</Alert>}
          {remove.isSuccess && <Alert tone="success">Photo removed.</Alert>}
        </div>
      </CardContent>
    </Card>
  );
}
