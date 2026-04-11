# MachinaOS Platform Refactor RFC — Scalable 3-Plane Architecture

**Status**: Draft 3 (consolidates `credentials-scaling/research.md`, the credentials panel plan, and the 3 UI optimization MDs into a single program of work)

**Worktree**: `d:/startup/projects/MachinaOs/.claude/worktrees/credentials-scaling/` — branch `feature/credentials-scaling`, from main `83f5d33` + Phase 1 refactor `747167e`.

## 0. Context

MachinaOS is a React Flow + FastAPI + Go + Node.js workflow automation platform. Today it ships 106 node types, ~20 credential providers, 127 WebSocket handlers, and an already-integrated Temporal worker for durable execution. The codebase has grown into a shape where **the next doubling of scope hurts more than the last one** — adding a new specialized agent touches 9 files, adding a new credential provider touches 4 files, and the palette/param panel/canvas all re-render on every status broadcast.

Four independent growth pressures are converging:

1. **1000+ integrations**: target parity with Pipedream/Zapier means 500–5000 node types and credential providers.
2. **1000+ graph nodes per workflow**: large workflows today jank at 200 nodes.
3. **1000+ runtime steps per execution**: long agent chains + subflows + retries.
4. **Contributors shipping new integrations without platform knowledge**: today requires tribal knowledge.

Separately audited this session:

- **`research.md`** (user-provided, in worktree): architectural vision — 3-plane split, Temporal + Conductor pattern, NodeSpec CRD, Backstage extension points, HTTP-for-commands / WS-for-subs.
- **`docs-internal/credentials_scaling/`** (3 MDs, written this session): runtime/heap numbers, React Compiler, TanStack Query, IndexedDB, store-shape rules, 6-layer architecture for the credentials panel as the first reference slice.
- **`docs-internal/ui_optimization/`** (3 MDs + README, written this session): ComponentPalette + parameter panel + React Flow canvas each analyzed for runtime perf, memory, and "drop-a-file-get-a-thing" extensibility via `import.meta.glob`.

This RFC unifies all of that into a single target architecture and migration plan.

---

## 1. Target vision — 3 planes

Following the `research.md` recommendation and matching what n8n, Temporal, and Conductor actually do at scale:

### 1.1 Authoring plane

Everything the user sees in the browser. React Flow canvas, node palette, parameter panel, credentials panel, console, output viewer, docs panel. **This plane owns zero business logic** — it reads declarative specs and renders UI.

Concretely for MachinaOS:
- `client/src/components/` (React components)
- `client/src/nodeDefinitions/` → replaced by a NodeSpec fetch + render pipeline
- `client/src/components/credentials/` → already being rewritten as the first reference slice
- `client/src/components/parameterPanel/` → becomes a spec-driven renderer with a type registry

### 1.2 Control plane

The server-side layer that accepts commands, validates workflows, compiles them, manages deployments, handles auth, and coordinates execution. **Stateless, horizontally scalable.**

Concretely for MachinaOS:
- `server/routers/` — HTTP endpoints for commands (deploy, validate, save, delete)
- `server/services/workflow.py` — already the facade, stays
- `server/services/credential_registry.py` — already built this session, canonical shape for other registries
- `server/services/deployment/` — already modularized
- **New**: `server/services/nodespec_registry.py` — load and serve NodeSpec v1 JSONs
- **New**: `server/services/workflow_compiler.py` — compile workflow JSON → execution IR

### 1.3 Execution plane

Specialized stateless workers that pull work from queues. Each worker class is good at one thing. Already partially implemented via Temporal — needs specialization by capability.

Concretely for MachinaOS:
- `server/services/temporal/` — already exists; activities currently monolithic
- **Target**: worker pools by capability — `http-worker`, `llm-worker`, `browser-worker`, `social-worker`, `filesystem-worker`, `trigger-worker`, `code-worker`
- Autoscale each pool by queue depth + wait time + completion rate
- Large outputs go to `data/workspaces/<workflow_id>/` (already exists) as artifact references; only metadata flows through workflow state

### 1.4 Why this shape

| Concern | Wrong shape (current) | Right shape (target) |
|---|---|---|
| Orchestration mixed with execution | Node handlers live inside `node_executor.py` dispatched by one registry | Orchestrator dispatches to task queues; workers pull tasks |
| One WebSocket router as the universal RPC bus | `websocket.py` has 127 handlers doing commands, queries, subscriptions | HTTP for commands, WebSocket for subscriptions and live state only |
| One giant node registry merged at module parse | `nodeDefinitions.ts` spreads 26 files at import time | Versioned NodeSpec registry, lazy-loaded, cached in IndexedDB |
| One custom component per node type in frontend | `SquareNode.tsx` + `AIAgentNode.tsx` + `TriggerNode.tsx` etc., per-node re-renders on every status broadcast | Per-node status store with per-slice subscriptions; small set of reusable node shells driven by spec |

---

## 2. Design principles

All subsequent phases inherit these. If a PR violates them, it's off-plan.

