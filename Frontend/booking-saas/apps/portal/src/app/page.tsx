import { APP } from '@/ui/app-info';
import { ApiStatusCard } from '@/ui/health/api-status-card';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Tempora {APP.name}</h1>
        <p className="text-muted">{APP.description}</p>
      </div>
      <div className="max-w-md">
        <ApiStatusCard />
      </div>
    </main>
  );
}
