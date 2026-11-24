// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  BUSINESS_IMAGE_FALLBACK,
  BusinessLogo,
  buttonVariants,
  Icon,
  UploadedImage,
  TherapistPhoto,
  type IconName,
} from '@tempora/ui';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useBranchPage, useBusinessPage } from '@/core/booking/presentation/use-booking';
import { NotFoundPanel, PageShell } from './page-shell';

type Business = NonNullable<ReturnType<typeof useBusinessPage>['data']>;
type Branch = Business['branches'][number];

/**
 * FSD 2.1 Business page `/[tenant]`, laid out like Figma `1:1025` (DESIGN 5.1): title and
 * branch meta, branch pills, the cover photo (FSD 6.15), therapists of the branch, the
 * service menu and three info cards. Figma content outside the FSD is replaced (DESIGN 4.2):
 * no ratings, verified badges, "next opening", insurance, rooms or parking.
 */
export function BusinessScreen({ slug }: Readonly<{ slug: string }>) {
  const business = useBusinessPage(slug);
  const [branchId, setBranchId] = useState<string | null>(null);

  if (business.isPending) return <PageShell loading />;
  if (business.isError) return <NotFoundPanel />;
  const page = business.data;
  const branch = page.branches.find((b) => b.id === branchId) ?? page.branches[0];

  return (
    <main className="px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 sm:gap-14">
        <div className="flex flex-col gap-6">
          <TitleBlock page={page} branch={branch} />
          {page.branches.length > 1 && branch && (
            <BranchPills branches={page.branches} selected={branch.id} onSelect={setBranchId} />
          )}
        </div>
        {!page.available && (
          <Alert tone="info" title="Temporarily unavailable">
            This business is not taking bookings at the moment. Please check back later.
          </Alert>
        )}
        {branch && (
          <div id="branch-panel" className="flex flex-col gap-14 sm:gap-20">
            <Cover page={page} branch={branch} />
            <BranchContent page={page} branch={branch} />
          </div>
        )}
      </div>
    </main>
  );
}

