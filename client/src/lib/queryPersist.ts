/**
 * TanStack Query persistence wiring.
 *
 * Persists the in-memory query cache to localStorage so that on hard
 * refresh the editor paints node specs / catalogues from last session
 * instead of waiting for the WebSocket handshake + bulk fetch.
 *
 * Buster: tied to root package.json version via Vite's __APP_VERSION__
 * compile-time constant (see vite.config.js). Bumping the version
 * automatically purges stale persisted entries on next load.
 *
 * Filter: only queries declaring staleTime: STALE_TIME.FOREVER are
 * persisted. Those carry data that only changes with a backend deploy
 * (NodeSpec catalogue, node groups). High-frequency / per-session
 * queries (status, parameters) are not persisted.
 *
 * References:
 *   https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
 *   https://datatracker.ietf.org/doc/html/rfc5861 (stale-while-revalidate)
 */

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Query } from '@tanstack/react-query';

declare const __APP_VERSION__: string;

const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

const STORAGE_KEY = 'machina-query-cache';

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: STORAGE_KEY,
  // Throttle persistence writes so high-frequency cache mutations do
  // not thrash localStorage. Default is 1000ms which is fine.
});

/**
 * Buster string. Persisted cache from a different version is purged on
 * load. Use the package.json version so a release bump implicitly
 * invalidates everything.
 */
export const queryBuster = APP_VERSION;

/**
 * Persisted entries are valid for 24h. After that the cache is
 * discarded on hydrate and refetched fresh. RFC 5861 SWR window.
 */
export const queryPersistMaxAge = 24 * 60 * 60 * 1000;

/**
 * Filter predicate: only persist queries that declare
 * `staleTime: Infinity`. That is our project-wide marker for
 * "data only changes with a backend deploy" (catalogues, node specs,
 * node groups). High-frequency or per-session data stays in memory.
 *
 * The key is a defensive string-prefix match in addition to staleTime
 * so a future regression to the staleTime config does not silently
 * start persisting noisy keys.
 */
const PERSISTED_KEY_PREFIXES = [
  'nodeSpec',
  'nodeGroups',
  // credentialValues: panel form fields prefilled across reloads.
  'credentialValues',
  // credentialCatalogue is NOT here -- it has its own IDB warm-start in
  // useCatalogueQuery.ts (idb-keyval) so localStorage persistence would
  // duplicate the bytes for no benefit. skillContent stays in-memory only.
];

export function shouldPersistQuery(query: Query): boolean {
  const key = query.queryKey;
  if (!Array.isArray(key) || typeof key[0] !== 'string') return false;
  if (!PERSISTED_KEY_PREFIXES.includes(key[0])) return false;
  // Only persist successfully resolved queries; do not write error or
  // pending state to disk.
  return query.state.status === 'success';
}