1. **Declarative first, programmatic only where it must be.** 70–90 % of nodes can be declarative NodeSpecs with zero TypeScript. Programmatic nodes exist only for triggers, streaming, browser automation, local code execution, and custom protocols.
2. **Versioned specs with mandatory structural validation.** Every NodeSpec has an `apiVersion` and `metadata.version`. Old workflows keep running on old versions. Kubernetes CRD pattern, not free-form JSON.
3. **Narrow extension points, not one giant registry.** Each concern (credentials, parameter types, custom editors, node renderers, worker runtimes, validation rules) has its own small provider interface. Backstage-style.
4. **HTTP for commands, WebSocket for subscriptions.** Commands are discrete, idempotent, and carry `request_id`. Subscriptions are long-lived and push live state. Stop funnelling 127 different RPCs through one WS router.
5. **Compute at the right layer.** Derived data lives in `useMemo` / `useQuery`, never in Zustand. Hot data lives in per-slice stores, never in React Context. Large payloads live in object storage / workspace, never in workflow state.
6. **Workers by capability, autoscale by queue depth.** No giant in-process dispatcher. One worker class per concern.
7. **Artifacts by reference, not by value.** Large outputs (scraped pages, LLM transcripts, files) are written to the workflow workspace; downstream nodes receive a path, not the bytes.
8. **One reference slice first.** The credentials panel is the pilot. Every library, store-shape rule, persistence pattern, and runtime target is proven on the credentials panel before being generalized.

---

## 3. The three "1000+" problems

Each has a different solution. Do not conflate them.

### 3.1 1000+ nodes in a single workflow graph

- **First-class subflows / groups / collapsed regions.** Keep full graph in state; render only the visible + expanded slice.
- **Viewport culling** via React Flow `onlyRenderVisibleElements={true}` (5-minute fix, already in the canvas MD).
- **Layout + graph transforms off the main thread** via a Web Worker. Don't block the main thread on Dagre/ELK at 1000 nodes.
- **Cheap node DOM.** No per-node shadows, animations, glow. Dracula theme stays, but purely visual effects move to CSS `transform` and GPU-accelerated properties only.
- **Per-node status store** (canvas MD Lever 1): each node subscribes only to its own slice via `useSyncExternalStore` or Zustand `useShallow`. 200 nodes × 10 status broadcasts/sec go from 2000 re-renders/sec → 10.

### 3.2 1000+ runtime steps per execution

- **Compile workflow JSON into an immutable execution IR** before running. `workflow_compiler.py` service.
- **Partition the DAG into stages / subflows.** Temporal orchestrates the top-level stage graph; each stage dispatches its nodes as activities.
- **Each executable node = one queue-dispatched activity**, not a callback buried in `node_executor.py`.
- **Persist only metadata + artifact refs.** Node outputs that exceed N bytes (configurable, start at 10 KB) land in the workspace and the in-workflow payload is a `{ "$artifact": "path/to/blob" }` reference.
- **WebSocket broadcasts carry references, not payloads.** Current `node_output` broadcasts dump the full output into every connected client. This breaks at any scale.

### 3.3 1000+ node types / integrations in the product

- **Versioned NodeSpec registry** (section 4 below).
- **New integration = new spec file**, not edits across 9 files. Spec lives under `server/nodespecs/<category>/<name>.v1.json`.
- **Declarative runtime binding** — the spec's `execution.requestTemplate` + `responseMapping` is interpreted by a generic HTTP worker. No custom Python handler needed.
- **Reserve custom code for the minority** — triggers, browser automation, streaming, code execution. These get a small `WorkerRuntimeProvider` module each.

---

## 4. NodeSpec v1 — the core abstraction

Matches `research.md`'s suggested shape, extended with a few MachinaOS-specific fields (credentials, dual-purpose tool flag, displayOptions).

```json
{
  "$schema": "https://machinaos.dev/schema/node-spec/v1",
  "kind": "NodeSpec",
  "apiVersion": "nodes.machinaos.dev/v1",
  "metadata": {
    "name": "gmail.send",
    "version": "2.1.0",
    "category": "google",
    "categoryLabel": "Google Workspace",
    "tags": ["email", "action"],
    "icon": "raw_svg:GoogleIcons.gmail",
    "color": "theme.categoryAI",
    "maturity": "stable"
  },
  "spec": {
    "mode": "declarative",
    "runtime": {
      "workerType": "http",
      "timeoutMs": 30000,
      "retryPolicy": "standard"
    },
    "ports": {
      "inputs":  [{ "id": "main", "schemaRef": "#/$defs/input" }],
      "outputs": [{ "id": "main", "schemaRef": "#/$defs/output" }]
    },
    "parametersSchema": { /* JSON Schema for parameters */ },
    "uiSchema":         { /* rjsf-style uiSchema or ParameterTypeRegistry hints */ },
    "credentials":      [{ "provider": "google_oauth", "scopes": ["gmail.send"] }],
    "displayOptions":   { /* conditional visibility, same semantics as current INodeProperties */ },
    "isAgentTool":      true,
    "execution": {
      "requestTemplate":  { "method": "POST", "url": "https://gmail.googleapis.com/...", "headers": {} },
      "responseMapping":  { "$ref": "#/$defs/output" }
    },
    "$defs": { /* JSON Schema definitions */ }
  }
}
```

