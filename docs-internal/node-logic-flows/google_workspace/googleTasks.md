# Tasks (`googleTasks`)

| Field | Value |
|------|-------|
| **Category** | google_workspace / tool (dual-purpose) |
| **Backend handler** | [`server/services/handlers/tasks.py::handle_google_tasks`](../../../server/services/handlers/tasks.py) |
| **Tests** | [`server/tests/nodes/test_google_workspace.py`](../../../server/tests/nodes/test_google_workspace.py) |
| **Skill (if any)** | [`server/skills/productivity_agent/google-tasks-skill/SKILL.md`](../../../server/skills/productivity_agent/google-tasks-skill/SKILL.md) |
| **Dual-purpose tool** | yes - tool name `googleTasks` |

## Purpose

Consolidated Google Tasks node for managing personal to-do items. Uses Google
Tasks API v1 (`tasklists` + `googleTasks` collections). One node, five operations
switched via the `operation` parameter.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Template source for operation parameters |

## Parameters

Top-level dispatcher: `operation` (one of `create`, `list`, `complete`, `update`, `delete`).

### `operation = create`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `title` | string | `""` | **yes** | Task title |
| `notes` | string | `""` | no | Task description |
| `due_date` | string | `""` | no | RFC 3339; date-only is upgraded to `T00:00:00.000Z` |
| `tasklist_id` | string | `@default` | no | Which tasklist |

### `operation = list`

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `tasklist_id` | string | `@default` | - |
| `show_completed` | boolean | `false` | - |
| `show_hidden` | boolean | `false` | - |
| `max_results` | number | `100` | No clamp |

### `operation = complete`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `task_id` | string | `""` | **yes** | - |
| `tasklist_id` | string | `@default` | no | - |

### `operation = update`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `task_id` | string | `""` | **yes** | - |
| `tasklist_id` | string | `@default` | no | - |
| `title` / `notes` / `due_date` / `status` | string | `""` | no | Patch fields |

Also accepts `update_title`, `update_notes`, `update_due_date`, `update_status`
aliases (the dispatcher rewrites them before delegating).

### `operation = delete`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `task_id` | string | `""` | **yes** | - |
| `tasklist_id` | string | `@default` | no | - |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Operation-specific payload |
| `output-tool` | object | Same, for AI tool wiring |

- `create` / `complete` / `update`: `{task_id, title, notes?, due, status, completed?, self_link?}`
- `list`: `{tasks: [{task_id, title, notes, due, status, completed, position}], count}`
- `delete`: `{deleted: true, task_id}`

## Logic Flow

```mermaid
flowchart TD
  A[handle_google_tasks] --> AL{operation == update?}
  AL -- yes --> AM[Alias update_* params<br/>to plain names]
  AL -- no --> B
  AM --> B{operation?}
  B -- create --> C1[handle_tasks_create]
  B -- list --> C2[handle_tasks_list]
  B -- complete --> C3[handle_tasks_complete]
  B -- update --> C4[handle_tasks_update]
  B -- delete --> C5[handle_tasks_delete]
  B -- unknown --> Eret[success=false<br/>Unknown Tasks operation]
  C1 --> G[get_google_credentials + build v1]
  C2 --> G
  C3 --> G
  C4 --> G
  C5 --> G
  G -- ValueError --> Eret
  C1 --> V1{title?}
  V1 -- no --> Eret
  V1 -- yes --> DF[Normalize due_date<br/>append T00:00:00.000Z if missing]
  DF --> R1[tasks.insert]
  C2 --> R2[tasks.list]
  C3 --> V3{task_id?}
  V3 -- no --> Eret
  V3 -- yes --> G3[tasks.get -> set status=completed -> tasks.update]
  C4 --> V4{task_id?}
  V4 -- no --> Eret
  V4 -- yes --> G4[tasks.get -> merge patch -> tasks.update]
  C5 --> V5{task_id?}
  V5 -- no --> Eret
  V5 -- yes --> R5[tasks.delete]
  R1 --> T[_track_tasks_usage]
  R2 --> T
  G3 --> T
  G4 --> T
  R5 --> T
  T --> OUT[Return success envelope]
```

## Decision Logic

- **Update parameter aliasing** (dispatcher): the dispatcher mutates the incoming `parameters` dict to promote `update_*` keys onto their plain counterparts BEFORE delegating. Irreversible.
- **Due-date upgrade**: any `due_date` that lacks a `T` gets `T00:00:00.000Z` appended. There is no strict ISO validation otherwise.
- **Complete** is a convenience op - it does a read-modify-write (`tasks.get` then `tasks.update`) with `status='completed'`. Two API calls per completion.
- **Update** merges only truthy fields (uses `parameters.get('title')` etc. which skips empty strings). Callers cannot clear `notes` via the update path - use an explicit `status='needsAction'` or direct API.
- **`tasks.list`** does NOT reject `max_results > 100` - the API itself caps silently.

## Side Effects

- **Database writes**: `api_usage_metrics` row per API call via `save_api_usage_metric` with `service='google_tasks'`. `list` records one row with `resource_count = len(tasks)`, but `_track_tasks_usage` is NOT called on the list path (see bug below).
- **Broadcasts**: none.
- **External API calls**: Tasks API v1 - `tasks().insert/list/get/update/delete`.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: OAuth via `auth_service.get_oauth_tokens("google")`.
- **Services**: Google Tasks API, `PricingService`, `Database`.
- **Python packages**: `google-api-python-client`.
- **Environment variables**: none.

## Edge cases & known limits

- **`handle_tasks_list` does not call `_track_tasks_usage`** (all other operations do). The list operation therefore skips the `api_usage_metrics` row. Handler bug noted, not fixed.
- Update cannot clear a field - empty strings are filtered out by truthiness. To clear notes or title you must bypass this node.
- Complete is non-idempotent on the server side: re-completing a completed task overwrites the `completed` timestamp.
- Dispatcher mutates `parameters` in place - callers that reuse the dict will see `title`/`notes`/`due_date`/`status` filled in from `update_*` aliases.
- `tasklist_id='@default'` only resolves for authenticated users who have created at least one list; freshly authenticated users may get a 404 until Google Tasks provisions their default list.

## Related

- **Skills using this as a tool**: [`tasks-skill/SKILL.md`](../../../server/skills/productivity_agent/google-tasks-skill/SKILL.md)
- **Companion nodes**: [`googleGmail`](./googleGmail.md), [`googleCalendar`](./googleCalendar.md), [`googleDrive`](./googleDrive.md), [`googleSheets`](./googleSheets.md), [`googleContacts`](./googleContacts.md)
- **Architecture docs**: `CLAUDE.md` -> "Google Workspace Nodes".
