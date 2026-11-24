// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Object storage as the API sees it (FSD 0.2, 6.15). Two implementations: S3 (Cloudflare R2
 * in production, SeaweedFS locally) and an in-memory store for tests. Files go from the browser
 * straight to storage through presigned URLs; the API only signs, checks and deletes.
 */

export interface PresignedUpload {
  url: string;
  /** Headers the browser must send unchanged: they are part of the signature. */
  headers: Record<string, string>;
}

export interface StoredObject {
  sizeBytes: number;
}

export interface ObjectStorage {
  /** A `PUT` URL that only accepts exactly this type and size, valid for `expiresInSeconds`. */
  presignUpload(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
    expiresInSeconds: number;
  }): Promise<PresignedUpload>;
  /** Size of a stored object, or null when it does not exist. */
  stat(key: string): Promise<StoredObject | null>;
  /** The first `length` bytes, to check the file's real type. */
  readStart(key: string, length: number): Promise<Uint8Array>;
  /** Deleting a missing object is not an error. */
  remove(key: string): Promise<void>;
  /** Where browsers load the object (`S3_PUBLIC_BASE_URL` + key). */
  publicUrl(key: string): string;
}

/** Joins the public base URL and a key without doubling or dropping the slash. */
export const joinPublicUrl = (baseUrl: string, key: string) =>
  `${baseUrl.replace(/\/+$/, '')}/${key}`;

/** Public URL of an uploaded image; null without an image or without storage (FSD 6.15). */
export const imageUrl = (storage: ObjectStorage | null, key: string | null) =>
  key && storage ? storage.publicUrl(key) : null;
