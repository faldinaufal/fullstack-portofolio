// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { SVGAttributes } from 'react';

/** Stroke icons drawn for Tempora (24×24 grid, one path each). */
const PATHS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  'calendar-check': 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  bookings: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  customers: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  invoices: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  branches:
    'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  services: 'M4 7h16M4 12h16M4 17h10',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M16 4.5a3.5 3.5 0 0 1 0 6.5M21 20v-1a5 5 0 0 0-3.5-4.8',
  audit: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4',
  emails: 'M3 6h18v12H3zM3 7l9 6 9-6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  tenants: 'M4 21V7l8-4 8 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
  'plus-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 8v8M8 12h8',
  plus: 'M12 5v14M5 12h14',
  shield: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z',
  'shield-check': 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6zM9 12l2 2 4-4',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h11',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  send: 'M4 12l16-8-6 16-2-7z',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16M12 9v4l2.5 2M9 2h6',
  check: 'M5 12l5 5 9-10',
  card: 'M3 6h18v13H3zM3 10h18M7 15h3',
  revenue:
    'M12 3v18M16 7.5C16 5.6 14.2 5 12 5s-4 .9-4 2.7C8 12 16 10 16 14.5c0 1.8-1.8 2.5-4 2.5s-4-.8-4-2.6',
  utilization: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
  'no-show': 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M3 21v-1a6 6 0 0 1 9-5.2M16 15l5 5M21 15l-5 5',
  pause: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M10 9v6M14 9v6',
  queue: 'M4 6h16M4 12h16M4 18h10',
  'map-pin':
    'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  massage: 'M4 15c2-.5 3.5.5 6 .5s4.5-1.5 6-3M5 12c1.5-2 3.5-3 6-3M11 9c1-2 3-2.5 4.5-1.5',
  physio: 'M9 4v5a3 3 0 0 0 6 0V4M12 12v8M9 20h6',
  spine: 'M12 3v18M9 5h6M8.5 9h7M9 13h6M8.5 17h7',
  leaf: 'M12 4c-4 4-4 9 0 16 4-7 4-12 0-16zM12 11v9',
  pilates: 'M12 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M7 10l5 1 5-1M12 11v4l-3 5M12 15l3 5',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  'eye-off':
    'M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  phone: 'M8 3h8v18H8zM11 18h2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11M12 15v2',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8.5 12.5l2.5 2.5 4.5-5',
  'user-search':
    'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M3 21v-1a6 6 0 0 1 7-5.9M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M21 22l-1.7-1.7',
  'calendar-edit': 'M4 6h16v6M4 6v14h7M4 10h16M8 3v4M16 3v4M18.5 14.5l2 2-5 5H13.5v-2z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  sunrise: 'M12 3v4M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4M2 17h20M7 17a5 5 0 0 1 10 0M8 21h8',
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

/** Decorative by default (`aria-hidden`); give the surrounding control an accessible name. */
export function Icon({ name, size = 20, strokeWidth = 1.9, ...props }: Readonly<IconProps>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d={PATHS[name]}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
