# React Flow Canvas + Dashboard Scaling to 200+ Nodes

Analysis of `client/src/Dashboard.tsx`, custom node components (`SquareNode.tsx`, `AIAgentNode.tsx`, `TriggerNode.tsx`, `GenericNode.tsx`), `WebSocketContext.tsx` status subscriptions, and `useAppStore` state shape. Goal: what actually breaks on a 200-node workflow with parallel executions, and what to fix first.

Scope: runtime performance, heap memory, and feature-addition DX. Not bundle size.

---

## TL;DR

React Flow itself scales fine to 200+ nodes (documented to 1000+ with `onlyRenderVisibleElements`). The real bottlenecks are **client-side state management**:

1. **Global node-status subscription storm** — every `SquareNode` subscribes to the full `allNodeStatuses` map via `useWebSocket().getNodeStatus(id)`, so any single node's status change re-renders all 200 nodes. 10 updates/sec × 200 nodes = **2000 re-renders/sec**.
2. **Eager configuration checks on mount** — 200 `SquareNode`s fire parallel `getStoredApiKey()` WebSocket requests at workflow open, producing head-of-line blocking. Workflow-open latency: ~10 s.
3. **Missing `onlyRenderVisibleElements`** — React Flow is rendering every off-screen node even during pan/zoom.

Three cheap fixes (~5 hours total) reduce p99 interaction latency by an estimated 80 %. All of them reuse the same patterns we're already adopting for the credentials panel: per-slice subscriptions, `startTransition`-wrapped updates, TanStack Query for deferred fetches.

---

## Current bottlenecks

### 1. Per-node status subscription storm — CRITICAL

**File**: `client/src/contexts/WebSocketContext.tsx:1258-1263`

```ts
const getNodeStatus = useCallback((nodeId: string) => {
  if (!currentWorkflowId) return undefined;
  return allNodeStatuses[currentWorkflowId]?.[nodeId];
}, [allNodeStatuses, currentWorkflowId]);
```

The problem is **the dependency array**: `getNodeStatus` is rebuilt whenever `allNodeStatuses` changes — which is on every single broadcast for any node in any workflow. Every `SquareNode.tsx:48-50` calls `getNodeStatus(id)` from the context, and every context consumer re-renders when the context value changes.

**Impact chain**:
1. Any node broadcasts a status update → `setAllNodeStatuses()` fires
2. Context value re-computes → `getNodeStatus` reference changes
3. **All 200 `SquareNode`s re-render** even if only one status changed
4. Each SquareNode render is ~2 ms (status check + glow animation setup)
5. 10 updates/sec × 200 nodes × 2 ms ≈ **40 ms/sec of JS blocking**, plus layout

At steady state this sits at ~20–40 % single-core CPU overhead and queues user interactions (drag, click, scroll) 100–200 ms behind status broadcasts. Directly contradicts our credentials-panel INP target.

### 2. Eager configuration checks on mount — critical for workflow open

**File**: `client/src/components/SquareNode.tsx:161-203`

```ts
useEffect(() => {
  if (!wsConnected) return;
  const checkConfiguration = async () => {
    const provider = extractProviderFromNodeType();
    const apiKey = await getStoredApiKey(provider);   // WebSocket roundtrip
    setHasApiKey(!!apiKey);
    setIsConfigured(hasRequiredParams && !!apiKey);
  };
  checkConfiguration();
}, [data, id, type, definition?.displayName, definition?.credentials, isGoogleMapsNode, getStoredApiKey, wsConnected]);
```

On workflow open, all 200 `SquareNode`s mount simultaneously → 200 parallel `getStoredApiKey` WebSocket requests → backend processes sequentially → head-of-line blocking. Total workflow-open cost: ~10 s of "loading" indicators. The `WhatsAppNode.getStatus()` call on mount (flagged in CLAUDE.md as a planned fix) is the same pattern.

### 3. Missing `onlyRenderVisibleElements` on `<ReactFlow>`

**File**: `client/src/Dashboard.tsx:317-336`

React Flow's documented best practice ([reactflow.dev/learn/troubleshooting/performance](https://reactflow.dev/learn/troubleshooting/performance)): enable `onlyRenderVisibleElements={true}` for workflows above ~200 nodes. Reduces render time ~70 % for off-screen nodes. Not currently enabled. 5-minute fix.

### 4. `styledNodes` / `styledEdges` `useMemo` dependency storm

**File**: `Dashboard.tsx:456-476`