**Why JSON Schema is the base**:
- Declarative contract
- Mandatory structural validation (Kubernetes CRD lesson)
- Dialect/vocabulary extensions exist for custom keywords that stay interoperable
- Every existing form library speaks it (rjsf, react-hook-form with resolver, ajv)

**Credentials reference** pipes into the credentials panel's `credential_providers.json` registry — already built this session. A NodeSpec declares which provider it needs; the credentials panel owns provisioning.

**Dual-purpose tool flag** (`isAgentTool: true`) replaces the current `group: ['whatsapp', 'tool']` convention. A single flag, machine-readable, exposed to the LangGraph schema builder at execution time.

---

## 5. Package boundaries (target)

### 5.1 Frontend (`client/src/`)

```
client/src/
├── authoring/                              # Authoring plane (new top-level)
│   ├── canvas/                             # React Flow wiring, viewport, keyboard shortcuts
│   │   ├── Dashboard.tsx                   # shrunk to coordinator; no more 1200-line monolith
│   │   ├── nodes/                          # per-node React components
│   │   │   ├── index.ts                    # import.meta.glob auto-registry
│   │   │   ├── shells/                     # shared node shells (square, round, trigger, config)
│   │   │   └── *.node.tsx                  # one file per node family
│   │   └── hooks/
│   │       └── useNodeStatus.ts            # per-node slice subscription (canvas MD Lever 1)
│   ├── palette/                            # ComponentPalette + search
│   │   ├── Palette.tsx
│   │   └── usePaletteQuery.ts              # TanStack Query wrapping NodeSpec fetch
│   ├── inspector/                          # parameter panel (spec-driven)
│   │   ├── Inspector.tsx
│   │   ├── ParameterTypeRegistry.ts        # plugin registry for parameter types
│   │   ├── types/                          # one file per parameter type
│   │   └── customEditors/                  # MasterSkillEditor, ToolSchemaEditor, etc.
│   ├── credentials/                        # credentials panel (reference slice — already in flight)
│   │   ├── CredentialsPalette.tsx
│   │   ├── panels/
│   │   └── primitives/
│   ├── console/                            # Chat / Console / Terminal resizable bottom panel
│   └── output/                             # connected node output panel
├── shared/                                 # cross-plane primitives
│   ├── stores/
│   │   ├── useNodeStatusStore.ts           # hot node status (Zustand with per-slice selectors)
│   │   ├── useCredentialRegistry.ts        # UI state only (already built)
│   │   └── useAppStore.ts                  # shrunk: UI visibility toggles, mode, renamingNodeId
│   ├── hooks/
│   │   ├── useCatalogueQuery.ts            # TanStack Query for NodeSpec + credential catalogue
│   │   └── useWebSocketSubscription.ts     # subscribe-only WS helper
│   ├── transport/
│   │   ├── httpClient.ts                   # axios/fetch wrapper with request_id
│   │   └── wsClient.ts                     # subscriptions only; no RPC
│   └── theme/                              # Dracula + Solarized tokens, `resolveColor` helper
└── main.tsx                                # QueryClientProvider + router + error boundary
```

### 5.2 Backend (`server/`)

```
server/
├── control/                                # Control plane (new top-level)
│   ├── routers/
│   │   ├── workflow.py                     # HTTP commands: deploy, validate, save, delete
│   │   ├── credentials.py                  # HTTP CRUD + icon endpoint (already in credentials plan)
│   │   ├── nodespecs.py                    # HTTP: list/get/validate NodeSpecs
│   │   └── subscriptions.py                # WebSocket /ws/status — subscriptions only
│   ├── services/
│   │   ├── credential_registry.py          # already built this session
│   │   ├── nodespec_registry.py            # new: load nodespecs/, resolve extends, validate via jsonschema
│   │   ├── workflow_compiler.py            # new: JSON → execution IR
│   │   ├── idempotency.py                  # new: TTL dedupe dict for all mutation handlers
│   │   └── auth.py                         # unchanged
│   └── middleware/
│       └── auth.py                         # unchanged
├── execution/                              # Execution plane
│   ├── temporal/
│   │   ├── workflow.py                     # stays (orchestrator)
│   │   ├── activities/                     # split by capability
│   │   │   ├── http_activities.py
│   │   │   ├── llm_activities.py
│   │   │   ├── browser_activities.py
│   │   │   ├── social_activities.py
│   │   │   ├── filesystem_activities.py
│   │   │   ├── trigger_activities.py
│   │   │   └── code_activities.py
│   │   ├── worker.py                       # stays, selects activity registration by worker class
│   │   └── runtime/                        # generic runtime interpreters for declarative specs
│   │       ├── http_runtime.py             # interprets NodeSpec.execution.requestTemplate
│   │       └── graphql_runtime.py
│   └── workers/                            # one launchable entry per worker class
│       ├── http_worker.py
│       ├── llm_worker.py
│       └── ...
├── nodespecs/                              # source of truth for declarative nodes
│   ├── _schemas/                           # JSON Schema definitions + $defs
│   ├── google/
│   │   ├── gmail.send.v1.json
│   │   ├── calendar.create.v1.json
│   │   └── ...
│   ├── ai/
│   │   ├── openai.chat.v1.json
│   │   └── ...
│   └── social/
│       └── ...
├── config/                                 # unchanged — pricing, email_providers, credential_providers, etc.
└── core/                                   # unchanged — container, database, encryption, etc.
```

