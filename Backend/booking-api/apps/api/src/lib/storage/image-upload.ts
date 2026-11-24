// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { randomUUID } from 'node:crypto';
import type { ImageContentType, ImageUpload, ImageUploadRequest } from '@tempora/contracts';
import { AppError } from '../app-error.js';
import { detectImageType, EXTENSIONS, SIGNATURE_LENGTH } from './image-type.js';
import type { ObjectStorage } from './storage.js';

/** How long an upload URL works: long enough for a slow connection, short if it leaks. */
const UPLOAD_URL_SECONDS = 5 * 60;

const TYPES = Object.keys(EXTENSIONS) as ImageContentType[];

const megabytes = (bytes: number) => `${bytes / (1024 * 1024)} MB`;

const storageUnavailable = () =>
  new AppError({
    status: 503,
    code: 'STORAGE_UNAVAILABLE',
    title: 'Uploads are not available',
    detail: 'No file storage is configured for this installation.',
  });

const uploadMissing = () =>
  new AppError({
    status: 422,
    code: 'UPLOAD_MISSING',
    title: 'Upload not found',
    detail: 'The file did not arrive or the upload link expired. Choose the file again.',
  });

const uploadInvalid = (detail: string) =>
  new AppError({ status: 422, code: 'UPLOAD_INVALID', title: 'File not accepted', detail });

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The upload steps every image shares (FSD 6.15), whatever it belongs to (business logo and
 * cover, therapist photo). Each image lives under its own key prefix, so a key that was
 * signed for one image can never be confirmed for another.
 */
export function createImageUploads(storage: ObjectStorage | null) {
  const ready = () => {
    if (!storage) throw storageUnavailable();
    return storage;
  };

  /** A file nobody references any more; failing to delete it only leaves a stray object. */
  const discard = async (key: string | null): Promise<void> => {
    if (!key || !storage) return;
    await storage.remove(key).catch(() => undefined);
  };

  return {
    discard,

    /** Step 1: checks the declared size and signs a `PUT` for a fresh random key. */
    async presign(
      prefix: string,
      maxBytes: number,
      input: ImageUploadRequest,
    ): Promise<ImageUpload> {
      const store = ready();
      if (input.sizeBytes > maxBytes) {
        throw new AppError({
          status: 400,
          code: 'VALIDATION_FAILED',
          title: 'File too large',
          errors: [{ path: 'sizeBytes', message: `Must be at most ${megabytes(maxBytes)}.` }],
        });
      }
      const key = `${prefix}/${randomUUID()}.${EXTENSIONS[input.contentType]}`;
      const upload = await store.presignUpload({
        key,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        expiresInSeconds: UPLOAD_URL_SECONDS,
      });
      return {
        uploadUrl: upload.url,
        headers: upload.headers,
        key,
        expiresAt: new Date(Date.now() + UPLOAD_URL_SECONDS * 1000).toISOString(),
      };
    },

    /**
     * Step 3: the key must sit under `prefix`, and the stored object must have the allowed
     * size and really be the declared image type (its first bytes). A rejected file is deleted.
     */
    async verify(prefix: string, maxBytes: number, key: string): Promise<void> {
      const store = ready();
      // Another tenant's key, or a made-up one, looks exactly like a missing upload.
      const pattern = new RegExp(`^${escape(prefix)}/[0-9a-f-]{36}\\.(png|jpg|webp)$`);
      if (!pattern.test(key)) throw uploadMissing();
      const object = await store.stat(key);
      if (!object) throw uploadMissing();

      // The extension was chosen by the API from the declared type (step 1).
      const declared = TYPES.find((type) => key.endsWith(`.${EXTENSIONS[type]}`));
      let problem: string | null = null;
      if (object.sizeBytes > maxBytes) problem = `The file is larger than ${megabytes(maxBytes)}.`;
      else if (detectImageType(await store.readStart(key, SIGNATURE_LENGTH)) !== declared) {
        problem = 'The file is not a PNG, JPEG or WebP image.';
      }
      if (problem) {
        await discard(key);
        throw uploadInvalid(problem);
      }
    },
  };
}

export type ImageUploads = ReturnType<typeof createImageUploads>;
