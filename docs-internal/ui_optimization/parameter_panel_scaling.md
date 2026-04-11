# Parameter Panel + Dynamic Schema Scaling

Analysis of the MachinaOs parameter configuration modal (`ParameterPanel.tsx`, `ParameterRenderer.tsx`, `parameterPanel/MiddleSection.tsx`, `parameterPanel/InputSection.tsx`, `useParameterPanel.ts`) — what breaks as node property schemas grow more complex, and the minimum changes to make adding new parameter types and custom editors a one-file operation.

Scope: runtime performance, heap memory, and contributor DX. Not bundle size.

---

## TL;DR

The parameter panel is functional at 20–30 fields but has four structural issues that will get worse quickly:

1. **Monolithic type dispatch** — `ParameterRenderer.tsx:1322-2103` is a ~780-line `switch` over 15+ parameter types with hard-coded WhatsApp/Telegram/session-id special cases baked in. Adding a new type means editing this file.
2. **Every keystroke re-renders every field** — no `React.memo` on the field list, no RHF, direct controlled-input pattern. On a 50-field form this is ~18 ms/keystroke vs ~2 ms with RHF (9× slower — measured in the credentials panel runtime research).
3. **`displayOptions.show` re-evaluated every render** — `shouldShowParameter` in `MiddleSection.tsx:59-81` iterates `Object.entries()` per field per render. Quadratic cost on conditional forms.
4. **WebSocket saves are unbatched** — `useParameterPanel.ts:101-106` fires one `save_node_parameters` message per keystroke with no debouncing. A 500-char field = 500 DB upserts.

Five levers fix all of this using the same libraries and patterns already being added for the credentials panel (react-hook-form, TanStack Query mutations, React Compiler, parameter-type registry). Zero new dependencies.

---

## Current bottlenecks

### 1. Monolithic type dispatch in `ParameterRenderer.tsx:1322-2103`

A single 780-line `switch (parameter.type)` block handles `string`, `number`, `boolean`, `options`, `multiOptions`, `slider`, `percentage`, `file`, `array`, `collection`, `fixedCollection`, `json`, `notice`, etc. Embedded inside the `string` branch are hard-coded special cases for node-specific parameters:

- `group_id` selector → `SquareNode.tsx:1534` (WhatsApp groups dropdown)
- `senderNumber` selector → `:1572`
- `channel_jid` selector → `:1553`
- `sessionId` → `:1593`

This makes "add a new parameter type" a direct edit to the monolith and makes WhatsApp-specific logic live inside the generic renderer. Adding a cron-expression picker, a credentials picker that queries the credentials panel's registry, or a nested multi-step form grows the switch further.

### 2. No field-level memoization

**File**: `client/src/components/parameterPanel/MiddleSection.tsx:484-512`

The field list is rendered with a plain `.map()` over filtered parameters, wrapping each in `<ParameterRenderer>`. Neither `ParameterRenderer` nor the individual renderers are wrapped in `React.memo`, so a keystroke in field A re-renders fields B–Z. At 50 fields this is a 50× amplification of the commit cost.

Combined with direct controlled inputs (not RHF `Controller`), this reproduces the exact pathology measured in the credentials-panel runtime research: ~18 ms/keystroke at 50 fields, vs ~2 ms with RHF + `React.memo` + `Controller`.

### 3. `displayOptions.show` is O(n × d) per render

**File**: `client/src/components/parameterPanel/MiddleSection.tsx:59-81`

```ts
const shouldShowParameter = (param: INodeProperties, allParameters: Record<string, any>): boolean => {
  if (!param.displayOptions?.show) return true;
  for (const [paramName, allowedValues] of Object.entries(param.displayOptions.show)) {
    const currentValue = allParameters[paramName];
    if (Array.isArray(allowedValues)) {
      if (!allowedValues.includes(currentValue)) return false;
    } else if (currentValue !== allowedValues) {
      return false;
    }
  }
  return true;
};
```

