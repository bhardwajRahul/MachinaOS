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
 * Wave 6 Phase 5.b: backend-group membership check.
 *
 * Returns `undefined` when the NodeSpec isn't cached yet (caller falls
 * back to its legacy `*_NODE_TYPES` array), `true`/`false` when the
 * cached spec's `group` array decides. Lets components retire local
 * helper arrays without introducing a hard dependency on prefetch
 * ordering — when the flag is off and prefetch hasn't run, the legacy
 * path runs unchanged.
 */
export function isNodeInBackendGroup(
  nodeType: string | null | undefined,
  group: string,
): boolean | undefined {
  if (!nodeType) return false;
  const spec = getCachedNodeSpec(nodeType);
  if (!spec) return undefined;
  return (spec.group ?? []).includes(group);
}

/**
 * Wave 7 flag-gated resolver.
 *
 * Flag OFF: returns `localFallback` unchanged.
 * Flag ON + spec cold: falls back to `localFallback` so the editor
 *   never renders an empty panel during prefetch warmup.
 * Flag ON + spec warm: returns the backend NodeSpec adapted to the
 *   INodeTypeDescription shape. Local UX-only hints that are absent
 *   from the NodeSpec (starter code defaults, placeholder JSON) are
 *   merged in per-property so the adapter never regresses UX.
 *
 * Merge rules (backend wins on schema, local wins on UX):
 *   - Schema fields (type, options, displayOptions, typeOptions,
 *     validation, required, description): always backend when present
 *   - UX fields (placeholder): backend when non-empty, else local
 *   - default: backend when non-empty, else local (preserves starter
 *     code + example JSON blobs that live only in the frontend)
 */
export function resolveNodeDescription(
  nodeType: string,
  localFallback: INodeTypeDescription | null | undefined,
): INodeTypeDescription | null {
  if (!featureFlags.nodeSpecBackend) {
    return localFallback ?? null;
  }
  const spec = getCachedNodeSpec(nodeType);
  if (!spec) return localFallback ?? null;

  const backend = nodeSpecToDescription(spec);
  if (!localFallback) return backend;

  // Per-property merge: keep backend as authoritative but pull UX
  // niceties (placeholder + non-empty default) from local when the
  // backend version is empty. Unknown local properties (no matching
  // backend entry) are dropped - backend is the schema SSOT.
  const localByName = new Map(
    (localFallback.properties ?? []).map((p) => [p.name, p]),
  );
  const mergedProperties = (backend.properties ?? []).map((bp) => {
    const lp = localByName.get(bp.name);
    if (!lp) return bp;
    const merged = { ...bp };
    const bpDefault = (bp as any).default;
    const bpDefaultEmpty =
      bpDefault === undefined ||
      bpDefault === null ||
      bpDefault === '' ||
      (typeof bpDefault === 'object' &&
        !Array.isArray(bpDefault) &&
        Object.keys(bpDefault).length === 0);
    if (bpDefaultEmpty && (lp as any).default !== undefined) {
      (merged as any).default = (lp as any).default;
    }
    if (!bp.placeholder && lp.placeholder) merged.placeholder = lp.placeholder;
    if (!bp.description && lp.description) merged.description = lp.description;
    return merged;
  });

  return { ...backend, properties: mergedProperties };
}
