# Orchestrator Agent (`orchestrator_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Frontend definition** | [`client/src/nodeDefinitions/specializedAgentNodes.ts`](../../../client/src/nodeDefinitions/specializedAgentNodes.ts) (search `orchestrator_agent`) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.cyan` |
| **Icon** | musical score (U+1F3BC) |
| **Team lead** | **yes** -- `input-teammates` handle enabled |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

Team-lead agent that coordinates multiple specialized agents. Teammates
are wired via the extra `input-teammates` handle and become
`delegate_to_<agent_type>` tools the orchestrator can call.

## What is unique to this node

- **`input-teammates` handle** (extra input beyond the shared 5).
- **`teamMode` parameter** (`""` / `parallel` / `sequential`) controlling
  how delegate_to_* calls are executed.
- **Team lead detection**: `handle_chat_agent` checks `node_type in
  TEAM_LEAD_TYPES = {'orchestrator_agent', 'ai_employee'}` and calls
  `_collect_teammate_connections` to expand teammates into tools.
- **Frontend theming**: cyan dracula accent.

## Teammate collection

`_collect_teammate_connections(node_id, context, database)` in
`handlers/ai.py`:

1. Scans `context.edges` for `edge.target == node_id` and
   `edge.targetHandle == 'input-teammates'`.
2. Resolves the source node in `context.nodes`.
3. Filters to `node_type in AI_AGENT_TYPES`.
4. Loads `database.get_node_parameters(source_id)` for each teammate.
5. Returns a list of `{node_id, node_type, label, parameters}` dicts.

The teammates are then appended to `tool_data` before
`execute_chat_agent` is called, so the LLM sees them as ordinary tools.

## Behaviour

Inputs, parameters, outputs, logic flow -- see **[Generic Specialized
Agent Pattern](./_pattern.md)**. The only difference is the teammate
expansion above.

## Edge cases

- Non-`AI_AGENT_TYPES` nodes wired to `input-teammates` are silently
  skipped.
- `teamMode` is collected by `execute_chat_agent` but the actual
  parallel / sequential scheduling is not enforced at this layer -- it
  depends on how the downstream `delegate_to_*` tool implementation handles
  concurrent invocations.
- When zero teammates are connected, the node behaves identically to any
  other specialized agent.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Sibling team lead**: [`aiEmployee`](./aiEmployee.md)
- **Architecture**: [Agent Teams](../../agent_teams.md)
