// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  BUSINESS_IMAGE_FALLBACK,
  BusinessLogo,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  UploadedImage,
} from '@tempora/ui';
import { useId, useState, type ChangeEvent } from 'react';
import {
  IMAGE_RULES,
  imageProblem,
  useBusinessImage,
  type ImageKind,
} from '@/core/catalogue/presentation/use-catalogue';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';

const COPY: Record<ImageKind, { title: string; hint: string }> = {
  logo: {
    title: 'Logo',
    hint: 'Shown on your directory card and booking page. A square image works best.',
  },
  cover: {
    title: 'Cover photo',
    hint: 'The wide photo at the top of your booking page, e.g. your reception or a treatment room.',
  },
};

const ERRORS = {
  UPLOAD_INVALID: 'This file is not a PNG, JPEG or WebP image, or it is too large.',
  UPLOAD_MISSING: 'The upload did not finish. Choose the file again.',
  UPLOAD_FAILED: 'The file could not be uploaded. Check your connection and try again.',
  STORAGE_UNAVAILABLE: 'Uploads are not available on this installation.',
  VERSION_CONFLICT: 'Settings were changed in the meantime. Reload the page and try again.',
};

/** FSD 2.2 Settings, 6.15: the logo and cover photo customers see in the Portal. */
export function BusinessImagesCard({
  version,
  logoUrl,
  coverUrl,
  name,
}: Readonly<{ version: number; logoUrl: string | null; coverUrl: string | null; name: string }>) {
  return (
    <Card className="mb-5 max-w-[720px]">
      <CardHeader>
        <CardTitle>Logo and cover photo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-sm text-muted">
          Optional. Without them, customers see your initials on a plain background.
        </p>
        <ImageField kind="logo" version={version} url={logoUrl} name={name} />
        <ImageField kind="cover" version={version} url={coverUrl} name={name} />
      </CardContent>
    </Card>
  );
}

function ImageField({
  kind,
  version,
  url,
  name,
}: Readonly<{ kind: ImageKind; version: number; url: string | null; name: string }>) {
  const inputId = useId();
  const { upload, remove } = useBusinessImage(kind);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;
  const error = toRequestErrorView(upload.error ?? remove.error, ERRORS);
  const { title, hint } = COPY[kind];
  const maxMb = IMAGE_RULES[kind].maxBytes / (1024 * 1024);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // choosing the same file again still fires `change`
    if (!file) return;
    const found = imageProblem(kind, file);
    setProblem(found);
    upload.reset();
    remove.reset();
    if (!found) upload.mutate({ version, file });
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Preview kind={kind} url={url} name={name} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 id={`${inputId}-title`} className="text-base font-semibold">
            {title}
          </h3>
          <p className="text-sm text-muted">
            {hint} PNG, JPEG or WebP, at most {maxMb} MB.
          </p>
          <div className="flex flex-wrap gap-2">
            {/* A styled label opens the native picker; the input stays keyboard-reachable. */}
            <input
              id={inputId}
              type="file"
              accept={IMAGE_RULES[kind].types.join(',')}
              className="peer sr-only"
              onChange={choose}
              disabled={busy}
            />
            <label
              htmlFor={inputId}
              aria-disabled={busy}
              className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-60`}
            >
              {upload.isPending
                ? 'Uploading…'
                : url
                  ? `Replace ${title.toLowerCase()}`
                  : `Upload ${title.toLowerCase()}`}
            </label>
            {url && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => remove.mutate(version)}
              >
                {remove.isPending ? 'Removing…' : 'Remove'}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div aria-live="polite">
        {problem && <Alert tone="danger">{problem}</Alert>}
        <RequestErrorAlert error={error} />
        {upload.isSuccess && <Alert tone="success">{title} saved.</Alert>}
        {remove.isSuccess && <Alert tone="success">{title} removed.</Alert>}
      </div>
    </section>
  );
}

/** The logo as a tile, the cover as a wide strip, like the Portal shows them. */
function Preview({
  kind,
  url,
  name,
}: Readonly<{ kind: ImageKind; url: string | null; name: string }>) {
  if (kind === 'logo') return <BusinessLogo name={name} url={url} className="size-20 text-lg" />;
  const frame = 'aspect-[16/7] w-full shrink-0 rounded-card sm:w-56';
  if (url) {
    return (
      <UploadedImage
        src={url}
        alt="Current cover photo"
        className={`${frame} border border-border-subtle`}
      />
    );
  }
  return <div aria-hidden="true" className={`${frame} ${BUSINESS_IMAGE_FALLBACK}`} />;
}
