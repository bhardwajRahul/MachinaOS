# Frontend Architecture Analysis

Last reviewed: 2026-04-13

## Purpose

This document records the current frontend architecture of MachinaOs as implemented in the repository today. It focuses on:

- runtime and library stack
- application shell and composition model
- state ownership and data flow
- node rendering and editor behavior
- inspector, output, and credentials subsystems
- main coupling points and architectural risks

This is a current-state audit. For the target-state frontend design, see [frontend_system_design_rfc.md](frontend_system_design_rfc.md).

---

## Executive Summary

The MachinaOs frontend is a fullscreen React Flow workspace implemented as a single protected application shell rather than a routed multi-page app.

The core shape is:

- `main.tsx` creates the provider stack
- `App.tsx` applies theme and auth gating
- `Dashboard.tsx` is the real application shell

The architecture is partly modular and partly centralized:

- modular in the sense that node families, panels, hooks, credentials, and outputs all have their own folders
- centralized in the sense that `Dashboard.tsx` and `WebSocketContext.tsx` still carry a very large share of orchestration

The frontend already contains strong building blocks for a large platform:

- React Flow for graph authoring
- Zustand for workflow and UI state
- React Query for server-backed catalogue caching
- a rich node-definition metadata model
- a newer schema-driven output renderer
- a more scalable credential-catalogue subsystem

But the system is still limited by several code-owned boundaries:

- node registration is TypeScript-driven rather than spec-driven
- shell composition is too concentrated in `Dashboard.tsx`
- realtime transport and business state are too concentrated in `WebSocketContext.tsx`
- parameter and input panels still contain node-name-specific branching

---

## Technology Stack

The frontend package lives in `client/` and is built on:

- React 19
- TypeScript
- Vite
- React Flow
- Ant Design
- Zustand
- TanStack React Query
- styled-components
- Tailwind packages for supporting styles
- cmdk, react-virtuoso, and fuzzysort for the credentials catalogue

This is not a minimal SPA. It is a UI workbench with:

- graph editing
- websocket-backed execution
- modal-heavy tooling
- progressive onboarding
- interactive credential configuration

---

## Boot and Provider Stack

### Entrypoints

The frontend startup path is:

1. `client/src/main.tsx`
2. `client/src/App.tsx`
3. `client/src/Dashboard.tsx`

### Provider order

`main.tsx` currently mounts:

- `QueryClientProvider`
- `ThemeProvider`
- `AuthProvider`
- `WebSocketProvider`

This order is meaningful:

- React Query is global infrastructure for cache-backed data such as the credential catalogue
- auth sits above realtime so the WebSocket connection can inherit auth state
- the dashboard only renders inside that authenticated and themed runtime

### App shell

`App.tsx` is intentionally thin. It:

- selects the Ant Design theme
- wraps the app in `ProtectedRoute`
- renders the dashboard fullscreen

This keeps route-level complexity low, but it also means almost all feature boundaries are inside one workspace shell instead of multiple routes.

---

## Top-Level Layout Model

### Dashboard as application shell

`Dashboard.tsx` is the real app shell. It owns:

- `ReactFlowProvider`
- node and edge local state
- toolbar wiring
- workflow selection
- import/export
- run and deploy actions
- debounced workflow persistence
- viewport persistence
- keyboard shortcuts
- context menu behavior
- modal visibility for settings, credentials, onboarding, and result views

The rendered shell is broadly:

- top toolbar
- left workflow sidebar
- center canvas
- right component palette
- bottom console panel
- floating parameter panels and modal systems

### Why this matters

This gives the product a cohesive "single workspace" feel, but it also means one file is coordinating:

- canvas concerns
- workflow document concerns
- execution concerns
- persistence concerns
- much of the app-level UI choreography

That is the largest frontend coupling point today.

---

## State Ownership Model

### 1. Zustand store

`client/src/store/useAppStore.ts` is the main application store.

It owns:

- `currentWorkflow`
- `savedWorkflows`
- `hasUnsavedChanges`
- workflow UI state keyed by workflow ID
- sidebar/palette/console visibility
- `proMode`
- selected node compatibility state

The important design choice is that workflow execution state is partially namespaced by workflow through `workflowUIStates`, but node selection is still also represented globally through `selectedNode`.

### 2. Local React Flow state

`Dashboard.tsx` keeps `nodes` and `edges` in local React Flow state for performance and editing responsiveness. Those local arrays are then synced back into the store on a debounce.

So the frontend currently has two workflow topology representations:

- live editing state in React Flow
- durable workflow document state in Zustand and backend persistence

This is a reasonable optimization, but it also creates a synchronization boundary that needs careful management.

### 3. Local panel state

Several feature areas keep working state locally:

- `useParameterPanel.ts` keeps current parameter values and dirty state
- credentials UI store keeps palette query and selection
- modal and hover states are often local to each component

This is generally the right choice, but because the app is modal-heavy, the number of active local state islands is growing.

---

## Data Flow and Backend Boundaries

### REST responsibilities

The frontend uses REST for:

- auth lifecycle via `AuthContext`
- workflow CRUD via `workflowApi`

### WebSocket responsibilities

The frontend uses `WebSocketContext` for almost everything else:

- parameter loading and saving
- node execution
- whole-workflow execution
- deployment and cancellation
- logs and status broadcasts
- provider status
- Android and WhatsApp operations
- memory and skill operations
- variable and node output retrieval

