import { buttonVariants, Icon, type IconName } from '@tempora/ui';
import Link from 'next/link';
import { FeaturedBusinesses } from './featured-businesses';

const FACTS = [
  { value: '3 steps', label: 'Service, time, pay' },
  { value: '30 min', label: 'Slot hold while you pay' },
  { value: '24 h', label: 'Reschedule up to the session' },
  { value: 'No account', label: 'needed: book as a guest' },
];

const CATEGORIES: { label: string; icon: IconName }[] = [
  { label: 'Massage', icon: 'massage' },
  { label: 'Physiotherapy', icon: 'physio' },
  { label: 'Sports recovery', icon: 'pulse' },
  { label: 'Chiropractic', icon: 'spine' },
  { label: 'Acupuncture', icon: 'leaf' },
  { label: 'Pilates', icon: 'pilates' },
];

const STEPS = [
  { title: 'Choose a service', text: 'Pick a branch, a service and the therapist you want.' },
  {
    title: 'Pick a free slot',
    text: 'Only times that are really bookable are shown, in 30-minute steps.',
  },
  {
    title: 'Pay securely',
    text: 'Your slot is held for 30 minutes while you pay. Confirmation arrives by email.',
  },
];

const fieldClass =
  'h-12 rounded-xl border border-white/35 bg-white/15 px-3.5 text-[15px] font-medium text-on-brand placeholder:text-on-brand-muted';

