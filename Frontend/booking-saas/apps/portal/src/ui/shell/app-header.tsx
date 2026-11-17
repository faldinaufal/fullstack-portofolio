import { ThemeToggle } from '@tempora/ui';
import { APP } from '@/ui/app-info';

export function AppHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <p className="font-semibold tracking-tight">
          Tempora <span className="font-normal text-muted">{APP.name}</span>
        </p>
        <ThemeToggle />
      </div>
    </header>
  );
}
