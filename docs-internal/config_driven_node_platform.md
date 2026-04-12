# Config-Driven Node Platform Design

Last reviewed: 2026-04-12

## Purpose

This document proposes a config-driven node platform for MachinaOs that makes it easy to:

- add new nodes without disturbing existing ones
- generate parameter panels from config
- generate docs and help panels from config
- version nodes safely
- keep execution modular across frontend and backend

This is the implementation-facing design that translates the research in [production_scale_architecture_research.md](production_scale_architecture_research.md) into a concrete platform model for this repo.

---

## Design Goals

### Primary goals

- one canonical source of truth for node metadata
- config-first onboarding for most new nodes
- strict separation between node spec and node runtime
- version-safe workflow compatibility
- modular extension points
- generated or mostly generated panels

### Non-goals

- removing support for advanced programmatic nodes
- forcing every node into the same UI chrome
- rewriting the whole repo in one step

---

## Current Problem

Today, MachinaOs already has good building blocks:

- typed node properties on the frontend
- grouped node definitions
- backend handler registry
- workflow execution abstraction

But the platform lacks a canonical contract that can drive everything from one place. The result is hidden coupling across:

- palette registration
- node rendering family selection
- parameter forms
- credentials requirements
- backend runtime dispatch
- validation
- docs/help

For a large node catalog, that coupling is the main maintenance cost.

---

## Core Proposal

Introduce a versioned `NodeSpec` resource as the canonical contract for most nodes.

### High-level rule

For most nodes:

- add one spec file
- let the frontend generate the node entry and panels
- let the backend bind the spec to a generic or specialized runtime

For advanced nodes:

- add one spec file
- add one runtime module
- register through an extension point

The spec still remains canonical even when a custom runtime exists.

---

## Canonical `NodeSpec`

### Resource shape

The platform should treat a node as a versioned resource, similar to a CRD-style manifest.

Example:

```json
{
  "$schema": "https://machinaos.dev/schema/node-spec/v1",
  "apiVersion": "nodes.machinaos.dev/v1",
  "kind": "NodeSpec",
  "metadata": {
    "name": "gmail.send",
    "version": "2.1.0",
    "displayName": "Send Gmail",
    "category": "google",
    "tags": ["email", "action", "google"]
  },
  "spec": {
    "class": "declarative",
    "family": "square",
    "description": "Send an email using Gmail.",
    "icon": "gmail",
    "ports": {
      "inputs": [
        {
          "id": "main",
          "type": "main",
          "required": true
        }
      ],
      "outputs": [
        {
          "id": "main",
          "type": "main",
          "schemaRef": "#/$defs/output"
        }
      ]
    },
    "credentials": [
      {
        "provider": "google_oauth",
        "required": true,
        "scopes": ["https://www.googleapis.com/auth/gmail.send"]
      }
    ],
    "parametersSchema": {
      "type": "object",
      "required": ["to", "subject", "body"],
      "properties": {
        "to": {
          "type": "string",
          "format": "email",
          "title": "To"
        },
        "subject": {
          "type": "string",
          "title": "Subject"
        },
        "body": {
          "type": "string",
          "title": "Body"
        }
      }
    },
    "uiSchema": {
      "ui:order": ["to", "subject", "body"],
      "body": {
        "ui:widget": "textarea",
        "ui:options": {
          "rows": 8
        }
      }
    },
    "runtime": {
      "runner": "http_action",
      "workerType": "http",
      "timeoutMs": 30000,
      "retryPolicy": "standard",
      "requestTemplate": {
        "provider": "gmail",
        "operation": "send_message"
      }
    },
    "docs": {
      "summary": "Send an email with Gmail.",
      "examples": [
        "Order confirmation email",
        "Status notification email"
      ]
    }
  }
}
```

### Why this shape

This splits the node into stable concerns:

- `metadata` for identity and discovery
- `parametersSchema` for validation and defaults
- `uiSchema` for panel rendering hints
- `runtime` for execution binding
- `docs` for generated help surfaces

---

## Spec Fields That Matter

### `metadata`

Use for:

- stable node identity
- display label
- search tags
- category grouping
- version pinning

### `spec.class`

Allowed initial values:

- `declarative`
- `programmatic`

This determines whether the node can be executed by a generic runner or needs a custom module.

### `spec.family`

Use for visual family selection rather than hardcoding long type lists in `Dashboard.tsx`.

Examples:

