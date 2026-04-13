# Frontend System Design RFC

Status: Proposed

Last updated: 2026-04-13

## Summary

This RFC proposes a new frontend architecture for MachinaOs that keeps the current workspace-centric UX but reduces the main scaling problems in the codebase:

- oversized shell orchestration
- oversized realtime provider
- code-owned node registration
- inspector branching by node name
- overlapping old and new rendering paths

The proposed direction is:

- keep the single-workspace product shape
- split the shell into bounded feature modules
- shrink the WebSocket layer into a transport and event core
- make node UI metadata spec-driven
- make inspector and output rendering primarily schema-driven
- treat credentials as the reference pattern for scalable frontend subsystems

Related docs:

- [frontend_architecture_analysis.md](frontend_architecture_analysis.md)
- [frontend_component_functionality_and_design.md](frontend_component_functionality_and_design.md)
- [frontend_ui_framework_research.md](frontend_ui_framework_research.md)
- [frontend_ui_stack_recommendation.md](frontend_ui_stack_recommendation.md)

---

## Context

The current frontend works, but it is approaching the limits of what a central orchestrator plus many special cases can support comfortably.

The current strengths should be preserved:

- fullscreen workspace
- React Flow editor
- strong visual node families
- consistent three-column inspector
- realtime execution feedback
- modal-based auxiliary tools

The current pain points should not be preserved:

- `Dashboard.tsx` as the universal coordinator
- `WebSocketContext.tsx` as the universal control plane
- TypeScript-owned node registry
- explicit node-type buckets for rendering and inspector behavior
- duplicated output surfaces

---

## Goals

### Primary goals

- preserve the current user-facing workspace model
- make new node addition lower-touch on the frontend
- isolate realtime transport from business-specific view state
- reduce merge hotspots
- improve large-graph performance headroom
- make inspector, output, and docs more spec-driven

### Non-goals

- replacing React Flow
- introducing a route-heavy app architecture
- rewriting the app in one step
- removing support for rich custom node families

---

## Current Problems

### 1. Shell concentration

`Dashboard.tsx` currently mixes:

- shell composition
- editor orchestration
- workflow persistence choreography
- run and deploy actions
- keyboard shortcuts
- viewport logic
- modal coordination

This makes the workspace hard to evolve safely.

### 2. Realtime concentration

`WebSocketContext.tsx` currently mixes:

- websocket lifecycle
- request-response tracking
- broadcast reconciliation
- execution APIs
- deployment APIs
- provider-specific status state
- log and console streams

This makes the realtime boundary too broad and too product-specific.

### 3. Node platform concentration

The current node model is rich but not canonical. Rendering still depends on:

- node definition metadata
- explicit type arrays
- dashboard family mapping logic
- inspector special cases

This prevents the frontend from behaving like a true modular node platform.

### 4. Inspector concentration

`ParameterRenderer`, `InputSection`, and `MiddleSection` currently contain much of the platform-specific branching for:

- memory nodes
- skill nodes
- tool nodes
- code editors
- compaction-related controls
- agent-specific affordances

This is the biggest blocker to config-driven node onboarding.

---

## Proposed Architecture

### High-level module model

The frontend should be reorganized into five major feature layers:

1. shell layer
2. editor layer
3. node platform layer
4. runtime layer
5. feature subsystems

### 1. Shell layer

Responsibilities:

- page-level composition
- workspace chrome
- modal routing
- feature mounting

Target modules:

- `shell/WorkspaceShell`
- `shell/Toolbar`
- `shell/SidebarRail`
- `shell/PaletteRail`
- `shell/ConsoleDock`
- `shell/ModalHost`

Rule:

The shell should compose feature modules, not implement their internal logic.

### 2. Editor layer

Responsibilities:

- React Flow instance
- node and edge local state
- viewport state
- selection state
- keyboard shortcuts
- drag/drop and clipboard behavior

Target modules:

- `editor/CanvasController`
- `editor/NodeFamilyRegistry`
- `editor/EdgeRegistry`
- `editor/SelectionController`
- `editor/ViewportController`

Rule:

The editor layer owns canvas concerns only. It should not directly own workflow persistence or feature-specific modal logic.

### 3. Node platform layer

Responsibilities:

- canonical frontend node spec loading
- palette generation
- family selection
- inspector schema generation
- node docs/help metadata
- output UI metadata

Target modules:

- `node-platform/spec-registry`
- `node-platform/family-registry`
- `node-platform/inspector-schema`
- `node-platform/output-schema`

Rule:

The node platform layer should be driven by a canonical `NodeSpec`, not by scattered TypeScript registries and category arrays.

### 4. Runtime layer

Responsibilities:

- websocket transport
- request correlation
- command APIs
- event subscriptions
- normalized runtime state caches

Target modules:

- `runtime/socket-client`
- `runtime/command-api`
- `runtime/event-store`
- `runtime/selectors`

Rule:

Transport should not also be the top-level owner of product-specific derived state.

### 5. Feature subsystems

Responsibilities:

- credentials
- onboarding
- settings
- output
- inspector extras such as memory or skills

Rule:

Each subsystem should own its own state shape and expose narrow integration points to the shell and node platform.

