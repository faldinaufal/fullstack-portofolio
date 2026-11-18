// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { BusinessRepository } from '../domain/business';

/**
 * Fictional demo data (PRD 1: demo tenants) until the directory endpoint
 * (`GET /v1/public/tenants`, FSD 5.2) exists. Replacing this file with an HTTP repository
 * is the only change needed; domain, presentation and UI stay the same.
 */
export function createDemoBusinessRepository(): BusinessRepository {
  return {
    async listFeatured() {
      return [
        {
          id: 'demo-lumen',
          slug: 'lumen',
          name: 'Lumen Wellness Studio',
          offering: 'Massage and physiotherapy',
          branchNames: ['Downtown', 'Riverside', 'Northgate'],
        },
        {
          id: 'demo-harbor',
          slug: 'harbor-physio',
          name: 'Harbor Physio Clinic',
          offering: 'Physiotherapy',
          branchNames: ['Harbor', 'Eastside'],
        },
      ];
    },
  };
}
