import { describe, expect, it } from 'vitest';
import { createDemoDashboardRepository, DEMO_NOW } from '../data/demo-dashboard-repository';
import { createGetDashboard } from '../domain/get-dashboard';
import { toDashboardViewModel } from './dashboard.view-model';

async function demoViewModel() {
  const dashboard = await createGetDashboard(createDemoDashboardRepository(), () => DEMO_NOW)();
  return toDashboardViewModel(dashboard);
}

describe('toDashboardViewModel', () => {
  it('formats the KPIs', async () => {
    const vm = await demoViewModel();
    expect(vm.dateLabel).toBe('Wednesday, 18 November 2026');
    expect(vm.kpis.map((k) => k.value)).toEqual(['18', '$24,680', '72%', '3.1%', '4', '11']);
    expect(vm.kpis[1]?.note).toBe('Last month: $31,240');
  });

  it('builds the chart and its screen-reader summary', async () => {
    const vm = await demoViewModel();
    expect(vm.chart.categories[0]).toBe('Dec');
    expect(vm.chart.series.map((s) => s.name)).toEqual(['Completed', 'No-show']);
    expect(vm.chart.summary).toBe(
      'Completed bookings per month peaked at 281 in Oct; no-shows stayed between 5 and 10 per month.',
    );
  });

  it('describes the next booking and maps statuses to tones', async () => {
    const vm = await demoViewModel();
    expect(vm.upNext).toEqual({
      title: 'Up next · Riverside',
      initials: 'LT',
      customer: 'Guest · Leo T.',
      detail: 'Follow-up Physio · 13:00 – 13:30 · with Hana T.',
      status: 'Confirmed',
      tone: 'success',
    });
    expect(vm.todaysBookings.map((b) => b.tone)).toEqual([
      'info',
      'danger',
      'success',
      'success',
      'warning',
    ]);
  });

  it('marks closures on the calendar', async () => {
    const vm = await demoViewModel();
    expect(vm.calendar).toEqual({
      year: 2026,
      monthIndex: 10,
      today: '2026-11-18',
      marked: { '2026-11-26': 'Northgate closed' },
    });
  });
});