Operationally, the WebSocket context is both:

- a request/response RPC layer
- a subscription/broadcast layer

This is effective, but it means one provider owns transport, message parsing, runtime state, and product-specific control-plane semantics.

### React Query role

React Query is not the dominant app data layer. It is currently used more selectively, especially for the credential-catalogue path:

- server-owned catalogue
- IndexedDB warm start
- background revalidation

This is a strong pattern and one of the cleaner frontend subsystems.

---

## Editor and Node Rendering System

### Node registry

The current registry is built from TypeScript modules:

- `client/src/nodeDefinitions.ts`
- `client/src/nodeDefinitions/*`
- `client/src/types/INodeProperties.ts`

This gives the system:

- display name
- icon
- group/category
- defaults
- inputs and outputs
- properties
- credentials metadata
- resource/operation metadata

This is already a meaningful declarative model, but it is still code-owned and not yet a true external spec contract.

### Node families

The main node-rendering families are:

- `GenericNode`
- `SquareNode`
- `TriggerNode`
- `ModelNode`
- `AIAgentNode`
- `ToolkitNode`
- `TeamMonitorNode`

`Dashboard.tsx` computes `nodeTypes` using registry metadata plus many explicit type lists. That means node-family selection is only partially data-driven.

### Edge rendering

`ConditionalEdge.tsx` extends React Flow edge rendering with labeled branching behavior and inline condition editing.

### Result

The canvas is flexible and visually differentiated, but adding a new node or node family often still requires edits in:

- node definitions
- category exports
- type buckets
- dashboard node-family mapping

---

## Inspector and Parameter System

### Main inspector flow

The inspector stack is:

- `ParameterPanel.tsx`
- `useParameterPanel.ts`
- `components/parameterPanel/ParameterPanelLayout.tsx`
- `InputSection.tsx`
- `MiddleSection.tsx`
- `OutputSection.tsx`

### Layout

The current layout is a fixed three-column inspector:

- left: upstream inputs and template variables
- middle: editable node parameters and node-specific utilities
- right: output view for the current node

### Strength

This is a strong UX model because it places:

- inbound data
- configuration
- outbound data

in one consistent workspace.

### Weakness

The layout is generic, but major parts of the middle and input sections are still heavily branched by node family or explicit node type:

- memory nodes
- master skill nodes
- tool nodes
- code editors
- skill-capable agents

This makes the inspector the main blocker to a truly config-driven node platform.

---

## Output Subsystem

There are two output paths in the repo:

- older UI output panels under `components/ui/`
- newer schema-driven output panels under `components/output/`

The newer subsystem is significantly cleaner:

- `OutputPanel.tsx` extracts execution output
- it reads `_uiHints` from the backend when present
- `inferHints.ts` provides a fallback inference path
- `SchemaRenderer.tsx` maps fields to widgets
- widget resolution is isolated under `components/output/widgets/`

This is the closest thing in the current frontend to a spec-driven rendering pipeline.

The remaining limitation is that widget registration is still a closed union rather than an open extension registry.

---

## Credentials Subsystem

The credentials system is now more modern than much of the rest of the frontend.

Main pieces:

- `components/credentials/CredentialsModal.tsx`
- `CredentialsPalette.tsx`
- `PanelRenderer.tsx`
- `useCatalogueQuery.ts`
- `useCredentialRegistry.ts`
- panel implementations under `components/credentials/panels/`

Important properties of this subsystem:

- server-owned catalogue data
- client fallback catalogue
- IndexedDB warm start
- React Query caching
- lazy-loaded panel kinds
- virtualized, fuzzy-search palette

This is one of the best existing blueprints for how other frontend subsystems should evolve: small UI store, server-backed data, derived data in memoized views, and bounded rendering branches.

---

## Main Frontend Strengths

- strong workspace-centric UX
- rich node metadata model
- flexible React Flow integration
- clear split between auth/CRUD REST and realtime websocket operations
- newer output subsystem is clean and generic
- newer credentials subsystem is scalable and performance-aware
- per-workflow execution state already exists conceptually

---

## Main Frontend Risks

### 1. Oversized shell

`Dashboard.tsx` is too large and too central.

### 2. Oversized realtime provider

`WebSocketContext.tsx` is too large and mixes:

- transport
- runtime state
- product integrations
- command methods
- broadcast reconciliation

### 3. Double workflow state

React Flow local state and store state coexist for topology, which is necessary today but increases drift risk.

### 4. Code-owned node registry

Node metadata is rich, but still TypeScript-owned and not canonical across the platform.

### 5. Inspector branching

`ParameterRenderer`, `InputSection`, and `MiddleSection` still rely on many explicit node-type or node-family branches.

### 6. Mixed old and new output paths

The output subsystem has improved, but older output surfaces still exist and can drift.

---

## Immediate Conclusion

The frontend is not a weak foundation. It already has enough structure to evolve into a large-scale node authoring platform.

The path forward is not a rewrite of the visual shell. The path forward is to reduce central orchestration and move toward:

- clearer feature boundaries
- a smaller realtime core
- a spec-driven node registry
- generated inspector and output surfaces
- more explicit extension points

That target architecture is described in [frontend_system_design_rfc.md](frontend_system_design_rfc.md).
