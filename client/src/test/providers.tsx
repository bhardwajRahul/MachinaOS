/**
 * Shared provider wrappers for tests.
 *
 * Wraps React Testing Library helpers in the providers that the scaling-v2
 * refactor made mandatory:
 *   - QueryClientProvider (TanStack Query) -- required by useNodeParamsQuery,
 *     useCatalogueQuery, and any component/hook downstream that uses
 *     useQueryClient().
 *   - ThemeProvider -- required by useTheme() inside the new
 *     components/output/OutputPanel and most shadcn primitives that read the
 *     dark-mode flag.
 *
 * Use:
 *
 *   import { renderWithProviders, wrapperWithProviders } from '../../test/providers';
 *
 *   // Component
 *   renderWithProviders(<CredentialsModal visible={true} onClose={fn}/>);
 *
 *   // Hook
 *   renderHook(() => useParameterPanel(), { wrapper: wrapperWithProviders() });
 */

import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../contexts/ThemeContext';

export interface ProvidersOptions {
  /**
   * Pass an existing QueryClient if the test needs to inspect or seed the
   * cache.  Defaults to a fresh client per call with retries disabled (so
   * that error-path tests resolve quickly instead of waiting for the default
   * three-attempt back-off).
   */
  queryClient?: QueryClient;
}

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
    // Silence React Query's default error logging in test runs.
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as any,
  });
}

export function AllProviders({
  children,
  queryClient,
}: { children: React.ReactNode } & ProvidersOptions) {
  const client = queryClient ?? makeTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: ProvidersOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { queryClient, ...rtlOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient}>{children}</AllProviders>
    ),
    ...rtlOptions,
  });
}

export function wrapperWithProviders(opts: ProvidersOptions = {}) {
  return ({ children }: { children: React.ReactNode }) => (
    <AllProviders queryClient={opts.queryClient}>{children}</AllProviders>
  );
}