### 5.3 What gets deleted / shrunk

| Path | Current size | Target |
|---|---|---|
| `server/routers/websocket.py` | 127 handlers in one file | Split: subscriptions-only at `control/routers/subscriptions.py`; all commands move to HTTP routers |
| `server/services/node_executor.py` | Monolithic dispatch registry | Replaced by Temporal activities per worker class; declarative nodes go through `http_runtime.py` |
| `client/src/nodeDefinitions.ts` + 26 per-category files | 93 nodes across 27 files, eager spread merge | Replaced by `useCatalogueQuery` fetching from `/api/nodespecs` |
| `client/src/components/ParameterRenderer.tsx` | 780-line monolith switch | Replaced by `ParameterTypeRegistry` with per-type files (param-panel MD) |
| `client/src/Dashboard.tsx` | 1200+ lines | Shrunk to a coordinator; node-type mapping auto-derived from component glob (canvas MD) |
| `client/src/contexts/WebSocketContext.tsx` | Full node status map in React context | Replaced by `useNodeStatusStore` (Zustand) + subscription-only WS client (canvas MD) |

**Non-goals**: do not delete any existing handler / node type / feature. Every migration phase is additive; deletions only happen after the new path is proven and the old site is a 1-line re-export for backward compat.

---

## 6. Extension points (Backstage-style)

Small, narrow, interface-driven. Each has a one-file registration via Vite `import.meta.glob` on the frontend and Python module auto-discovery on the backend.

| Extension point | What registers | Frontend | Backend |
|---|---|---|---|
| **NodeSpecProvider** | New node types | — | `server/nodespecs/**/*.v{N}.json` |
| **WorkerRuntimeProvider** | New execution runtimes (http, graphql, streaming, browser, code) | — | `server/execution/temporal/runtime/*.py` |
| **InspectorSectionProvider** | New parameter panel sections (e.g. token-usage meter, skill editor) | `client/src/authoring/inspector/sections/*.tsx` | — |
| **ParameterTypeHandler** | New parameter input types (e.g. cronExpression, credentialsPicker) | `client/src/authoring/inspector/types/*.tsx` | — |
| **CustomEditorProvider** | Full-panel replacements (MasterSkillEditor, ToolSchemaEditor) | `client/src/authoring/inspector/customEditors/*.tsx` | — |
| **NodeShellProvider** | Reusable React node shells (square, round, trigger, config) | `client/src/authoring/canvas/nodes/shells/*.tsx` | — |
| **CredentialProvider** | New credential kinds (apiKey, oauth, qrPairing, email) | `client/src/authoring/credentials/panels/*.tsx` | `server/control/services/credentials/providers/*.py` |
| **OutputRendererProvider** | How to render node outputs in the connected output panel | `client/src/authoring/output/renderers/*.tsx` | — |
| **ValidationRuleProvider** | Custom runtime validation rules beyond JSON Schema | `client/src/authoring/inspector/validators/*.ts` | `server/control/services/validators/*.py` |
| **DocsProvider** | Markdown docs for node types | `client/src/authoring/docs/*.tsx` | `server/nodespecs/**/README.md` |

**Pattern** (frontend, same across all the above):

```ts
// client/src/authoring/inspector/types/index.ts
import type { ParameterTypeHandler } from '../ParameterTypeRegistry';
const modules = import.meta.glob<{ default: ParameterTypeHandler }>('./*.tsx', { eager: true });
for (const m of Object.values(modules)) registerParameterType(m.default);
```

**Pattern** (backend, same across the above):

```py
# server/control/services/credentials/providers/__init__.py
import pkgutil, importlib, pathlib
_ROOT = pathlib.Path(__file__).parent
for mod_info in pkgutil.iter_modules([str(_ROOT)]):
    importlib.import_module(f"{__name__}.{mod_info.name}")
# Each provider module does `register_provider(...)` at import time.
```

---

## 7. Delta from current state

### 7.1 Already good (keep)

