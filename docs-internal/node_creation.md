# Node Creation Guide

> **Canonical recipe:** [Plugin System (Wave 11)](./plugin_system.md) and the inline [Nodes Cookbook](../server/nodes/README.md) next to the plugin files.

This file is a redirect. New nodes use the class-based `ActionNode` / `TriggerNode` / `ToolNode` hierarchy under `server/nodes/<group>/<name>.py`. Each subclass declares `type`, metadata, `Params` + `Output` Pydantic models, `credentials`, `handles`, `task_queue`, and operations on the class object; `BaseNode.__init_subclass__` writes to the four legacy registries (`NODE_METADATA`, `_DIRECT_MODELS`, `NODE_OUTPUT_SCHEMAS`, `_HANDLER_REGISTRY`) plus the class registry on import. No frontend edits.

## Where to look

| Need | Doc |
|------|-----|
| 5-minute recipe, folder map, shared helpers | [server/nodes/README.md](../server/nodes/README.md) |
| Full plugin pattern, `@Operation`, declarative `Routing`, `Connection` facade, Temporal task queues, credential classes | [plugin_system.md](./plugin_system.md) |
| Backend-as-SSOT design (NodeSpec, icons, output schemas) | [schema_source_of_truth_rfc.md](./schema_source_of_truth_rfc.md) |
| JSON workflow format, edge handle conventions | [workflow-schema.md](./workflow-schema.md) |
| AI-tool nodes (dual-purpose or dedicated) | [ai_tool_node_creation.md](./ai_tool_node_creation.md), [dual_purpose_tool_node_creation.md](./dual_purpose_tool_node_creation.md) |
| Specialized AI agents | [specialized_agent_node_creation.md](./specialized_agent_node_creation.md) |

## Wave 11 end state

- 111 plugins across 9 Temporal worker pools (`rest-api`, `ai-heavy`, `code-exec`, `triggers-poll`, `triggers-event`, `android`, `browser`, `messaging`, `machina-default`).
- Per-domain `_credentials.py` in each node folder (18 `Credential` subclasses; central `server/credentials/` was deleted in Wave 11.E.1).
- `services/handlers/` shrank to 4 files / 1.1K LOC — only cross-cutting orchestration remains (`tools.py` AI-tool dispatch + agent delegation, `google_auth.py`, `triggers.py`).
- Agent delegation invokes child agents through `BaseNode.execute()` via the node registry.
- 124 pytest invariants in `tests/test_node_spec.py` lock the contract.
