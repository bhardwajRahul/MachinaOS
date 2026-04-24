# Social Media Agent (`social_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.green` |
| **Icon** | phone (U+1F4F1) |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

AI agent pre-configured for social messaging across WhatsApp, Telegram,
Twitter/X, and the unified `socialSend` node.

## What is unique to this node

- **Intended tool set**: `whatsappSend`, `whatsappDb`, `telegramSend`,
  `twitterSend`, `twitterSearch`, `twitterUser`, `socialSend`.
- **Intended skills**: `server/skills/social_agent/` (whatsapp-send-skill,
  whatsapp-db-skill, twitter-send-skill, twitter-search-skill,
  twitter-user-skill).
- **Frontend theming**: green dracula accent.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)**.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Skills**: [`server/skills/social_agent/`](../../../server/skills/social_agent/)
