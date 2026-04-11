# UI Optimization & Prod-Scale Extensibility Research

Companion research set to `docs-internal/credentials_scaling/`. While the credentials panel plan focuses on making the 5000-provider catalogue fast, this folder applies the **same patterns and libraries** to the rest of the MachinaOs UI — so runtime perf, memory use, and contributor DX all scale together.

**Zero new dependencies**: every library referenced (`react-virtuoso`, `cmdk`, `fuzzysort`, `react-hook-form`, `@tanstack/react-query`, `idb-keyval`, `babel-plugin-react-compiler`) is already being installed for the credentials panel.

---

## Files

| Document | Covers | Status |
|---|---|---|
| [component_palette_scaling.md](./component_palette_scaling.md) | Node sidebar (`ComponentPalette.tsx`) + node definition registry (`nodeDefinitions.ts` + 26 per-category files) at 500+ nodes. Lazy-load, virtualization, fuzzy search, file-based registry, "drop a file, get a node" proposal. | Complete |
| [parameter_panel_scaling.md](./parameter_panel_scaling.md) | Parameter configuration modal (`ParameterPanel.tsx`, `ParameterRenderer.tsx`, `MiddleSection.tsx`, `useParameterPanel.ts`). Parameter type registry, TanStack Query mutation queue, display-options predicate compilation, custom editor registry. | Complete |
| [canvas_dashboard_scaling.md](./canvas_dashboard_scaling.md) | React Flow canvas + Dashboard shell (`Dashboard.tsx`, `SquareNode.tsx`, `AIAgentNode.tsx`, `WebSocketContext.tsx`, `useAppStore`) at 200+ nodes with parallel workflow execution. Per-node status store, `onlyRenderVisibleElements`, deferred config checks, component registry. | Complete |

---

## Cross-cutting findings

Three patterns come up in every file and should be treated as project-wide principles:

### 1. Store shape: hot data in TanStack Query, UI state in Zustand, derived data in `useMemo`

The credentials panel runtime research identified a single memory trap worth more attention than all others combined: **Zustand selectors that capture large arrays retain them forever via closure scope**. The fix — moving catalogue data out of Zustand and into TanStack Query — generalizes to every large dataset in the UI:

- Node definitions → `useQuery(['nodeRegistry'])` (ComponentPalette MD)
- Connected-node output schemas → `useQuery(['nodeOutputSchema', nodeId])` (Parameter panel MD)
- Per-node status → dedicated `useNodeStatusStore` with per-node selectors (Canvas/Dashboard MD)
- Node parameters → `useMutation` queue with optimistic updates (Parameter panel MD)

Zustand shrinks to UI-only state: `selectedNodeId`, `paletteOpen`, `renamingNodeId`, `sidebarVisible`, etc.

### 2. The same library stack everywhere

Every MD ranks the same five levers in the top 5:

| Library | Used for | Files affected |
|---|---|---|
| `react-virtuoso` (`GroupedVirtuoso`) | Virtualized lists with sticky headers | Credentials palette, ComponentPalette |
| `cmdk` | Command palette + keyboard nav | Credentials palette, ComponentPalette (optional) |
| `fuzzysort` | Pre-indexed fuzzy search | Credentials palette, ComponentPalette |
| `react-hook-form` + `Controller` | Uncontrolled form state | Credentials panels, Parameter panel |
| `@tanstack/react-query` | Server cache + mutations + `experimental_createPersister(idb-keyval)` | Credentials catalogue, node registry, param saves, output schemas |
| `startTransition` (React 19) | Non-urgent state updates | Credentials search filter, param display re-filter, node status dispatch |
| `babel-plugin-react-compiler` | Auto-memoization (scoped via Vite babel plugin) | Credentials module + extend to `parameterPanel/`, `components/`, `ComponentPalette.tsx` |

**No new dependencies beyond the credentials plan.** Scoping the React Compiler babel plugin is the one place scope matters: start tight (credentials module only), expand module by module as each is verified.

### 3. "One file to add a thing" via Vite `import.meta.glob`

All three MDs propose the same auto-registration pattern for their respective extensibility axis:

| Axis | Pattern | Location |
|---|---|---|
| Node **definitions** (the schema/metadata) | `import.meta.glob('./nodes/**/*.node.ts', { eager: true })` | `client/src/nodeDefinitions/` |
| Node **React components** (the visual) | `import.meta.glob('./**/*.node.tsx', { eager: true })` | `client/src/components/nodes/` |
| Parameter **type handlers** (registry entries) | `import.meta.glob('./parameterPanel/types/*.tsx', { eager: true })` | `client/src/components/parameterPanel/types/` |
| Parameter **custom editors** (MasterSkillEditor-class full-panel replacements) | `import.meta.glob('./parameterPanel/customEditors/*.tsx', { eager: true })` | `client/src/components/parameterPanel/customEditors/` |

