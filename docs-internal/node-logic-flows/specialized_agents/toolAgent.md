# Tool Agent (`tool_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Frontend definition** | [`client/src/nodeDefinitions/specializedAgentNodes.ts`](../../../client/src/nodeDefinitions/specializedAgentNodes.ts) (search `tool_agent`) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.yellow` |
| **Icon** | wrench (U+1F527) |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

Domain-agnostic AI agent for mixing arbitrary tools. Use when the intended
tool set spans multiple categories and no other specialized agent fits.

## What is unique to this node

- **Intended tool set**: any combination of workflow tool nodes.
- **Intended skills**: none pre-assigned; user wires whatever fits.
- **Frontend theming**: yellow dracula accent.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)**.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
