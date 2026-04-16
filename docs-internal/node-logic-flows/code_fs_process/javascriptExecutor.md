# JavaScript Executor (`javascriptExecutor`)

| Field | Value |
|------|-------|
| **Category** | code_fs_process / code |
| **Frontend definition** | [`client/src/nodeDefinitions/codeNodes.ts`](../../../client/src/nodeDefinitions/codeNodes.ts) |
| **Backend handler** | [`server/services/handlers/code.py::handle_javascript_executor`](../../../server/services/handlers/code.py) |
| **Node.js client** | [`server/services/nodejs_client.py::NodeJSClient`](../../../server/services/nodejs_client.py) |
| **Tests** | [`server/tests/nodes/test_code_fs_process.py`](../../../server/tests/nodes/test_code_fs_process.py) |
| **Skill (if any)** | [`server/skills/coding_agent/javascript-skill/SKILL.md`](../../../server/skills/coding_agent/javascript-skill/SKILL.md) |
| **Dual-purpose tool** | yes - tool name `javascript_code` |

## Purpose

Runs user JavaScript through the persistent Node.js executor server (Express +
tsx) that the Python backend spawns on startup. The handler does **not** spawn
`node` per call - it POSTs the code to `http://localhost:3020/execute` via an
async `aiohttp` client. The Node.js server evaluates the script inside a VM
sandbox and returns `{success, output, console_output, execution_time_ms}`.

The handler merges the caller's upstream outputs into an `input_data` object,
injects the workflow's `workspace_dir` as a key, then forwards the payload.

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
| `code` | string (code editor) | (boilerplate stub) | yes | - | JavaScript source. User must assign to `output` |
| `timeout` | number | `30` | no | - | Seconds - multiplied by 1000 and forwarded as millisecond timeout to the Node server |

## Handler-level kwargs (bound via partial at registry setup)

| Name | Default | Description |
|------|---------|-------------|
| `nodejs_url` | `http://localhost:3020` | Overridable via `NODEJS_EXECUTOR_URL` at container wiring |
| `nodejs_timeout` | `30` | Seconds; overridable via `NODEJS_EXECUTOR_TIMEOUT` |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload |
| `output-tool` | object | Same payload when wired to an AI agent |

### Output payload

```ts
{
  output: any;              // Value the Node.js server parsed from `output` in the script
  console_output: string;   // Captured console.log/.error etc.
  timestamp: string;        // ISO8601
}
```

## Logic Flow

```mermaid
flowchart TD
  A[handle_javascript_executor] --> B{code strip empty?}
  B -- yes --> E[Return error envelope:<br/>No code provided]
  B -- no --> C[timeout_ms = int timeout * 1000]
  C --> D[input_data = connected_outputs or {}<br/>inject workspace_dir]
  D --> F[get_nodejs_client<br/>lazy singleton]
  F --> G[client.execute<br/>POST /execute<br/>language=javascript]
  G -- exception --> H[Return error envelope<br/>error=str e]
  G -- ok + success=true --> I[Return success envelope<br/>output + console_output]
  G -- ok + success=false --> J[Return error envelope<br/>preserve console_output]
```

## Decision Logic

- **Validation**: `code.strip() == ""` -> immediate error envelope
  `"No code provided"`.
- **Timeout unit mismatch**: UI accepts seconds, handler multiplies by 1000
  before forwarding. Default 30 -> 30000 ms. No upper cap enforced in Python.
- **`workspace_dir` injection**: unconditionally sets
  `input_data["workspace_dir"]`, shadowing any upstream node that happened to
  produce a key with that name.
- **Client reuse**: `_nodejs_client` is a **module-global** singleton. First
  call fixes the `base_url` and `timeout`; subsequent calls with different
  kwargs silently reuse the first one. See Edge cases.
- **Node server error propagation**: if the Node.js server returns
  `{success: false, error, console_output}`, the handler forwards the `error`
  string and **keeps** `console_output` so users still see logs from the failed
  run.
- **Broad `except Exception`**: any networking error (aiohttp.ClientError,
  TimeoutError, ConnectionRefusedError) is caught, logged at ERROR, and
  surfaced as an error envelope with `console_output=""`.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none from this handler.
- **External API calls**: `POST http://localhost:3020/execute`
  (configurable via `NODEJS_EXECUTOR_URL`). Body:
  `{code, input_data, language: "javascript", timeout}`.
- **File I/O**: none from Python; the Node.js server may read/write user
  packages at `server/nodejs/user-packages/`.
- **Subprocess**: none directly. The Node.js server itself is a long-lived
  subprocess started by `main.py` lifespan.
- **Module-level state**: the `_nodejs_client` module global is created on
  first use and never reset.

## External Dependencies

- **Credentials**: none.
- **Services**: Persistent Node.js executor at `http://localhost:3020`.
  Must be running - the backend start script boots it alongside uvicorn.
- **Python packages**: `aiohttp`.
- **Environment variables**: `NODEJS_EXECUTOR_URL`,
  `NODEJS_EXECUTOR_TIMEOUT`, `NODEJS_EXECUTOR_PORT`, `NODEJS_EXECUTOR_HOST`,
  `NODEJS_EXECUTOR_BODY_LIMIT` (all read by the Node server itself).

## Edge cases & known limits

- **Module-level client singleton**: `_nodejs_client` is cached on first call.
  If the injected `nodejs_url` / `nodejs_timeout` kwargs change mid-process
  (e.g., tests re-wiring the container), the cached instance keeps the
  original values. Reset by `services.handlers.code._nodejs_client = None`.
- **Node server down**: connection refused surfaces as
  `error="Cannot connect to host localhost:3020 ssl:default [Connect call
  failed]"` or similar aiohttp message. No automatic retry.
- **`workspace_dir` key collision**: user code cannot read an upstream
  `workspace_dir` from `input_data` - the handler always overwrites it.
- **Timeout semantics**: the Python-side `timeout` is a ceiling on the
  aiohttp request itself (set once at client creation); the
  `timeout_ms` forwarded in the body is the Node server's script timeout.
  These two can disagree - if the script timeout is longer than the aiohttp
  timeout, the HTTP call fails before the script finishes.
- **`console_output` may contain partial output**: Node server streams stdio
  into a buffer and flushes at end-of-run, but on script timeout the server
  returns whatever it captured up to the kill signal.
- **JSON-only transport**: `output` must be JSON-serialisable on the Node
  side. Functions, `undefined`, `BigInt`, circular refs are stripped or
  rejected by `JSON.stringify` before return.

## Related

- **Skills using this as a tool**: [`javascript-skill/SKILL.md`](../../../server/skills/coding_agent/javascript-skill/SKILL.md)
- **Sibling nodes**: [`typescriptExecutor`](./typescriptExecutor.md), [`pythonExecutor`](./pythonExecutor.md)
- **Architecture docs**: [DESIGN.md](../../DESIGN.md)
