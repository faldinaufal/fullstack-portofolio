// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** A business (tenant) as customers see it in the directory. */
export interface Business {
  id: string;
  slug: string;
  name: string;
  /** What the business offers, e.g. "Massage and physiotherapy". */
  offering: string;
  branchNames: string[];
}

/** Port implemented by the data layer. */
export interface BusinessRepository {
  listFeatured(): Promise<Business[]>;
}
