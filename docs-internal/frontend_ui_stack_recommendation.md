# Frontend UI Stack Recommendation

Status: Proposed

Last updated: 2026-04-13

## Executive Decision

MachinaOs should not replace React.

MachinaOs should replace the current default UI component model.

The recommended target stack is:

- `React 19` with progressive `React Compiler` rollout
- `React Flow 12.x` as the node editor foundation
- owned UI code via `shadcn/ui` distribution model
- `Base UI` as the default primitive layer for common product components
- `React Aria` for the hardest accessibility-heavy and collection-heavy widgets
- `Tailwind CSS 4` plus CSS variables as the main styling system
- `TanStack Virtual` as the default virtualization primitive
- `React Virtuoso` kept only where grouped variable-height lists are already a strong fit
- `JSON Forms` plus custom renderers as the schema-driven panel engine

This gives MachinaOs:

- better UI control than Ant Design
- lower long-term component overhead
- easier node onboarding through schemas
- strong performance characteristics for large editor surfaces
- a migration path that does not require rebuilding the product in another runtime

---

## Why This Stack Wins

### 1. It keeps the editor on the strongest ecosystem path

MachinaOs is a workflow editor, not a document site. The core editor dependency is `reactflow`, and the current xyflow ecosystem direction is clearly modern React plus owned UI components. Rewriting the runtime would throw away too much working surface area.

### 2. It separates beautiful UI from library lock-in

The current app mixes:

- Ant Design
- Tailwind
- a small amount of Radix
- a small amount of styled-components

That creates visual inconsistency and architectural drift.

The target stack moves to:

- a small owned design system
- headless primitives
- CSS variables and utility-driven styling

That is how the team gets better UI without tying the product to a monolithic component library.

### 3. It makes schema-driven nodes realistic

The current blocker to easy node onboarding is not the canvas. It is the inspector and surrounding panels. New nodes still pull too much TypeScript-owned logic into:

- `Dashboard.tsx`
- `ParameterRenderer.tsx`
- `InputSection.tsx`
- `MiddleSection.tsx`

The target stack fixes that by making panels render from versioned metadata instead of from hardcoded branching.

### 4. It scales better organizationally

The architecture should optimize for many future node additions by multiple contributors. That requires:

- narrow extension points
- a canonical `NodeSpec`
- owned UI components
- renderer registries instead of switch statements

---

## Recommended Stack By Layer

## 1. Runtime and App Foundation

Recommended:

- `React 19`
- `React Compiler`
- `Vite`
- `TypeScript`

Why:

- minimal rewrite risk
- strong current ecosystem fit
- incremental rollout possible
- no need to trade ecosystem maturity for framework novelty

Do not do:

- full runtime rewrite to Solid, Svelte, Qwik, or Preact

Those are reasonable greenfield choices, but they are not the highest-leverage move for this repo.

---

## 2. Canvas and Graph Authoring

Recommended:

- `React Flow 12.x`

Architecture rules:

- keep React Flow state local to the editor module
- keep selection and viewport state in tightly scoped stores
- keep expensive node data out of broad subscriptions
- add first-class group and subflow support
- add explicit collapse and expand behavior for large graphs
- push layout and heavy graph transforms off the main thread

Why:

- current React Flow guidance already matches the needs of 1000+ node graphs
- current docs and UI examples are aligned with React 19 and `shadcn/ui`

Do not do:

- replace React Flow just to chase theoretical runtime savings

---

## 3. Product Design System

Recommended:

- `shadcn/ui` as the distribution and ownership model
- `Base UI` as the default primitive layer
- `React Aria` for advanced collection widgets and accessibility-heavy interactions
- `Tailwind CSS 4` plus CSS variables for styling

Why this composition is better than a single large library:

- `shadcn/ui` gives the team source ownership
- `Base UI` gives tree-shakable, accessible, unstyled building blocks
- `React Aria` covers harder collection, keyboard, and drag/drop interactions
- `Tailwind 4` keeps styling local, fast, and token-driven without another runtime styling layer

What this should replace:

- default use of `antd` components for shell, forms, cards, tabs, modals, inputs, and layout
- remaining `styled-components` usage

What can stay temporarily during migration:

- existing Ant Design forms and simple panels until replacement slices are ready

---

## 4. Schema-Driven Panel Engine

Recommended:

- `JSON Forms`
- custom MachinaOs renderer registry
- JSON Schema plus UI schema as the canonical panel contract

Why:

- supports layout metadata, not just field generation
- works with nested groups, tabs, arrays, conditional sections, defaults, and annotations
- fits the existing direction already visible in the output subsystem