Called inside a `.filter()` before the `.map()` render, on every commit. For 50 fields with ~3 average dependencies each, that's 150 property lookups + 150 `Array.includes` calls per keystroke. Trivially cacheable: compile each schema's `show` clause into a stable predicate function `(params) => boolean` once at definition load, then call the cached function.

### 4. Unbatched WebSocket saves

**File**: `client/src/hooks/useParameterPanel.ts:101-106`

`handleParameterChange` updates local state synchronously and `handleSave` fires `sendRequest('save_node_parameters', ...)` with no debounce, batching, or mutation queue. For a user typing 500 characters into a prompt field, this is 500 WebSocket round-trips, 500 DB upserts against `NodeParameter` (full-row upsert per call in `database.py:232-250`), and 500 broadcast events via `node_parameters_updated` to any other connected clients.

At 1 client this is "just" wasteful. At 5 parallel clients editing the same workflow it creates echo storms and temporary state thrash.

### 5. Custom editors hard-coded by node type

**File**: `client/src/components/parameterPanel/MiddleSection.tsx:515-521` and scattered conditionals in `ParameterRenderer.tsx`

`MasterSkillEditor`, `ToolSchemaEditor`, `LocationParameterPanel`, `MapsSection`, `CodeEditor` are wired in with explicit `if (nodeType === 'masterSkill')` / `if (TOOL_NODE_TYPES.includes(...))` checks. There is no registry. Adding a new custom editor (say, a `credentialsPicker` that queries the new credentials catalogue) requires:

1. Create the component.
2. Import it in `MiddleSection.tsx`.
3. Add a conditional branch in `MiddleSection.tsx`.
4. Possibly add another conditional in `ParameterPanel.tsx` wrapper.
5. Update `CLAUDE.md`'s guide.

**3–4 files touched** for what should be plug-in code.

### 6. `InputSection` rebuilds schema tree on every open

**File**: `client/src/components/parameterPanel/InputSection.tsx:49-100`

`fetchConnectedNodes` runs on every node-selection change, walks edges to find connected nodes, calls `getNodeOutput` per connected node via WebSocket, and rebuilds the draggable variable tree. No caching across opens; no dedupe of identical schemas. On a 50-connected-node workflow every panel open re-fetches the same schema repeatedly.

Fix is a cached, TanStack Query-backed schema fetch keyed on `(connectedNodeId, outputType)` with `staleTime` tuned to the node's execution interval.

---

## Top 5 levers (ranked by impact × effort)

### Lever 1 — Parameter type registry (tier-1)

**Effort**: ~3 hours. **Impact**: eliminates the 780-line switch, makes adding a new parameter type a one-file addition, unblocks the rest of the levers.

```ts
// client/src/components/parameterPanel/ParameterTypeRegistry.ts
import type { INodeProperties } from '../../types/INodeProperties';

export interface ParameterRendererProps {
  parameter: INodeProperties;
  value: unknown;
  onChange: (value: unknown) => void;
  allParameters: Record<string, unknown>;
  nodeId: string;
  nodeType: string;
}

export interface ParameterTypeHandler {
  readonly types: readonly string[];           // e.g. ['string'] or ['options', 'multiOptions']
  render: (props: ParameterRendererProps) => React.ReactNode;
  validate?: (value: unknown, param: INodeProperties) => string | null;
}

const handlers = new Map<string, ParameterTypeHandler>();

export function registerParameterType(handler: ParameterTypeHandler) {
  for (const t of handler.types) handlers.set(t, handler);
}

export function renderParameter(props: ParameterRendererProps): React.ReactNode {
  const h = handlers.get(props.parameter.type);
  if (!h) return <UnsupportedParameterWarning type={props.parameter.type} />;
  return h.render(props);
}
```

Refactor each branch of the existing switch into its own file:

```
client/src/components/parameterPanel/types/
├── index.ts            # auto-register via import.meta.glob
├── StringType.tsx
├── NumberType.tsx
├── BooleanType.tsx
├── OptionsType.tsx
├── MultiOptionsType.tsx
├── CollectionType.tsx
├── FixedCollectionType.tsx
├── JsonType.tsx
├── NoticeType.tsx
├── CodeType.tsx
└── ...
```

