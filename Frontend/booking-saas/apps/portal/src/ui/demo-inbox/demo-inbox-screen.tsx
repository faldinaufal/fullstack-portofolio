// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, cn, Icon, Select, TemporaLogo } from '@tempora/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  type DemoEmail,
  EMAIL_KINDS,
  emailLabel,
  loginCode,
  matchesSearch,
  paragraphs,
  receivedLabel,
  textParts,
  useDemoInbox,
} from '@/core/demo-inbox/presentation/use-demo-inbox';
import { DEMO_EMAIL_DOMAIN, DEMO_INBOX_SHORTCUTS } from '@/core/shared/presentation/demo';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';

const ALL = 'all';

/**
 * Public demo mailbox (FSD 2.1, 10.3): every email sent to a demo address in the last day,
 * newest first, so visitors can read login codes and booking emails without a real mailbox.
 */
export function DemoInboxScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const to = params.get('to')?.trim().toLowerCase() || undefined;
  const inbox = useDemoInbox(to);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On a phone the list and the reader take turns, like a mail app.
  const [reading, setReading] = useState(false);
  const now = useNow();

  const all = inbox.data?.items ?? [];
  const items = all.filter(
    (email) =>
      (kind === ALL || emailLabel(email.template).kind === kind) && matchesSearch(email, query),
  );
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const setAddress = (address: string) => {
    setSelectedId(null);
    setReading(false);
    router.replace(
      address === ALL ? pathname : `${pathname}?${new URLSearchParams({ to: address })}`,
      { scroll: false },
    );
  };
  const addressOptions = [
    { value: ALL, label: 'All addresses' },
    ...DEMO_INBOX_SHORTCUTS.map((s) => ({ value: s.email, label: `${s.role} · ${s.email}` })),
    ...(to && !DEMO_INBOX_SHORTCUTS.some((s) => s.email === to) ? [{ value: to, label: to }] : []),
  ];

  return (
    <main className="relative px-4 pt-10 pb-16 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent"
      />
      <div className="relative mx-auto flex max-w-[1240px] flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[30px] font-extrabold tracking-tight sm:text-[40px]">
              Demo mailbox
            </h1>
            <Badge dot className="font-mono font-semibold">
              DEMO_MODE=true
            </Badge>
          </div>
          <p className="m-0 max-w-[760px] text-[15px] text-muted sm:text-base">
            Every email Tempora sends to an address ending in{' '}
            <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-sm text-primary-text">
              @{DEMO_EMAIL_DOMAIN}
            </code>
            : login codes, account emails, booking emails and team invites. Nothing goes to a real
            mailbox. Anyone can read this page, so it keeps the last 24 hours and refreshes every 5
            seconds.
          </p>
        </header>

        <section
          aria-label="Search and filters"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:p-4 lg:flex-row lg:items-end"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="sr-only">Search emails</span>
            <span className="relative flex items-center">
              <Icon
                name="search"
                size={20}
                className="pointer-events-none absolute left-3.5 text-muted"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by recipient, subject or code…"
                className="h-12 w-full rounded-lg border border-border bg-surface-muted pr-3.5 pl-11 text-[15px] text-foreground placeholder:text-muted"
              />
            </span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row lg:contents">
            <Select
              label="Type"
              hideLabel
              value={kind}
              onValueChange={setKind}
              options={[
                { value: ALL, label: 'All types' },
                ...EMAIL_KINDS.map((k) => ({ value: k.kind, label: k.label })),
              ]}
              className="sm:flex-1 lg:w-48 lg:flex-none"
            />
            <Select
              label="Address"
              hideLabel
              value={to ?? ALL}
              onValueChange={setAddress}
              options={addressOptions}
              className="sm:flex-1 lg:w-72 lg:flex-none"
            />
            <Button
              variant="secondary"
              size="icon"
              className="hidden size-12 shrink-0 lg:inline-flex"
              aria-label="Refresh now"
              onClick={() => void inbox.refetch()}
            >
              <Icon name="refresh" size={20} className={cn(inbox.isFetching && 'animate-spin')} />
            </Button>
          </div>
        </section>

        <RequestErrorAlert error={inbox.isError ? toRequestErrorView(inbox.error) : null} />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <section
            aria-label="Emails"
            className={cn('flex flex-col gap-3', reading && 'max-lg:hidden')}
          >
            <div className="flex items-center justify-between gap-3 px-1 text-[13px]">
              <span className="font-semibold tracking-[0.08em] text-muted uppercase">Inbox</span>
              <span className="flex items-center gap-1.5 text-muted" aria-live="polite">
                <span
                  className={cn(
                    'size-2 rounded-full bg-success',
                    inbox.isFetching && 'animate-pulse',
                  )}
                />
                {inbox.isPending
                  ? 'Loading…'
                  : `Showing ${items.length} email${items.length === 1 ? '' : 's'}`}
              </span>
            </div>
            {inbox.isPending ? (
              <ListSkeleton />
            ) : items.length === 0 ? (
              <EmptyList filtered={all.length > 0} to={to} />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {items.map((email) => (
                  <li key={email.id}>
                    <EmailCard
                      email={email}
                      now={now}
                      selected={selected?.id === email.id}
                      onOpen={() => {
                        setSelectedId(email.id);
                        setReading(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className={cn('lg:sticky lg:top-6', !reading && 'max-lg:hidden')}>
            <Button
              variant="ghost"
              className="mb-3 -ml-2 lg:hidden"
              onClick={() => setReading(false)}
            >
              <Icon name="arrow-left" size={18} />
              Back to inbox
            </Button>
            {selected ? (
              <EmailReader key={selected.id} email={selected} />
            ) : (
              !inbox.isPending && (
                <Alert tone="info" title="Nothing selected">
                  Pick an email from the list to read it.
                </Alert>
              )
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function EmailCard({
  email,
  now,
  selected,
  onOpen,
}: Readonly<{ email: DemoEmail; now: Date; selected: boolean; onOpen: () => void }>) {
  const label = emailLabel(email.template);
  const preview = paragraphs(email.text)
    .slice(1)
    .map((lines) => lines.join(' '))
    .join(' ');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full flex-col gap-2 rounded-2xl border bg-surface p-4 text-left shadow-sm transition-colors hover:border-border-strong',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <Badge tone={label.tone} dot={label.kind === 'code'}>
          {label.label}
        </Badge>
        <span
          className={cn(
            'shrink-0 text-[13px]',
            selected ? 'font-semibold text-primary-text' : 'text-muted',
          )}
        >
          {receivedLabel(email.receivedAt, now)}
        </span>
      </span>
      <span className="line-clamp-2 text-[17px] leading-snug font-bold">{email.subject}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
        <Icon name="send" size={14} className="shrink-0" />
        <span className="truncate">To: {email.to}</span>
      </span>
      {preview && <span className="line-clamp-2 text-sm text-muted">{preview}</span>}
    </button>
  );
}

function EmailReader({ email }: Readonly<{ email: DemoEmail }>) {
  const label = emailLabel(email.template);
  const code = loginCode(email);
  const host = useSyncExternalStore(noSubscription, browserHost, () => '');
  const [greeting, ...rest] = paragraphs(email.text);
  const hasGreeting = greeting?.length === 1 && /^(hi|hello)\b/i.test(greeting[0]!);
  const body = hasGreeting ? rest : paragraphs(email.text);

  const line = (text: string) =>
    host
      ? textParts(text, [host, CONSOLE_HOST]).map((part, index) =>
          part.kind === 'link' ? (
            <a
              key={index}
              href={part.href}
              className="font-semibold break-all text-primary-text underline underline-offset-2"
            >
              {part.text}
            </a>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )
      : text;

  return (
    <article
      aria-labelledby="email-subject"
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
    >
      <header className="flex flex-col gap-4 border-b border-border-subtle bg-surface-muted p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge tone={label.tone} dot={label.kind === 'code'}>
              {label.label}
            </Badge>
            <code className="truncate font-mono text-xs text-muted">{email.template}</code>
          </div>
          <time dateTime={email.receivedAt.toISOString()} className="text-[13px] text-muted">
            {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
              email.receivedAt,
            )}
          </time>
        </div>
        <h2 id="email-subject" className="m-0 text-2xl leading-tight font-extrabold sm:text-[28px]">
          {email.subject}
        </h2>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">From</dt>
          <dd className="m-0 font-semibold">Tempora</dd>
          <dt className="text-muted">To</dt>
          <dd className="m-0 font-semibold break-all">{email.to}</dd>
        </dl>
        {code && (
          <div>
            <CopyButton value={code} label={`Copy code ${code}`} variant="primary" />
          </div>
        )}
      </header>

      <div className="bg-background p-4 sm:p-8">
        <div className="mx-auto flex max-w-[600px] flex-col gap-5 rounded-2xl border border-border-subtle bg-surface p-5 sm:p-8">
          <TemporaLogo height={28} />
          {hasGreeting && <p className="m-0 text-xl font-extrabold sm:text-2xl">{greeting![0]}</p>}
          {code && <CodeTiles code={code} />}
          {body.map((lines, index) => (
            <p key={index} className="m-0 text-[15px] leading-relaxed break-words">
              {lines.map((text, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line(text)}
                </span>
              ))}
            </p>
          ))}
          <p className="m-0 border-t border-border-subtle pt-4 text-[13px] text-muted">
            Tempora · booking and invoicing for studios and clinics
          </p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle bg-surface-muted px-5 py-3 font-mono text-xs text-muted sm:px-7">
        <Icon name="emails" size={14} />
        <span>Stored by the Tempora worker instead of sent (DEMO_MODE)</span>
        <span aria-hidden="true">·</span>
        <span>Removed after 24 hours</span>
      </footer>
    </article>
  );
}

function CodeTiles({ code }: Readonly<{ code: string }>) {
  const digits = code.split('');
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-muted px-4 py-6">
      <span className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
        One-time login code
      </span>
      <span className="sr-only">{code}</span>
      <span aria-hidden="true" className="flex items-center gap-1.5 sm:gap-2.5">
        {digits.map((digit, index) => (
          <span key={index} className="flex items-center gap-1.5 sm:gap-2.5">
            {index === 3 && <span className="font-mono text-xl font-bold text-muted">-</span>}
            <span className="flex h-12 w-10 items-center justify-center rounded-xl border border-border bg-surface font-mono text-2xl font-bold text-primary-text shadow-sm sm:h-16 sm:w-14 sm:text-[32px]">
              {digit}
            </span>
          </span>
        ))}
      </span>
      <CopyButton value={code} label={`Copy code: ${code}`} variant="secondary" />
    </div>
  );
}

function CopyButton({
  value,
  label,
  variant,
}: Readonly<{ value: string; label: string; variant: 'primary' | 'secondary' }>) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard blocked: the code is still on screen to type.
    }
  };

  return (
    <Button variant={variant} onClick={copy} aria-live="polite">
      <Icon name={copied ? 'check' : 'copy'} size={18} />
      {copied ? 'Copied' : label}
    </Button>
  );
}

function EmptyList({ filtered, to }: Readonly<{ filtered: boolean; to: string | undefined }>) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
      {filtered
        ? 'No email matches this search or type.'
        : to
          ? `No emails to ${to} in the last 24 hours.`
          : 'No emails in the last 24 hours. Log in with a demo account and its code shows up here.'}
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul
      className="m-0 flex list-none flex-col gap-3 p-0"
      aria-busy="true"
      aria-label="Loading emails"
    >
      {[0, 1, 2].map((row) => (
        <li
          key={row}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
        >
          <span className="h-5 w-24 animate-pulse rounded-full bg-surface-muted" />
          <span className="h-4 w-56 animate-pulse rounded bg-surface-muted" />
          <span className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
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

/** Links into the Console (invitations, its password reset) are Tempora's own too. */
const CONSOLE_HOST = new URL(process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001')
  .hostname;

// The page's host name never changes, so there is nothing to subscribe to.
const noSubscription = () => () => {};
const browserHost = () => window.location.hostname;
