// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { joinPublicUrl, type ObjectStorage } from './storage.js';

export interface S3StorageConfig {
  /** How the API reaches storage, e.g. `http://storage:8333` inside Docker. */
  endpoint: string;
  /** Endpoint written into upload URLs, when browsers reach storage elsewhere. */
  uploadEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

const isMissing = (error: unknown) =>
  error instanceof NotFound ||
  (error instanceof S3ServiceException &&
    (error.name === 'NoSuchKey' || error.$metadata.httpStatusCode === 404));

/**
 * Works with R2 and SeaweedFS alike: both speak the S3 API. Path-style URLs
 * (`endpoint/bucket/key`) are used: the local server needs them and R2 accepts them.
 */
export function createS3Storage(config: S3StorageConfig): ObjectStorage {
  const client = (endpoint: string) =>
    new S3Client({
      endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // No automatic checksums: a browser upload could not send the matching header.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  const api = client(config.endpoint);
  // Signing happens locally (no request), so a second client just changes the URL's host.
  const signer = config.uploadEndpoint ? client(config.uploadEndpoint) : api;
  const Bucket = config.bucket;

  return {
    async presignUpload({ key, contentType, sizeBytes, expiresInSeconds }) {
      const command = new PutObjectCommand({
        Bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: sizeBytes,
      });
      // Both headers are signed, so storage refuses an upload of another type or size.
      const url = await getSignedUrl(signer, command, {
        expiresIn: expiresInSeconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      // `Content-Length` is set by the browser from the file itself; only the type is sent.
      return { url, headers: { 'Content-Type': contentType } };
    },

    async stat(key) {
      try {
        const head = await api.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { sizeBytes: head.ContentLength ?? 0 };
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    async readStart(key, length) {
      const object = await api.send(
        new GetObjectCommand({ Bucket, Key: key, Range: `bytes=0-${length - 1}` }),
      );
      return object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
    },

    async remove(key) {
      await api.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    publicUrl: (key) => joinPublicUrl(config.publicBaseUrl, key),
  };
}
