/** Whether the app can talk to the Tempora API right now. */
export type ApiState = 'online' | 'offline';

export interface ApiStatus {
  state: ApiState;
  /** API build version; unknown while offline. */
  version: string | null;
  checkedAt: Date;
}

/** Port implemented by the data layer. The domain never knows it is HTTP. */
export interface ApiStatusRepository {
  fetchStatus(): Promise<ApiStatus>;
}
