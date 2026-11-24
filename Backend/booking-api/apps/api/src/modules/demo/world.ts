// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * The fictional businesses of the demo (PRD "Demo tenants", FSD 10.3). Everything here is made
 * up: names, addresses, prices and email addresses (the reserved `.test` domain).
 */

/** The demo accounts, one per role; they share one password (see the README). */
export const DEMO_ACCOUNTS = {
  owner: { email: 'owner@veloria.test', name: 'Ines Halvorsen' },
  manager: { email: 'manager@veloria.test', name: 'Daniel Kim' },
  therapist: { email: 'therapist@veloria.test', name: 'Mira Santos' },
  customer: { email: 'customer@veloria.test', name: 'Lena Fischer', phone: '+15550147010' },
  admin: { email: 'admin@veloria.test', name: 'Noah Castellanos' },
} as const;

export interface DemoService {
  key: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
}

/** Working days 1–6 (Monday–Saturday) with hours as `HH:MM`; Sunday is closed everywhere. */
export interface DemoHours {
  weekdays: number[];
  from: string;
  to: string;
}

export interface DemoMember {
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'staff';
  /** Branch key; none for the owner. */
  branch?: string;
  /** Therapists work and take bookings; a manager may too. */
  hours?: DemoHours;
  services?: string[];
}