export function HomeScreen() {
  return (
    <main>
      {/* Hero */}
      <section className="px-4 pt-14 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
            <p className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-primary-text">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              Real-time availability
            </p>
            <h1 className="text-[40px] leading-[1.08] font-extrabold tracking-tight sm:text-[56px]">
              Book wellness and care sessions in minutes
            </h1>
            <p className="max-w-[520px] text-lg leading-relaxed text-muted">
              Find a studio or clinic, pick your therapist and a free slot, and pay online. Your
              slot is held for you while you pay, and it can never be double-booked.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/#businesses" className={buttonVariants({ size: 'lg' })}>
                Find a business <Icon name="arrow-right" size={18} />
              </Link>
              <Link href="/#how" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                How it works
              </Link>
            </div>
          </div>

          <div className="relative h-[460px] min-w-0 flex-[1_1_420px]" aria-hidden="true">
            <div className="absolute top-2.5 right-0 h-[420px] w-[88%] rounded-[46%_54%_40%_60%/52%_44%_56%_48%] bg-primary" />
            <div className="absolute top-0 right-8 size-14 rounded-full bg-[#bcd5e1] dark:bg-surface-muted" />
            <div className="absolute bottom-8 left-6 size-7 rounded-full bg-[#bcd5e1] dark:bg-surface-muted" />

            <div className="absolute top-[70px] left-[8%] flex w-[340px] max-w-[84%] flex-col gap-4 rounded-[20px] bg-surface p-[22px] shadow-[0_20px_50px_rgba(23,38,47,0.18)]">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-muted">Lumen Wellness Studio</p>
                <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                  Confirmed
                </span>
              </div>
              <p className="text-[22px] font-extrabold">Deep Tissue Massage</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-background p-3">
                  <p className="text-xs text-muted">Date</p>
                  <p className="mt-1 text-[15px] font-bold">Thu, 20 Nov</p>
                </div>
                <div className="rounded-xl bg-background p-3">
                  <p className="text-xs text-muted">Time</p>
                  <p className="mt-1 text-[15px] font-bold">14:30 · 90 min</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-muted font-bold text-primary-text">
                  DK
                </span>
                <div>
                  <p className="text-sm font-bold">Daniel K.</p>
                  <p className="text-xs text-muted">Therapist · Downtown</p>
                </div>
              </div>
            </div>

            <div className="absolute right-[4%] bottom-10 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 shadow-[0_14px_34px_rgba(23,38,47,0.16)]">
              <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-white dark:bg-primary">
                <Icon name="timer" />
              </span>
              <div>
                <p className="text-sm font-bold">Slot held for 30 min</p>
                <p className="text-xs text-muted">while you complete payment</p>
              </div>
            </div>
          </div>
        </div>

        <dl className="mx-auto mt-6 grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] overflow-hidden rounded-[20px] bg-surface">
          {FACTS.map((fact) => (
            <div
              key={fact.value}
              className="border-border px-6 py-[22px] [&:not(:last-child)]:border-r"
            >
              <dt className="text-[26px] font-extrabold">{fact.value}</dt>
              <dd className="mt-1 text-sm text-muted">{fact.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Search band */}
      <section aria-label="Search" className="px-4 pt-10 sm:px-6">
        <form
          role="search"
          action="/"
          className="mx-auto flex max-w-[1200px] flex-wrap items-end gap-3 rounded-[20px] bg-primary p-[18px]"
        >
          <label className="flex flex-[1_1_200px] flex-col gap-1.5 text-[13px] font-semibold text-on-brand">
            Service type
            <select name="category" className={fieldClass} defaultValue="">
              <option value="" className="text-ink">
                Any service
              </option>
              {CATEGORIES.map((category) => (
                <option key={category.label} className="text-ink">
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-[1_1_200px] flex-col gap-1.5 text-[13px] font-semibold text-on-brand">
            Business or area
            <input name="q" type="text" placeholder="e.g. Lumen, Downtown" className={fieldClass} />
          </label>
          <label className="flex flex-[1_1_180px] flex-col gap-1.5 text-[13px] font-semibold text-on-brand">
            Date
            <input name="date" type="date" className={fieldClass} />
          </label>
          <button
            type="submit"
            className={buttonVariants({ variant: 'inverse', size: 'lg', className: 'rounded-xl' })}
          >
            <Icon name="search" size={18} /> Search
          </button>
        </form>
      </section>

      {/* Categories */}
      <section className="px-4 pt-[72px] sm:px-6" aria-labelledby="categories-title">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-7">
          <div className="flex flex-col gap-2 text-center">
            <h2 id="categories-title" className="text-[30px] font-extrabold">
              Browse by category
            </h2>
            <p className="text-muted">
              Every listed business takes online bookings with live availability.
            </p>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 p-0">
            {CATEGORIES.map((category) => (
              <li key={category.label}>
                <Link
                  href="/#businesses"
                  className="flex flex-col items-center gap-3.5 rounded-2xl border border-border bg-surface px-4 py-[22px] text-foreground no-underline hover:border-primary"
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-surface-muted text-primary-text">
                    <Icon name={category.icon} size={28} strokeWidth={1.8} />
                  </span>
                  <span className="text-[15px] font-bold">{category.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured businesses */}
      <section
        id="businesses"
        className="scroll-mt-6 px-4 pt-[72px] sm:px-6"
        aria-labelledby="businesses-title"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h2 id="businesses-title" className="text-[30px] font-extrabold">
              Businesses on Tempora
            </h2>
            <p className="text-muted">Demo businesses with fictional data.</p>
          </div>
          <FeaturedBusinesses />
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="mt-[88px] scroll-mt-6 bg-primary px-4 py-[72px] sm:px-6"
        aria-labelledby="how-title"
      >
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-10">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 text-on-brand">
            <h2 id="how-title" className="text-4xl leading-tight font-extrabold">
              Booking that respects your time and theirs
            </h2>
            <p className="leading-relaxed text-on-brand-muted">
              Availability is checked twice: when you see a slot and again when you book it. Two
              people can never end up in the same session.
            </p>
            <Link
              href="/#businesses"
              className={buttonVariants({
                variant: 'inverse',
                size: 'lg',
                className: 'self-start',
              })}
            >
              Start booking <Icon name="arrow-right" size={18} />
            </Link>
          </div>
          <ol className="m-0 grid min-w-0 flex-[2_1_560px] list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[18px] p-0">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-3 rounded-[18px] bg-surface p-[22px]"
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-xl bg-surface-muted font-extrabold text-primary-text"
                >
                  {index + 1}
                </span>
                <p className="text-[17px] font-extrabold">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* For businesses */}
      <section
        id="for-business"
        className="scroll-mt-6 px-4 py-[72px] sm:px-6"
        aria-labelledby="for-business-title"
      >
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 rounded-panel border border-border bg-surface p-10">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
            <h2 id="for-business-title" className="text-[28px] font-extrabold">
              Run a studio or clinic?
            </h2>
            <p className="leading-relaxed text-muted">
              Manage branches, therapists, bookings and invoices from the Tempora Console. Customers
              book and pay online; you never chase a double booking again.
            </p>
          </div>
          <a
            href={process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001'}
            className={buttonVariants({ size: 'lg' })}
          >
            List your business
          </a>
        </div>
      </section>
    </main>
  );
}
