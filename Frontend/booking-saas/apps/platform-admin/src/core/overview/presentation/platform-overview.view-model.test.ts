// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import {
  createDemoPlatformOverviewRepository,
  DEMO_NOW,
} from '../data/demo-platform-overview-repository';
import { createGetPlatformOverview } from '../domain/get-platform-overview';
import { supportLabel, toPlatformOverviewViewModel } from './platform-overview.view-model';

async function demoViewModel() {
  const overview = await createGetPlatformOverview(createDemoPlatformOverviewRepository())();
  return toPlatformOverviewViewModel(overview, DEMO_NOW);
}

describe('toPlatformOverviewViewModel', () => {
  it('formats the KPIs', async () => {
    const vm = await demoViewModel();
    expect(vm.dateLabel).toBe('Wednesday, 18 November 2026');
    expect(vm.kpis.map((k) => k.value)).toEqual(['3', '1', '236', '$18,940', '0.2%', '3']);
  });

  it('shows tenants needing attention first, with derived statuses', async () => {
    const vm = await demoViewModel();
    expect(vm.tenants.map((t) => [t.name, t.status, t.support])).toEqual([
      ['Blue Pine Spa', 'Suspended', 'None'],
      ['Northwind Yoga', 'Onboarding', 'None'],
      ['Lumen Wellness Studio', 'Active', 'Granted · 18 h left'],
      ['Harbor Physio Clinic', 'Active', 'None'],
    ]);
  });

  it('summarises the chart for screen readers', async () => {
    const vm = await demoViewModel();
    expect(vm.chart.categories.slice(0, 2)).toEqual(['5', '6']);
    expect(vm.chart.summary).toContain('ranged from 168 to 251');
  });
});

describe('supportLabel', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  it('treats expired grants as none', () => {
    expect(supportLabel('2026-11-18T11:00:00.000Z', now)).toBe('None');
    expect(supportLabel('2026-11-18T12:30:00.000Z', now)).toBe('Granted · under 1 h left');
  });
});
