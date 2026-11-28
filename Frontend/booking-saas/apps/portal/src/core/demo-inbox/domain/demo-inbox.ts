// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * The public demo inbox (FSD 2.1, 10.3): emails to demo addresses are stored instead of sent,
 * so visitors can read the login codes, reset links and booking emails of the demo accounts.
 */
export interface DemoEmail {
  id: string;
  to: string;
  /** The worker's template name, e.g. `console.login_code`. */
  template: string;
  subject: string;
  text: string;
  receivedAt: Date;
}

export interface DemoInbox {
  /** The demo address domain, e.g. `demo.example.com`. */
  domain: string;
  items: DemoEmail[];
}

export interface DemoInboxRepository {
  /** The newest emails, all of them or one address's. */
  list(to: string | undefined): Promise<DemoInbox>;
}

/** Login code emails say "421700 is your Tempora Console code" (worker templates). */
const CODE_SUBJECT = /^(\d{6}) is your Tempora .+ code$/;

/** The 6-digit login code of a code email; null for every other email. */
export function loginCode(email: Pick<DemoEmail, 'subject'>): string | null {
  return CODE_SUBJECT.exec(email.subject)?.[1] ?? null;
}

export type TextPart =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

/**
 * Splits an email's text into plain text and links. Only links to Tempora's own apps become
 * clickable (`allowedHosts`, exact host names such as the Portal's and the Console's): a name
 * typed at sign-up lands in a public page, so a link to anywhere else stays plain text.
 */
export function textParts(text: string, allowedHosts: readonly string[]): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const href = match[0].replace(/[.,;:!?)]+$/, '');
    const start = match.index;
    const host = hostnameOf(href);
    if (!host || !allowedHosts.includes(host)) continue;
    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) });
    parts.push({ kind: 'link', text: href, href });
    last = start + href.length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** The mailbox's groups of emails, for the label on each email and the type filter. */
export type EmailKind = 'code' | 'account' | 'booking' | 'invite' | 'business' | 'other';

export interface EmailLabel {
  kind: EmailKind;
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export const EMAIL_KINDS: readonly { kind: EmailKind; label: string }[] = [
  { kind: 'code', label: 'Login codes' },
  { kind: 'account', label: 'Account emails' },
  { kind: 'booking', label: 'Bookings' },
  { kind: 'invite', label: 'Team invites' },
  { kind: 'business', label: 'Business notices' },
];

const LABELS: Record<string, EmailLabel> = {
  'console.login_code': { kind: 'code', label: 'Login code', tone: 'danger' },
  'admin.login_code': { kind: 'code', label: 'Login code', tone: 'danger' },
  'portal.verify_email': { kind: 'account', label: 'Verify email', tone: 'info' },
  'portal.password_reset': { kind: 'account', label: 'Password reset', tone: 'info' },
  'console.password_reset': { kind: 'account', label: 'Password reset', tone: 'info' },
  'portal.password_changed': { kind: 'account', label: 'Password changed', tone: 'neutral' },
  'console.password_changed': { kind: 'account', label: 'Password changed', tone: 'neutral' },
  'portal.booking_confirmed': { kind: 'booking', label: 'Booking confirmed', tone: 'success' },
  'portal.booking_reminder': { kind: 'booking', label: 'Reminder', tone: 'info' },
  'portal.booking_rescheduled': { kind: 'booking', label: 'Rescheduled', tone: 'warning' },
  'portal.booking_cancelled': { kind: 'booking', label: 'Cancelled', tone: 'neutral' },
  'console.invitation': { kind: 'invite', label: 'Team invite', tone: 'neutral' },
  'console.payment_needs_attention': { kind: 'business', label: 'Payment issue', tone: 'warning' },
  'console.tenant_suspended': { kind: 'business', label: 'Suspended', tone: 'danger' },
  'console.tenant_reactivated': { kind: 'business', label: 'Reactivated', tone: 'success' },
};

/** Label of an email by its template; a template added later shows as a plain "Email". */
export function emailLabel(template: string): EmailLabel {
  return LABELS[template] ?? { kind: 'other', label: 'Email', tone: 'neutral' };
}

/** Search over recipient, subject, text and template, ignoring case. */
export function matchesSearch(email: DemoEmail, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [email.to, email.subject, email.text, email.template].some((field) =>
    field.toLowerCase().includes(q),
  );
}

/** The email's text as paragraphs (blank lines), each a list of lines. */
export function paragraphs(text: string): string[][] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0);
}