Auto-register via Vite glob (same pattern as the node definition and custom-editor globs proposed in the other UI optimization MDs):

```ts
// types/index.ts
const modules = import.meta.glob<{ default: ParameterTypeHandler }>(
  './*.tsx',
  { eager: true }
);
for (const m of Object.values(modules)) registerParameterType(m.default);
```

**Adding a new type** becomes creating one file:

```ts
// client/src/components/parameterPanel/types/CronExpressionType.tsx
import type { ParameterTypeHandler } from '../ParameterTypeRegistry';
import { CronInput } from '../../ui/CronInput';
import cronParser from 'cron-parser';

const handler: ParameterTypeHandler = {
  types: ['cronExpression'],
  render: ({ value, onChange, parameter }) => (
    <CronInput value={value as string} onChange={onChange} placeholder={parameter.placeholder} />
  ),
  validate: (value) => {
    try { cronParser.parseExpression(value as string); return null; }
    catch (e) { return (e as Error).message; }
  },
};
export default handler;
```

One line in `types/INodeProperties.ts` adds `'cronExpression'` to the type union. Zero edits to `ParameterRenderer.tsx`, `MiddleSection.tsx`, or `ParameterPanel.tsx`.

Node-type-specific special cases (WhatsApp group selector, Telegram channel selector, etc.) move into separate per-feature handler files that register via the same mechanism and use a stricter `types` array or an `appliesWhen(ctx)` guard.

### Lever 2 — TanStack Query mutation queue with optimistic updates + debouncing (tier-1)

**Effort**: ~4 hours. **Impact**: 500 WebSocket messages → 1 debounced message per 300 ms idle window. Optimistic updates make UI feel instant.

Replace the imperative `saveNodeParameters` call with a TanStack Query mutation (the same `QueryClient` already being set up for the credentials panel):

```ts
// client/src/hooks/useParameterPanel.ts
const queryClient = useQueryClient();

const saveMutation = useMutation({
  mutationFn: (params: Record<string, unknown>) =>
    sendRequest('save_node_parameters', {
      node_id: nodeId,
      parameters: params,
      request_id: crypto.randomUUID(),   // idempotency key, same pattern as credentials panel
    }),
  onMutate: async (params) => {
    await queryClient.cancelQueries({ queryKey: ['nodeParams', nodeId] });
    const previous = queryClient.getQueryData(['nodeParams', nodeId]);
    queryClient.setQueryData(['nodeParams', nodeId], params);   // optimistic
    return { previous };
  },
  onError: (_err, _params, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(['nodeParams', nodeId], ctx.previous);
  },
});

const debouncedSave = useMemo(
  () => debounce((p: Record<string, unknown>) => saveMutation.mutate(p), 300),
  [saveMutation]
);

// On every parameter change:
const handleParameterChange = (name: string, value: unknown) => {
  const next = { ...parameters, [name]: value };
  setParameters(next);          // local UI state, synchronous
  debouncedSave(next);           // batched server save
};
```

