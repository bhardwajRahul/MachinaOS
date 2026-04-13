# Frontend Component Functionality And Design

Last reviewed: 2026-04-13

## Purpose

This document describes the main frontend component families in MachinaOs, what each subsystem does, and how the current design is organized.

It is intended as a practical engineering guide for contributors who need to understand:

- which components make up the workspace shell
- how node rendering works
- how the inspector is built
- how output and credentials rendering work
- where the extensibility seams are today

---

## Component Taxonomy

The frontend component tree can be understood in seven major groups:

1. shell and workspace composition
2. auth and onboarding
3. node and edge rendering
4. parameter and inspector surfaces
5. output rendering
6. credentials configuration
7. shared UI primitives

---

## 1. Shell And Workspace Composition

### `Dashboard.tsx`

Primary responsibilities:

- owns the React Flow workspace shell
- wires local node and edge state
- bridges toolbar, sidebar, palette, console, settings, onboarding, credentials, and modals
- coordinates run, deploy, export, import, selection, and viewport behavior

Design notes:

- this is the de facto application coordinator
- it is currently too large to be treated as a normal feature component
- it should be thought of as a workspace orchestration layer, not a leaf UI module

### `TopToolbar.tsx`

Primary responsibilities:

- workflow title editing
- file menu actions
- global run/deploy actions
- theme toggle
- credentials/settings entry points
- global model selection

Design notes:

- mixes straightforward controls with higher-level workflow actions
- contains global-model concerns that could become their own feature module over time

### `WorkflowSidebar.tsx`

Primary responsibilities:

- render saved workflows
- selection and deletion actions
- current-workflow indication

Design notes:

- relatively self-contained
- presentation-oriented, but still coupled to workflow summary shape and shell visibility state

### `ComponentPalette.tsx`

Primary responsibilities:

- search node definitions
- group nodes into categories
- respect simple-mode vs pro-mode filtering
- render draggable component items

Design notes:

- mostly data-driven
- still embeds category semantics through `group[0]`, merged categories, and simple-mode filters

### `ConsolePanel.tsx`

Primary responsibilities:

- display runtime logs and console outputs
- surface backend activity inside the workspace

Design notes:

- important for observability in a graph-based tool
- still coupled to websocket log shapes

### `SettingsPanel.tsx`

Primary responsibilities:

- edit UI defaults and runtime preferences
- store user-facing settings through backend-backed data

Design notes:

- modal-first settings surface
- bound to shell-level commands rather than being route-isolated

---

## 2. Auth And Onboarding

### `ProtectedRoute.tsx`

Primary responsibilities:

- gate the workspace behind auth state
- switch between login and the app shell

### `LoginPage.tsx`

Primary responsibilities:

- render the login/register entry flow

### `OnboardingWizard.tsx` and onboarding steps

Primary responsibilities:

- first-run guidance
- explain the canvas model
- bridge new users into API keys and basic workflow concepts

Design notes:

- modal-based onboarding works with the single-workspace design
- shell-coupled lifecycle means onboarding inherits dashboard complexity

---

## 3. Node And Edge Rendering

### Design principle

Node rendering is organized into visual families, but family selection still depends on both metadata and explicit node-type buckets.

### `GenericNode.tsx`

Role:

- fallback renderer
- generic handle and label rendering
- lowest-common-denominator node UI

Good for:

- simple or not-yet-specialized node types

### `SquareNode.tsx`

Role:

- general-purpose service/action node renderer
- used across many categories such as utility, Google Workspace, filesystem, browser, proxy, and document nodes

Design notes:

- broadest renderer family
- carries many special cases and status behaviors
- effective, but increasingly overloaded

### `TriggerNode.tsx`

Role:

- start and inbound-trigger family
- output-only trigger-style visual language

Design notes:

- visually differentiated correctly
- represents workflow entry semantics well

### `ModelNode.tsx` and `BaseChatModelNode.tsx`

Role:

- circular AI-model family
- provider-specific wrappers inject branding and provider metadata

Design notes:

- one of the cleaner renderer families because the provider-specific wrappers are thin

### `AIAgentNode.tsx`

Role:

- primary agent-family renderer
- multi-handle layout for tools, memory, skill, model, and task inputs
- richer phase and execution-state presentation

Design notes:

- most expressive node renderer
- also one of the most behavior-heavy visual components

### `ToolkitNode.tsx`

Role:

- toolkit-style rendering for skill and tool-like nodes

### `TeamMonitorNode.tsx`

Role:

- live status widget for team-monitoring behavior

### `ConditionalEdge.tsx`

Role:

- branching edge UI with inline condition editing semantics

Design notes:

- edge customization is a useful differentiator in workflow tools
- should remain bounded so the editor does not accumulate too many edge paradigms

---

## 4. Parameter And Inspector Surfaces

### `ParameterPanel.tsx`

Role:

- top-level node inspector modal/surface
- binds selected node, parameter state, execution results, and panel actions

### `useParameterPanel.ts`

Role:

- load node parameters from backend
- merge with node-definition defaults
- track dirty state
- save parameters back over WebSocket

