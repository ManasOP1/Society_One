import type { UseQueryResult } from '@tanstack/react-query';

/** True only on first load — not during background refetch/poll. */
export function isInitialLoad<T>(query: Pick<UseQueryResult<T>, 'isPending' | 'data'>): boolean {
  return query.isPending && query.data === undefined;
}

/** Fire-and-forget silent refresh — no loading UI. */
export function silentRefetch(refetch: () => Promise<unknown>): void {
  void refetch().catch(() => undefined);
}
