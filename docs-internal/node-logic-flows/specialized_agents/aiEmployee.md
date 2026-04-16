# AI Employee (`ai_employee`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Frontend definition** | [`client/src/nodeDefinitions/specializedAgentNodes.ts`](../../../client/src/nodeDefinitions/specializedAgentNodes.ts) (search `ai_employee`) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.purple` |
| **Icon** | people / briefcase (U+1F465) |
| **Team lead** | **yes** -- `input-teammates` handle enabled |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

Team-lead agent identical in behaviour to `orchestrator_agent`. Distinct
only in frontend presentation (different icon, theme color, default
labels) and an extra `maxConcurrent` parameter. Backend routing is the
same: `handle_chat_agent` -> `_collect_teammate_connections` ->
teammates appended to `tool_data` as `delegate_to_*` tools.

## What is unique to this node

- **`input-teammates` handle** (same as `orchestrator_agent`).
- **`teamMode` parameter** (`parallel` / `sequential`, default `parallel`;
  no `""` option).
- **`maxConcurrent` parameter** (number, default `5`, range 1-20)
  controlling max concurrent task executions.
- **Frontend theming**: purple dracula accent.

## Behaviour

See **[Orchestrator Agent](./orchestratorAgent.md)** for the teammate
expansion details, and **[Generic Specialized Agent Pattern](./_pattern.md)**
for the shared contract.

## Edge cases

- Same as `orchestrator_agent`: non-agent teammates are silently skipped,
  and `maxConcurrent` / `teamMode` are passed through as parameters but
  not enforced by `handle_chat_agent` itself -- the `delegate_to_*`
  implementation owns concurrency.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Sibling team lead**: [`orchestratorAgent`](./orchestratorAgent.md)
- **Architecture**: [Agent Teams](../../agent_teams.md)
