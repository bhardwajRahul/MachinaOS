# Web Control Agent (`web_agent`)

| Field | Value |
|------|-------|
| **Category** | specialized_agents |
| **Frontend definition** | [`client/src/nodeDefinitions/specializedAgentNodes.ts`](../../../client/src/nodeDefinitions/specializedAgentNodes.ts) (search `web_agent`) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_chat_agent`](../../../server/services/handlers/ai.py) |
| **Theme color** | `dracula.pink` |
| **Icon** | globe (U+1F310) |
| **Tests** | [`server/tests/nodes/test_specialized_agents.py`](../../../server/tests/nodes/test_specialized_agents.py) |

## Purpose

AI agent pre-configured for web automation. Typical tool connections:
`httpRequest`, `browser`, `crawleeScraper`, `apifyActor`, `proxyRequest`,
and any of the search nodes (`braveSearch`, `serperSearch`,
`perplexitySearch`, `duckduckgoSearch`).

## What is unique to this node

- **Intended tool set**: HTTP, browser, scrapers, proxies, search.
- **Intended skills**: `server/skills/web_agent/` (http-request-skill,
  browser-skill, crawlee-scraper-skill, apify-skill, proxy-config-skill,
  duckduckgo/brave/serper/perplexity search skills).
- **Frontend theming**: pink dracula accent.

## Behaviour

See **[Generic Specialized Agent Pattern](./_pattern.md)**.

## Related

- **Pattern doc**: [`_pattern.md`](./_pattern.md)
- **Skills**: [`server/skills/web_agent/`](../../../server/skills/web_agent/)
