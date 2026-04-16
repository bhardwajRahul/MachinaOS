/**
 * Centralized TanStack Query configuration.
 *
 * All cache-time constants and cross-file query keys live here. Hook-local
 * keys (those consumed in a single file) stay next to their owning hook;
 * only keys read or written from more than one module are centralized.
 *
 * Query keys are built with the community-standard
 * `@lukemorales/query-key-factory` (recommended by the TanStack Query
 * docs) so key shapes, partial-match `_def` scopes, and TypeScript
 * inference are all library-managed instead of hand-rolled.
 *
 * See:
 *   docs-internal/credentials_scaling/architecture.md (cache shape)
 *   docs-internal/frontend_architecture.md            (WS-push model)
 *   https://tanstack.com/query/v5/docs/framework/react/community/lukemorales-query-key-factory
 */

import { createQueryKeys, mergeQueryKeys } from '@lukemorales/query-key-factory';

/**
 * Stale-time buckets keyed by update cadence of the underlying data.
 * Values are milliseconds.
 */
export const STALE_TIME = {
  /** Fast-changing data; tolerates occasional refetch on mount. */
  SHORT: 30_000,
  /** Moderately stable (user settings, node parameters). */
  MEDIUM: 60_000,
  /** Stable data held across route changes and modal cycles. */
  LONG: 5 * 60_000,
  /** Data that only changes with a backend deploy or explicit invalidate. */
  FOREVER: Infinity,
} as const;

/**
 * Garbage-collection times. Longer values keep cache entries in memory
 * after the last consumer unmounts, improving warm-open latency.
 */
export const GC_TIME = {
  DEFAULT: 5 * 60_000,
  CATALOGUE: 10 * 60_000,
} as const;

/**
 * Decrypted value for a stored credential field. SquareNode reads it;
 * WebSocketContext bridges `api_key_status` broadcasts into it.
 */
const storedApiKey = createQueryKeys('storedApiKey', {
  byProvider: (provider: string) => [provider],
});

/**
 * Compaction / token-usage stats for a memory session. MiddleSection
 * reads it; WebSocketContext bridges `token_usage_update` and
 * `compaction_completed` broadcasts into it.
 */
const compactionStats = createQueryKeys('compactionStats', {
  bySession: (sessionId: string, model: string, provider: string) =>
    [sessionId, model, provider],
});

/**
 * Merged factory. Consumers call
 *   queryKeys.storedApiKey.byProvider(provider).queryKey
 * for a specific key, and
 *   queryKeys.storedApiKey._def
 * for partial-match invalidation across the namespace.
 */
export const queryKeys = mergeQueryKeys(storedApiKey, compactionStats);