The server-side `save_node_parameters` handler already exists; adding an `idempotency_key` dedupe (60 s TTL dict, same as the credentials panel's Phase 7.5) makes the mutation queue + retry loop safe.

**Benefit**: one network roundtrip per 300 ms idle window, not per keystroke. Server-side load drops by ~99% during typing. Other connected clients get a single broadcast update per burst, eliminating state thrash.

### Lever 3 — `React.memo` field list + React Compiler scope expansion (tier-1)

**Effort**: 30 min manual, 5 min via compiler scoping. **Impact**: 50× reduction in commit cost at 50 fields — only the changed field re-renders.

Manual:

```tsx
// ParameterRenderer.tsx
const ParameterRenderer = React.memo(
  function ParameterRenderer(props) { /* ... */ },
  (prev, next) =>
    prev.value === next.value &&
    prev.parameter === next.parameter &&
    prev.allParameters[prev.parameter.name] === next.allParameters[next.parameter.name]
);
```

Preferred: **extend the credentials-panel React Compiler babel scope** to cover `client/src/components/ParameterRenderer.tsx`, `client/src/components/parameterPanel/*.tsx`, and the new `types/` folder. Auto-memoization handles this without manual `React.memo` — same zero-code win as the credentials module.

### Lever 4 — Compile `displayOptions.show` predicates once (tier-2)

**Effort**: ~2 hours. **Impact**: removes the O(n × d) per-render cost; visibility checks become a function call.

At schema-load time (or lazily on first use, memoized), transform each `displayOptions.show` clause into a stable predicate:

```ts
// client/src/components/parameterPanel/compileDisplayOptions.ts
export type VisibilityPredicate = (params: Record<string, unknown>) => boolean;

const cache = new WeakMap<INodeProperties, VisibilityPredicate>();

export function compileVisibility(param: INodeProperties): VisibilityPredicate {
  const cached = cache.get(param);
  if (cached) return cached;

  const show = param.displayOptions?.show;
  if (!show) {
    const alwaysTrue = () => true;
    cache.set(param, alwaysTrue);
    return alwaysTrue;
  }

  const entries = Object.entries(show);
  const fn: VisibilityPredicate = (params) => {
    for (const [key, allowed] of entries) {
      const v = params[key];
      if (Array.isArray(allowed)) {
        if (!allowed.includes(v)) return false;
      } else if (v !== allowed) {
        return false;
      }
    }
    return true;
  };
  cache.set(param, fn);
  return fn;
}
```

Replace `shouldShowParameter(param, params)` in `MiddleSection.tsx` with `compileVisibility(param)(params)`. The predicate body is identical; the win is that it's a stable function reference, JIT-friendly, and keyed by a `WeakMap` so unused schemas can be garbage-collected.

### Lever 5 — Cached schema tree fetch for `InputSection` via TanStack Query

**Effort**: ~2 hours. **Impact**: eliminates WebSocket round-trips on repeated panel opens.

```ts
// client/src/hooks/useNodeOutputSchema.ts
export function useNodeOutputSchema(nodeId: string) {
  return useQuery({
    queryKey: ['nodeOutputSchema', nodeId],
    queryFn: () => sendRequest('get_node_output_schema', { node_id: nodeId }),
    staleTime: 30_000,
  });
}
```

`InputSection` then calls `useNodeOutputSchema(connectedNodeId)` for each connected node. Queries dedupe automatically; switching between nodes reuses the cache.

### Lever 6 (defer) — Full RHF `Controller` migration

**Effort**: 12–16 hours. **Impact**: 9× faster keystroke latency on very large forms + unified validation + field-level errors.

This is the same migration already planned for the credentials panel. Order matters: do Levers 1–4 first, then migrate `FieldRenderer` / `ParameterRenderer` to RHF `Controller` wrapping antd inputs — that way the registry is already in place and each per-type handler can be migrated incrementally without a big-bang refactor.

For the parameter panel specifically, RHF's biggest win is validation (each field can now report its own error without re-rendering siblings) and the mutation queue becomes trivial (`handleSubmit(saveMutation.mutate)`).

---

## Custom editor registry (makes "new custom editor" a one-file addition)

The same glob-based auto-registration pattern used for parameter types handles custom editors:

```ts
// client/src/components/parameterPanel/customEditors/index.ts
export interface CustomEditorHandler {
  readonly nodeTypes: readonly string[];          // e.g. ['masterSkill']
  readonly component: React.ComponentType<{ nodeId: string; parameters: Record<string, unknown> }>;
}

const handlers = new Map<string, CustomEditorHandler>();

const modules = import.meta.glob<{ default: CustomEditorHandler }>('./*.tsx', { eager: true });
for (const m of Object.values(modules)) {
  for (const t of m.default.nodeTypes) handlers.set(t, m.default);
}

export function getCustomEditor(nodeType: string) {
  return handlers.get(nodeType);
}
```

`MiddleSection.tsx` replaces its long conditional chain with:

```tsx
const editor = getCustomEditor(nodeType);
if (editor) {
  const Editor = editor.component;
  return <Editor nodeId={nodeId} parameters={parameters} />;
}
return <DefaultParameterList ... />;
```

Adding a `credentialsPicker` editor that queries the new credentials catalogue (via `useCatalogueQuery` from the credentials panel plan) is now one file in `customEditors/` with `nodeTypes: ['credentialsPicker']` and a default export.

---

## What to steal from the credentials panel plan

| Credentials-panel decision | Applies to parameter panel? |
|---|---|
| `@tanstack/react-query` with idempotency-key mutations | ✅ Lever 2 — replaces ad-hoc WebSocket saves |
| `experimental_createPersister(idb-keyval)` for warm-start | ⚠️ Only if we want to persist the in-progress panel edit across app reloads (probably not) |
| `react-hook-form` `Controller` wrapping antd inputs | ✅ Lever 6 — same migration, do after Levers 1–4 |
| `babel-plugin-react-compiler` scoped via `@vitejs/plugin-react` | ✅ Lever 3 — extend scope to `parameterPanel/` directory |
| Schema version hash (for client-side cache invalidation) | ✅ Apply to `useNodeOutputSchema` so stale output schemas get invalidated after a node re-executes |
| UI-state-only Zustand store, no derived data | ✅ `useAppStore` keeps `selectedNodeId`, `paramPanelOpen`; TanStack Query owns `parameters` and `outputSchema` |
| Idempotency keys on all mutations | ✅ Lever 2 — already included |
| Heap snapshot verification (50-cycle open/close delta < 1 MB) | ✅ apply to parameter panel open/close cycles |

**Zero new dependencies.** All the libraries needed are already being installed for the credentials panel.

---

## Concrete roadmap

| Phase | Effort | Impact | Prereq |
|---|---|---|---|
| **A — Type registry + memo** (Levers 1 + 3) | ~4 hours | New parameter type = 1 file; 50× less re-render cost | Credentials panel dep install |
| **B — Mutation queue + debounce** (Lever 2) | ~4 hours | 99% fewer WebSocket saves during typing; optimistic UI | TanStack Query wired (credentials plan) |
| **C — Compile visibility predicates** (Lever 4) | ~2 hours | Removes O(n × d) per-keystroke visibility check | None |
| **D — Cached output schema fetch** (Lever 5) | ~2 hours | No redundant WebSocket roundtrips on panel re-open | TanStack Query wired |
| **E — Custom editor registry** | ~3 hours | New custom editor = 1 file | Lever 1 shipped |
| **F — Full RHF migration** (Lever 6, optional) | 12–16 hours | 9× faster keystroke latency on very large forms | All previous phases |

Phases A–E land in ~15 hours. Phase F is a larger refactor that should wait until Phase A–E are battle-tested.

---

## References

- React Hook Form `Controller`: https://react-hook-form.com/docs/usecontroller/controller
- TanStack Query mutations + optimistic updates: https://tanstack.com/query/v5/docs/react/guides/optimistic-updates
- React Compiler 1.0: https://react.dev/blog/2025/10/07/react-compiler-1
- Vite `import.meta.glob`: https://vite.dev/guide/features.html#glob-import
- `WeakMap` for predicate caching: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
- n8n `INodeProperties` + `displayOptions`: https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/Interfaces.ts
- File references from worktree audit:
  - `ParameterRenderer.tsx:1322-2103` (780-line type switch, embedded node-type special cases)
  - `MiddleSection.tsx:59-81` (`shouldShowParameter` — O(n × d) per render)
  - `MiddleSection.tsx:484-512` (unmemoized field list render)
  - `MiddleSection.tsx:515-521` (`ToolSchemaEditor` hard-coded conditional)
  - `useParameterPanel.ts:101-106` (unbatched `handleSave`)
  - `InputSection.tsx:49-100` (schema tree rebuild on every open)
  - `server/routers/websocket.py:150-162` + `server/core/database.py:232-250` (`save_node_parameters` handler + `NodeParameter` upsert)