Design notes:

- backend is the source of truth for node parameters
- local hook state is only the working copy

### `ParameterPanelLayout.tsx`

Role:

- fixed three-column shell

Columns:

- input data and available variables
- editable parameter content
- output for selected node

Design notes:

- consistent and understandable layout
- not itself config-driven

### `InputSection.tsx`

Role:

- show connected upstream nodes
- show execution data when available
- provide draggable variables for template insertion

Design notes:

- functionally useful
- currently overloaded with config-handle detection, agent-specific rules, and large sample-schema logic

### `MiddleSection.tsx`

Role:

- render parameters and node-specific tooling
- host memory controls, skill connections, master-skill editing, tool schema editing, and compaction-related views

Design notes:

- this is the most feature-dense part of the inspector
- many explicit branches are organized here because the node-definition schema is not yet expressive enough to generate them

### `ParameterRenderer.tsx`

Role:

- core field renderer for node property definitions
- supports string, options, code, file, collection, JSON, and several richer field types

Design notes:

- extremely important component
- flexible, but switch-heavy
- a future spec-driven platform should reduce the need for node-name-specific logic around it

### `OutputSection.tsx`

Role:

- bridge execution results and websocket node status into the selected-node output panel

Design notes:

- currently combines local execution results with workflow-run output from websocket status
- this is the right behavior for users, but it reveals that output state is still coming from multiple runtime channels

---

## 5. Output Rendering

### New output subsystem

The newer `components/output/*` stack is built around schema-driven rendering.

Main components:

- `OutputPanel.tsx`
- `OutputCard.tsx`
- `SchemaRenderer.tsx`
- `widgets/*`
- `utils/inferHints.ts`
- `utils/resolveWidget.ts`
- `utils/types.ts`

### Current design

The output pipeline is:

1. extract output data from an execution result
2. read backend `_uiHints` if present
3. infer hints if backend hints are absent
4. map fields to widgets
5. render widgets lazily where appropriate

### Why this subsystem is important

This is the cleanest example in the frontend of:

- generic rendering
- schema-like output contracts
- limited per-node branching

### Limitation

The widget registry is still closed. Extending output rendering still means code changes in the widget union and resolver.

---

## 6. Credentials Configuration

### Main pieces

- `CredentialsModal.tsx`
- `CredentialsPalette.tsx`
- `PanelRenderer.tsx`
- `providers.tsx`
- `catalogueAdapter.ts`
- `useCatalogueQuery.ts`
- `useCredentialRegistry.ts`
- `panels/*`
- `primitives/*`
- `sections/*`

### Current design

The credentials system now follows a better frontend architecture than most of the rest of the app:

- server owns catalogue data
- IndexedDB provides warm-start caching
- React Query owns remote cache state
- a tiny Zustand store owns only UI state
- palette rendering is virtualized
- panels are lazy-loaded

### Panel model

Current panel kinds are bounded:

- API key
- OAuth
- QR pairing
- email

This is already a config-driven renderer model, but still with a fixed set of panel classes.

### Why this matters

The credentials subsystem is the best template in the repo for how to scale a feature area without turning one provider into a giant store object.

---

## 7. Shared UI Primitives

Important reusable shell primitives live under `components/ui/` and `components/shared/`.

Examples:

- `Modal.tsx`
- `CollapsibleSection.tsx`
- `ComponentItem.tsx`
- `NodeContextMenu.tsx`
- `ErrorBoundary.tsx`
- `DataPanel.tsx`
- `JSONTreeRenderer.tsx`

These provide consistent workspace affordances, but they are still plain components rather than part of a formal design-system package.

---

## Hooks And Services

### High-value hooks

- `useWorkflowManagement.ts`
- `useReactFlowNodes.ts`
- `useComponentPalette.ts`
- `useParameterPanel.ts`
- `useCatalogueQuery.ts`
- `useApiKeys.ts`

### Important services

- `workflowApi.ts`
- `executionService.ts`
- `dynamicParameterService.ts`

### Design observation

The frontend already has useful hook boundaries, but some of them are thin facades and some duplicate behavior.

Example:

- `useExecution.ts` and `executionService.ts` overlap significantly in websocket execution wrapping

That is a signal that execution concerns need one canonical frontend boundary.

---

## Main Contribution Risks

Contributors are most likely to break shared behavior when editing:

- `Dashboard.tsx`
- `WebSocketContext.tsx`
- `ParameterRenderer.tsx`
- `InputSection.tsx`
- `MiddleSection.tsx`
- node registry and node-definition buckets

These are the current merge hotspots and architectural pressure points.

---

## Practical Conclusion

The frontend already has the right feature areas, but the boundaries between them are still too implicit.

In practical terms:

- the credentials system shows how a scalable, cache-aware, feature-bounded subsystem can work
- the output system shows how schema-driven rendering can replace node-type branching
- the inspector and dashboard are where the next architectural work should focus

The target-state boundary changes are defined in [frontend_system_design_rfc.md](frontend_system_design_rfc.md).
