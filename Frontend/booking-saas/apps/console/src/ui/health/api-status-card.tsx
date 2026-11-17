'use client';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tempora/ui';
import { useApiStatus } from '@/core/health/presentation/use-api-status';

export function ApiStatusCard() {
  const status = useApiStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle>System status</CardTitle>
        <CardDescription>Live connection between this app and the Tempora API.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3" aria-live="polite">
        <Badge tone={status.tone}>{status.label}</Badge>
        <p className="text-sm text-muted">{status.detail}</p>
      </CardContent>
    </Card>
  );
}
