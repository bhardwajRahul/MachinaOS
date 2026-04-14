/**
 * NodeSpec fetch + resolve utilities.
 *
 * Wave 6 Phase 2. Thin wrapper around TanStack Query's `fetchQuery`
 * mirroring the Wave 3 pattern at InputSection.tsx:28-36 — no new hook
 * file, just a shared async helper so every consumer can opt in behind
 * the VITE_NODESPEC_BACKEND flag without duplicating boilerplate.
 *
 * Query key convention: ['nodeSpec', nodeType]
 * Stale time: Infinity (node shapes only change with a deploy).
 *
 * See C:\\Users\\Tgroh\\.claude\\plans\\typed-splashing-crown.md.
 */

import { nodeSpecToDescription, type NodeSpec } from '../adapters/nodeSpecToDescription';
import type { INodeTypeDescription } from '../types/INodeProperties';
import { featureFlags } from './featureFlags';
import { queryClient } from './queryClient';

type SendRequest = (type: string, data?: any) => Promise<any>;

export const nodeSpecQueryKey = (nodeType: string) => ['nodeSpec', nodeType] as const;

/**
 * Fetch a single NodeSpec via the WS handler, caching per node type.
 * Returns `null` when the type is unknown on the backend — callers fall
 * back to the legacy `nodeDefinitions/*` entry.
 */
export async function fetchNodeSpec(
  nodeType: string,
  sendRequest: SendRequest,
): Promise<NodeSpec | null> {
  return queryClient.fetchQuery({
    queryKey: nodeSpecQueryKey(nodeType),
    queryFn: async () => {
      try {
        const response = await sendRequest('get_node_spec', { node_type: nodeType });
        return (response?.spec ?? null) as NodeSpec | null;
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
  });
}

/**
 * Prefetch every node type the backend knows about, in a single idle
 * burst at editor boot. Non-blocking — failures are swallowed so a flaky
 * WS doesn't block UI. Matches Activepieces' summary+lazy pattern.
 */
export async function prefetchAllNodeSpecs(sendRequest: SendRequest): Promise<void> {
  try {
    const response = await sendRequest('list_node_specs', {});
    const nodeTypes: string[] = response?.node_types ?? [];
    await Promise.all(nodeTypes.map(t => fetchNodeSpec(t, sendRequest)));
  } catch {
    // Prefetch is best-effort — logged by the WS layer, not us.
  }
}

/**
 * Synchronous read of a previously-cached NodeSpec. Used by flag-gated
 * render paths that need a description on-demand without suspending.
 * Returns `null` if not yet fetched.
 */
export function getCachedNodeSpec(nodeType: string): NodeSpec | null {
  return queryClient.getQueryData<NodeSpec | null>(nodeSpecQueryKey(nodeType)) ?? null;
}

/**
 * Flag-gated resolver. When `VITE_NODESPEC_BACKEND` is off (default),
 * returns `localFallback` unchanged — legacy `nodeDefinitions/*` wins.
 * When on, returns the adapter output from the cached NodeSpec, or
 * falls through to `localFallback` if the spec hasn't arrived yet.
 *
 * Phase 3 sub-commits use this seam to delete legacy definitions one
 * file group at a time: once a group's NodeSpec is seeded on the
 * backend, the local fallback can drop to a minimal stub (or vanish).
 */
export function resolveNodeDescription(
  nodeType: string,
  localFallback: INodeTypeDescription | null | undefined,
): INodeTypeDescription | null {
  if (!featureFlags.nodeSpecBackend) {
    return localFallback ?? null;
  }
  const spec = getCachedNodeSpec(nodeType);
  if (spec) return nodeSpecToDescription(spec);
  return localFallback ?? null;
}
