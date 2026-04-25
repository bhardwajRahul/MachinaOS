# Contacts (`googleContacts`)

| Field | Value |
|------|-------|
| **Category** | google_workspace / tool (dual-purpose) |
| **Backend handler** | [`server/services/handlers/contacts.py::handle_google_contacts`](../../../server/services/handlers/contacts.py) |
| **Tests** | [`server/tests/nodes/test_google_workspace.py`](../../../server/tests/nodes/test_google_workspace.py) |
| **Skill (if any)** | [`server/skills/productivity_agent/google-contacts-skill/SKILL.md`](../../../server/skills/productivity_agent/google-contacts-skill/SKILL.md) |
| **Dual-purpose tool** | yes - tool name `googleContacts` |

## Purpose

Consolidated Google Contacts node backed by the People API v1. One node, six
operations switched via the `operation` parameter. All payloads are flattened
through `_format_contact()` into a consistent simplified shape.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Template source for operation parameters |

## Parameters

Top-level dispatcher: `operation` (one of `create`, `list`, `search`, `get`, `update`, `delete`).

### `operation = create`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `first_name` | string | `""` | **yes** | Given name |
| `last_name` | string | `""` | no | Family name |
| `email` | string | `""` | no | - |
| `phone` | string | `""` | no | - |
| `company` | string | `""` | no | Organization name |
| `job_title` | string | `""` | no | - |
| `notes` | string | `""` | no | Stored as `biographies` with `contentType: TEXT_PLAIN` |

### `operation = list`

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `page_size` | number | `100` | - |
| `page_token` | string | `""` | Pagination cursor |
| `sort_order` | options | `LAST_MODIFIED_DESCENDING` | also `LAST_MODIFIED_ASCENDING`, `FIRST_NAME_ASCENDING`, `LAST_NAME_ASCENDING` |

### `operation = search`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `query` | string | `""` | **yes** | Name/email/phone fragment |
| `page_size` | number | `30` | no | - |

### `operation = get`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `resource_name` | string | `""` | **yes** | e.g. `people/c12345678` |

### `operation = update`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `resource_name` | string | `""` | **yes** | - |
| `first_name` / `last_name` / `email` / `phone` / `company` / `job_title` | string | `""` | no | Any provided field triggers its person field group to be replaced. **At least one patch field required.** |

Also accepts `update_first_name`, `update_last_name`, `update_email`,
`update_phone`, `update_company`, `update_job_title` aliases.

### `operation = delete`

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `resource_name` | string | `""` | **yes** | - |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Formatted contact(s) payload |
| `output-tool` | object | Same, for AI tool wiring |

### Formatted contact shape (`_format_contact`)

```ts
{
  resource_name: string;
  display_name: string;
  given_name: string;
  family_name: string;
  email: string;       // primary
  phone: string;       // primary
  company: string;
  job_title: string;
  photo_url: string;
  emails: string[];
  phones: string[];
}
```

- `list`: `{contacts: [...], count, total_people, next_page_token}`
- `search`: `{contacts: [...], count}`
- `delete`: `{deleted: true, resource_name}`

## Logic Flow

```mermaid
flowchart TD
  A[handle_google_contacts] --> AL{operation == update?}
  AL -- yes --> AM[Alias update_* params<br/>to plain names]
  AL -- no --> B
  AM --> B{operation?}
  B -- create --> C1[handle_contacts_create]
  B -- list --> C2[handle_contacts_list]
  B -- search --> C3[handle_contacts_search]
  B -- get --> C4[handle_contacts_get]
  B -- update --> C5[handle_contacts_update]
  B -- delete --> C6[handle_contacts_delete]
  B -- unknown --> Eret[success=false<br/>Unknown Contacts operation]
  C1 --> G[get_google_credentials + build people v1]
  C2 --> G
  C3 --> G
  C4 --> G
  C5 --> G
  C6 --> G
  G -- ValueError --> Eret
  C1 --> V1{first_name?}
  V1 -- no --> Eret
  V1 -- yes --> BB[Build names/emails/phones<br/>organizations/biographies]
  BB --> R1[people.createContact]
  C2 --> R2[people.connections.list<br/>personFields names emails phones<br/>organizations photos biographies]
  C3 --> V3{query?}
  V3 -- no --> Eret
  V3 -- yes --> R3[people.searchContacts]
  C4 --> V4{resource_name?}
  V4 -- no --> Eret
  V4 -- yes --> R4[people.get]
  C5 --> V5{resource_name?}
  V5 -- no --> Eret
  V5 -- yes --> G5[people.get etag -> build update body -> check updatePersonFields non-empty]
  G5 -- no fields --> Eret2[raise<br/>At least one field to update required]
  G5 -- ok --> R5[people.updateContact updatePersonFields=csv]
  C6 --> V6{resource_name?}
  V6 -- no --> Eret
  V6 -- yes --> R6[people.deleteContact]
  R1 --> T[_track_contacts_usage]
  R2 --> T
  R3 --> T
  R4 --> T
  R5 --> T
  R6 --> T
  T --> OUT[Return success envelope]
```

## Decision Logic

- **Dispatcher aliasing**: `update_*` params are copied over their plain counterparts (mutating input) before delegation.
- **Update requires etag**: `update` does a `people.get` first to fetch the current etag, then submits `updateContact` with `updatePersonFields` set to the comma-joined list of person field groups touched. If no field group was modified, raises `ValueError("At least one field to update is required")`.
- **Search requires query**: empty query -> `ValueError` captured by outer except.
- **Notes field on create**: non-empty `notes` writes a `biographies[0]` entry; empty notes skip the field. Cannot be cleared via update (not wired).
- **Format fallbacks**: `_format_contact` returns `""` for missing headers rather than `None`, so callers should not distinguish absence from empty.
- **`list` resource_name** is hard-coded to `people/me` - this node cannot list another user's contacts.

## Side Effects

- **Database writes**: `api_usage_metrics` row per call via `save_api_usage_metric` with `service='google_contacts'`. `list` DOES call `_track_contacts_usage`.
- **Broadcasts**: none.
- **External API calls**: People API v1 - `people().createContact/get/updateContact/deleteContact/searchContacts`, `people().connections().list`.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: OAuth via `auth_service.get_oauth_tokens("google")`.
- **Services**: Google People API, `PricingService`, `Database`.
- **Python packages**: `google-api-python-client`.
- **Environment variables**: none.

## Edge cases & known limits

- Primary email/phone detection uses `metadata.primary` - contacts with no explicit primary fall back to the first entry in the list, which may not match Google UI's primary.
- Update replaces entire field groups: passing `email` wipes any additional emails on the contact. The handler does not merge.
- `search` returns at most `page_size` results; there is no pagination wrapper.
- `delete` does not prompt or verify - the deletion is immediate and final on Google's side.
- An unused local statement `person.get('addresses', [])` exists in `_format_contact` without assignment - noted as dead code, not a bug.
- `update` requires at least one patch field; however the handler only treats first_name/last_name/email/phone/company/job_title. Notes and other fields cannot be updated here.

## Related

- **Skills using this as a tool**: [`contacts-skill/SKILL.md`](../../../server/skills/productivity_agent/google-contacts-skill/SKILL.md)
- **Companion nodes**: [`googleGmail`](./googleGmail.md), [`googleCalendar`](./googleCalendar.md), [`googleDrive`](./googleDrive.md), [`googleSheets`](./googleSheets.md), [`googleTasks`](./googleTasks.md)
- **Architecture docs**: `CLAUDE.md` -> "Google Workspace Nodes".
