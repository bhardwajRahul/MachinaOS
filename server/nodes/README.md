# `server/nodes/` — plugin cookbook

**One file = one node.** Drop a Python file in the right subfolder and
it auto-registers at import time. No other code needs to change.

Full reference: [docs-internal/plugin_system.md](../../docs-internal/plugin_system.md).

---

## Five-minute recipe

```python
# server/nodes/search/acme_search.py
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Literal, Optional

from credentials.llm import OpenAICredential  # or your provider
from services.plugin import (
    ActionNode, ApiKeyCredential, NodeContext, Operation, TaskQueue,
)


# 1. Credential (or import a shared one from server/credentials/).
class AcmeCredential(ApiKeyCredential):
    id = "acme"
    display_name = "Acme Search"
    category = "Search"
    key_name = "X-Acme-Token"
    key_location = "header"


# 2. Params — user-visible config (UI + LLM tool schema).
class AcmeParams(BaseModel):
    query: str = Field(..., min_length=1)
    max_results: int = Field(default=10, ge=1, le=100, alias="maxResults")
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


# 3. Output — runtime result shape.
class AcmeOutput(BaseModel):
    results: List[dict] = Field(default_factory=list)
    count: int = 0


# 4. The node.
class AcmeSearchNode(ActionNode):
    type = "acmeSearch"
    display_name = "Acme Search"
    icon = "asset:acme"
    color = "#abcdef"
    group = ("search", "tool")
    description = "Search Acme's web index"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    credentials = (AcmeCredential,)
    task_queue = TaskQueue.REST_API
    usable_as_tool = True
    Params = AcmeParams
    Output = AcmeOutput

    @Operation("search")
    async def search(self, ctx: NodeContext, params: AcmeParams) -> AcmeOutput:
        async with ctx.connection("acme") as conn:
            resp = await conn.get(
                "https://api.acme.com/search",
                params={"q": params.query, "limit": params.max_results},
            )
            resp.raise_for_status()
            data = resp.json()
        hits = data.get("hits", [])
        return AcmeOutput(results=hits, count=len(hits))
```

On server restart this node is:
- in the Component Palette under `search` and `tool`
- runnable via the run button (REST API worker pool)
- invokable by any AI Agent connected to its `output-main`
- emitted as NodeSpec at `GET /api/schemas/nodes/acmeSearch/spec.json`

No other edits. Zero frontend changes.

---

## Folder map

Match the palette group. Current folders (see
[`groups.py`](./groups.py) for the canonical list):

```
agent/       — AI agents (ai_agent, chat_agent, 13 specialized, team leads)
model/       — LLM chat models (openai, anthropic, gemini, …)
android/     — Android device services
google/      — Google Workspace (gmail / calendar / drive / sheets / …)
twitter/     — Twitter/X (send / search / user / receive)
telegram/    — Telegram bot (send / receive)
whatsapp/    — WhatsApp (send / db / receive)
social/      — Unified social (send / receive)
email/       — IMAP/SMTP via Himalaya CLI
search/      — Web search APIs (brave / serper / perplexity / duckduckgo)
scraper/     — Apify / Crawlee
document/    — RAG pipeline (scrape / download / parse / chunk / embed / store)
code/        — Python / JS / TS executors
filesystem/  — file_read / file_modify / shell / fs_search
proxy/       — Residential proxy (request / config / status)
location/    — Google Maps (create / locations / nearby places)
chat/        — chatSend / chatHistory
text/        — textGenerator / fileHandler
scheduler/   — timer / cron_scheduler
trigger/     — Generic triggers (webhook / task / chat)
tool/        — calculatorTool / currentTimeTool / writeTodos / taskManager
utility/     — console / httpRequest / webhookResponse / processManager / team_monitor
workflow/    — start
skill/       — simpleMemory / masterSkill
browser/     — browser (agent-browser CLI)
```

---

## Shared helpers (one per domain)

Domains with 2+ plugins share a `_base.py` (or `_<name>.py`) in the
folder. If you're adding a new node in one of these domains, reuse
these first before writing new code:

