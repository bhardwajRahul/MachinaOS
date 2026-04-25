# Workflow Operations Protocol

The standard wire format any backend service uses to mutate the React
Flow canvas. A service returns `{operations: [...]}`; the frontend
walks the list with a single applier (`client/src/lib/workflowOps.ts`)
that creates / removes nodes + edges and persists parameter changes.

**Why a protocol**: keeps domain rules in the backend (visuals.json
lookups, plugin-registry checks, canonical config shapes) without
forcing each new feature to invent its own RPC + frontend glue.
"Auto-add Skill on tool connect" is the first consumer; future
features (workflow templates, AI-suggested edits, automation recipes)
just emit op batches.

## Wire shape

```json
{
  "operations": [
    { "type": "add_node", ... },
    { "type": "add_edge", ... }
  ]
}
```

Operations apply **in order**. Earlier ops can produce React Flow node
ids that later ops reference via `client_ref` placeholders.

## Operation types (v1)

| Type | Required | Optional | Purpose |
|---|---|---|---|
| `add_node` | `client_ref`, `node_type`, `parameters` | `label`, `position` | Create a new node + persist its initial params. `client_ref` is a batch-local id later ops can target. |
| `add_edge` | `source`, `target` | `source_handle`, `target_handle` | Wire two nodes. `source` / `target` are either existing node ids (string) or `{client_ref}` references. |
| `set_node_parameters` | `node_id`, `parameters` | -- | Shallow-merge `parameters` into the node's existing params via `saveNodeParameters`. |
| `delete_node` | `node_id` | -- | Remove node; edges to/from it cascade-delete. |
| `delete_edge` | `edge_id` | -- | Remove a single edge. |
| `move_node` | `node_id`, `position` | -- | Reposition without changing identity. |
| `replace_node` | `node_id`, `node_type`, `parameters` | `label`, `preserve_edges` (default `true`) | Atomic delete-and-add at the same position. With `preserve_edges`, edges to/from the old id rewire to the new id. |

### `PositionSpec`

Either absolute or anchored:

```ts
type PositionSpec =
  | { x: number; y: number }
  | { anchor_node_id: string;
      offset?: { x?: number; y?: number };
      fallback?: { x: number; y: number } };
```

Anchored positions stay backend-agnostic about pixel coords -- the
frontend resolves the anchor against current React Flow state. If the
anchor doesn't exist, `fallback` is used (or a sensible default).

### `NodeRef`

```ts
type NodeRef = string | { client_ref: string };
```

A string is an existing React Flow node id. A `{client_ref}` is a
placeholder that resolves to the id of an `add_node` op earlier in
the same batch.

## Application semantics

- **Order**: ops apply sequentially. Anchor lookups and `client_ref`
  resolution see the cumulative state of earlier ops in the batch.
- **Best-effort**: a failed op (e.g. `delete_node` on a missing id) is
  logged and reported in the result; subsequent ops still apply. v1
  has no rollback. Backend services should write op sequences that are
  robust to partial application.
- **Not a diff reconciler**: re-applying a batch is not assumed safe.
  The protocol is a one-shot mutation wire format.

## Backend usage

```python
from services import workflow_ops

ref = "new_master"
return {
    "operations": [
        workflow_ops.add_node(
            ref, "masterSkill",
            {"skillsConfig": {...}},
            label="Master Skill",
            position=workflow_ops.anchored(agent_id, offset_x=-60, offset_y=220),
        ),
        workflow_ops.add_edge(
            {"client_ref": ref}, agent_id,
            source_handle="output-tool", target_handle="input-skill",
        ),
    ],
}
```

Helpers live in `server/services/workflow_ops.py` (TypedDicts +
builder functions). Empty result: `workflow_ops.empty()` returns
`{"operations": []}`.

## Frontend usage

```ts
import { applyOperations } from '@/lib/workflowOps';

const result = await applyOperations(operations, {
  nodes, edges, setNodes, setEdges, saveNodeParameters,
});
// result.applied  -> count of successful ops
// result.errors   -> [{op, message}, ...]
// result.refMap   -> { client_ref: generated_node_id, ... }
```

`applyOperations` does not throw; callers inspect `errors` to surface
failures (toast, log, retry, etc.).

## Current consumers

| Service | WS handler | Module |
|---|---|---|
| Auto-add Skill on tool connect | `evaluate_auto_skill` | `server/services/auto_skill.py` |

## Adding a new consumer

1. Write a backend service that returns `{operations: [...]}` using
   the builder helpers in `services/workflow_ops`.
2. Add a thin `@ws_handler` that calls into the service.
3. On the frontend, send the WS request and pass the returned
   `operations` into `applyOperations`. No new applier code.
4. If you need a new op type, follow the steps in the docstring of
   `server/services/workflow_ops.py` (mirror the TypedDict in TS,
   add an apply branch, document here).
