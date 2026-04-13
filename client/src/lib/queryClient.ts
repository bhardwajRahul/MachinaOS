import { QueryClient } from '@tanstack/react-query';

/**
 * Single app-wide QueryClient. Cache lives across route changes and modal
 * open/close cycles, which is what makes warm-start persistence (e.g. the
 * credentials catalogue) actually work. Exported as a module singleton so
 * imperative code (Zustand actions, workflowApi mutations) can invalidate
 * queries without needing React context.
 *
 * See docs-internal/credentials_scaling/architecture.md for cache shape.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Most server data is push-driven via WebSocket, so queries should
      // stay stable unless we explicitly invalidate them.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});
