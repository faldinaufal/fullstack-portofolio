// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Platform time zone (FSD 4.1: one time zone for the whole platform), for deciding what
 * "today" is before the API has answered. Times from the API come with their own zone.
 */
export const PLATFORM_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE ?? 'UTC';