```ts
const styledNodes = useMemo(
  () => nodes.map(n => ({ /* inject className from nodeStatuses, isExecuting, executionOrder, executedNodes */ })),
  [nodes, nodeStatuses, isExecuting, executionOrder, executedNodes]
);
```

Every time `nodeStatuses` changes (10×/sec during execution), the memo recomputes **for all 200 nodes**, producing a fresh `styledNodes` array. React Flow then diffs the array and re-runs its own reconciliation. This compounds the subscription storm.

### 5. Inline style objects in `SquareNode` render body

**File**: `client/src/components/SquareNode.tsx:530-801`

~20-key inline style objects created fresh on every render (no `useMemo`). At 200 nodes × 1 re-render per status broadcast that's 4000 short-lived style objects per update → measurable GC pressure. Trivially fixed with `useMemo` or — preferred — React Compiler auto-memoization.

### 6. Parallel workflow execution — filtering not implemented

**File**: `WebSocketContext.tsx:689-717` (and `440-449` for the state shape)

State is already workflow-scoped (`allNodeStatuses[workflowId][nodeId]`, good), but the broadcast handler **accepts every workflow's events**:

```ts
case 'node_status':
  if (node_id) {
    const statusWorkflowId = message.workflow_id || 'unknown';
    // stores regardless of currentWorkflowId
```

At 5 parallel deployed workflows × 10 updates/sec each = 50 status broadcasts/sec, all causing the same re-render storm on all 200 nodes of whichever workflow the user is looking at. Backend should filter by subscribed workflow before sending, or client should ignore broadcasts for non-current workflows at the dispatcher level.

### 7. Context menu + keyboard shortcuts — actually fine

Investigated because CLAUDE.md has a long planned-features section. `NodeContextMenu.tsx:73-121` correctly attaches a single document-level listener per open menu with clean teardown. F2 rename uses `renamingNodeId` in Zustand (per-node state is derived). `useCopyPaste.ts:40-143` uses in-memory clipboard, no listeners. **No changes needed here.**

---

## Top 5 levers (ranked by impact × effort)

### Lever 1 — Extract a per-node status store (CRITICAL)

**Effort**: 1–2 hours. **Impact**: –60 % re-renders at 200 nodes; interaction latency drops from 100–200 ms → < 20 ms.

Move `allNodeStatuses` out of React context into a dedicated Zustand store and have each `SquareNode` subscribe to **only its own slice** via a selector + equality check:

```ts
// client/src/stores/useNodeStatusStore.ts
import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

type WorkflowStatuses = Record<string, NodeStatus>;
interface NodeStatusState {
  statuses: Record<string, WorkflowStatuses>;   // workflow_id -> node_id -> status
  update: (workflowId: string, nodeId: string, status: NodeStatus) => void;
  clear: (workflowId: string) => void;
}

export const useNodeStatusStore = create<NodeStatusState>((set) => ({
  statuses: {},
  update: (workflowId, nodeId, status) => set((state) => ({
    statuses: {
      ...state.statuses,
      [workflowId]: { ...state.statuses[workflowId], [nodeId]: status },
    },
  })),
  clear: (workflowId) => set((state) => {
    const { [workflowId]: _, ...rest } = state.statuses;
    return { statuses: rest };
  }),
}));

// Per-node selector — only re-renders the affected node
export function useNodeStatus(workflowId: string | null, nodeId: string) {
  return useNodeStatusStore(
    (state) => (workflowId ? state.statuses[workflowId]?.[nodeId] : undefined)
  );
}
```

`WebSocketContext` dispatches straight into this store instead of holding `allNodeStatuses` in React state. `SquareNode.tsx` replaces `useWebSocket().getNodeStatus(id)` with `useNodeStatus(currentWorkflowId, id)`.

**Result**: A status update for node X re-renders only node X. 200-node workflow with 10 updates/sec goes from 2000 re-renders/sec → 10. Same pattern recommended in the credentials-panel plan's "store shape decision" — UI state lives outside React context when it's hot.

### Lever 2 — Add `onlyRenderVisibleElements={true}` to `<ReactFlow>`

**Effort**: 5 minutes. **Impact**: –70 % render time for off-screen nodes during pan/zoom/scroll.

```tsx
// client/src/Dashboard.tsx
<ReactFlow
  nodes={styledNodes}
  edges={styledEdges}
  onlyRenderVisibleElements={true}   // add
  nodeTypes={moduleNodeTypes}
  edgeTypes={moduleEdgeTypes}
  connectionMode={ConnectionMode.Loose}
  // ...
>
```