- Temporal worker + activities infrastructure (`server/services/temporal/`) — activities need splitting by capability but the plumbing is solid.
- `server/services/workflow.py` facade + `deployment/` modularization — already following the Conductor Decide pattern.
- `server/services/credential_registry.py` (built this session) — canonical shape for other registries to follow.
- `server/config/*.json` convention (`email_providers.json`, `credential_providers.json`, `pricing.json`, `google_apis.json`, `llm_defaults.json`) — already aligned with the NodeSpec approach.
- Workspace directory per workflow — already the right pattern for artifact storage.
- `functools.partial` dependency injection in `node_executor.py` — good; generalize to the activity registries.
- Dracula + Solarized theme tokens — unchanged.
- Per-workflow status scoping in `WebSocketContext.tsx:440-449` — right shape, wrong subscription pattern (fix in canvas MD Lever 1).
- `useAppStore` UI-state persistence — shape is right; just shrink to UI-only.

### 7.2 Needs change (in scope for this RFC)

- `client/src/nodeDefinitions.ts` + 26 per-category files → NodeSpec registry served from `control/routers/nodespecs.py`.
- `client/src/components/ParameterRenderer.tsx` → `ParameterTypeRegistry` (param-panel MD).
- `client/src/Dashboard.tsx` + `SquareNode.tsx` + `AIAgentNode.tsx` → per-slice status subscription + component glob (canvas MD).
- `server/routers/websocket.py` → split into subscriptions-only + HTTP command routers.
- `server/services/node_executor.py` → thin dispatcher over Temporal activity queues, one per capability.
- `server/services/handlers/*` → merge into `execution/temporal/activities/*` split by worker class; declarative node handlers deleted in favour of `http_runtime.py`.
- Credentials panel Phase 2–7 (already planned in this file before rewrite; preserved as Phase A below).

### 7.3 Load-bearing blockers (must land first)

1. **NodeSpec v1 schema** — every subsequent phase depends on this being stable. One well-reviewed JSON Schema + one Pydantic model + one JSON Schema validator.
2. **TanStack Query + QueryClientProvider wired at app root** — credentials panel Phase 3 does this. Everything else (palette, parameter panel, node status) piggybacks on the same `QueryClient`.
3. **idempotency.py + request_id on all mutations** — credentials panel Phase 7.5 starts this. Generalize to every HTTP command endpoint.
4. **React Compiler babel plugin enabled and trusted** — credentials panel Phase 7.5 validates it on one module; then expand module-by-module.

Nothing else is a blocker. The rest can roll forward incrementally.

---

## 8. Migration plan (phased)

Each phase is self-contained, lands as its own PR, and does not break `main`. Every phase lands on the worktree first.

### Phase A — Credentials panel as the reference slice (IN FLIGHT)

**Status**: Phase 2 complete (JSON registry + `credential_registry.py` + `get_credential_catalogue` WebSocket handler, all verified end-to-end). Phases 3–8 pending.

**Scope**: everything from the original credentials plan — see `docs-internal/credentials_scaling/` for full detail.

**What it proves**:
- TanStack Query + `experimental_createPersister(idb-keyval)` warm-start pattern
- Zustand UI-state-only store (no catalogue, no derived data)
- `cmdk` + `fuzzysort` + `react-virtuoso GroupedVirtuoso` + `startTransition` palette pattern
- `react-hook-form` `Controller` wrapping antd inputs
- `React.lazy` per-panel code splitting
- `babel-plugin-react-compiler` scoped via Vite
- Idempotency keys + OAuth circuit breaker
- JSON registry with `extends` inheritance and array-merge-by-key — becomes the template for NodeSpec
- Content-sha256 version hash + conditional-`since` fetches — becomes the template for NodeSpec registry

**Runtime targets** (verified via heap snapshot + `web-vitals` onINP):
- Catalogue retained heap: ~1.5–2.5 MB, single retainer (TanStack Query cache)
- Modal 50-cycle heap delta: < 1 MB
- INP p75 during rapid search typing: < 200 ms
- Scroll FPS at row 2000 on synthetic 5000-provider probe: 60 fps

### Phase B — NodeSpec v1 registry + first declarative migration

**Scope**:
1. Define `server/nodespecs/_schemas/node-spec.v1.json` (JSON Schema describing the NodeSpec shape).
2. Build `server/control/services/nodespec_registry.py` following the exact same lazy-singleton + content-sha256 + `extends`-resolution pattern as `credential_registry.py`.
3. Add `server/control/routers/nodespecs.py` — HTTP endpoints: `GET /api/nodespecs`, `GET /api/nodespecs/{id}`, `GET /api/nodespecs/validate`.
4. Migrate 5–10 simple nodes from `client/src/nodeDefinitions/` to JSON NodeSpec files: start with `gmail.send`, `calendar.create`, `openai.chat`, `brave.search`, `httpRequest` — mix of declarative-friendly shapes.
5. Build `server/execution/temporal/runtime/http_runtime.py` — the generic HTTP executor that interprets `spec.execution.requestTemplate` + `responseMapping`.
6. Frontend: `useNodeSpecQuery` on TanStack Query, served into a new `authoring/palette/Palette.tsx` alongside (not replacing) the existing ComponentPalette.

