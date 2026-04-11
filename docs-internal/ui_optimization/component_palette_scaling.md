# ComponentPalette & Node Registry Scaling to 500+ Nodes

Analysis of the MachinaOs node sidebar (`client/src/components/ui/ComponentPalette.tsx`) and the node definition registry (`client/src/nodeDefinitions.ts` + 26 per-category files) — what breaks as node count grows from 93 → 500+, and the minimum changes to make adding new nodes a one-file operation.

Scope: runtime performance, heap memory, and contributor DX. Not bundle size.

---

## Current bottlenecks

### 1. Registry runtime cost (module parse time)

`client/src/nodeDefinitions.ts:38-64` performs a synchronous spread merge of 26 per-category modules at module parse time:

```ts
export const nodeDefinitions: Record<string, INodeTypeDescription> = {
  ...workflowNodes,
  ...schedulerNodes,
  ...aiModelNodes,       // calls createBaseChatModel() eagerly per provider
  ...aiAgentNodes,
  // ... 23 more
};
```

Each per-category file eagerly constructs full `INodeTypeDescription` objects including nested `properties[]` schema arrays (100–300 lines per complex node). At 93 nodes today this is ~200 KB of schema JS executing on the main thread before first paint. At 500+ nodes it extrapolates to ~1.1 MB of synchronous parse + object construction.

**Specific hotspot**: `specializedAgentNodes.ts:63-150` defines `AI_AGENT_PROPERTIES` as a shared array, then each specialized agent references (not clones) it — **but** the current pattern still instantiates a wrapper object per agent. At 9 specialized agents that's 810 nested property objects retained in heap; scaling to 50 agents would hit ~4,500.

**Good news** — icons are raw strings (emoji or `data:image/svg+xml,...` URIs), not React.FC instances. V8 interns identical strings so there is no per-node icon retention cost.

### 2. Filter/search runtime (O(n) per keystroke, full re-render)

`ComponentPalette.tsx:102-151` implements search with a naive substring `.includes()` scan inside `useMemo`:

```ts
const categorizedComponents = React.useMemo(() => {
  const filteredDefinitions = Object.values(nodeDefinitions).filter((definition) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesQuery =
        (definition.displayName || '').toLowerCase().includes(query) ||
        (definition.description || '').toLowerCase().includes(query) ||
        (definition.group?.[0] || '').toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }
    // proMode filter, category merge, ...
    return true;
  });
  // re-group into 20+ CollapsibleSection buckets
}, [nodeDefinitions, searchQuery, proMode]);
```

At 500 nodes every keystroke runs an O(n) string scan, rebuilds the category map, and triggers a full re-render of every `CollapsibleSection` + `ComponentItem`. **No virtualization, no pre-indexed search, no startTransition.** At the credentials-panel scale target (which we now share), this hits ~50–150 ms per keystroke — well over the INP budget.

### 3. Memory footprint of node definitions

Per `INodeTypeDescription` (`client/src/types/INodeProperties.ts:177`) the retained cost is:
- `displayName` / `name` / `description`: ~100 B
- `icon` (string): ~50–200 B
- `group`, `defaults`, `keywords`, `credentials`: ~500 B
- `properties[]` schema: **1–10 KB per node** (dominant)
- `inputs[]` / `outputs[]`: 200–500 B each

**Total: ~2–12 KB per node.** At 500 nodes: ~1–6 MB retained in the main heap for the registry alone, plus V8 object overhead. This retention is permanent for the app session because the registry is module-scoped.

### 4. Developer experience: 9 files to add one specialized agent

Current checklist (from `CLAUDE.md` "Adding New Specialized Agents"):

**Frontend (5 files)**:
1. `client/src/nodeDefinitions/specializedAgentNodes.ts` — definition + `SPECIALIZED_AGENT_TYPES` entry
2. `client/src/components/AIAgentNode.tsx` — `AGENT_CONFIGS` entry
3. `client/src/components/parameterPanel/MiddleSection.tsx` — `AGENT_WITH_SKILLS_TYPES`
4. `client/src/components/parameterPanel/InputSection.tsx` — `aiAgentTypes` + `AGENT_WITH_SKILLS_TYPES`
5. Category icon in `ComponentPalette.tsx` (manual)