- `trigger`
- `square`
- `agent`
- `toolkit`
- `model`
- `monitor`

### `ports`

This should replace the current pattern where some connection semantics are encoded partly in node definitions and partly in visual conventions.

### `parametersSchema`

Use JSON Schema for:

- types
- required fields
- defaults
- enums
- numeric limits
- schema composition
- validation annotations

### `uiSchema`

Use a separate UI-oriented schema for:

- control order
- widget type
- grouping
- help text
- placeholders
- textarea sizing
- hidden fields
- advanced sections

### `runtime`

This binds the node to a runner or worker capability. It should answer:

- who executes the node
- where it executes
- which retry policy applies
- which request template or adapter is used

### `docs`

Use for:

- human-readable summary
- example use cases
- link to provider documentation
- migration notes

---

## Frontend Design

### Palette generation

The node palette should be generated from the loaded `NodeSpec` registry. The palette should not need custom code for most new nodes.

Palette fields from spec:

- display name
- icon
- category
- tags
- maturity
- keywords

### Node chrome generation

The frontend should choose node chrome from `spec.family`, not from a long switch statement over many individual node IDs.

Mapping example:

- `family=trigger` -> trigger-style node
- `family=agent` -> agent-style node
- `family=square` -> square node
- `family=model` -> model-style node

This keeps the visual system bounded even as the catalog grows.

### Inspector generation

The parameter panel should primarily render from:

- `parametersSchema`
- `uiSchema`
- runtime status from execution services

This keeps the inspector generic and dramatically reduces node-specific frontend branching.

### Additional generated panels

The following panels should also derive mostly from the same spec:

- credentials panel
- outputs/help panel
- validation panel
- docs/examples panel

That is the system change required to make "all other panels" easy to extend as well.

---

## Backend Design

### Spec registry

The backend should load node specs from a registry directory or package set at startup.

Recommended layout:

```text
server/
  node_specs/
    google/
      gmail.send@2.1.0.json
      gmail.receive@1.4.0.json
    http/
      http.request@1.0.0.json
```

The backend registry should expose:

- lookup by name
- lookup by name and version
- category listings
- compatibility metadata

### Runtime registry

The backend should keep a runtime registry separate from the node spec registry.

Example runtime providers:

- `http_action`
- `http_trigger`
- `llm_agent`
- `browser_session`
- `filesystem_action`
- `code_runner`
- `social_trigger`

The spec says what the node is. The runtime provider says how it executes.

### Execution boundary

The execution path should become:

1. load workflow
2. resolve node version
3. load `NodeSpec`
4. validate parameters against schema
5. bind to runtime provider
6. execute in the correct worker class

This is cleaner than importing many handlers directly into a large central executor module.

---

## Extension Points

Following the research-backed modularity model, MachinaOs should expose narrow extension points.

Recommended extension points:

### `NodeSpecProvider`

Adds one or more node specs to the registry.

### `RuntimeProvider`

Registers a runner for a `runtime.runner` or `workerType`.

### `CredentialProvider`

Registers credential types, validation rules, and acquisition UX.

### `InspectorRendererProvider`

Adds custom inspector widgets only when plain schema generation is not enough.

### `OutputRendererProvider`

Adds result viewers for special output types.

### `ValidationRuleProvider`

Adds extra rules beyond schema validation.

### `DocsProvider`

Adds or enriches generated docs and examples.

The main rule is that each extension point should be addition-oriented and small.

---

## Declarative And Programmatic Nodes

### Declarative nodes

Use for:

- CRUD APIs
- REST integrations
- SaaS actions
- simple utility actions

Implementation style:

- manifest only
- generic runner
- no custom frontend code

### Programmatic nodes

Use for:

- triggers
- browser automation
- code execution
- stream processors
- specialized agent runtimes

Implementation style:

- manifest plus custom runtime module
- optional custom panel widgets
- still versioned through the same `NodeSpec`

This avoids forcing simple nodes to pay the complexity tax of advanced ones.

---

## Versioning Rules

### Required platform behavior

1. New workflows should use the latest stable node version by default.
2. Existing workflows should stay pinned to the version they were saved with.
3. Major breaking changes should create a new node version, not silently mutate old behavior.
4. Migration helpers should be explicit and reversible.

### Suggested fields

Add explicit compatibility metadata:

- `metadata.version`
- `spec.replaces`
- `spec.compatibility.minWorkflowVersion`
- `spec.compatibility.featureFlags`

