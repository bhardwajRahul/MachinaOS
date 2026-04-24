# Python Executor (`pythonExecutor`)

| Field | Value |
|------|-------|
| **Category** | code_fs_process / code |
| **Backend handler** | [`server/services/handlers/code.py::handle_python_executor`](../../../server/services/handlers/code.py) |
| **Tests** | [`server/tests/nodes/test_code_fs_process.py`](../../../server/tests/nodes/test_code_fs_process.py) |
| **Skill (if any)** | [`server/skills/coding_agent/python-skill/SKILL.md`](../../../server/skills/coding_agent/python-skill/SKILL.md) |
| **Dual-purpose tool** | yes - tool name `python_code` |

## Purpose

Executes user-supplied Python code in the backend process using `exec()` with a
curated `__builtins__` whitelist. Intended for quick data transforms inside a
workflow; input from upstream nodes lands in a local `input_data` dict and the
code must set a module-level `output` variable to emit a result. Heavy libraries
are intentionally excluded - only `math`, `json`, `datetime`, `re`, `random`,
`Counter`, `defaultdict` are preloaded by the skill guide. `print()` is
redirected to an `io.StringIO` buffer so stdout becomes the `console_output`
return field.

Dispatched through the special-handlers branch at
[`node_executor.py:367-381`](../../../server/services/node_executor.py) so it
receives `connected_outputs` (dict of upstream outputs keyed by source node id).

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream outputs are exposed as `input_data` dict inside the exec namespace |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `code` | string (code editor) | (boilerplate stub) | yes | - | Python source. Must assign to the free variable `output` to emit a value |
| `timeout` | number | `30` | no | - | Read and coerced to int but **not enforced** - `exec()` is synchronous with no wall-clock guard |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload |
| `output-tool` | object | Same payload when wired to an AI agent |

### Output payload

```ts
{
  output: any;              // Value assigned to `output` in the user code (None by default)
  console_output: string;   // Captured stdout from redirected print()
  timestamp: string;        // ISO8601 local time
}
```

On failure the envelope is `{success: false, error, console_output: "", ...}`.
Note that `console_output` is **only** preserved on the success path; when an
exception fires mid-execution the already-captured buffer is discarded because
the `except` branch hard-codes `"console_output": console_output` but
`console_output` is only assigned after `exec()` finishes. See Edge cases.

## Logic Flow

```mermaid
flowchart TD
  A[handle_python_executor] --> B{code strip empty?}
  B -- yes --> E[Return error envelope:<br/>No code provided]
  B -- no --> C[Read timeout<br/>int-coerce only, unused]
  C --> D[Build safe_builtins dict:<br/>abs..zip, math, json, captured_print]
  D --> F[Build namespace:<br/>input_data=connected_outputs or {},<br/>workspace_dir=context,<br/>output=None]
  F --> G[exec code in namespace]
  G -- exception --> H[Return error envelope<br/>error=str e, console_output=empty]
  G -- ok --> I[output = namespace.get output<br/>console_output = StringIO.getvalue]
  I --> J[Return success envelope<br/>output, console_output, timestamp]
```

## Decision Logic

- **Validation**: `code.strip() == ""` -> immediate error envelope with message
  `"No code provided"`.
- **Namespace seeding**: `input_data` defaults to `{}` if `connected_outputs` is
  None. `workspace_dir` is pulled from `context["workspace_dir"]` but never
  validated; an empty string is fine.
- **Print redirection**: `safe_builtins["print"]` is a wrapper that forces
  `file=stdout_capture`, so any user-supplied `file=` kwarg is **overwritten**.
- **Output extraction**: `namespace.get("output", None)` - the user writing
  `output = <value>` is the only way to emit data. A top-level expression is
  evaluated but not captured.
- **No timeout enforcement**: the `timeout` parameter is int-coerced only as a
  sanity check (raises on non-numeric strings) but never passed to a watchdog.
  Long loops will block the async event loop for the whole backend.
- **Error path**: broad `except Exception` catches everything, logs via
  `logger.error`, and returns `{success: false, error: str(e)}`.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none (the handler itself is silent; the executor does the
  status broadcast around it).
- **External API calls**: none.
- **File I/O**: user code can freely read/write via Python stdlib - it is NOT
  sandboxed by the `safe_builtins` dict because `open`, `eval`, `exec`,
  `__import__` are still reachable through attribute lookups on imported
  modules. `exec()` runs in the server process with its full OS privileges.
- **Subprocess**: none from the handler; user code could spawn.
- **Event loop blocking**: `exec()` is synchronous. A tight loop blocks every
  other request/workflow until it returns.

## External Dependencies

- **Credentials**: none.
- **Services**: none.
- **Python packages**: stdlib only (`io`, `math`, `json`, `datetime`).
- **Environment variables**: none.

## Edge cases & known limits

- **`timeout` is cosmetic**: accepted and coerced to int but never enforced. A
  hanging script hangs the entire FastAPI worker.
- **No real sandbox**: the `safe_builtins` dict is not a security boundary -
  `math` and `json` are module objects, and user code can re-import anything via
  `().__class__.__base__.__subclasses__()` or similar well-known escapes. Treat
  this node as trusted-input only.
- **`console_output` swallowed on error**: the `except` path hard-codes
  `"console_output": console_output`, but `console_output` is initialised to
  `""` and only overwritten **after** `exec()` succeeds. Any print()s before an
  exception are therefore lost.
- **`output=None` is indistinguishable from a user explicitly returning
  `None`**: both surface as `{"output": None}` in the envelope.
- **`input_data` mutation is visible to later siblings**: the handler passes
  the `connected_outputs` dict by reference, so user code mutating it mutates
  the executor's cache. Downstream nodes in the same execution layer can see
  the mutation.
- **`print(..., file=...)`**: the captured_print wrapper unconditionally sets
  `kwargs["file"] = stdout_capture`, overriding any user-provided file handle.
- **No `await` support**: `exec()` cannot evaluate top-level `await`; the user
  must wrap async code in `asyncio.run(...)` themselves.

## Related

- **Skills using this as a tool**: [`python-skill/SKILL.md`](../../../server/skills/coding_agent/python-skill/SKILL.md)
- **Sibling nodes**: [`javascriptExecutor`](./javascriptExecutor.md), [`typescriptExecutor`](./typescriptExecutor.md), [`shell`](./shell.md), [`processManager`](./processManager.md)
- **Architecture docs**: [DESIGN.md](../../DESIGN.md)
