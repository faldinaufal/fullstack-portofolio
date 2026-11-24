// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** A business (tenant) as customers see it in the directory. */
export interface Business {
  id: string;
  slug: string;
  name: string;
  /** What the business offers, e.g. "Deep Tissue Massage, Sports Physiotherapy". */
  offering: string;
  /** Every service someone performs, in catalogue order. */
  serviceNames: string[];
  branchNames: string[];
  /** Uploaded by the owner (FSD 6.15); null shows the initials. */
  logoUrl: string | null;
}

/** Port implemented by the data layer. */
export interface BusinessRepository {
  /** Businesses that take bookings, optionally filtered by business or service name. */
  search(query?: string): Promise<Business[]>;
}