This is directly informed by n8n-style version pinning and CRD-style versioned resources.

---

## Generated Panels Model

The platform should treat UI panels as generated views over the same spec.

### Palette panel

Generated from:

- metadata
- icon
- category
- tags

### Parameter panel

Generated from:

- `parametersSchema`
- `uiSchema`
- runtime status

### Credentials panel

Generated from:

- `credentials[]`

### Output panel

Generated from:

- output port schema
- output renderer bindings

### Docs panel

Generated from:

- `docs.summary`
- `docs.examples`
- provider links
- version info

### Validation panel

Generated from:

- schema validation
- extension-point validation rules

Once these are all driven from the same spec, new node addition becomes genuinely low-touch.

---

## Suggested Package Boundaries

### Frontend

```text
client/src/
  node-specs/
  node-registry/
  node-families/
  panels/
  runtime-status/
```

### Backend

```text
server/
  node_specs/
  runtimes/
    http/
    llm/
    browser/
    filesystem/
    social/
  registry/
  compiler/
  execution/
```

### Shared

If the repo wants stronger type safety across stacks, extract shared contracts:

```text
packages/
  node-spec-contract/
```

This package should define:

- `NodeSpec` schema types
- workflow IR types
- validation helpers

---

## Suggested Migration Path From The Current Repo

### Phase 0: Introduce the contract

- add `NodeSpec` schema
- add registry loaders
- do not change execution yet

### Phase 1: Make frontend metadata spec-driven

- generate palette from spec
- generate basic inspector from schema
- map visual family from spec

### Phase 2: Make backend resolution spec-driven

- load node specs in backend
- validate parameters via schema
- map to existing handlers through a compatibility adapter

### Phase 3: Introduce generic declarative runners

- implement `http_action`
- implement `http_trigger`
- migrate simple nodes first

### Phase 4: Split worker pools by capability

- pull node execution out of the universal runtime path
- use queues or Temporal task queues per capability

### Phase 5: Remove legacy central registries

- shrink `Dashboard.tsx` type mapping
- shrink `NodeExecutor` handler registry
- keep only advanced runtime modules

This sequence reduces migration risk because it does not require a flag-day rewrite.

---

## Adding A New Node In The Target System

### Declarative node flow

1. Add one `NodeSpec` JSON file.
2. Register or reuse a runtime runner such as `http_action`.
3. The palette, parameter panel, docs panel, and credentials panel appear automatically.
4. Existing nodes are untouched.

### Programmatic node flow

1. Add one `NodeSpec` JSON file.
2. Add one runtime module implementing the runtime interface.
3. Register it through `RuntimeProvider`.
4. Add a custom widget only if the default panels are insufficient.

That is the modularity target.

---

## Runtime Interface Sketch

```ts
export interface RuntimeProvider {
  id: string;
  workerType: string;
  canRun(spec: NodeSpec): boolean;
  validate?(spec: NodeSpec): ValidationIssue[];
  execute(input: RuntimeExecutionInput): Promise<RuntimeExecutionResult>;
}
```

The important point is not the exact TypeScript shape. The important point is that:

- node specs are data
- runtimes are modules
- the registry binds them together

---

## Summary

The config-driven design is the missing platform boundary in the current MachinaOs architecture.

The target state should be:

- spec-first node catalog
- generated panels from `parametersSchema` and `uiSchema`
- runtime binding through narrow extension points
- declarative nodes by default
- programmatic nodes only when needed
- version pinning for workflow compatibility

That is the architecture that makes new node addition easy without disturbing existing nodes.

---

## Source References

- [n8n Choose Node Building Approach](https://docs.n8n.io/integrations/creating-nodes/plan/choose-node-method/)
- [n8n Node Versioning](https://docs.n8n.io/integrations/creating-nodes/build/reference/node-versioning/)
- [JSON Schema Reference](https://json-schema.org/understanding-json-schema)
- [JSON Schema Dialect and Vocabulary Declaration](https://json-schema.org/understanding-json-schema/reference/schema)
- [Backstage Extension Points](https://backstage.io/docs/backend-system/architecture/extension-points/)
- [Backstage Modules](https://backstage.io/docs/next/backend-system/architecture/modules)
- [Kubernetes Custom Resources](https://kubernetes.io/docs/concepts/api-extension/custom-resources/)
- [Kubernetes CRD Structural Schema Guide](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/)
- [react-jsonschema-form uiSchema](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema/)
