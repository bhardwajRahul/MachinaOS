# Productivity Agent (`productivity_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.cyan` |
| **Icon** | clock (U+23F0) |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

AI agent pre-configured for Google Workspace productivity flows: email,
calendar, drive, sheets, tasks, contacts.

## What is unique to this node

- **Intended tool set**: `gmail`, `calendar`, `drive`, `sheets`, `tasks`,
  `contacts`, plus scheduling tools (`timer`, `cronScheduler`).
- **Intended skills**: `server/skills/productivity_agent/` (gmail-skill,
  calendar-skill, drive-skill, sheets-skill, tasks-skill, contacts-skill).
- **Frontend theming**: cyan dracula accent.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)**.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Skills**: [`server/skills/productivity_agent/`](../../../server/skills/productivity_agent/)