**Backend (4 files)**:
6. `server/constants.py` — `AI_AGENT_TYPES` frozenset
7. `server/services/node_executor.py` — handler registry entry
8. `server/services/handlers/tools.py` — delegation tuple
9. `server/services/ai.py` — `DEFAULT_TOOL_NAMES`, `DEFAULT_TOOL_DESCRIPTIONS`, `DelegateToAgentSchema`

None of this should require touching 9 separate files. Most entries are derivable from a single metadata blob.

---

## Factory patterns — what's already good

| Factory | File | Extensibility | Files to touch for new entry |
|---|---|---|---|
| `createBaseChatModel()` | `client/src/factories/baseChatModelFactory.ts:31` | 7/10 — config-in, full definition-out | 2 (config object + export) |
| `createAndroidServiceNode()` | `client/src/nodeDefinitions/androidServiceNodes.ts:13` | 8/10 — self-contained, hidden-field injection | 1 |
| Dual-purpose tool pattern | `whatsappNodes.ts:77`, `twitterNodes.ts:24` | 5/10 — `group: ['category', 'tool']` works but requires manual schema + handler sync | 4–5 |

The AI-model and Android factories are the closest thing we have to "drop a file, get a node". The rest of the system could adopt the same pattern.

---

## Top 5 levers (ranked by impact × effort)

### Lever 1 — react-virtuoso `GroupedVirtuoso` for the palette (tier-1)
**Effort**: 1 day. **Impact**: 60 fps scroll at 500+ nodes, DOM pool of ~15 nodes regardless of catalogue size.

Same pattern we're already adopting for the credentials panel. Replace the `CollapsibleSection`-per-category render with `<GroupedVirtuoso groupCounts={...} groupContent={...} itemContent={...}>`. Keep `CollapsibleSection` as the `groupContent` wrapper so sticky-collapse semantics survive.

### Lever 2 — `fuzzysort` pre-indexed search + `startTransition` (tier-1)
**Effort**: 2 days. **Impact**: per-keystroke cost drops from ~50–150 ms → ~1–3 ms.

```ts
const prepared = useMemo(
  () => Object.values(nodeDefinitions).map(def => ({
    def,
    _name: fuzzysort.prepare(def.displayName),
    _desc: fuzzysort.prepare(def.description || ''),
    _kw: fuzzysort.prepare((def.keywords || []).join(' ')),
  })),
  []  // registry is module-scoped, rebuild only on HMR
);

const [query, setQuery] = useState('');
const [filtered, setFiltered] = useState(prepared);
const handleChange = (v: string) => {
  setQuery(v);
  startTransition(() => {
    setFiltered(
      v
        ? fuzzysort
            .go(v, prepared, { keys: ['_name', '_desc', '_kw'], threshold: -1000, limit: 200 })
            .map(r => r.obj)
        : prepared
    );
  });
};
```

Keep input value synchronous so typing never stalls. Uses the same pattern and library the credentials panel is adopting.

### Lever 3 — Shared property-schema registry (tier-2)
**Effort**: 2 days. **Impact**: removes the 810 → 4,500 property-object duplication problem; centralizes schemas.

Extract to `client/src/schemas/propertySchemas.ts`:

```ts
export const PROPERTY_SCHEMAS = {
  AI_AGENT_CORE: [ /* provider, model, prompt, system message, thinking... */ ],
  WHATSAPP_MESSAGE: [ /* recipient_type, chat_id, message_type, text... */ ],
  ANDROID_SERVICE: [ /* hidden service_id, android_host, ... */ ],
  // ...
} as const;
```

Nodes reference by array spread:
```ts
properties: [...PROPERTY_SCHEMAS.AI_AGENT_CORE, { /* per-agent extras */ }]
```

**Already partly done**: `specializedAgentNodes.ts` exports `AI_AGENT_PROPERTIES` as a shared constant. Formalize this as the canonical pattern, migrate `whatsappSend` / `twitterSend` / `androidServiceNodes` etc. to use it.

### Lever 4 — Lazy-load per-category node definitions via Vite dynamic `import()` (tier-2)
**Effort**: 1–2 days. **Impact**: module-parse time drops from ~200 KB synchronous → ~20 KB for the shell + per-category on-demand.

