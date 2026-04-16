# Autonomous Agent (`autonomous_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Frontend definition** | [`client/src/nodeDefinitions/specializedAgentNodes.ts`](../../../client/src/nodeDefinitions/specializedAgentNodes.ts) (search `autonomous_agent`) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.purple` |
| **Icon** | target (U+1F3AF) |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

AI agent pre-configured for autonomous multi-step operations using the
Code Mode patterns (agentic loops, progressive discovery, error recovery,
multi-tool orchestration). Claims 81-98% token savings when paired with
the autonomous skill pack.

## What is unique to this node

- **Intended tool set**: code executors + filesystem + HTTP, typically
  combined so the agent writes code to orchestrate other tools.
- **Intended skills**: `server/skills/autonomous/` (code-mode-skill,
  agentic-loop-skill, progressive-discovery-skill, error-recovery-skill,
  multi-tool-orchestration-skill).
- **Frontend theming**: purple dracula accent.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)**. Routes to the
same `handle_chat_agent` -- the "autonomous" behaviour comes entirely from
the attached skill content, not a different execution engine.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Skills**: [`server/skills/autonomous/`](../../../server/skills/autonomous/)
- **Architecture**: [Autonomous Agent Creation](../../autonomous_agent_creation.md)
