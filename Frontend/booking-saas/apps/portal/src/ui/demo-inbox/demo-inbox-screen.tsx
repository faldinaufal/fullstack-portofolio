// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card, cn, Icon } from '@tempora/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  type DemoEmail,
  loginCode,
  receivedLabel,
  textParts,
  useDemoInbox,
} from '@/core/demo-inbox/presentation/use-demo-inbox';
import { DEMO_INBOX_SHORTCUTS } from '@/core/shared/presentation/demo';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';

/**
 * Public demo inbox (FSD 2.1, 10.3): every email sent to a demo account in the last day,
 * newest first, so visitors can read the login code without a real mailbox.
 */
export function DemoInboxScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const to = params.get('to')?.trim().toLowerCase() || undefined;
  const inbox = useDemoInbox(to);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const now = useNow();

  const items = inbox.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const filter = (address: string | null) => {
    setSelectedId(null);
    router.replace(address ? `${pathname}?${new URLSearchParams({ to: address })}` : pathname, {
      scroll: false,
    });
  };
  const open = (email: DemoEmail) => {
    setSelectedId(email.id);
    // On a phone the reader sits under the list.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] font-extrabold sm:text-[32px]">Demo inbox</h1>
          <p className="m-0 max-w-[640px] text-muted">
            Emails to the demo accounts land here instead of a real mailbox: login codes, password
            reset links and booking emails. Anyone can read them, so the inbox only keeps the last
            24 hours and refreshes on its own.
          </p>
        </header>

        <nav aria-label="Filter by address" className="flex flex-wrap gap-2">
          <FilterChip active={!to} onClick={() => filter(null)}>
            All addresses
          </FilterChip>
          {DEMO_INBOX_SHORTCUTS.map((shortcut) => (
            <FilterChip
              key={shortcut.email}
              active={to === shortcut.email}
              onClick={() => filter(shortcut.email)}
              title={shortcut.email}
            >
              {shortcut.role}
            </FilterChip>
          ))}
        </nav>

        <RequestErrorAlert error={inbox.isError ? toRequestErrorView(inbox.error) : null} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Card className="flex flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <h2 className="m-0 text-sm font-bold">
                {to ? <span className="break-all">{to}</span> : 'All demo addresses'}
              </h2>
              <span className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
                <Icon name="pulse" size={14} />
                {inbox.isFetching ? 'Checking…' : 'Live'}
              </span>
            </div>
            {inbox.isPending ? (
              <ListSkeleton />
            ) : items.length === 0 ? (
              <p className="m-0 px-4 py-10 text-center text-sm text-muted">
                {to
                  ? `No emails to ${to} in the last 24 hours.`
                  : 'No emails in the last 24 hours. Log in to a demo account and the code shows up here.'}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {items.map((email) => (
                  <li key={email.id} className="border-t border-border-subtle first:border-t-0">
                    <button
                      type="button"
                      onClick={() => open(email)}
                      aria-current={selected?.id === email.id ? 'true' : undefined}
                      className={cn(
                        'flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-surface-muted',
                        selected?.id === email.id && 'bg-surface-muted',
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13px] text-muted">{email.to}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {receivedLabel(email.receivedAt, now)}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-sm font-semibold">{email.subject}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div ref={readerRef} className="scroll-mt-6">
            {selected ? <EmailReader email={selected} /> : !inbox.isPending && <ReaderEmpty />}
          </div>
        </div>
      </div>
    </main>
  );
}

function FilterChip({
  active,
  className,
  ...props
}: Readonly<React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface text-foreground hover:bg-surface-muted',
        className,
      )}
      {...props}
    />
  );
}

function EmailReader({ email }: Readonly<{ email: DemoEmail }>) {
  const code = loginCode(email);
  const host = useSyncExternalStore(noSubscription, browserHost, () => '');

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl font-extrabold">{email.subject}</h2>
        <p className="m-0 text-sm text-muted">
          To <span className="break-all">{email.to}</span> ·{' '}
          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
            email.receivedAt,
          )}
        </p>
      </div>
      {code && <CodeBox code={code} />}
      <div className="whitespace-pre-wrap break-words rounded-xl border border-border-subtle bg-surface-muted p-4 text-sm leading-relaxed">
        {host
          ? textParts(email.text, host).map((part, index) =>
              part.kind === 'link' ? (
                <a
                  key={index}
                  href={part.href}
                  className="break-all font-semibold text-primary-text underline underline-offset-2"
                >
                  {part.text}
                </a>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )
          : email.text}
      </div>
    </Card>
  );
}

function CodeBox({ code }: Readonly<{ code: string }>) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard blocked: the code is still on screen to type.
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-muted">Login code</span>
        <span className="font-mono text-[28px] font-bold tracking-[0.2em] tabular-nums">
          {code}
        </span>
      </div>
      <Button variant="secondary" onClick={copy} aria-live="polite">
        <Icon name={copied ? 'check' : 'receipt'} size={16} />
        {copied ? 'Copied' : 'Copy code'}
      </Button>
    </div>
  );
}

function ReaderEmpty() {
  return (
    <Alert tone="info" title="Nothing selected">
      Pick an email from the list to read it.
    </Alert>
  );
}

function ListSkeleton() {
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-busy="true" aria-label="Loading emails">
      {[0, 1, 2].map((row) => (
        <li
          key={row}
          className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3 first:border-t-0"
        >
          <span className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
          <span className="h-4 w-56 animate-pulse rounded bg-surface-muted" />
        </li>
      ))}
    </ul>
  );
}

/** The current time, ticking every 30 seconds for the "3 min ago" labels. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// The page's host name never changes, so there is nothing to subscribe to.
const noSubscription = () => () => {};
const browserHost = () => window.location.hostname;
