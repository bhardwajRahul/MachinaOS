# Task Management Agent (`task_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.purple` |
| **Icon** | clipboard (U+1F4CB) |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

AI agent pre-configured for task scheduling and planning. Typical tool
connections: `timer`, `cronScheduler`, `taskManager`, `writeTodos`.

## What is unique to this node

- **Intended tool set**: scheduling, reminders, todo planning.
- **Intended skills**: `server/skills/task_agent/` (timer-skill,
  cron-scheduler-skill, task-manager-skill, write-todos-skill).
- **Frontend theming**: purple dracula accent.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)**.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Skills**: [`server/skills/task_agent/`](../../../server/skills/task_agent/)