function TitleBlock({ page, branch }: Readonly<{ page: Business; branch: Branch | undefined }>) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-4">
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            page.available ? 'bg-success-soft text-success' : 'bg-surface-high text-muted'
          }`}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {page.available ? 'Taking bookings' : 'Not taking bookings'}
        </span>
        <div className="flex items-center gap-4">
          {page.logoUrl && (
            <BusinessLogo name={page.name} url={page.logoUrl} className="size-14 sm:size-16" />
          )}
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[56px]">
            {page.name}
          </h1>
        </div>
        {branch && (
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-sm text-muted">
            <li className="flex items-center gap-1.5">
              <Icon name="map-pin" size={16} />
              {branch.name} branch{branch.address && ` · ${branch.address}`}
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="clock" size={16} />
              {branch.hours}
            </li>
          </ul>
        )}
      </div>
      {page.available && (
        <Link
          href={`/${page.slug}/book${branch ? `?branch=${branch.id}` : ''}`}
          className={`${buttonVariants({ size: 'lg' })} self-start lg:self-auto`}
        >
          Book a session <Icon name="calendar" size={18} />
        </Link>
      )}
    </div>
  );
}

/** Branch switcher as pills (Figma), with WAI-ARIA tab semantics and arrow keys. */
function BranchPills({
  branches,
  selected,
  onSelect,
}: Readonly<{ branches: Branch[]; selected: string; onSelect: (id: string) => void }>) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = branches.findIndex((b) => b.id === selected);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    let next: number | undefined;
    if (step) next = (index + step + branches.length) % branches.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = branches.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    onSelect(branches[next]!.id);
    tabs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Branches"
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-2"
    >
      {branches.map((branch, index) => {
        const active = branch.id === selected;
        return (
          <button
            key={branch.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="branch-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(branch.id)}
            className={`flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors ${
              active
                ? 'border-border bg-surface-high text-foreground shadow-[0_1px_2px_rgba(31,28,27,0.08)]'
                : 'border-border-subtle bg-surface text-foreground hover:bg-surface-muted'
            }`}
          >
            {active && <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />}
            {branch.name}
            {active && <span className="sr-only"> (selected)</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The owner's cover photo with the branch as caption; brand gradient and logo without one. */
function Cover({ page, branch }: Readonly<{ page: Business; branch: Branch }>) {
  return (
    <figure className="relative m-0 aspect-[16/9] overflow-hidden rounded-panel sm:aspect-[37/10]">
      {page.coverUrl ? (
        <>
          <UploadedImage src={page.coverUrl} alt="" className="absolute inset-0 size-full" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center ${BUSINESS_IMAGE_FALLBACK}`}
        >
          <BusinessLogo
            name={page.name}
            url={page.logoUrl}
            className="size-24 bg-surface text-3xl shadow-sm max-sm:hidden"
          />
        </div>
      )}
      <figcaption
        className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5 sm:p-8 ${
          page.coverUrl ? 'text-white' : 'text-on-primary-container'
        }`}
      >
        <span className="text-xs font-semibold tracking-[0.12em] uppercase opacity-90">
          {branch.name} branch
        </span>
        <span className="max-w-[640px] text-lg font-semibold sm:text-2xl">
          {page.services.length} {page.services.length === 1 ? 'service' : 'services'} across{' '}
          {page.branches.length} {page.branches.length === 1 ? 'branch' : 'branches'}, booked and
          paid online.
        </span>
      </figcaption>
    </figure>
  );
}

function BranchContent({ page, branch }: Readonly<{ page: Business; branch: Branch }>) {
  const details = useBranchPage(page.slug, branch.id);
  const services = details.data?.services ?? [];
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const book = (extra: string) => `/${page.slug}/book?branch=${branch.id}${extra}`;

  return (
    <>
      <section aria-labelledby="therapists-title" className="flex flex-col gap-6">
        <SectionHeading
          id="therapists-title"
          eyebrow="Therapists"
          title={`Therapists at ${branch.name}`}
          aside="Book with the therapist you choose"
        />
        {details.isPending ? (
          <Skeleton className="h-40" count={3} grid />
        ) : details.data && details.data.therapists.length > 0 ? (
          <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2 lg:grid-cols-3">
            {details.data.therapists.map((therapist) => {
              const offered = therapist.serviceIds
                .map((id) => serviceName.get(id))
                .filter((name): name is string => !!name);
              return (
                <li
                  key={therapist.id}
                  className="flex flex-col overflow-hidden rounded-panel bg-surface shadow-[0_1px_3px_rgba(31,28,27,0.06)]"
                >
                  <div className="flex flex-1 items-start gap-4 p-6">
                    <TherapistPhoto
                      name={therapist.displayName}
                      url={therapist.photoUrl}
                      className="size-16 text-lg"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-xl font-medium tracking-tight">
                        {therapist.displayName}
                      </span>
                      <span className="text-sm font-medium text-muted">{offered.join(', ')}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-surface-muted px-6 py-4">
                    <span className="flex flex-col">
                      <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                        Performs
                      </span>
                      <span className="text-sm font-semibold">
                        {offered.length} {offered.length === 1 ? 'service' : 'services'}
                      </span>
                    </span>
                    {page.available && (
                      <Link
                        href={book(`&staff=${therapist.id}`)}
                        className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} border-transparent text-primary-text`}
                        aria-label={`Book with ${therapist.displayName}`}
                      >
                        Book
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">No therapists take bookings at this branch yet.</p>
        )}
      </section>

      <section aria-labelledby="services-title" className="flex flex-col gap-6">
        <SectionHeading
          id="services-title"
          eyebrow="Services"
          title="Services menu"
          aside="Price includes the whole session"
        />
        {details.isPending ? (
          <Skeleton className="h-24" count={3} />
        ) : services.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex flex-col gap-4 rounded-panel bg-surface p-5 shadow-[0_1px_3px_rgba(31,28,27,0.06)] sm:flex-row sm:items-center sm:gap-5 sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className="hidden size-12 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary-text sm:flex"
                >
                  <Icon name={serviceIcon(service.name)} size={22} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-medium tracking-tight">{service.name}</span>
                    <span className="rounded-full bg-surface-high px-2 py-0.5 text-xs font-semibold">
                      {service.duration}
                    </span>
                  </span>
                  {service.description && <span className="text-muted">{service.description}</span>}
                </span>
                <span className="flex items-center justify-between gap-5 sm:justify-end">
                  <span className="flex flex-col sm:items-end">
                    <span className="text-2xl font-medium tabular-nums">{service.price}</span>
                    <span className="text-xs font-semibold text-muted">Paid when booking</span>
                  </span>
                  {page.available && (
                    <Link
                      href={book(`&service=${service.id}`)}
                      className={buttonVariants({ size: 'md' })}
                      aria-label={`Select ${service.name} at ${branch.name}`}
                    >
                      Select
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No services are offered at this branch yet.</p>
        )}
      </section>

      <section aria-labelledby="info-title" className="flex flex-col gap-6">
        <SectionHeading id="info-title" eyebrow="Before you visit" title="Essential info" />
        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard
            icon="map-pin"
            title="Location"
            footer={
              <Link
                href={`/${page.slug}/branches/${branch.id}`}
                className="flex items-center gap-1.5 text-primary-text"
              >
                <Icon name="arrow-right" size={16} /> {branch.name} branch page
              </Link>
            }
          >
            <p>{branch.address ?? 'Address not published yet.'}</p>
            {branch.phone && (
              <p>
                <a href={`tel:${branch.phone}`} className="text-foreground underline">
                  {branch.phone}
                </a>
              </p>
            )}
          </InfoCard>
          <InfoCard
            icon="clock"
            title="Opening hours"
            footer={
              <span className="flex items-center gap-1.5 text-muted">
                Times in {page.timeZone.replace('_', ' ')}
              </span>
            }
          >
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {branch.week.map((day) => (
                <div key={day.weekday} className="contents">
                  <dt>{day.label}</dt>
                  <dd className="m-0 text-right tabular-nums">{day.hours ?? 'Closed'}</dd>
                </div>
              ))}
            </dl>
            {branch.closures.map((closure) => (
              <p
                key={`${closure.startsOn}-${closure.endsOn}`}
                className="text-sm font-semibold text-warning"
              >
                Closed {closure.startsOn}
                {closure.endsOn !== closure.startsOn && ` – ${closure.endsOn}`} ({closure.reason})
              </p>
            ))}
          </InfoCard>
          <InfoCard
            icon="calendar-edit"
            title="Booking policy"
            footer={
              <span className="flex items-center gap-1.5 text-success">
                <Icon name="shield-check" size={16} /> Secure payment, slot held while you pay
              </span>
            }
          >
            {page.policyLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </InfoCard>
        </div>
      </section>
    </>
  );
}

