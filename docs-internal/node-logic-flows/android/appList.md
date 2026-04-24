# App List (`appList`)

| Field | Value |
|------|-------|
| **Category** | android / apps |
| **Backend handler** | [`server/services/handlers/android.py::handle_android_service`](../../../server/services/handlers/android.py) (shared) |
| **Tests** | [`server/tests/nodes/test_android.py`](../../../server/tests/nodes/test_android.py) |
| **Skill (if any)** | [`server/skills/android_agent/app-list-skill/SKILL.md`](../../../server/skills/android_agent/app-list-skill/SKILL.md) |
| **Dual-purpose tool** | sub-node of `androidTool`; connectable directly to any agent's `input-tools` |

## Purpose

Enumerate installed applications with package name, label, version, and other
metadata returned by the device-side service.

## Backend service mapping

| Field | Value |
|------|-------|
| `SERVICE_ID_MAP[appList]` | `app_list` |
| Default action | `list` |

## Parameters

Shared parameter set only. Filters (system/user apps, name contains, etc.) are
passed through `parameters` to the device.

## Logic Flow (node-specific slice)

```mermaid
flowchart TD
  A[Dispatch] --> B[service_id = 'app_list']
  B --> C[POST /api/app_list {action, parameters}]
  C --> D[Flatten data: apps array, count]
```

## Edge cases & known limits

- Full package listings can be large; response size is bounded only by the
  device handler and `httpx` timeout.
- Shared edge cases only otherwise.

## Related

- Skill: [`app-list-skill/SKILL.md`](../../../server/skills/android_agent/app-list-skill/SKILL.md)
- Sibling: [`appLauncher`](./appLauncher.md)
- Shared pattern: [`_pattern.md`](./_pattern.md)