Target contract layers:

- `NodeSpec`
- `ParameterSchema`
- `UiSchema`
- `OutputSchema`
- `DocsSchema`

### Proposed `NodeSpec` shape

```json
{
  "apiVersion": "ui.machinaos.dev/v1",
  "kind": "NodeSpec",
  "metadata": {
    "type": "gmail.send",
    "version": "2.1.0",
    "title": "Send Gmail",
    "category": "Google"
  },
  "spec": {
    "family": "action",
    "icon": "gmail",
    "capabilities": ["credentialed", "network"],
    "parametersSchema": {
      "type": "object",
      "properties": {
        "to": { "type": "string", "format": "email" },
        "subject": { "type": "string" },
        "body": { "type": "string" }
      },
      "required": ["to", "subject"]
    },
    "uiSchema": {
      "type": "VerticalLayout",
      "elements": [
        { "type": "Control", "scope": "#/properties/to" },
        { "type": "Control", "scope": "#/properties/subject" },
        {
          "type": "Control",
          "scope": "#/properties/body",
          "options": { "widget": "markdown-textarea" }
        }
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "messageId": { "type": "string" },
        "accepted": { "type": "boolean" }
      }
    }
  }
}
```

### Resulting frontend behavior

From that one spec, the frontend should be able to generate:

- palette entry
- inspector form
- docs panel
- credential requirements
- output renderer defaults
- validation messages
- analytics identifiers

---

## 5. Virtualization Strategy

Recommended default:

- `TanStack Virtual`

Keep selectively:

- `React Virtuoso` for grouped, variable-height, sticky-header lists such as the credentials picker

Why:

- TanStack Virtual is the better primitive when the team needs custom list behavior inside a complex product shell
- Virtuoso remains a good specialized tool where its grouping model is already paying off

Target virtualized surfaces:

- node palette
- search results
- large schema sections
- execution log panes
- docs sidebars
- asset or credential pickers

---

## Target Frontend Architecture

## 1. Shell Layer

Responsibilities:

- app chrome
- panel docking
- modal routing
- feature mounting

Target modules:

- `shell/WorkspaceShell`
- `shell/Topbar`
- `shell/LeftRail`
- `shell/RightInspector`
- `shell/BottomDock`
- `shell/ModalHost`

Rule:

The shell composes features. It does not contain feature internals.

## 2. Editor Layer

Responsibilities:

- React Flow instance
- viewport
- selection
- node and edge registration
- keyboard shortcuts

Target modules:

- `editor/CanvasController`
- `editor/NodeRendererRegistry`
- `editor/EdgeRendererRegistry`
- `editor/SelectionStore`
- `editor/ViewportStore`

Rule:

The editor owns graph interaction. It does not own inspector rules.

## 3. Node Platform Layer

Responsibilities:

- spec loading
- palette generation
- inspector schema composition
- docs metadata
- output metadata

Target modules:

- `node-platform/specs`
- `node-platform/palette`
- `node-platform/forms`
- `node-platform/output`
- `node-platform/docs`

Rule:

Node behavior metadata must come from specs first, not from scattered TypeScript arrays.

## 4. Runtime Layer

Responsibilities:

- websocket transport
- command dispatch
- event subscriptions
- normalized execution state

Target modules:

- `runtime/socket`
- `runtime/commands`
- `runtime/events`
- `runtime/selectors`

Rule:

Realtime transport should not also be the product's top-level business-state god object.

## 5. Extension Layer

Responsibilities:

- register custom renderers
- register custom widgets
- register custom docs panels
- register custom output renderers

Target modules:

- `extensions/forms`
- `extensions/outputs`
- `extensions/docs`
- `extensions/node-families`

Rule:

Use Backstage-style extension points, not one giant mutable registry.

---

## Replacement Map From Current Stack

### Replace now

- `antd`
- `styled-components`

### Keep

- `react`
- `react-dom`
- `vite`
- `typescript`
- `reactflow`
- `zustand`
- `@tanstack/react-query`
- `cmdk`
- `react-virtuoso` in limited targeted usage

### Add

- `@base-ui/react`
- `react-aria` and related React Aria packages as needed
- `@tanstack/react-virtual`
- `@jsonforms/core`
- `@jsonforms/react`
- custom renderer package inside the repo
- a shared token package for color, typography, spacing, radius, elevation, and motion

### Introduce by policy, not just packages

- all new shell and panel components must use the owned design system
- all new node panels must be driven by schema plus renderer registry
- no new Ant Design surfaces unless explicitly approved as stopgap work

---

## Migration Plan