---

## Proposed Runtime Boundary

### Current model

One giant context provides:

- connection management
- command methods
- subscription state
- derived app state

### Proposed model

Split it into three parts:

1. transport client
2. command layer
3. event store

#### Transport client

Owns:

- socket connection lifecycle
- reconnect policy
- send and receive primitives

#### Command layer

Owns:

- typed request APIs such as `executeNode`, `saveNodeParameters`, `deployWorkflow`

#### Event store

Owns:

- normalized runtime state derived from broadcasts

Benefits:

- easier testing
- easier memory management
- smaller provider surface
- clearer ownership

---

## Proposed NodeSpec Frontend Contract

The frontend should consume a canonical spec with at least:

- metadata
- visual family
- ports
- parameters schema
- UI schema
- credential requirements
- output UI hints
- docs/help metadata

### Why this matters

With a canonical frontend spec:

- palette generation becomes generic
- node family selection becomes data-driven
- inspector generation becomes mostly schema-driven
- output rendering becomes more predictable
- docs and help can be generated consistently

### Immediate implication

The current `nodeDefinitions` TypeScript registry should become an adapter layer, not the final source of truth.

---

## Proposed Inspector Design

### Keep the three-column model

The current inspector layout is good and should be preserved:

- inputs
- parameters
- outputs

### Change what drives each column

#### Inputs column

Should be driven by:

- upstream port contracts
- runtime data envelope
- generic sample data fallback

It should not need large hardcoded node-type maps.

#### Parameters column

Should be driven by:

- `parametersSchema`
- `uiSchema`
- bounded extension hooks for special widgets

#### Outputs column

Should use the existing schema-driven output stack as the default path everywhere.

### Extension points

When generic schema rendering is not enough, use narrow extension points such as:

- `InspectorAddonProvider`
- `InputPreviewProvider`
- `OutputWidgetProvider`

This is better than embedding more node-name branches in shared components.

---

## Proposed Output Design

The `components/output/*` stack should become the only output path.

### Required moves

1. retire legacy output surfaces under `components/ui/`
2. move widget registration into a formal registry
3. make `_uiHints` compatible with future `NodeSpec` output metadata
4. keep the inference path as a fallback, not the primary contract

### Result

Output rendering becomes:

- generic
- extensible
- more consistent across nodes

---

## Proposed Credentials Pattern As Reference Model

The credentials subsystem should be treated as the reference implementation for scalable frontend feature design.

Key properties worth copying:

- server-owned data model
- React Query ownership of remote cache
- tiny local UI store
- virtualized list for large datasets
- lazy-loaded detail panels
- fallback data path without coupling catalogue data into global state

This pattern should inform future subsystems such as:

- node docs catalogue
- template library
- generated node-spec browser

---

## Proposed File And Package Shape

Suggested frontend reorganization:

```text
client/src/
  shell/
  editor/
  runtime/
  node-platform/
  features/
    credentials/
    output/
    onboarding/
    settings/
    inspector/
  shared/
```

Suggested rules:

- `shell/` composes features
- `editor/` owns React Flow concerns
- `runtime/` owns transport and live state
- `node-platform/` owns spec consumption and rendering contracts
- `features/` own their own state and presentation

---

## Migration Plan

### Phase 1: Extract shell modules

- split `Dashboard.tsx` into shell and editor controllers
- keep behavior the same

### Phase 2: Split realtime core

- extract transport client from `WebSocketContext.tsx`
- extract typed command APIs
- isolate event-state normalization

### Phase 3: Unify output rendering

- standardize on `components/output/*`
- route all output surfaces through the new stack

### Phase 4: Introduce frontend `NodeSpec` adapter

- map existing `nodeDefinitions` into a canonical spec shape
- move family selection to spec metadata

### Phase 5: Reduce inspector branching

- drive more parameter UI from schema
- move node-family extras into extension providers

### Phase 6: Replace code-owned registry

- load specs from a shared contract source
- retire category arrays and type-bucket coupling over time

This sequence keeps the app functional throughout the migration.

---

## Risks And Tradeoffs

### Benefits

- lower merge pressure
- cleaner ownership
- easier node onboarding
- better large-graph performance headroom
- easier testing of runtime and editor concerns separately

### Costs

- more modules and explicit boundaries
- migration overhead
- temporary adapter layers during transition
- stronger schema discipline for node metadata

These are acceptable costs if MachinaOs is intended to become a large platform rather than a feature-growing single shell.

---

## Open Questions

1. Should selected-node state move fully into per-workflow UI state?
2. Should React Query remain selective, or should more server-backed read models move into it?
3. Which inspector behaviors truly need extension points, and which can be encoded in schema?
4. Should the frontend load `NodeSpec` from a shared package, from the backend, or both?
5. How much of `_uiHints` should be preserved as runtime override versus moved into static node metadata?

---

## Decision

This RFC recommends that the next frontend architecture work should prioritize:

1. shrinking `Dashboard.tsx`
2. shrinking `WebSocketContext.tsx`
3. standardizing on the new output subsystem
4. introducing a canonical spec-driven node platform on the frontend

That path preserves the current user experience while making the frontend easier to scale, document, and extend.
