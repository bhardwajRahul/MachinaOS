# Payments Agent (`payments_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Frontend definition** | [`client/src/nodeDefinitions/specializedAgentNodes.ts`](../../../client/src/nodeDefinitions/specializedAgentNodes.ts) (search `payments_agent`) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.green` |
| **Icon** | credit card (U+1F4B3) |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

AI agent pre-configured for payment processing and financial workflows.
No first-party payment tools ship with MachinaOs yet, so users typically
wire `httpRequest` against a payment provider (Stripe, Razorpay) as a tool.

## What is unique to this node

- **Intended tool set**: `httpRequest` against payment APIs.
- **Intended skills**: no dedicated `server/skills/payments_agent/` folder
  ships today -- the node is a naming / theming shell around
  `handle_chat_agent`.
- **Frontend theming**: green dracula accent.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)**.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