/** A matching icon for a service from its name; a leaf for anything else. */
function serviceIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes('physio') || n.includes('assessment')) return 'physio';
  if (n.includes('needling') || n.includes('back') || n.includes('spine')) return 'spine';
  if (n.includes('pilates')) return 'pilates';
  if (n.includes('massage')) return 'massage';
  return 'leaf';
}

function SectionHeading({
  id,
  eyebrow,
  title,
  aside,
}: Readonly<{ id: string; eyebrow: string; title: string; aside?: string }>) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          {eyebrow}
        </span>
        <h2 id={id} className="text-[28px] leading-tight font-medium tracking-tight sm:text-[34px]">
          {title}
        </h2>
      </div>
      {aside && <p className="text-sm text-muted">{aside}</p>}
    </div>
  );
}

function InfoCard({
  icon,
  title,
  children,
  footer,
}: Readonly<{ icon: IconName; title: string; children: ReactNode; footer: ReactNode }>) {
  return (
    <section className="flex flex-col gap-4 rounded-panel bg-surface p-6 shadow-[0_1px_3px_rgba(31,28,27,0.06)] sm:p-7">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-lg bg-surface-muted text-primary-text"
      >
        <Icon name={icon} size={22} />
      </span>
      <h3 className="text-xl font-medium tracking-tight">{title}</h3>
      <div className="flex flex-1 flex-col gap-2 leading-relaxed text-muted">{children}</div>
      <div className="pt-2 text-sm font-semibold">{footer}</div>
    </section>
  );
}

function Skeleton({
  className,
  count,
  grid = false,
}: Readonly<{ className: string; count: number; grid?: boolean }>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={grid ? 'grid gap-5 md:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-4'}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${className} animate-pulse rounded-panel bg-surface-muted`} />
      ))}
    </div>
  );
}
