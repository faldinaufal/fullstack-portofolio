// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * The public demo inbox (FSD 2.1, 10.3): emails to demo addresses are stored instead of sent,
 * so visitors can read the login codes, reset links and booking emails of the demo accounts.
 */
export interface DemoEmail {
  id: string;
  to: string;
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
 * Splits an email's text into plain text and links. Only links to this site and its
 * subdomains become clickable (`siteHost`, e.g. the Portal's host name): a name typed at
 * sign-up lands in a public page, so a link to anywhere else stays plain text.
 */
export function textParts(text: string, siteHost: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const href = match[0].replace(/[.,;:!?)]+$/, '');
    const start = match.index;
    const host = hostnameOf(href);
    if (!host || (host !== siteHost && !host.endsWith(`.${siteHost}`))) continue;
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