| Folder | Helper | Purpose |
|---|---|---|
| `agent/` | `_inline.prepare_agent_call` | One-shot pre-dispatch for every agent (memory + skill + tool + teammate collection) |
| `agent/` | `_specialized.SpecializedAgentBase` | Base for 13 specialized agents |
| `model/` | `_base.ChatModelBase` | 9 chat models inherit → same `@Operation("chat")` body |
| `android/` | `_base.AndroidServiceBase` | 16 Android services inherit |
| `code/` | `_base.CodeExecutorBase` + `_nodejs.NodeJSClient` | Python/JS/TS executors |
| `google/` | `_base.build_google_service` / `track_google_usage` | 7 Google plugins (OAuth + API) |
| `google/` | `_gmail.fetch_email_details` / `mark_email_as_read` | gmail + gmail_receive |
| `twitter/` | `_base.call_with_retry` / `format_tweet` / `sync_search_recent` | 4 twitter plugins (XDK + refresh) |
| `whatsapp/` | `_base.*` | whatsappSend / whatsappDb |
| `social/` | `_base.*` | socialReceive / socialSend |

Cross-domain infrastructure lives in `services/plugin/` (e.g.
`edge_walker.py` for agent connection discovery, `routing.py` for
declarative REST).

---

## Shared credentials

For any new node reaching an external API, prefer a shared credential
under `server/credentials/` over an inline one:

```python
from credentials.google import GoogleCredential         # OAuth, 7 nodes
from credentials.google_maps import GoogleMapsCredential
from credentials.twitter import TwitterCredential
from credentials.telegram import TelegramCredential
from credentials.apify import ApifyCredential
from credentials.llm import (
    OpenAICredential, AnthropicCredential, GeminiCredential,
    OpenRouterCredential, GroqCredential, CerebrasCredential,
    DeepSeekCredential, KimiCredential, MistralCredential, XaiCredential,
)
```

Declare inline only when genuinely single-use (see
`nodes/search/brave_search.py` for the inline pattern).

---

## Contract invariants

`server/tests/test_plugin_contract.py` enforces 16 invariants on
every plugin. Common ones you'll trip:

- `type` / `display_name` / `group` must be non-empty.
- `Params` + `Output` must be Pydantic `BaseModel` subclasses.
- Every `@Operation` name unique per class.
- Every declared credential class must be registered
  (happens automatically via `__init_subclass__` — just import it).
- `routing=...` requires `credentials` declared.
- `task_queue` ∈ `TaskQueue.ALL` (`rest-api` / `ai-heavy` / `code-exec`
  / `triggers-poll` / `triggers-event` / `android` / `browser` /
  `messaging` / `machina-default`).
- Tool schemas (`usable_as_tool=True` or `ToolNode`) — no `$defs`,
  no `$ref` (LLM-compat).

Run: `pytest server/tests/test_plugin_contract.py -q`.

---

## Common pitfalls

- **Don't edit `server/nodes/__init__.py`** — it's a pure auto-discovery
  walker. Adding a new folder doesn't need edits either; `pkgutil` finds
  subpackages automatically.
- **Don't instantiate services directly.** Use
  `from core.container import container; svc = container.X()`.
- **Don't call `auth_service.get_api_key(...)` from plugins.** Declare
  a `Credential` subclass; the `Connection` facade / service layer
  resolves tokens.
- **Pydantic `extra="ignore"` is the default for Params** — extra fields
  silently drop. Use `extra="allow"` if the node passes unknown fields
  through to a handler.
- **Alias camelCase fields** via `Field(..., alias="camelName")` +
  `ConfigDict(populate_by_name=True)`. Frontend sends camelCase.
- **LLM tool schemas must be flat.** If your Params uses nested
  Pydantic models or `Union`, the LLM-schema emission will add `$defs`
  and fail the invariant. Keep tool-facing Params flat; move nested
  types to `Output` instead.

---

## Waves-at-a-glance

Added in Wave 11 (Mar 2026):

- **11.A**: `BaseNode` / `ActionNode` / `TriggerNode` / `ToolNode`
  + `@Operation` + `Routing` + `Connection` + `Credential`.
- **11.B/C**: 111 plugins migrated, folder layout adopted.
- **11.D**: Handler bodies inlined into plugins (handlers/ shrank
  ~12.8K → ~4.9K LOC).
- **11.E**: 18 declarative credentials, 29 plugins wired.
- **11.F**: Per-plugin Temporal activities, 9 worker pools with tuned
  concurrency.
- **11.G** (this doc): Cookbook.

Plan + migration history: [plugin_system.md](../../docs-internal/plugin_system.md).
