// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ImageUpload } from '@tempora/contracts';
import { RequestError } from '../domain/request-error';

/**
 * Sends a file straight to storage with a presigned URL (FSD 6.15): no cookies, and the signed
 * headers exactly as the API gave them, or storage rejects the upload.
 */
export async function putToStorage(upload: ImageUpload, file: File): Promise<void> {
  const stored = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.headers,
    body: file,
  }).catch(() => null);
  if (!stored?.ok) throw new RequestError('UPLOAD_FAILED', 'The file could not be uploaded.');
}
