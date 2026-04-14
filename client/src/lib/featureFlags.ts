/**
 * Feature flags read from Vite env (`import.meta.env.VITE_*`).
 *
 * Flags that gate in-flight migration work — flip them to `true` in
 * `.env.local` to opt the dev build into the new path. Wave 6 uses
 * `VITE_NODESPEC_BACKEND` to gate the backend-driven NodeSpec flow
 * alongside the legacy `nodeDefinitions/*.ts` flow.
 *
 * Keep this module tiny and dep-free — it is imported from render-path
 * components and should never force a React Query dep at top-level.
 */

const readEnv = (key: string): string | undefined => {
  try {
    return (import.meta as any).env?.[key];
  } catch {
    return undefined;
  }
};

const isTruthy = (value: string | undefined): boolean => {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
};

export const featureFlags = {
  /** Wave 6 Phase 2: fetch NodeSpec from the backend instead of
   *  reading from client/src/nodeDefinitions/*.ts. Off by default. */
  nodeSpecBackend: isTruthy(readEnv('VITE_NODESPEC_BACKEND')),
} as const;

export type FeatureFlags = typeof featureFlags;
