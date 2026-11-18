import { buttonVariants } from '@tempora/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex max-w-[640px] flex-col items-start gap-4 py-12">
      <p className="text-sm font-bold text-primary-text">404</p>
      <h1 className="text-3xl font-extrabold">This screen does not exist yet</h1>
      <p className="text-muted">
        Tempora is being built screen by screen. This part of the Console is a later milestone.
      </p>
      <Link href="/" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  );
}
