import type { ApiStatus } from '../domain/api-status';

export type StatusTone = 'neutral' | 'success' | 'danger';

export interface ApiStatusViewModel {
  label: string;
  tone: StatusTone;
  detail: string;
}

/** Pure mapping from domain state to what the screen shows; unit-tested without React. */
export function toApiStatusViewModel(status: ApiStatus | undefined): ApiStatusViewModel {
  if (!status) {
    return { label: 'Checking API…', tone: 'neutral', detail: 'Contacting the Tempora API.' };
  }
  if (status.state === 'offline') {
    return {
      label: 'API offline',
      tone: 'danger',
      detail: 'The Tempora API cannot be reached. Is the backend running?',
    };
  }
  return {
    label: 'API online',
    tone: 'success',
    detail: `Connected to Tempora API ${status.version ?? ''}`.trim() + '.',
  };
}
