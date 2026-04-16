import { QueryClient } from '@tanstack/react-query';
import { GC_TIME, STALE_TIME } from './queryConfig';

/**
 * Single app-wide QueryClient. Cache lives across route changes and modal
 * open/close cycles, which is what makes warm-start persistence (e.g. the
 * credentials catalogue) actually work. Exported as a module singleton so
 * imperative code (Zustand actions, workflowApi mutations) can invalidate
 * queries without needing React context.
 *
 * Defaults match the WS-push architecture: data is considered fresh for
 * STALE_TIME.SHORT by default and components trust the cache on mount.
 * The broadcast bridge in WebSocketContext keeps the cache in sync with
 * server state, so refetch-on-mount is unnecessary overhead.
 *
 * See docs-internal/credentials_scaling/architecture.md for cache shape.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
      staleTime: STALE_TIME.SHORT,
      gcTime: GC_TIME.DEFAULT,
    },
  },
});