Each glob consolidates what is currently 4–9 files of scattered registration into a single file change. Adding a new node type, new parameter type, new custom editor, or new React component for a node becomes **one file**. The tribal checklists in `CLAUDE.md`'s "Adding New Specialized Agents" etc. shrink to a paragraph.

This is not n8n-style dynamic loading from arbitrary `node_modules/` — it's just Vite resolving globs at build time. No runtime overhead, full type safety, HMR works normally.

---

## Relationship to the credentials panel plan

The credentials panel (`docs-internal/credentials_scaling/`) is the **reference implementation**. It installs all the dependencies, wires `QueryClientProvider` in `main.tsx`, enables the React Compiler babel plugin, sets up the `idb-keyval` persister, and proves the runtime/memory targets.

Everything in this folder is "reuse that infra for the rest of the UI":

- Phase 2–4 of the credentials plan ships the backend registry + Zustand + TanStack Query + palette infrastructure.
- Phase 7.5 ships the React Compiler babel plugin config + idempotency keys.
- **Only after Phase 8 verification passes** should we start applying these patterns to ComponentPalette, parameter panel, and canvas.

Order of operations:

1. **Credentials panel lands first** (phases 2–8 of `typed-splashing-crown.md`)
2. **ComponentPalette follows** (ComponentPalette MD phases A–C: search UX overhaul + file-based registry + lazy loading)
3. **Parameter panel follows** (Parameter panel MD phases A–D: type registry + mutation queue + visibility compilation + schema cache)
4. **Canvas/Dashboard is last** (Canvas MD phases A–D: onlyRenderVisibleElements + per-node status store + deferred config checks + React Compiler scope extension)

Each of these is a separate work-unit of 1–2 weeks. They should not be bundled into the credentials-panel PR.

---

## Runtime targets (UI-wide)

Inherited from the credentials panel plan, applied project-wide:

| Metric | Target |
|---|---|
| Modal / panel open (second visit, warm cache) | < 50 ms |
| Modal / panel open (cold, first visit) | < 500 ms |
| INP p75 during rapid typing in any text field | < 200 ms |
| Scroll FPS on 500-node palette / 200-node canvas | 60 fps |
| 50-cycle open/close heap delta for any modal | < 1 MB |
| Main-heap retained for the entire frontend at idle | Established by heap snapshot — should be dominated by React internals + antd cssinjs cache, not our data |

Verification workflow (per the credentials panel runtime research): Chrome DevTools → Memory → Heap Snapshot → filter by `Array`, sort by Retained Size → single retainer per large dataset. Allocation timeline → 50-cycle delta. `web-vitals` library `onINP` for INP attribution.

---

## Rejected / deferred ideas

- **Million.js** — superseded by React Compiler 1.0; doesn't play well with antd cssinjs.
- **Jotai / Valtio / Legend State** — Zustand + TanStack Query already covers our needs.
- **Module Federation** — overkill for in-app plugins.
- **Tauri / Electron packaging** — scope creep; web-based self-hosted covers 95% of cases.
- **Cloudflare Workers / edge CDN** — not justified for a self-hosted tool.
- **CQRS / event sourcing** — tribal enterprise patterns, not load-bearing at our scale.
- **Server-owned node registry** (ComponentPalette Lever 5) — deferred until credentials-panel server-owned registry is production-proven.
- **Full RHF migration of parameter panel** (Parameter panel Lever 6) — deferred until the type registry and mutation queue land first.
- **Workflow-scoped backend broadcast filter** (Canvas Lever 6) — deferred until per-node status store (Lever 1) proves adequate at 5+ parallel workflows.

---

## Open questions

1. **React Compiler scope expansion strategy.** Should we enable it project-wide at once, or module-by-module as each MD's patterns are verified? Recommendation in all three MDs: module-by-module, starting with the credentials module.
2. **`idb-keyval` vs TanStack Query built-in persister.** Credentials plan uses `experimental_createPersister(idb-keyval)`. We should verify this works correctly with multiple persisted queries (node registry + credentials catalogue + output schemas) sharing one IndexedDB store.
3. **Glob-based auto-discovery + backend handler colocation.** ComponentPalette and canvas MDs both propose `*.node.ts` / `*.node.tsx` globs for frontend. The backend handlers still live in `server/services/handlers/` — should there be a symmetric discovery mechanism on the Python side? (Probably yes, but out of scope for these MDs.)
4. **Parameter panel custom-editor access to global catalogues.** The parameter panel MD proposes a `credentialsPicker` custom editor that queries the credentials catalogue. This is fine within a single `QueryClientProvider`, but we should verify we're not opening two distinct `QueryClient` instances by accident.

---

## Document history

All three MDs written 2026-04-11 following parallel research by Explore agents. Source material: runtime/memory research from the credentials panel (see `../credentials_scaling/research_react_stack.md` addendum), React Flow performance docs, n8n + Pipedream + oboe.com architecture references, and direct worktree audit with file:line references.
