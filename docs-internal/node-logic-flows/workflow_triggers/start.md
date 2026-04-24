# Start (`start`)

| Field | Value |
|------|-------|
| **Category** | workflow / trigger |
| **Backend handler** | [`server/services/handlers/utility.py::handle_start`](../../../server/services/handlers/utility.py) |
| **Tests** | [`server/tests/nodes/test_workflow_triggers.py`](../../../server/tests/nodes/test_workflow_triggers.py) |
| **Skill (if any)** | none |
| **Dual-purpose tool** | no |

## Purpose

Manual workflow entry point. Emits a user-authored JSON payload as the
workflow's initial data. Every workflow that is not kicked off by an event
trigger (`webhookTrigger`, `chatTrigger`, `cronScheduler`, etc.) starts from a
`start` node. Unlike the event triggers in this category, `start` does not
register an event waiter - it completes immediately with the parsed initial
data.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| (none) | - | - | `start` has no inputs - it is the entry point |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `initialData` | string (JSON) | `"{}"` | no | - | JSON document surfaced as the node output. Any parse failure silently becomes `{}`. |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | The parsed JSON value of `initialData` (or `{}` if invalid). |

### Output payload

```ts
// Whatever the user put in initialData, parsed as JSON.
// Invalid JSON -> {}.
Record<string, unknown>
```

Wrapped in the standard envelope: `{ success: true, result: <payload>, node_id, node_type: "start" }`.

## Logic Flow

```mermaid
flowchart TD
  A[handle_start] --> B[Read parameters.initialData<br/>default: '{}']
  B --> C{json.loads?}
  C -- ok --> D[initial_data = parsed]
  C -- Exception --> E[initial_data = {}]
  D --> F[Return success envelope<br/>result = initial_data]
  E --> F
```

## Decision Logic

- **Validation**: none. Empty / missing `initialData` is treated as `"{}"`.
- **Branches**: single path; either `initialData` parses or it is silently
  replaced with `{}`.
- **Fallbacks**: JSON decode errors are swallowed and produce `{}`.
- **Error paths**: the handler does not raise; it always returns a
  `success=True` envelope. A malformed `initialData` is **not** reported as an
  error.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none (the caller emits `executing` / `success` via
  `StatusBroadcaster`; the handler itself is silent).
- **External API calls**: none.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: none.
- **Services**: none.
- **Python packages**: `json` (stdlib).
- **Environment variables**: none.

## Edge cases & known limits

- `start` always returns `success=True` regardless of `initialData` content.
  Invalid JSON is silently coerced to `{}` - users get no warning their data
  was dropped.
- Although `start` is listed in `TRIGGER_REGISTRY` (as `deploy_triggered`),
  the handler registry in `NodeExecutor._build_handler_registry()` maps
  `start` directly to `handle_start`. The event-waiter path is only exercised
  inside `DeploymentManager` when a workflow is deployed; ad-hoc runs go
  through `handle_start` without waiting for any event.
- The payload is returned as-is; no validation, schema enforcement, or nested
  template resolution is performed by the handler.

## Related

- **Skills using this as a tool**: none.
- **Other nodes that consume this output**: any downstream node - typical
  pattern is `start -> aiAgent` or `start -> httpRequest` in a hand-run
  workflow.
- **Architecture docs**: [Workflow Schema](../../workflow-schema.md), [Execution Engine Design](../../DESIGN.md)
- **Sibling triggers**: [`cronScheduler`](./cronScheduler.md), [`timer`](./timer.md), [`webhookTrigger`](./webhookTrigger.md), [`chatTrigger`](./chatTrigger.md), [`taskTrigger`](./taskTrigger.md), [`webhookResponse`](./webhookResponse.md)
