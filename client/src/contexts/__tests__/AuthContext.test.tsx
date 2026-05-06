/**
 * Tests for the TanStack-Query-backed AuthContext.
 *
 * Locks in the contracts that drive perceived launch time + the
 * disconnect-reconnect bug-fix:
 *
 *   1. Anonymous-mode happy path: backend reports `auth_enabled: false`
 *      → user is auto-set to the anonymous owner without further work.
 *   2. Retry-then-recover: 503 fails N times then 200 succeeds → user
 *      is set, no LoginPage flash.
 *   3. 401 fast-fail: backend returns 401 → query reports error
 *      immediately, NO retry budget burned (would otherwise wait 10s).
 *   4. Logout invalidates the cache: after logout the cached data shows
 *      `authenticated: false` so the WebSocketContext logout effect
 *      fires deterministically.
 *
 * Backoff is verified at the unit level (the AUTH_RETRY constant is
 * used by `lib/connectionConfig.ts`); the E2E backoff curve is covered
 * by the manual flake-test plan in docs-internal/release_build_pipeline.md.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, AUTH_STATUS_QUERY_KEY } from '../AuthContext';

// Mock the API config so the fetch URL is predictable in test logs.
vi.mock('../../config/api', () => ({
  API_CONFIG: { PYTHON_BASE_URL: 'http://test' },
}));

// Each test gets a fresh QueryClient with retries disabled by default;
// individual tests opt back into retries to exercise the retry path.
function makeQueryClient(opts?: { retry?: number }): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: opts?.retry ?? 0, retryDelay: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({
  children,
  client,
}: {
  children: React.ReactNode;
  client: QueryClient;
}) {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

// Captures the `useAuth()` value across renders so tests can assert on
// state transitions without remembering to await effects manually.
function makeProbe() {
  const states: ReturnType<typeof useAuth>[] = [];
  function Probe() {
    states.push(useAuth());
    return null;
  }
  return { states, Probe };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AuthContext (TanStack Query)', () => {
  it('sets the anonymous user when backend reports auth_enabled: false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          auth_enabled: false,
          auth_mode: 'single',
          authenticated: false,
          user: null,
          can_register: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = makeQueryClient();
    const { states, Probe } = makeProbe();
    render(
      <Wrapper client={client}>
        <Probe />
      </Wrapper>,
    );

    await waitFor(() => {
      const last = states[states.length - 1];
      expect(last.isLoading).toBe(false);
      expect(last.isAuthenticated).toBe(true);
      expect(last.user?.email).toBe('anonymous');
    });
  });

  it('retries on 503 and surfaces the user on the 200', async () => {
    let attempt = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempt += 1;
      if (attempt < 3) {
        return new Response('upstream not ready', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          auth_enabled: true,
          auth_mode: 'single',
          authenticated: true,
          user: { id: 1, email: 'a@b', display_name: 'A', is_owner: true },
          can_register: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    // Allow up to 3 retries here so the third attempt resolves the 200.
    const client = makeQueryClient({ retry: 3 });
    const { states, Probe } = makeProbe();
    render(
      <Wrapper client={client}>
        <Probe />
      </Wrapper>,
    );

    await waitFor(() => {
      const last = states[states.length - 1];
      expect(last.isAuthenticated).toBe(true);
      expect(last.user?.email).toBe('a@b');
    });
    expect(attempt).toBeGreaterThanOrEqual(3);
  });

  it('does not retry a 401 — surfaces "not authenticated" immediately', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 }),
    );

    // Even with a generous retry budget the AuthContext's `retry`
    // predicate refuses 401/403 — `fetchSpy` should be called exactly
    // ONCE.
    const client = makeQueryClient({ retry: 5 });
    const { states, Probe } = makeProbe();
    render(
      <Wrapper client={client}>
        <Probe />
      </Wrapper>,
    );

    await waitFor(() => {
      const last = states[states.length - 1];
      expect(last.isLoading).toBe(false);
      expect(last.isAuthenticated).toBe(false);
      expect(last.error).not.toBeNull();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('logout invalidates the auth-status cache and flips authenticated → false', async () => {
    // Initial auth-enabled, logged-in user.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/logout')) {
        return new Response('', { status: 200 });
      }
      // /status — return a logged-in user the first call, an
      // unauthenticated response on every subsequent call (after logout
      // invalidates the cache and refetches).
      return new Response(
        JSON.stringify({
          auth_enabled: true,
          auth_mode: 'single',
          authenticated: false,
          user: null,
          can_register: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = makeQueryClient();
    // Seed the cache with an authenticated user so we can observe the
    // transition triggered by `logout()`. This mirrors the real flow:
    // on first mount the query resolves authenticated, then later
    // logout flips it.
    client.setQueryData([...AUTH_STATUS_QUERY_KEY], {
      auth_enabled: true,
      auth_mode: 'single',
      authenticated: true,
      user: { id: 1, email: 'a@b', display_name: 'A', is_owner: true },
      can_register: false,
    });

    const { states, Probe } = makeProbe();
    render(
      <Wrapper client={client}>
        <Probe />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(states[states.length - 1].isAuthenticated).toBe(true);
    });

    await act(async () => {
      await states[states.length - 1].logout();
    });

    await waitFor(() => {
      const last = states[states.length - 1];
      expect(last.isAuthenticated).toBe(false);
      expect(last.user).toBeNull();
    });
  });
});