export interface DemoTenant {
  key: 'lumen' | 'harbor';
  slug: string;
  name: string;
  invoicePrefix: string;
  branches: { key: string; name: string; address: string; phone: string }[];
  /** Opening hours of every branch: weekday → [from, to]. */
  opening: Record<number, [string, string]>;
  services: DemoService[];
  team: DemoMember[];
  /** How many regular customers book here besides the demo customer. */
  customers: number;
  /** Roughly how full a therapist's day is (0–1). */
  occupancy: number;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

export const DEMO_TENANTS: DemoTenant[] = [
  {
    key: 'lumen',
    slug: 'lumen',
    name: 'Lumen Wellness Studio',
    invoicePrefix: 'LUM',
    branches: [
      {
        key: 'downtown',
        name: 'Downtown',
        address: '18 Alder Street, Suite 200',
        phone: '+15550147001',
      },
      { key: 'riverside', name: 'Riverside', address: '402 Quay Road', phone: '+15550147002' },
      { key: 'northgate', name: 'Northgate', address: '9 Linden Plaza', phone: '+15550147003' },
    ],
    opening: {
      1: ['09:00', '19:00'],
      2: ['09:00', '19:00'],
      3: ['09:00', '19:00'],
      4: ['09:00', '19:00'],
      5: ['09:00', '19:00'],
      6: ['10:00', '16:00'],
    },
    services: [
      {
        key: 'swedish',
        name: 'Swedish Massage',
        description: 'Long, flowing strokes to relax the whole body.',
        durationMinutes: 60,
        bufferMinutes: 15,
        priceCents: 8500,
      },
      {
        key: 'deep',
        name: 'Deep Tissue Massage',
        description: 'Slow, firm pressure for chronic tension.',
        durationMinutes: 90,
        bufferMinutes: 15,
        priceCents: 12_000,
      },
      {
        key: 'stone',
        name: 'Hot Stone Massage',
        description: 'Warm basalt stones ease muscles before the massage.',
        durationMinutes: 75,
        bufferMinutes: 15,
        priceCents: 11_000,
      },
      {
        key: 'express',
        name: 'Express Back Massage',
        description: 'A focused half hour for back, neck and shoulders.',
        durationMinutes: 30,
        bufferMinutes: 10,
        priceCents: 4217,
      },
      {
        key: 'assessment',
        name: 'Sports Physio Assessment',
        description: 'Movement screening and a treatment plan.',
        durationMinutes: 45,
        bufferMinutes: 15,
        priceCents: 9500,
      },
      {
        key: 'followup',
        name: 'Follow-up Physio',
        description: 'Progress check and hands-on treatment.',
        durationMinutes: 30,
        bufferMinutes: 10,
        priceCents: 6500,
      },
    ],
    team: [
      { ...DEMO_ACCOUNTS.owner, role: 'owner' },
      {
        ...DEMO_ACCOUNTS.manager,
        role: 'manager',
        branch: 'downtown',
        hours: { weekdays: [1, 3, 5], from: '12:00', to: '18:00' },
        services: ['assessment', 'followup'],
      },
      {
        ...DEMO_ACCOUNTS.therapist,
        role: 'staff',
        branch: 'downtown',
        hours: { weekdays: WEEKDAYS, from: '09:00', to: '17:00' },
        services: ['swedish', 'deep', 'stone', 'express'],
      },
      {
        name: 'Theo Brandt',
        email: 'theo.brandt@veloria.test',
        role: 'staff',
        branch: 'downtown',
        hours: { weekdays: [2, 3, 4, 5, 6], from: '10:00', to: '18:00' },
        services: ['swedish', 'deep', 'express'],
      },
      {
        name: 'Priya Raman',
        email: 'priya.raman@veloria.test',
        role: 'manager',
        branch: 'riverside',
      },
      {
        name: 'Lucas Moreau',
        email: 'lucas.moreau@veloria.test',
        role: 'staff',
        branch: 'riverside',
        hours: { weekdays: WEEKDAYS, from: '09:00', to: '17:00' },
        services: ['assessment', 'followup', 'express'],
      },
      {
        name: 'Hana Sato',
        email: 'hana.sato@veloria.test',
        role: 'staff',
        branch: 'riverside',
        hours: { weekdays: [1, 2, 4, 5, 6], from: '10:00', to: '18:00' },
        services: ['swedish', 'stone', 'deep'],
      },
      {
        name: 'Sofia Lindqvist',
        email: 'sofia.lindqvist@veloria.test',
        role: 'manager',
        branch: 'northgate',
        hours: { weekdays: [2, 4], from: '09:00', to: '13:00' },
        services: ['swedish', 'express'],
      },
      {
        name: 'Jonas Weber',
        email: 'jonas.weber@veloria.test',
        role: 'staff',
        branch: 'northgate',
        hours: { weekdays: WEEKDAYS, from: '11:00', to: '19:00' },
        services: ['deep', 'assessment', 'followup'],
      },
    ],
    customers: 46,
    occupancy: 0.62,
  },
  {
    key: 'harbor',
    slug: 'harbor',
    name: 'Harbor Physio Clinic',
    invoicePrefix: 'HAR',
    branches: [
      { key: 'harbor', name: 'Harbor', address: '3 Pier Lane', phone: '+15550147021' },
      { key: 'eastside', name: 'Eastside', address: '77 Orchard Avenue', phone: '+15550147022' },
    ],
    opening: {
      1: ['08:00', '18:00'],
      2: ['08:00', '18:00'],
      3: ['08:00', '18:00'],
      4: ['08:00', '18:00'],
      5: ['08:00', '16:00'],
    },
    services: [
      {
        key: 'initial',
        name: 'Physio Assessment',
        description: 'A first visit: history, assessment and a plan.',
        durationMinutes: 60,
        bufferMinutes: 15,
        priceCents: 9800,
      },
      {
        key: 'followup',
        name: 'Follow-up Physio',
        description: 'Treatment and exercises, 30 minutes.',
        durationMinutes: 30,
        bufferMinutes: 10,
        priceCents: 6200,
      },
      {
        key: 'needling',
        name: 'Dry Needling',
        description: 'Targeted release of trigger points.',
        durationMinutes: 45,
        bufferMinutes: 15,
        priceCents: 8800,
      },
    ],
    team: [
      { name: 'Jonah Reed', email: 'jonah@veloria.test', role: 'owner' },
      {
        name: 'Clara Nguyen',
        email: 'clara.nguyen@veloria.test',
        role: 'staff',
        branch: 'harbor',
        hours: { weekdays: WEEKDAYS, from: '08:00', to: '16:00' },
        services: ['initial', 'followup', 'needling'],
      },
      {
        name: 'Mateo Rossi',
        email: 'mateo.rossi@veloria.test',
        role: 'staff',
        branch: 'eastside',
        hours: { weekdays: [1, 2, 3, 4], from: '10:00', to: '18:00' },
        services: ['initial', 'followup'],
      },
    ],
    customers: 18,
    occupancy: 0.5,
  },
];

/** Regular customers: first and last names, combined into distinct people. */
export const FIRST_NAMES = [
  'Omar',
  'Lena',
  'Ava',
  'Malik',
  'Chloe',
  'Ethan',
  'Yara',
  'Felix',
  'Nora',
  'Samuel',
  'Isla',
  'Kenji',
  'Maya',
  'Rafael',
  'Zoe',
  'Leo',
  'Amara',
  'Oscar',
  'Ruth',
  'Tariq',
  'Elena',
  'Jasper',
  'Wren',
  'Diego',
  'Freya',
  'Hugo',
  'Leila',
  'Arjun',
  'Greta',
  'Milo',
];
export const LAST_NAMES = [
  'Haddad',
  'Okafor',
  'Park',
  'Novak',
  'Silva',
  'Bennett',
  'Costa',
  'Ivanova',
  'Mensah',
  'Larsen',
  'Duarte',
  'Kowalski',
  'Ahmed',
  'Fontaine',
  'Gallagher',
  'Moreno',
  'Patel',
  'Quinn',
  'Sorensen',
  'Vargas',
];

export const NOTES = [
  'Lower back tension after long drives.',
  'Prefers light pressure on the shoulders.',
  'Recovering from a knee sprain.',
  'Training for a half marathon.',
  'First visit, a little nervous.',
  'Desk job, stiff neck.',
];

export const CANCEL_REASONS = [
  'Therapist unwell',
  'Branch closed for maintenance',
  'Customer asked by phone',
];