```ts
// client/src/nodeDefinitions/index.ts
type CategoryModule = { default: Record<string, INodeTypeDescription> };
const LOADERS: Record<string, () => Promise<CategoryModule>> = {
  workflow:  () => import('./workflowNodes'),
  aiModel:   () => import('./aiModelNodes'),
  aiAgent:   () => import('./aiAgentNodes'),
  android:   () => import('./androidServiceNodes'),
  // ... one entry per category
};

export async function loadNodeRegistry(): Promise<Record<string, INodeTypeDescription>> {
  const modules = await Promise.all(Object.values(LOADERS).map(l => l()));
  return Object.assign({}, ...modules.map(m => m.default));
}
```

Mount `ComponentPalette` inside `<Suspense>`, fetch via TanStack Query (`queryKey: ['nodeRegistry']`, `staleTime: Infinity`), and reuse the same `idb-keyval` persister pattern as the credentials panel. Zero extra infra.

**Trade-off**: first palette open gains ~200 ms async boot delay. Acceptable because the palette is an off-canvas sidebar, and subsequent opens hit the warm cache in < 50 ms. React Flow canvas itself does not depend on the registry at mount, so the main app is not blocked.

### Lever 5 — Server-owned node registry via WebSocket (tier-3, defer)
**Effort**: 3–4 days. **Impact**: removes 1–6 MB from the client module graph entirely; enables runtime registry updates without frontend redeploy.

Same shape as the credentials panel's `get_credential_catalogue` handler. Server reads from a JSON manifest or Python-side registry, client fetches once on boot, caches in IndexedDB, reconciles via version hash.

**Defer until** we actually need sub-500-ms boot or runtime extensibility. For now, Lever 4 (client-side lazy load) achieves most of the benefit at a tenth of the effort. **Do not build this before the credentials panel's catalogue infrastructure is proven** — the credentials panel is the reference implementation; this just reuses the pattern.

---

## "Drop a file, get a node" proposal

Restructure the node tree so adding a new node = creating one `*.node.ts` file. The auto-discoverer handles registration, category icons, palette wiring, and (with conventions) backend handler stubs.

### New structure

```
client/src/nodeDefinitions/
├── index.ts                          # auto-discoverer + loadNodeRegistry()
├── schemas/
│   ├── propertySchemas.ts            # shared property sets (Lever 3)
│   └── types.ts                      # INodeTypeDescription re-export
└── nodes/
    ├── ai/
    │   ├── openai.node.ts
    │   ├── anthropic.node.ts
    │   └── aiAgent.node.ts
    ├── social/
    │   ├── whatsappSend.node.ts
    │   ├── twitterSend.node.ts
    │   └── instagramSend.node.ts     # new: just add this file
    ├── android/
    │   ├── batteryMonitor.node.ts
    │   └── ...
    └── ...
```

### One node file (template)

```ts
// client/src/nodeDefinitions/nodes/social/instagramSend.node.ts
import type { INodeTypeDescription } from '../../schemas/types';
import { PROPERTY_SCHEMAS } from '../../schemas/propertySchemas';

export const metadata = {
  category: 'social',
  categoryLabel: 'Social Media Platforms',
  categoryIcon: '📸',
} as const;

const node: INodeTypeDescription = {
  displayName: 'Instagram Send',
  name: 'instagramSend',
  icon: '📸',
  group: ['social', 'tool'],          // dual-purpose: workflow node + AI tool
  version: 1,
  description: 'Post content to Instagram',
  keywords: ['instagram', 'post', 'share', 'social'],
  defaults: { name: 'Instagram Send' },
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    ...PROPERTY_SCHEMAS.SOCIAL_MESSAGE,
    { displayName: 'Caption', name: 'caption', type: 'string', required: false },
  ],
};

export default node;
```

### Auto-discoverer (Vite `import.meta.glob`)

Vite supports eager/lazy glob imports natively — we don't need any extra tooling.

