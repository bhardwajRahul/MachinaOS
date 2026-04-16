# Android Control Agent (`android_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Frontend definition** | [`client/src/nodeDefinitions/specializedAgentNodes.ts`](../../../client/src/nodeDefinitions/specializedAgentNodes.ts) (search `android_agent`) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) (routed via registry) |
| **Theme color** | `dracula.green` |
| **Icon** | phone (U+1F4F1) |
| **AGENT_CONFIGS entry** | `AIAgentNode.tsx` key `android_agent` |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

AI agent pre-configured for Android device control. Users typically connect
Android service nodes (`batteryMonitor`, `wifiAutomation`, `appLauncher`,
etc.) directly to `input-tools`, or wire an `androidTool` toolkit, or attach
the `android_agent` folder via a Master Skill.

## What is unique to this node

- **Intended tool set**: Android service nodes (16 total) and the
  `androidTool` aggregator.
- **Intended skills**: `server/skills/android_agent/` (12 skills:
  personality, battery, wifi, bluetooth, location, etc.).
- **Frontend theming**: green dracula accent, phone emoji in component
  palette.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)** for the full
contract: inputs, parameters, outputs, logic flow, decision logic, side
effects, edge cases. This node routes to `handle_chat_agent` with no
behavioural differences from the other 12 variants.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Skills**: [`server/skills/android_agent/`](../../../server/skills/android_agent/)
