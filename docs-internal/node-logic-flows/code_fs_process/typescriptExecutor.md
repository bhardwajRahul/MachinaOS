# TypeScript Executor (`typescriptExecutor`)

| Field | Value |
|------|-------|
| **Category** | code_fs_process / code |
| **Backend handler** | [`server/services/handlers/code.py::handle_typescript_executor`](../../../server/services/handlers/code.py) |
| **Node.js client** | [`server/services/nodejs_client.py::NodeJSClient`](../../../server/services/nodejs_client.py) |
| **Tests** | [`server/tests/nodes/test_code_fs_process.py`](../../../server/tests/nodes/test_code_fs_process.py) |
| **Skill (if any)** | - (shared with `javascript-skill`) |
| **Dual-purpose tool** | yes - tool name `typescript_code` |

## Purpose

Identical to [`javascriptExecutor`](./javascriptExecutor.md) except the
`language` field in the POST payload is `"typescript"`, so the Node.js server
runs the script through `tsx` (TypeScript runner) instead of plain `node`.
All inputs, outputs, and error paths match the JS variant - the only
user-facing difference is that TypeScript type annotations parse without
error.

Dispatched through the special-handlers branch at
[`node_executor.py:367-381`](../../../server/services/node_executor.py) so it
receives `connected_outputs`.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream outputs merged into the Node-side `input_data` object |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `code` | string (code editor) | (boilerplate stub with `interface Result { ... }`) | yes | - | TypeScript source. User must assign to `output` |
| `timeout` | number | `30` | no | - | Seconds - multiplied by 1000 before forwarding to the Node server |

## Handler-level kwargs

| Name | Default | Description |
|------|---------|-------------|
| `nodejs_url` | `http://localhost:3020` | |
| `nodejs_timeout` | `30` | |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload |
| `output-tool` | object | Same payload when wired to an AI agent |

### Output payload

```ts
{
  output: any;
  console_output: string;
  timestamp: string;
}
```

## Logic Flow

```mermaid
flowchart TD
  A[handle_typescript_executor] --> B{code strip empty?}
  B -- yes --> E[Return error envelope:<br/>No code provided]
  B -- no --> C[timeout_ms = int timeout * 1000]
  C --> D[input_data = connected_outputs or {}<br/>inject workspace_dir]
  D --> F[get_nodejs_client<br/>lazy singleton]
  F --> G[client.execute<br/>POST /execute<br/>language=typescript]
  G -- exception --> H[Return error envelope]
  G -- ok + success=true --> I[Return success envelope]
  G -- ok + success=false --> J[Return error envelope<br/>preserve console_output]
```

## Decision Logic

Matches [`javascriptExecutor`](./javascriptExecutor.md#decision-logic). The only
wire-level difference is the POST body's `language` field.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none.
- **External API calls**: `POST http://localhost:3020/execute` with body
  `{code, input_data, language: "typescript", timeout}`.
- **Subprocess**: none directly.
- **Module-level state**: shares the `_nodejs_client` singleton with the JS
  executor.

## External Dependencies

- **Services**: Persistent Node.js executor at `http://localhost:3020`.
  The server must have `tsx` available (pinned in `server/nodejs/package.json`).
- **Python packages**: `aiohttp`.
- **Environment variables**: `NODEJS_EXECUTOR_URL`, `NODEJS_EXECUTOR_TIMEOUT`.

## Edge cases & known limits

- **Shared singleton with `javascriptExecutor`**: a TS call after a JS call
  (or vice versa) reuses the same `NodeJSClient` instance. Changing
  `nodejs_url` / `nodejs_timeout` mid-process has no effect.
- **No TypeScript compile errors at HTTP layer**: if `tsx` emits compile
  errors the Node server returns `{success: false, error: "<tsc message>"}`;
  the Python handler surfaces this verbatim.
- **Type erasure**: runtime output is still JSON; interfaces and type aliases
  are compile-time only.
- **Inherits every JS caveat**: module-level client, aiohttp-vs-script timeout
  mismatch, `workspace_dir` overwrite, JSON-only transport. See
  [`javascriptExecutor.md`](./javascriptExecutor.md#edge-cases--known-limits).

## Related

- **Shared skill**: [`javascript-skill/SKILL.md`](../../../server/skills/coding_agent/javascript-skill/SKILL.md)
- **Sibling nodes**: [`javascriptExecutor`](./javascriptExecutor.md), [`pythonExecutor`](./pythonExecutor.md)