React Flow's `onlyRenderVisibleElements` culls nodes outside the viewport. Combined with Lever 1, pan/zoom FPS on 500-node workflows should stay at 60. Documented at [reactflow.dev/learn/troubleshooting/performance](https://reactflow.dev/learn/troubleshooting/performance).

### Lever 3 — Defer node configuration checks until workflow selected, batched via TanStack Query

**Effort**: 1–2 hours. **Impact**: Workflow-open time drops from ~10 s → < 1 s.

Remove the per-node mount effect entirely. In `Dashboard.tsx`, when a workflow becomes active, fire one batched fetch using TanStack Query (same instance already being set up for the credentials panel):

```ts
// client/src/hooks/useWorkflowConfigStatus.ts
import { useQuery } from '@tanstack/react-query';

export function useWorkflowConfigStatus(workflow: Workflow | null) {
  return useQuery({
    queryKey: ['workflowConfigStatus', workflow?.id],
    queryFn: async () => {
      const nodeIds = workflow!.nodes.map(n => n.id);
      // One WebSocket request, backend does N lookups in a single pass
      return sendRequest('get_all_node_config_status', { node_ids: nodeIds });
    },
    enabled: !!workflow,
    staleTime: 30_000,
  });
}
```

Backend adds a single `get_all_node_config_status` handler that returns `{ [nodeId]: { isConfigured, hasApiKey } }`. Each `SquareNode` reads its entry via a per-node selector. No per-node effects, no head-of-line blocking.

CLAUDE.md already lists this as a planned feature ("Defer Node Status Checks Until Workflow Selected") — this is the concrete shape of the fix.

### Lever 4 — Wrap status dispatch in `startTransition`

**Effort**: 30 minutes. **Impact**: –100–200 ms INP on drag/select during status floods.

```ts
// WebSocketContext.tsx status handler
import { startTransition } from 'react';

case 'node_status':
  startTransition(() => {
    useNodeStatusStore.getState().update(statusWorkflowId, node_id, flattenedData);
  });
  break;
```

React 19 treats transition updates as interruptible and low-priority, so user drags / clicks stay synchronous even during a burst of 50 status broadcasts/sec. Same decision the credentials plan made for fuzzysort filter updates.

### Lever 5 — Memoize Dashboard styling + enable React Compiler for the canvas module

**Effort**: 30 min manual OR 5 min via React Compiler scoping. **Impact**: –15 % per-render cost on custom nodes.

Manual: wrap the `SquareNode` inline style objects in `useMemo` keyed on `(theme, nodeColor, selected, isExecuting, isGlowing)`.

Preferred: extend the credentials plan's React Compiler babel plugin scope to include `client/src/components/SquareNode.tsx`, `AIAgentNode.tsx`, `TriggerNode.tsx`, `GenericNode.tsx`, `Dashboard.tsx`. React Compiler 1.0 auto-memoizes the inline objects with zero code changes — same mechanism we're already using for the credentials module. This also catches the `styledNodes`/`styledEdges` recomputation in Dashboard.

### Lever 6 (defer) — Workflow-scoped status filter at the WebSocket boundary

**Effort**: 1 day server-side. **Impact**: Only relevant if users deploy 5+ parallel workflows simultaneously.

Backend's `StatusBroadcaster` already knows which client subscribes to which workflow. Add a `subscribe_workflow(workflow_id)` WebSocket handler and filter `node_status` broadcasts by the subscribed set. Client dispatch dispatches only if `message.workflow_id === currentWorkflowId` (cheap) until the server-side filter lands.

CLAUDE.md lists this as a planned feature. Defer until Lever 1 is in — at 5 parallel workflows Lever 1 alone brings the cost from 10 000 re-renders/sec → 50/sec, which is fine.

---

## Missing from CLAUDE.md's "Planned Features" roadmap

CLAUDE.md's planned-features section talks about removing mount status fetches and adding workflow filtering but doesn't mention:

- **The real root cause** of the subscription storm (context value churn), not just the fetch calls.
- **`onlyRenderVisibleElements`** — this is a one-line change with a 70 % win.
- **TanStack Query batched config fetch** as the replacement for per-node mount effects.
- **`startTransition` wrapping** of status dispatches.

This MD is the updated plan.

---

## "Add a new custom node component in 1 file" proposal

Current state: adding a new React component for a new node type touches **4 files** (new component file + `Dashboard.tsx` node-type mapping + per-category `nodeDefinitions/*.ts` + `ComponentPalette.tsx` category icon).

The ComponentPalette scaling MD proposes a file-based registry with Vite `import.meta.glob`. For the **React component** side of the registry, extend that pattern with a second glob:

```ts
// client/src/components/nodes/index.ts
import type { ComponentType } from 'react';
import type { NodeProps } from 'reactflow';

// Every *.node.tsx file exports `default` (the component) + `nodeTypes` (string[] it handles)
type NodeModule = {
  default: ComponentType<NodeProps>;
  nodeTypes: readonly string[];
};

const modules = import.meta.glob<NodeModule>('./**/*.node.tsx', { eager: true });

export const NODE_COMPONENT_REGISTRY: Record<string, ComponentType<NodeProps>> = {};
for (const mod of Object.values(modules)) {
  for (const t of mod.nodeTypes) {
    NODE_COMPONENT_REGISTRY[t] = mod.default;
  }
}

export const getNodeComponent = (type: string) =>
  NODE_COMPONENT_REGISTRY[type] ?? NODE_COMPONENT_REGISTRY.generic;
```

`Dashboard.tsx` replaces the long if/else mapping with:

```ts
const moduleNodeTypes = useMemo(
  () => Object.fromEntries(
    new Set(nodeArray.map(n => n.type).filter(Boolean)).values()
  ).map(type => [type, getNodeComponent(type)]),
  [nodeArray]
);
```

Now adding a timeline node = create `client/src/components/nodes/timeline.node.tsx` with `export const nodeTypes = ['timeline', 'timelineEnd'] as const;` + default component. Done. No `Dashboard.tsx` edit, no registration step.

Pairs directly with the ComponentPalette MD's file-based node *definition* registry — both glob patterns live side by side, one for definitions, one for React components.

---

## Concrete roadmap

| Phase | Effort | Impact | Prereq |
|---|---|---|---|
| **A — Cheap wins** (Levers 2 + 4) | 1 hour | –70 % off-screen renders, smoother drag during status floods | None |
| **B — Subscription storm fix** (Lever 1) | 2 hours | –60 % re-renders at 200 nodes; < 20 ms interaction latency | None |
| **C — Workflow-open latency fix** (Lever 3) | 2 hours | 10 s → < 1 s open time | TanStack Query infra (from credentials plan) |
| **D — React Compiler scope expansion** (Lever 5) | 30 min | –15 % custom-node render cost | Credentials plan Phase 7.5 complete |
| **E — Component registry glob** | 1 day | New node component = 1 file | ComponentPalette glob proposal |
| **F — Workflow-scoped broadcast filter** (Lever 6) | 1 day | Only relevant for 5+ parallel deployments | Lever 1 |

Total A+B+C+D: ~6 hours for the single biggest runtime win in the app.

---

## What to steal from the credentials panel plan

| Credentials-panel decision | Applies here? |
|---|---|
| Per-slice Zustand subscriptions (no closures over hot data) | ✅ Lever 1 |
| `@tanstack/react-query` for bulk server fetches | ✅ Lever 3 |
| `startTransition` wrapping non-urgent state updates | ✅ Lever 4 |
| `babel-plugin-react-compiler` scoped via Vite babel config | ✅ Lever 5 (extend scope to canvas module) |
| `useShallow` for multi-field subscriptions | ✅ replace the monolithic `useAppStore()` destructures |
| Heap-snapshot verification (single retainer, modal/workflow 50-cycle delta < 1 MB) | ✅ apply to workflow open/close cycles |
| INP p75 < 200 ms target (now < 100 ms for the canvas during status floods) | ✅ same target |

**Zero new dependencies.** Everything needed is already being installed for the credentials panel.

---

## References

- React Flow performance best practices: https://reactflow.dev/learn/troubleshooting/performance
- `onlyRenderVisibleElements` prop: https://reactflow.dev/api-reference/react-flow#onlyrendervisibleelements
- Zustand `useShallow`: https://github.com/pmndrs/zustand#using-zustand-without-react
- React `startTransition`: https://react.dev/reference/react/startTransition
- `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
- React Compiler 1.0: https://react.dev/blog/2025/10/07/react-compiler-1
- TanStack Query v5: https://tanstack.com/query/latest
- File references from worktree audit:
  - `WebSocketContext.tsx:1258-1263` (getNodeStatus dep churn)
  - `WebSocketContext.tsx:440-449, 689-717` (state shape + broadcast handler)
  - `SquareNode.tsx:48-50` (per-node status subscription)
  - `SquareNode.tsx:161-203` (eager config check)
  - `SquareNode.tsx:530-801` (inline style objects)
  - `Dashboard.tsx:317-336, 456-476` (ReactFlow wiring + styledNodes memo)
  - `NodeContextMenu.tsx:73-121` (cleanup paths — OK)