**Verification**:
- The 5–10 migrated nodes appear in both the old and new palette.
- Executing a migrated node via the new path produces byte-identical output to the old path.
- Adding a new Mailchimp / Notion / Airtable node = one `.v1.json` file, tested, no frontend or backend code change.

### Phase C — WebSocket router fission (command vs subscription split)

**Scope**:
1. Audit `server/routers/websocket.py`: bucket all 127 handlers into `{command, query, subscription}`.
2. For each command handler: add an equivalent HTTP endpoint under `server/control/routers/` that accepts `request_id` (idempotency).
3. For each query handler: same — HTTP endpoint.
4. Keep subscription handlers at the new `control/routers/subscriptions.py` (`/ws/status`) — only.
5. Frontend: build `shared/transport/httpClient.ts` (with request_id auto-injection) + `shared/transport/wsClient.ts` (subscriptions only).
6. Migrate one feature at a time (credentials first — already in Phase A; then parameter panel; then workflow CRUD; then execution control).
7. **Do not delete `websocket.py` handlers until the HTTP equivalent is production-proven.** They coexist for a release.

**Verification**:
- WebSocket connection no longer receives any request/response traffic — only server-pushed status updates.
- Request latency for commands drops (HTTP avoids WebSocket sequential dispatch overhead).
- Browser network panel cleanly separates commands (HTTP) from events (WS).

### Phase D — Worker pool specialization

**Scope**:
1. Split `server/services/temporal/activities.py` into `activities/{http,llm,browser,social,filesystem,trigger,code}_activities.py`.
2. Each activity file registers only activities for its worker class.
3. Update `worker.py` to accept a `--worker-class` flag; a worker process registers only the matching activity subset.
4. Update Temporal task queue names: one per worker class (`machina-http`, `machina-llm`, `machina-browser`, …).
5. Workflow orchestrator dispatches each node to the matching queue based on the NodeSpec's `runtime.workerType`.
6. Docker / dev script: spin up one worker process per class by default; single-process fallback for local dev.
7. Add queue-depth metrics (Prometheus or stdout) so later autoscaling has something to key on.

**Verification**:
- Mixed workload (e.g. 50 HTTP requests + 5 LLM calls) runs with no head-of-line blocking between classes.
- LLM workers can be restarted / scaled independently without interrupting HTTP workers.
- A crashed browser worker does not kill other activities.

### Phase E — Authoring plane modularity

**Scope**: apply the 3 UI optimization MDs (in order of impact, not in order of the MDs):

1. **Canvas MD Lever 2** (5 minutes): `onlyRenderVisibleElements={true}` on `<ReactFlow>`. 70 % win on pan/zoom.
2. **Canvas MD Lever 1** (2 hours): extract `useNodeStatusStore`; replace `WebSocketContext.getNodeStatus` with per-slice subscription. 2000 → 10 re-renders/sec during status floods.
3. **Canvas MD Lever 4** (30 min): wrap status dispatches in `startTransition`. Keeps drag/select synchronous during broadcast storms.
4. **Canvas MD Lever 3** (2 hours): `useWorkflowConfigStatus` TanStack Query hook replaces per-`SquareNode` mount `getStoredApiKey()` calls. Workflow open 10 s → < 1 s.
5. **Parameter panel MD Lever 1** (3 hours): `ParameterTypeRegistry` with `import.meta.glob` auto-discovery. Migrate string / number / boolean / options / collection first.
6. **Parameter panel MD Lever 2** (4 hours): `useParameterPanel` migrates to TanStack Query `useMutation` with 300 ms debounce, optimistic updates, idempotency keys.
7. **Parameter panel MD Lever 3** (30 min): extend React Compiler babel scope to `parameterPanel/`.
8. **Parameter panel MD Lever 4** (2 hours): compile `displayOptions.show` to memoized predicates (`WeakMap`-cached).
9. **ComponentPalette MD Levers 1–3** (3 days): `GroupedVirtuoso` + `fuzzysort.prepare()` + `import.meta.glob` file-based node registry. "Drop a file, get a node" for the visual side of things — pairs with Phase B's NodeSpec registry for the data side.
10. **Dashboard slim-down**: extract the node-type mapping into an `import.meta.glob('./nodes/**/*.node.tsx')` registry; Dashboard becomes a coordinator.

**Verification**:
- 200-node workflow open < 1 s, drag 60 fps, INP p75 < 200 ms during status floods.
- New parameter type = 1 file under `inspector/types/`, auto-registered.
- New node React component = 1 file under `canvas/nodes/`, auto-registered.

### Phase F — Subflows + collapse as first-class concept