```ts
// client/src/nodeDefinitions/index.ts
import type { INodeTypeDescription } from './schemas/types';

// Eager variant (keeps current sync semantics, replaces the 26-file spread merge)
const modules = import.meta.glob<{ default: INodeTypeDescription }>(
  './nodes/**/*.node.ts',
  { eager: true }
);

export const nodeDefinitions: Record<string, INodeTypeDescription> = Object.fromEntries(
  Object.values(modules).map(m => [m.default.name, m.default])
);

// Lazy variant (for Lever 4)
export const lazyNodeModules = import.meta.glob<{ default: INodeTypeDescription }>(
  './nodes/**/*.node.ts'
);
export async function loadNodeRegistry() {
  const entries = await Promise.all(
    Object.entries(lazyNodeModules).map(async ([path, loader]) => {
      const mod = await loader();
      return [mod.default.name, mod.default] as const;
    })
  );
  return Object.fromEntries(entries);
}
```

**Result**: the 26-file spread merge in `nodeDefinitions.ts` becomes a 1-line glob, the per-category barrel files become obsolete, and adding a new node is one file. Categories are derivable from the `metadata.category` export.

### Collapses the 9-file DX checklist to 1-2 files

Backend handlers still need to live under `server/services/handlers/`, but the **frontend** checklist collapses to 1 file. The `AGENT_CONFIGS` / `AGENT_WITH_SKILLS_TYPES` / `aiAgentTypes` arrays currently scattered across `AIAgentNode.tsx`, `MiddleSection.tsx`, `InputSection.tsx`, and `Dashboard.tsx` can all be derived from a single query: `Object.values(nodeDefinitions).filter(n => n.group?.includes('agent'))`.

---

## What to steal from the credentials panel plan

Every library, pattern, and guardrail in the credentials plan applies here, usually unchanged:

| Credentials-panel decision | Applies to ComponentPalette? |
|---|---|
| `react-virtuoso GroupedVirtuoso` with sticky category headers | ✅ Lever 1 |
| `cmdk` command palette shell for search + keyboard nav | ✅ — Ctrl+K for node discovery, same keybind |
| `fuzzysort.prepare()` pre-indexed search | ✅ Lever 2 |
| `startTransition` wrapping filter updates (not `useDeferredValue`) | ✅ Lever 2 |
| `@tanstack/react-query` + `experimental_createPersister(idb-keyval)` | ✅ Lever 4 / 5 |
| `babel-plugin-react-compiler` scoped via `@vitejs/plugin-react` babel plugin | ✅ extend scope to `nodeDefinitions/` + `ComponentPalette.tsx` |
| Store shape rule: **UI state in Zustand, catalogue in TanStack Query, derived data in `useMemo`** | ✅ same rule |
| Heap snapshot verification (retained size, one retainer, 50-cycle delta < 1 MB) | ✅ same workflow |
| INP p75 < 200 ms on synthetic 5000-item probe | ✅ same target |

**Zero new dependencies.** Everything needed is already being installed for the credentials panel.

---

## Concrete roadmap (phase-in)

| Phase | Effort | Impact | Prerequisite |
|---|---|---|---|
| **A — Search UX overhaul** (Levers 1+2) | 2–3 days | 200+ nodes feel instant; 60 fps scroll | Credentials panel dep install is done |
| **B — Developer ergonomics** (file-based registry + shared schemas) | 1 week | Adding a node = 1 file; ~30 % memory reduction | Phase A |
| **C — Lazy registry** (Lever 4) | 1–2 days | 300 ms → 50 ms module parse cost at app boot | Phase B (needs glob structure) |
| **D — Server registry** (Lever 5, optional) | 3–4 days | Decouple client/server release cycles | Credentials panel production-proven |

## References

- `react-virtuoso` GroupedVirtuoso: https://virtuoso.dev/grouped-numbers/
- `fuzzysort`: https://github.com/farzher/fuzzysort
- Vite `import.meta.glob`: https://vite.dev/guide/features.html#glob-import
- n8n node loader (filesystem-as-registry): https://github.com/n8n-io/n8n/tree/master/packages/nodes-base/nodes
- Pipedream components: https://github.com/PipedreamHQ/pipedream/tree/master/components
- React `startTransition`: https://react.dev/reference/react/useTransition
- React Compiler 1.0: https://react.dev/blog/2025/10/07/react-compiler-1
