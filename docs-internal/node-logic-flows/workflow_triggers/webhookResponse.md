# Webhook Response (`webhookResponse`)

| Field | Value |
|------|-------|
| **Category** | workflow / utility |
| **Frontend definition** | [`client/src/nodeDefinitions/utilityNodes.ts`](../../../client/src/nodeDefinitions/utilityNodes.ts) |
| **Backend handler** | [`server/services/handlers/http.py::handle_webhook_response`](../../../server/services/handlers/http.py) |
| **Tests** | [`server/tests/nodes/test_workflow_triggers.py`](../../../server/tests/nodes/test_workflow_triggers.py) |
| **Skill (if any)** | none |
| **Dual-purpose tool** | no |

## Purpose

Sends a custom HTTP response back to the caller of a companion
[`webhookTrigger`](./webhookTrigger.md) whose `responseMode` is set to
`responseNode`. The trigger parks the incoming request on a future inside
`routers/webhook.py`; this node resolves that future with the configured
status code, body, and content type. Without a `webhookResponse` node in
the workflow, a `responseNode`-mode trigger hangs until the request times
out.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | yes (semantically) | Upstream node outputs are collected via `_get_connected_outputs_with_info` and made available for template substitution / default body. |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `statusCode` | number | `200` | no | - | HTTP status code. Coerced via `int(...)`. |
| `responseBody` | string | `""` | no | - | Response body. Supports `{{input.<field>}}` and `{{<nodeType>.<field>}}` template substitutions using connected upstream outputs. |
| `contentType` | options | `application/json` | no | - | One of `application/json` / `text/plain` / `text/html`. |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| (none) | - | `webhookResponse` has no output handle - it terminates a response branch. The handler still returns a standard envelope (used by the executor for status tracking). |

### Handler return payload

```ts
{
  sent: true;
  statusCode: number;
  contentType: string;
  bodyLength: number;
}
```

Wrapped in the standard envelope.

## Logic Flow

```mermaid
flowchart TD
  A[NodeExecutor._dispatch] --> B[_get_connected_outputs_with_info<br/>returns connected_outputs + source_nodes]
  B --> C[handle_webhook_response<br/>node_id / params / context / connected_outputs]
  C --> D[status_code = int params.statusCode default 200]
  D --> E[response_body = params.responseBody]
  E --> F{response_body non-empty AND connected_outputs?}
  F -- yes --> G[For each node_type, output in connected_outputs:<br/>replace '{{input.key}}' and '{{node_type.key}}' with str value]
  F -- no --> H
  G --> H{response_body still empty?}
  H -- yes AND connected_outputs present --> I[response_body = json.dumps first output]
  H -- no --> J
  I --> J[resolve_webhook_response node_id, statusCode, body, contentType]
  J --> K[Return success envelope]
  J -- Exception --> L[Return success=false<br/>error: str e]
```

## Decision Logic

- **Template resolution**: only applied when `response_body` is non-empty.
  Two template formats are supported:
  - `{{input.<key>}}` - pulls from any connected node's output dict
  - `{{<nodeType>.<key>}}` - pulls from a specific connected node type
- **Empty body fallback**: if `response_body` is empty AND at least one
  upstream node has output, the handler JSON-serialises the FIRST output
  (iteration order of a Python dict keyed by node type) and uses that as
  the body. If there are no upstream outputs the body stays empty.
- **resolve_webhook_response**: imported lazily from `routers.webhook`;
  writes the response dict into the pending-future map so the originating
  request can return.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none directly from the handler.
- **External API calls**: none. Instead, the handler resolves an
  in-process `asyncio.Future` owned by `routers.webhook` which in turn
  completes the pending HTTP response.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: none.
- **Services**: `routers.webhook.resolve_webhook_response`.
- **Python packages**: `json` (stdlib).
- **Environment variables**: none.

## Edge cases & known limits

- `resolve_webhook_response` is looked up by `node_id`. If no matching
  webhookTrigger is pending (e.g. this node runs in a workflow without an
  upstream `webhookTrigger`, or the trigger uses `responseMode=immediate`),
  `resolve_webhook_response` simply no-ops - the handler still returns
  `success=True`. There is no warning that the response was dropped.
- Template substitution uses plain `str.replace`; there is no escaping.
  Binary / non-stringifiable values will render as their Python `repr`.
- The "first connected output" fallback depends on dict iteration order
  (insertion order in CPython 3.7+) - which in turn depends on edge order.
  If multiple upstream nodes are connected, the output picked is not
  explicitly controlled by the user.
- `statusCode` coercion via `int(...)` will raise on non-numeric strings,
  which is then caught and returned as a failed envelope.
- Unlike other handlers in the registry, `webhookResponse` is dispatched
  in `NodeExecutor._dispatch` (not the handler registry) because it needs
  the `connected_outputs` list - see
  [`node_executor.py:367-381`](../../../server/services/node_executor.py).

## Related

- **Companion node**: [`webhookTrigger`](./webhookTrigger.md) -
  `webhookResponse` is only useful when the trigger's `responseMode` is
  `responseNode`.
- **Sibling triggers**: [`webhookTrigger`](./webhookTrigger.md),
  [`chatTrigger`](./chatTrigger.md).
- **Architecture docs**: [Event Waiter System](../../event_waiter_system.md)