**Scope**:
1. Extend workflow JSON schema: `nodes[].parent` for group membership; `nodes[].collapsed: boolean`.
2. React Flow implementation: use the official [expand/collapse example](https://reactflow.dev/examples/layout/expand-collapse) as the base.
3. Workflow compiler: subflows become compiled stages; collapsed groups render as a single placeholder node but execute as their contents.
4. Storage: subflow definitions are reusable — a workflow can reference a subflow template by name, enabling reusable automations without copy-paste.

**Prerequisite**: Phase B (NodeSpec) and Phase E (canvas status store) must be in.

**Verification**:
- A 1000-node workflow with 10 collapsed subflows renders at 60 fps.
- Executing a workflow with subflows produces the same result as the equivalent flat workflow.
- A subflow saved once can be imported into a second workflow with a single drag.

### Phase G — Execution IR + artifact references

**Scope**:
1. `server/control/services/workflow_compiler.py`: takes workflow JSON → immutable IR (stage DAG, activity bindings, expression graph).
2. Workflow orchestrator executes from the IR, not from the raw JSON.
3. Output artifact policy: any node output > 10 KB lands in `data/workspaces/<workflow_id>/<node_id>/output.json` (or binary); the in-workflow payload is `{ "$artifact": "<path>" }`.
4. `ParameterResolver` template engine learns to dereference `$artifact` paths lazily — artifacts are only materialized when a downstream node actually reads them.
5. WebSocket `node_output` broadcasts carry artifact references; the frontend fetches the blob on demand when the user opens the output panel.

**Verification**:
- A workflow that produces a 50 MB scraped HTML blob does not blow up the WebSocket buffer or the in-memory workflow state.
- Downstream nodes that don't need the large payload incur zero artifact materialization cost.
- Workflow execution memory floor stays flat regardless of output sizes.

### Phase H — Polish

- Off-main-thread layout via a Web Worker for workflows > 200 nodes.
- Prometheus metrics for queue depth + wait time + completion rate per worker class.
- Autoscaling rules (dev: single-process; prod: per-worker-class horizontal scaling).
- Generator: `pnpm machina new-node gmail.send.draft` scaffolds a new NodeSpec JSON from a template + opens it in the editor.
- `pnpm machina new-param-type cronExpression` scaffolds a new parameter type file with a registered handler.

---

## 9. What lands first (concrete next PRs)

In order, each independently shippable:

1. **Finish Phase A** (credentials panel, Phases 3–8 of the original plan).
2. **Phase E steps 1–4** (canvas perf cheap wins: `onlyRenderVisibleElements`, `useNodeStatusStore`, `startTransition` dispatch, `useWorkflowConfigStatus`). ~6 hours total. Single biggest runtime win in the app, no prerequisites.
3. **Phase B** (NodeSpec v1 registry + 5–10 declarative migrations + `http_runtime.py`). ~1–2 weeks.
4. **Phase C** (WebSocket → HTTP split, one feature at a time starting with credentials). ~1 week.
5. **Phase E steps 5–8** (parameter panel type registry + mutation queue + React Compiler scope + visibility compilation). ~10 hours.
6. **Phase D** (worker pool specialization). ~1 week.
7. **Phase F, G, H** — each is a separate 1–2 week phase.

---

## 10. Out of scope (deliberate)

- **CQRS, event sourcing, API gateway, service mesh.** Tribal at this scale; add only when measured need arises.
- **Cloudflare Workers / edge CDN.** Not justified for a self-hosted tool.
- **Desktop packaging (Tauri / Electron).** Scope creep; web + self-hosted covers 95 % of cases.
- **Module Federation / plugin marketplaces.** Overkill; `import.meta.glob` is enough for in-repo extensibility.
- **Rewriting Temporal integration.** What exists works; just split activities by capability.
- **Multi-tenant credential isolation, credential encryption changes, OAuth flow rewrites.** Unchanged.
- **`lucide-react` icon swap.** Assets are already SVG-based.
- **Million.js, Jotai, Valtio, Legend State, `rjsf`, `pro-form`.** Already rejected in credentials plan; same rejections apply here.
- **Node.js subprocess pool replacement.** Persistent Node.js server at port 3020 already solves the startup cost.
- **AI provider changes.** Credentials panel + `services/llm/` already handle this.

---

## 11. Open questions

1. **NodeSpec `execution.requestTemplate` expression language.** JSON pointers? JSONata? JMESPath? Simple `{{ template }}` like the existing `ParameterResolver`? **Recommendation**: reuse the existing `{{ node.field }}` template engine — no new DSL, zero contributor learning curve. Escape hatch: `responseMapping` can include a `transformRef` pointing at a NodeSpec-owned TypeScript/Python transformer module for the 5 % of cases the template engine can't express.
2. **NodeSpec storage location.** Committed to the repo under `server/nodespecs/`, or served from a git-backed registry (Nango-style)? **Recommendation**: start in-repo. Add git-backed only if we grow an ecosystem.
3. **Backward compatibility during Phase C (WS → HTTP split).** Keep both paths live, or hard cutover? **Recommendation**: both paths live for one release; delete the WS command handler only after telemetry shows zero calls for 14 days.
4. **Temporal activity retry semantics for declarative HTTP nodes.** NodeSpec `retryPolicy: "standard"` — what's the concrete meaning? **Recommendation**: start with Temporal's default exponential backoff (initial 1 s, max 100 s, 3 attempts). Per-node tuning via `retryPolicy: "aggressive" | "cautious" | "none"` presets defined centrally in `http_runtime.py`.
5. **Extension point registration on the backend.** Python doesn't have Vite globs. **Recommendation**: `pkgutil.iter_modules` in each extension-point package's `__init__.py` + decorator-based `@register_X()` from each module. Proven pattern, zero config.
6. **Credentials plan phase 7.5 React Compiler scope expansion ordering.** Expand to canvas first (biggest perf win) or parameter panel first (most fields)? **Recommendation**: canvas first — it's the larger hot path at steady state.

---

## 12. Runtime targets (platform-wide)

Inherited from the credentials panel runtime research, applied across the authoring plane:

| Metric | Target |
|---|---|
| Workflow open (200 nodes, warm) | < 1 s |
| Workflow open (200 nodes, cold) | < 3 s |
| Credentials / palette / inspector warm open | < 50 ms |
| Credentials / palette / inspector cold open | < 500 ms |
| INP p75 during any rapid typing in any text field | < 200 ms |
| Scroll FPS — 500-node palette / 200-node canvas / 5000-provider list | 60 fps |
| 50-cycle open/close heap delta for any modal | < 1 MB |
| Catalogue / NodeSpec retained heap | ~1.5–2.5 MB per catalogue, single retainer |
| WebSocket broadcast → UI update p99 | < 50 ms |
| Large workflow output payload (50 MB) in-memory state | 0 bytes (artifact reference only) |

Verification workflow: Chrome DevTools → Memory → Heap Snapshot → single retainer per large dataset; Allocation timeline → 50-cycle delta < 1 MB; `web-vitals` `onINP` with attribution. Same tooling across all phases.

---

## 13. Sources

Inherited from `research.md`:
- [Temporal server overview](https://github.com/temporalio/temporal)
- [Conductor architecture overview](https://conductor-oss.org/docs/architecture)
- [Conductor task workers](https://conductor-oss.org/docs/developer-guides/concepts/worker)
- [Conductor worker scaling](https://conductor-oss.org/docs/developer-guides/scaling)
- [React Flow performance](https://reactflow.dev/learn/troubleshooting/performance)
- [React Flow expand/collapse example](https://reactflow.dev/examples/layout/expand-collapse)
- [n8n declarative vs programmatic nodes](https://docs.n8n.io/integrations/creating-nodes/plan/choose-node-method/)
- [n8n node file structure](https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/)
- [n8n node versioning](https://docs.n8n.io/integrations/creating-nodes/build/reference/node-versioning/)
- [JSON Schema docs](https://json-schema.org/learn/)
- [JSON Schema dialects and vocabularies](https://json-schema.org/understanding-json-schema/reference/schema)
- [Backstage backend extension points](https://backstage.io/docs/backend-system/architecture/extension-points)
- [Backstage plugin modules](https://backstage.io/docs/backend-system/architecture/modules)
- [Kubernetes CRDs and structural schemas](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/)
- [react-jsonschema-form uiSchema](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema/)

Added this session:
- [React Compiler 1.0 release](https://react.dev/blog/2025/10/07/react-compiler-1)
- [TanStack Query v5](https://tanstack.com/query/latest) and [`experimental_createPersister`](https://tanstack.com/query/v5/docs/react/plugins/createPersister)
- [V8 memory optimization](https://v8.dev/blog/optimizing-v8-memory)
- [MemLab (Meta)](https://engineering.fb.com/2022/09/12/open-source/memlab/)
- [Vite `import.meta.glob`](https://vite.dev/guide/features.html#glob-import)
- [`web-vitals` library](https://github.com/GoogleChrome/web-vitals)
- [oboe.com](https://oboe.com/) — production reference for TanStack Query + dehydrated/hydrated cache pattern
- [`credential_providers.json` + `credential_registry.py`](../worktrees/credentials-scaling/) — in-tree reference implementation built this session

Companion MDs in the worktree (all read-only in plan mode):
- `docs-internal/credentials_scaling/research_production_platforms.md`
- `docs-internal/credentials_scaling/research_react_stack.md`
- `docs-internal/credentials_scaling/architecture.md`
- `docs-internal/ui_optimization/README.md`
- `docs-internal/ui_optimization/component_palette_scaling.md`
- `docs-internal/ui_optimization/parameter_panel_scaling.md`
- `docs-internal/ui_optimization/canvas_dashboard_scaling.md`
- `research.md` (user-provided vision doc — the seed for this RFC)

---

## 14. Non-goals of this RFC

This document defines the target architecture and phased migration. It does **not** prescribe:
- Specific UI copy or visual design changes beyond what the 3 UI optimization MDs already spec.
- Pricing, billing, or quota logic for any provider.
- Production deployment changes beyond "worker class autoscaling lands in Phase D + H".
- Database schema changes beyond what's already in the credentials plan + the artifact reference convention in Phase G.
- Authentication or authorization model changes.

Each of those is a separate RFC if and when needed.
