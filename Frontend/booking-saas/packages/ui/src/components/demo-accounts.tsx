// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { cn } from '../lib/cn.js';
import { Alert } from './alert.js';
import { Button } from './button.js';
import { Icon } from './icon.js';

export interface DemoAccount {
  /** The role, e.g. "Owner". */
  role: string;
  email: string;
  /** What the account can see, e.g. "Lumen Wellness Studio, all branches". */
  scope: string;
}

export interface DemoAccountsProps {
  accounts: DemoAccount[];
  password: string;
  /** Link to the public demo inbox, where the demo accounts' emails arrive. */
  inboxUrl?: string | undefined;
  /** What arrives there, before the link: "The 6-digit code arrives in the". */
  inboxLead?: string;
  /** Fills the login form with this account. */
  onUse: (account: DemoAccount, password: string) => void;
  className?: string;
}

/**
 * Login hint for the public demo (FSD 10.3): the app's demo accounts with the shared password,
 * a "Use" button that fills the form and, for apps with an email code, the demo inbox link.
 */
export function DemoAccounts({
  accounts,
  password,
  inboxUrl,
  inboxLead = 'The 6-digit code arrives in the',
  onUse,
  className,
}: Readonly<DemoAccountsProps>) {
  return (
    <section
      aria-labelledby="demo-accounts-title"
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 id="demo-accounts-title" className="m-0 flex items-center gap-2 text-sm font-bold">
          <Icon name="user" size={16} className="text-primary-text" />
          Try the demo
        </h2>
        <p className="m-0 text-sm text-muted">
          Fictional data. Every account uses the password{' '}
          <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
            {password}
          </code>
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {accounts.map((account) => (
          <li
            key={account.email}
            className="flex items-center justify-between gap-3 border-t border-border-subtle py-2 first:border-t-0"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">{account.role}</span>
              <span className="truncate text-[13px] text-muted">{account.email}</span>
              <span className="truncate text-xs text-muted">{account.scope}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-11 shrink-0"
              aria-label={`Use the ${account.role.toLowerCase()} demo account`}
              onClick={() => onUse(account, password)}
            >
              Use
            </Button>
          </li>
        ))}
      </ul>
      {inboxUrl && (
        <p className="m-0 text-sm text-muted">
          {inboxLead}{' '}
          <a
            href={inboxUrl}
            target="_blank"
            rel="noopener"
            className="font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            demo inbox
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      )}
    </section>
  );
}

/** On the code screen, when the code went to a demo address: where to find it (FSD 10.3). */
export function DemoInboxNotice({ href }: Readonly<{ href: string }>) {
  return (
    <Alert tone="info" title="Demo account">
      The code is in the public{' '}
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="font-semibold text-primary-text underline underline-offset-2"
      >
        demo inbox
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      , newest email first.
    </Alert>
  );
}

/**
 * On sign-up in the public demo (FSD 10.3): any address at the demo domain works and its
 * emails show up in the demo inbox; a real address would never receive anything.
 */
export function DemoSignupHint({
  domain,
  inboxUrl,
  className,
}: Readonly<{ domain: string; inboxUrl: string; className?: string }>) {
  return (
    <Alert tone="info" title="This is a demo" {...(className && { className })}>
      Sign up with any address ending in{' '}
      <code className="font-mono font-semibold text-foreground">@{domain}</code>, for example{' '}
      <code className="font-mono font-semibold text-foreground">yourname@{domain}</code>. No mailbox
      needed: its emails appear in the public{' '}
      <a
        href={inboxUrl}
        target="_blank"
        rel="noopener"
        className="font-semibold text-primary-text underline underline-offset-2"
      >
        demo inbox
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      . A real address receives no email here.
    </Alert>
  );
}

/** Puts an account into a login form's `email` and `password` fields (uncontrolled inputs). */
export function fillLoginForm(form: HTMLFormElement | null, email: string, password: string) {
  if (!form) return;
  const set = (name: string, value: string) => {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement) field.value = value;
  };
  set('email', email);
  set('password', password);
  form.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
}