### Phase 0: Baseline and freeze

- stop expanding Ant Design usage
- document current component ownership
- measure initial bundle and interaction baselines

### Phase 1: Build the owned design system

- establish tokens with CSS variables
- add base primitives and shell components
- rebuild shared modal, tabs, form field, select, combobox, tooltip, and panel primitives

### Phase 2: Replace shell surfaces

- top toolbar
- main dialogs
- settings panels
- onboarding

This gets visual consistency quickly without touching the node engine first.

### Phase 3: Introduce schema-driven inspector

- define `NodeSpec`
- build JSON Forms renderer layer
- migrate a small vertical slice of node families first
- keep escape hatches for custom widgets

Suggested first slices:

- simple tool/action nodes
- API credential nodes
- scheduler nodes

### Phase 4: Upgrade editor foundation

- move from `reactflow` `11.11.4` to current 12.x generation
- adopt current performance guidance
- add grouping and collapse patterns

### Phase 5: Remove old paths

- retire `ParameterRenderer` branching where spec-driven renderers exist
- retire old output rendering paths
- retire remaining Ant Design dependencies

---

## UX Direction

The target UX should not imitate a CRUD admin panel.

It should feel like a focused visual tool:

- docked workspace shell instead of page-like cards everywhere
- compact but readable controls near the canvas
- command-palette-first navigation for high-frequency actions
- strong visual hierarchy between graph, inspector, output, and logs
- progressive disclosure so complex node settings do not overwhelm the default view
- motion used for orientation and state change, not decoration
- color and iconography driven by node families and runtime status, not by generic library defaults

Visual implementation rules:

- use one token system for color, spacing, typography, radii, and elevation
- prefer custom node chrome over generic card components
- avoid mixing multiple visual idioms from different UI libraries
- reserve dense data-table patterns for places where tabular analysis is actually required
- keep node and panel visuals cheap enough for large counts: no heavy shadows, no excessive blur, no constant animation on many elements at once

---

## Risk Assessment

### Main risk

The main risk is not technical failure. The main risk is ending up with two parallel UI systems for too long.

Mitigation:

- freeze new Ant Design surface area
- migrate by subsystem ownership
- define one design-token source of truth early

### Secondary risk

Schema-driven systems can become too generic and fail to support rich node-specific UX.

Mitigation:

- allow renderer overrides and custom widgets
- keep a deliberate escape hatch for specialized nodes
- make declarative the default, not the only mode

### Third risk

React Flow performance issues can persist if store boundaries remain sloppy.

Mitigation:

- separate canvas state from workflow document state
- move high-churn state out of broad React trees
- audit selectors and rerender boundaries before blaming the runtime

---

## Success Criteria

The migration is successful when:

- new nodes can be onboarded mostly by adding spec files
- the inspector no longer requires broad node-name branching
- the shell no longer depends on Ant Design for core surfaces
- the palette and large lists stay responsive at very high counts
- the node editor supports grouping and collapse for large workflows
- frontend contributors have a clear component ownership and extension model

---

## Recommended Final Pick

If one concise answer is needed, it is this:

Use `React 19 + React Compiler + React Flow 12 + shadcn ownership model + Base UI primitives + React Aria for advanced collections + Tailwind 4 + TanStack Virtual + JSON Forms`.

That is the best balance of:

- modern UI quality
- editor performance
- low migration risk
- schema-driven extensibility
- modular frontend architecture

---

## Sources

- [docs-internal/frontend_ui_framework_research.md](frontend_ui_framework_research.md)
- [React Compiler incremental adoption](https://react.dev/learn/react-compiler/incremental-adoption)
- [React Compiler 1.0](https://react.dev/blog/2025/10/07/react-compiler-1)
- [React Flow performance guidance](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow UI tutorial](https://reactflow.dev/learn/tutorials/getting-started-with-react-flow-components)
- [Base UI quick start](https://base-ui.com/react/overview/quick-start)
- [React Aria overview](https://react-aria.adobe.com/)
- [Mantine styles performance](https://mantine.dev/styles/styles-performance/)
- [TanStack Virtual introduction](https://tanstack.com/virtual/v3/docs/introduction)
- [Virtuoso grouped list API](https://virtuoso.dev/react-virtuoso/api-reference/grouped-virtuoso/)
- [JSON Forms layouts](https://jsonforms.io/docs/uischema/layouts/)
- [Backstage frontend extensions](https://backstage.io/docs/frontend-system/architecture/extensions/)
- [Kubernetes custom resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [JSON Schema reference](https://json-schema.org/understanding-json-schema/reference)
