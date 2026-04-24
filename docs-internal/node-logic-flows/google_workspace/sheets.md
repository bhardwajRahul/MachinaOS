# Sheets (`sheets`)

| Field | Value |
|------|-------|
| **Category** | google_workspace / tool (dual-purpose) |
| **Backend handler** | [`server/services/handlers/sheets.py::handle_google_sheets`](../../../server/services/handlers/sheets.py) |
| **Tests** | [`server/tests/nodes/test_google_workspace.py`](../../../server/tests/nodes/test_google_workspace.py) |
| **Skill (if any)** | [`server/skills/productivity_agent/sheets-skill/SKILL.md`](../../../server/skills/productivity_agent/sheets-skill/SKILL.md) |
| **Dual-purpose tool** | yes - tool name `sheets` |

## Purpose

Consolidated Google Sheets node for reading, writing, and appending cell
values. Uses Sheets API v4 (`spreadsheets.values` collection). One node,
three operations switched via the `operation` parameter.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Template source for operation parameters |

## Parameters

Top-level dispatcher: `operation` (one of `read`, `write`, `append`).

### `operation = read`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `spreadsheet_id` | string | `""` | **yes** | Sheet ID (from URL) |
| `range` | string | `""` | **yes** | A1 notation, e.g. `Sheet1!A1:D10` |
| `value_render_option` | options | `FORMATTED_VALUE` | no | `FORMATTED_VALUE` / `UNFORMATTED_VALUE` / `FORMULA` |
| `major_dimension` | options | `ROWS` | no | `ROWS` / `COLUMNS` |

### `operation = write`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `spreadsheet_id` | string | `""` | **yes** | - |
| `range` | string | `""` | **yes** | e.g. `Sheet1!A1` |
| `values` | array/string | `[]` | **yes** | 2D array, or JSON string that parses to 2D array, or 1D auto-wrapped to 2D |
| `value_input_option` | options | `USER_ENTERED` | no | `RAW` or `USER_ENTERED` |

### `operation = append`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `spreadsheet_id` | string | `""` | **yes** | - |
| `range` | string | `""` | **yes** | e.g. `Sheet1!A:D` |
| `values` | array/string | `[]` | **yes** | Same coercion as write |
| `value_input_option` | options | `USER_ENTERED` | no | - |
| `insert_data_option` | options | `INSERT_ROWS` | no | `INSERT_ROWS` / `OVERWRITE` |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Operation-specific payload |
| `output-tool` | object | Same, for AI tool wiring |

- `read`: `{values: [[...],...], range, rows, columns, major_dimension}`
- `write` / `append`: `{updated_range, updated_rows, updated_columns, updated_cells, table_range?}`

## Logic Flow

```mermaid
flowchart TD
  A[handle_google_sheets] --> B{operation?}
  B -- read --> R[handle_sheets_read]
  B -- write --> W[handle_sheets_write]
  B -- append --> AP[handle_sheets_append]
  B -- unknown --> Eret[success=false<br/>Unknown Sheets operation]
  R --> G[get_google_credentials + build v4]
  W --> G
  AP --> G
  G -- ValueError --> Eret
  R --> V1{spreadsheet_id & range?}
  V1 -- no --> Eret
  V1 -- yes --> R1[spreadsheets.values.get<br/>valueRenderOption majorDimension]
  W --> V2{spreadsheet_id & range & values?}
  V2 -- no --> Eret
  V2 -- yes --> C2[Coerce values:<br/>str -> json.loads<br/>1D -> wrap to 2D]
  C2 --> R2[spreadsheets.values.update<br/>valueInputOption body]
  AP --> V3{spreadsheet_id & range & values?}
  V3 -- no --> Eret
  V3 -- yes --> C3[Same coercion as write]
  C3 --> R3[spreadsheets.values.append<br/>valueInputOption insertDataOption]
  R1 --> T[_track_sheets_usage]
  R2 --> T
  R3 --> T
  T --> OUT[Return success envelope]
```

## Decision Logic

- **Values coercion**: if `values` is a `str`, parsed via `json.loads`. If the (possibly parsed) sequence's first element is not a list, the whole thing is wrapped into `[values]` to guarantee 2D.
- **Required fields**: each operation has its own validation block; all three require `spreadsheet_id` and `range`, write/append additionally require a non-empty `values`.
- **Usage tracking count**: read reports `len(values)` rows; write reports `updatedCells`; append reports `updates.updatedCells`. If any field is missing in the response, usage count is 0 (no exception).
- **JSON parse errors** on `values` propagate into the outer `except Exception` and become `error: "<ValueError str>"`.

## Side Effects

- **Database writes**: `api_usage_metrics` row per call via `save_api_usage_metric` with `service='google_sheets'`.
- **Broadcasts**: none.
- **External API calls**: Sheets API v4 - `spreadsheets().values().get/update/append`.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: OAuth via `auth_service.get_oauth_tokens("google")`.
- **Services**: Google Sheets API, `PricingService`, `Database`.
- **Python packages**: `google-api-python-client`.
- **Environment variables**: none.

## Edge cases & known limits

- `value_input_option='USER_ENTERED'` means strings like `=SUM(A1:A5)` are evaluated as formulas. Use `RAW` to write literal text that may otherwise be coerced.
- No row-count validation - writing a 10,000-row block will attempt it in a single call; Sheets API rejects bodies over the limit with a 413 surfaced as `HttpError`.
- `append` with `insert_data_option='OVERWRITE'` can clobber existing rows below the header; callers commonly want `INSERT_ROWS`.
- `range` for write is a start cell (e.g. `Sheet1!A1`); the API automatically expands to fit `values`. A too-small range is silently widened.
- `FORMULA` rendering returns formulas as-is for read; `UNFORMATTED_VALUE` returns native types (int/float/bool), `FORMATTED_VALUE` returns the user-visible string.

## Related

- **Skills using this as a tool**: [`sheets-skill/SKILL.md`](../../../server/skills/productivity_agent/sheets-skill/SKILL.md)
- **Companion nodes**: [`gmail`](./gmail.md), [`calendar`](./calendar.md), [`drive`](./drive.md), [`tasks`](./tasks.md), [`contacts`](./contacts.md)
- **Architecture docs**: `CLAUDE.md` -> "Google Workspace Nodes".
