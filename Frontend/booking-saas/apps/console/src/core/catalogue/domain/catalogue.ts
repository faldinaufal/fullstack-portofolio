// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Booking settings the owner controls (FSD 6.1). */
export interface BookingSettings {
  minLeadHours: number;
  maxAdvanceDays: number;
  cancellationCutoffHours: number;
  maxCustomerReschedules: number;
}

export interface SetupStatus {
  hasBranch: boolean;
  hasService: boolean;
  hasBookableTherapist: boolean;
  complete: boolean;
}

export interface BusinessSettings {
  name: string;
  slug: string;
  version: number;
  bookingSettings: BookingSettings;
  /** Uploaded images (FSD 6.15); null until the owner adds one. */
  logoUrl: string | null;
  coverUrl: string | null;
  setup: SetupStatus;
}

export type ImageKind = 'logo' | 'cover';

/** Same rules as the API (FSD 6.15): raster images only, size per kind. */
export const IMAGE_RULES: Record<ImageKind, { maxBytes: number; types: readonly string[] }> = {
  logo: { maxBytes: 1024 * 1024, types: ['image/png', 'image/jpeg', 'image/webp'] },
  cover: { maxBytes: 4 * 1024 * 1024, types: ['image/jpeg', 'image/webp', 'image/png'] },
};

/** Why a chosen file cannot be used, before anything is uploaded; null when it is fine. */
export function imageProblem(kind: ImageKind, file: { type: string; size: number }): string | null {
  const rule = IMAGE_RULES[kind];
  if (!rule.types.includes(file.type)) return 'Choose a PNG, JPEG or WebP image.';
  if (file.size > rule.maxBytes) {
    return `The file is too large: at most ${rule.maxBytes / (1024 * 1024)} MB.`;
  }
  return null;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  archived: boolean;
  version: number;
  therapists: number;
}

export interface ServiceInput {
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
}

export interface CatalogueRepository {
  getSettings(): Promise<BusinessSettings>;
  updateSettings(
    version: number,
    input: { name?: string; bookingSettings?: Partial<BookingSettings> },
  ): Promise<BusinessSettings>;
  /** Uploads straight to storage, then asks the API to check and use it (FSD 6.15). */
  uploadImage(kind: ImageKind, version: number, file: File): Promise<BusinessSettings>;
  removeImage(kind: ImageKind, version: number): Promise<BusinessSettings>;
  listServices(): Promise<Service[]>;
  createService(input: ServiceInput): Promise<Service>;
  updateService(id: string, version: number, input: ServiceInput): Promise<Service>;
  archiveService(id: string): Promise<Service>;
}

/** Ranges shared with the API (FSD 6.1, 6.12); used for instant form feedback. */
export const LIMITS = {
  minLeadHours: { min: 0, max: 72 },
  maxAdvanceDays: { min: 1, max: 180 },
  cancellationCutoffHours: { min: 0, max: 168 },
  maxCustomerReschedules: { min: 0, max: 10 },
  durationMinutes: { min: 15, max: 480, step: 15 },
  bufferMinutes: { min: 0, max: 60, step: 5 },
  priceCents: { min: 0, max: 1_000_000 },
} as const;

/** Problems in a service form, keyed by field; empty when valid. */
export function serviceProblems(input: ServiceInput): Record<string, string> {
  const problems: Record<string, string> = {};
  const { durationMinutes: d, bufferMinutes: b, priceCents: p } = LIMITS;
  if (input.name.trim().length < 2) problems.name = 'Enter a name of at least 2 characters.';
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < d.min ||
    input.durationMinutes > d.max ||
    input.durationMinutes % d.step !== 0
  ) {
    problems.durationMinutes = 'Use 15 to 480 minutes, in steps of 15.';
  }
  if (
    !Number.isInteger(input.bufferMinutes) ||
    input.bufferMinutes < b.min ||
    input.bufferMinutes > b.max ||
    input.bufferMinutes % b.step !== 0
  ) {
    problems.bufferMinutes = 'Use 0 to 60 minutes, in steps of 5.';
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < p.min || input.priceCents > p.max) {
    problems.priceCents = 'Use a price between $0 and $10,000.';
  }
  return problems;
}

/** "$42.17" ⇄ 4217: money is entered in dollars and stored as integer cents (FSD 4.1). */
export function parseDollars(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

export function formatDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
