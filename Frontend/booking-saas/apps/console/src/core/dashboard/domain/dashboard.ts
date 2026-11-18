export type BookingStatus =
  'pending_payment' | 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'expired';

export interface DashboardBooking {
  id: string;
  customerName: string;
  isGuest: boolean;
  serviceName: string;
  therapistName: string;
  branchName: string;
  /** ISO 8601, UTC. */
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
}

export interface MonthlyBookings {
  /** `YYYY-MM`. */
  month: string;
  completed: number;
  noShow: number;
}

/** Everything the owner dashboard shows, for one scope (all branches or one branch). */
export interface DashboardSnapshot {
  /** The "today" of this snapshot, `YYYY-MM-DD` in the platform time zone. */
  today: string;
  scopeLabel: string;
  bookingsToday: number;
  bookingsSameDayLastWeek: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  /** Booked hours / available hours, 0–1. */
  utilization: number;
  /** No-shows / finished bookings over the last 30 days, 0–1. */
  noShowRate: number;
  pendingPayments: number;
  activeTherapists: number;
  branchCount: number;
  monthly: MonthlyBookings[];
  todaysBookings: DashboardBooking[];
  closures: { date: string; label: string }[];
}

export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
}
