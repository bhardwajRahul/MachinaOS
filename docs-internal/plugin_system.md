# Plugin System (Wave 11)

The MachinaOs plugin system is a class-based, declarative node
authoring model inspired by n8n's `INodeType`, Nango's
`providers.yaml`, Pipedream's app/component split, and Temporal's
activity pattern. One Python file under `server/nodes/<group>/<name>.py`
= one node. No cross-cutting edits.

**Status: shipped.** 111 plugin classes cover every node type in the
product across 9 Temporal worker queues; 124 pytest contract
invariants lock the architecture. `services/handlers/` shrank from
12.8K → 1.1K LOC across 16 → 4 files. See
[`server/nodes/README.md`](../server/nodes/README.md) for the
authoring cookbook (5-minute recipe + shared helpers + common
pitfalls).

## Quick start — adding a new node

```python
# server/nodes/search/example_search.py
from pydantic import BaseModel, Field
from services.plugin import (
    ActionNode, ApiKeyCredential, NodeContext, Operation, TaskQueue,
)


class ExampleCredential(ApiKeyCredential):
    id = "example_api"
    display_name = "Example Search"
    category = "Search"
    key_name = "X-API-Key"
    key_location = "header"


class ExampleParams(BaseModel):
    query: str = Field(..., min_length=1)
    max_results: int = Field(default=10, ge=1, le=50)


class ExampleOutput(BaseModel):
    results: list
    count: int


class ExampleSearchNode(ActionNode):
    type = "exampleSearch"
    display_name = "Example Search"
    icon = "asset:example"
    color = "#abcdef"
    group = ("search", "tool")
    description = "Example search via external API"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    credentials = (ExampleCredential,)
    task_queue = TaskQueue.REST_API
    usable_as_tool = True
    Params = ExampleParams
    Output = ExampleOutput

    @Operation("search")
    async def search(self, ctx: NodeContext, params: ExampleParams) -> ExampleOutput:
        async with ctx.connection("example_api") as conn:
            resp = await conn.get(
                "https://api.example.com/search",
                params={"q": params.query, "limit": params.max_results},
            )
            resp.raise_for_status()
            data = resp.json()
        return ExampleOutput(results=data.get("hits", []), count=len(data.get("hits", [])))
```

**That's it.** On server restart:

- `BaseNode.__init_subclass__` eagerly registers the class into four
  registries: `NODE_METADATA`, `NODE_INPUT_MODELS`,
  `NODE_OUTPUT_SCHEMAS`, `_HANDLER_REGISTRY`.
- `_NODE_CLASS_REGISTRY` indexes the class itself so Temporal workers
  and tool dispatch can look it up by type.
- NodeSpec emits automatically via
  `GET /api/schemas/nodes/exampleSearch/spec.json`.
- `_PLUGIN_HANDLERS` merge in `NodeExecutor` makes it runnable.
- The node appears in the Component Palette under its group
  (search + tool) at the next browser reload.

## Architecture

### Class hierarchy

```
BaseNode (services/plugin/base.py)
├── ActionNode   fire-once, {success, result} envelope
├── TriggerNode  long-lived, event (event_waiter) or polling modes
└── ToolNode     AI-invoked, flat return (no success wrapper)
```

Every subclass auto-registers on import. Pure-visual or abstract
intermediaries pass `abstract=True` in the class definition:

```python
class SpecializedAgentBase(ActionNode, abstract=True):
    ...
```

### Class attributes

| Attribute | Purpose |
|---|---|
| `type` | Node type string. Matches workflow JSON + registry key. |
| `version` | Int, bumped on breaking changes. Activity name includes it. |
| `display_name` / `subtitle` / `description` | Palette + panel header. |
| `icon` | `asset:<key>` / `<lib>:<brand>` / URL / emoji. |
| `color` | Hex or Dracula token. |
| `group` | Tuple of palette groupings (first is primary). |
| `component_kind` | Frontend dispatch: `square` / `trigger` / `agent` / `tool` / `model` / `start` / `generic`. |
| `handles` | React Flow handle topology (`input-main`, `output-main`, …). |
| `ui_hints` | Dict of panel flags (`hasCodeEditor`, `isMemoryPanel`, …). |
| `annotations` | Pipedream-style: `destructive` / `readonly` / `open_world`. |
| `credentials` | Tuple of `Credential` subclasses the node uses. |
| `Params` | Pydantic `BaseModel` — user-facing parameters. Used for both UI rendering and AI tool schemas. |
| `Output` | Pydantic `BaseModel` — runtime output shape. |
| `usable_as_tool` | `ActionNode` flag — mints a ToolNode adapter for AI invocation. |
| `task_queue` | Temporal worker pool. See `TaskQueue` constants. |
| `retry_policy` | `RetryPolicy` dataclass (mirrors `temporalio.common.RetryPolicy`). |
| `start_to_close_timeout` / `heartbeat_timeout` | Per-node Temporal knobs. |

### Params schema conventions

**snake_case everywhere.** Field names are the JSON Schema keys, the UI
parameter keys, and the `displayOptions.show` reference keys. Keeping
a single naming convention makes cross-references trivially correct.

- No `alias="camelName"` on `Field(...)`.
- No `populate_by_name=True` in `model_config`.
- No `model_dump(by_alias=True)` in handlers — call `model_dump()` or
  read typed attributes off the validated `params` object.
- `displayOptions.show["driver_field"]` must match a Pydantic field
  name in the same `Params` class. The frontend's visibility evaluator
  looks up that exact key.

Example:

```python
class ExampleParams(BaseModel):
    operation: Literal["send", "search"] = Field(default="send")
    recipient: str = Field(
        default="",
        description="Email recipient",
        json_schema_extra={"displayOptions": {"show": {"operation": ["send"]}}},
    )
    query: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["search"]}}},
    )
    model_config = ConfigDict(extra="ignore")
```

Option labels (the `name` shown in dropdowns) ride on `json_schema_extra`:

```python
operation: Literal["send", "search"] = Field(
    default="send",
    json_schema_extra={"options": [
        {"name": "Send", "value": "send"},
        {"name": "Search", "value": "search"},
    ]},
)
```

If a user-facing input needs multi-line, a password mask, or a code
editor, set those via `json_schema_extra` keys the adapter lifts into
`typeOptions`: `rows`, `password`, `editor`, `editorLanguage`,
`dynamicOptions`, `loadOptionsMethod`, `numberStepSize`, `widget`,
`accept`.

### Operations (`@Operation`)

A multi-op node declares multiple methods, each decorated with
`@Operation("name")`. `BaseNode._pick_operation` reads
`parameters.operation` to choose which to run.

```python
@Operation("send", cost={"service": "gmail", "action": "send", "count": 1})
async def send(self, ctx: NodeContext, params: GmailParams) -> Any: ...

@Operation("search")
async def search(self, ctx: NodeContext, params: GmailParams) -> Any: ...

@Operation("read")
async def read(self, ctx: NodeContext, params: GmailParams) -> Any: ...
```

Single-op nodes use one method; `parameters.operation` can be omitted.

### Declarative REST via `Routing`

For pure REST integrations, leave the op body empty and attach a
`Routing` object:

```python
@Operation("search", routing=Routing(
    request=RoutingRequest(
        method="GET",
        url="https://api.example.com/search",
        qs={"q": "={{params.query}}"},
        headers={"X-API-Key": "={{credentials.api_key}}"},
    ),
    output=RoutingOutput(
        post_receive=[PostReceiveAction(type="root_property", property="data.hits")],
    ),
))
async def search(self, ctx, params): pass  # body unused — routing handles it
```

Supported `post_receive` strategies: `root_property`, `limit`,
`filter`, `set`.

### Connection facade (Nango pattern)

Plugins never see tokens. `ctx.connection(credential_id)` returns an
authed `httpx`-compatible client:

```python
async with ctx.connection("brave_search") as conn:
    resp = await conn.get(url, params={"q": query})
    # X-Subscription-Token header auto-injected by Credential.inject()
```

401/403 responses trigger one refresh-and-retry transparently.

### Credentials

Declarative credentials live **in each node folder's `_credentials.py`**
(Wave 11.E.1) — same "one domain owns its own code" principle as
`_base.py` and `_inline.py` helpers. Three base classes (stay in
`services/plugin/credential.py` as infrastructure):

- `ApiKeyCredential` — header / query / bearer injection.
- `OAuth2Credential` — `Authorization: Bearer <access_token>` with
  auto-refresh via `auth_service.get_oauth_tokens`.
- `Credential` — fully custom (override `resolve()` + `inject()`).

Auto-discovery rides on node-package import. When
`nodes/__init__.py:pkgutil.walk_packages` imports a plugin module,
that module's `from ._credentials import XCredential` statement
imports the sibling `_credentials.py`, which triggers
`Credential.__init_subclass__` → writes to `CREDENTIAL_REGISTRY`
*before* the plugin class is defined. The walker skips
underscore-prefixed files, so `_credentials.py` is never
double-imported. Contract invariant
`test_credentials_are_registered` ensures every declared credential
on a plugin resolves to a registered class.

**Shipped credentials** (Wave 11.E → E.1):

| File | Class(es) | Auth | Covers |
|---|---|---|---|
| `nodes/google/_credentials.py` | `GoogleCredential` | oauth2 | gmail, calendar, drive, sheets, tasks, contacts, gmailReceive |
| `nodes/location/_credentials.py` | `GoogleMapsCredential` | api_key (query) | gmaps_create / gmaps_locations / gmaps_nearby_places |
| `nodes/twitter/_credentials.py` | `TwitterCredential` | oauth2 | twitterSend / twitterSearch / twitterUser / twitterReceive |
| `nodes/telegram/_credentials.py` | `TelegramCredential` | api_key | telegramSend / telegramReceive |
| `nodes/scraper/_credentials.py` | `ApifyCredential` | api_key (bearer) | apifyActor |
| `nodes/model/_credentials.py` | `OpenAI / Anthropic / Gemini / OpenRouter / Groq / Cerebras / DeepSeek / Kimi / Mistral / Xai` | api_key | 9 chat models (xAI reserved) |
| `nodes/search/*.py` (inline) | `BraveSearch / Serper / Perplexity` | api_key | single-use search nodes |

`GoogleCredential` exposes a `build_credentials()` classmethod that
returns a `google.oauth2.credentials.Credentials` — hand-off to
`googleapiclient.discovery.build(...)` is unchanged from Wave 11.D.4.

Agents (aiAgent / chatAgent / 13 specialized) stay `credentials = ()`
because they are poly-provider — the user picks the provider at
runtime via `params.provider`, so declaring any single credential
would be misleading.

### Shared agent helpers

Every agent plugin (ai_agent, chat_agent, 13 specialized agents, team
leads) calls one helper:

```python
from ._inline import prepare_agent_call

kwargs = await prepare_agent_call(
    node_id=ctx.node_id, node_type=self.type,
    parameters=params.model_dump(),
    context=ctx.raw, database=database,
    log_prefix=f"[{self.type}]",
)
response = await ai_service.execute_chat_agent(ctx.node_id, **kwargs)
```

`prepare_agent_call` wraps the shared edge-walker
(`services/plugin/edge_walker.py`) + task context injection +
auto-prompt fallback + team-lead teammate injection. Plugin-specific
logic stays in the `execute_op` method.

### Temporal per-node activities (Wave 11.F)

Every `BaseNode` subclass exposes `cls.as_activity()`, a Temporal
`@activity.defn`-decorated callable with name
`node.{type}.v{version}`. Collect them for worker registration:

```python
from services.temporal.plugin_activities import (
    collect_plugin_activities,
    distinct_task_queues,
)

# Single-queue workers:
activities = collect_plugin_activities(task_queue="ai-heavy")
worker = Worker(client, task_queue="ai-heavy", activities=activities, ...)

# Multi-queue pool (one worker per queue):
from services.temporal.worker import TemporalWorkerPool
pool = TemporalWorkerPool(client)  # defaults to all declared queues
await pool.start()
```

Queue distribution (current state):

| Queue | Plugins | Default concurrency |
|---|---|---|
| `ai-heavy` | 28 | 4 |
| `rest-api` | 21 | 50 |
| `machina-default` | 25 | 20 |
| `android` | 16 | 10 |
| `messaging` | 7 | 20 |
| `triggers-event` | 5 | 100 |
| `triggers-poll` | 4 | 100 |
| `code-exec` | 3 | 10 |
| `browser` | 2 | 4 |

Env overrides: `TEMPORAL_<QUEUE>_CONCURRENCY` (e.g.
`TEMPORAL_AI_HEAVY_CONCURRENCY=8`).

### Trigger registry auto-populate (Wave 11.D.11)

`services/event_waiter.py:TRIGGER_REGISTRY` + `FILTER_BUILDERS` are
backfilled from plugin `TriggerNode` subclasses on first access. A
plugin declaring `event_type` + `build_filter` auto-registers — no
hand-edit of `event_waiter.py` required.

Hardcoded entries still win when present (authoritative), so plugin
upgrades never silently replace hand-tuned filter behaviour.

## Folder layout

```
server/
├── nodes/                        # One file per node
│   ├── __init__.py              # pkgutil.walk_packages discovery
│   ├── groups.py                # Palette group metadata
│   ├── agent/                   # AI agents (aiAgent, chatAgent, 13 specialized)
│   │   ├── _handles.py          # Shared handle topology helpers
│   │   ├── _inline.py           # prepare_agent_call()
│   │   ├── _specialized.py      # SpecializedAgentBase
│   │   └── <agent>.py
│   ├── model/                   # AI chat models (9 providers)
│   │   ├── _base.py             # ChatModelBase + ChatModelParams/Output
│   │   └── <provider>_chat_model.py
│   ├── android/                 # 16 Android service nodes
│   │   ├── _base.py             # AndroidServiceBase
│   │   └── <service>.py
│   ├── code/                    # python/js/ts executors
│   │   ├── _base.py             # CodeExecutorBase
│   │   ├── _nodejs.py           # Shared NodeJSClient singleton
│   │   └── <lang>_executor.py
│   ├── filesystem/              # file_read / file_modify / shell / fs_search
│   │   ├── _backend.py          # Shared LocalShellBackend helper
│   │   └── <op>.py
│   ├── document/                # http_scraper / parser / chunker / embedding / vector
│   │   ├── _helpers.py          # delegate() wrapper
│   │   └── <stage>.py
│   ├── google/                  # gmail / calendar / drive / sheets / tasks / contacts
│   ├── proxy/                   # proxy_request / proxy_config / proxy_status
│   │   └── _usage.py            # Shared track_proxy_usage
│   ├── search/                  # brave / serper / perplexity / duckduckgo
│   ├── scraper/                 # apify / crawlee
│   ├── tool/                    # calculator / currentTime / taskManager / writeTodos
│   ├── trigger/                 # webhookTrigger / chatTrigger / taskTrigger
│   ├── workflow/                # start
│   ├── scheduler/               # cronScheduler / timer
│   ├── whatsapp/                # whatsappSend / whatsappDb / whatsappReceive
│   ├── telegram/                # telegramSend / telegramReceive
│   ├── twitter/                 # twitterSend / search / user / receive
│   ├── email/                   # emailSend / emailRead / emailReceive
│   ├── chat/                    # chatSend / chatHistory
│   ├── social/                  # socialSend / socialReceive
│   ├── browser/                 # browser (agent-browser CLI)
│   ├── utility/                 # httpRequest / webhookResponse / console / team_monitor / process_manager
│   ├── text/                    # textGenerator / fileHandler
│   ├── location/                # gmaps_create / gmaps_locations / gmaps_nearby_places
│   └── skill/                   # simpleMemory / masterSkill
│                                # Each group folder owns its own
│                                # _credentials.py (Wave 11.E.1) —
│                                # no central credentials package.
└── services/
    ├── plugin/                  # Plugin runtime
    │   ├── base.py              # BaseNode
    │   ├── action.py / trigger.py / tool.py
    │   ├── operation.py         # @Operation decorator + collector
    │   ├── routing.py           # Declarative REST DSL
    │   ├── credential.py        # Credential base classes
    │   ├── connection.py        # Nango-style authed httpx wrapper
    │   ├── context.py           # NodeContext dataclass
    │   ├── scaling.py           # TaskQueue / RetryPolicy
    │   ├── edge_walker.py       # collect_agent_connections / collect_teammate_connections
    │   └── interceptor.py       # Interceptor ABC + chain
    ├── node_registry.py         # register_node + _NODE_CLASS_REGISTRY + helpers
    ├── node_spec.py             # NodeSpec envelope emission
    └── temporal/
        ├── plugin_activities.py # collect_plugin_activities / distinct_task_queues
        └── worker.py            # TemporalWorkerManager + TemporalWorkerPool
```

## Contract invariants

`server/tests/test_plugin_contract.py` — 16 invariants enforced on
every CI run. Examples:

- Non-empty `type` / `display_name` / `group` per class.
- `Params` + `Output` must be Pydantic `BaseModel` subclasses.
- Every declared `credentials` entry resolves to a registered class.
- Operation names unique per class.
- `routing=...` requires `credentials` declared.
- `task_queue` ∈ `TaskQueue.ALL`.
- Every `ToolNode` JSON schema has no `$defs` / `$ref` (LLM-compat).
- Every event-mode `TriggerNode` declares `event_type`.
- Fast-path covers every AI-tool-usable plugin (no hardcoded schema
  dependency).
- Trigger registry auto-populates for every event-mode plugin.

108 Wave 10 invariants in `test_node_spec.py` still run — 124 total.

## Canonical principles

1. **One file = one node.** Adding a new node never edits multiple
   files. The filesystem location matches the palette group.
2. **Backend is SSOT.** Node declaration, visual metadata, handlers,
   schemas, credentials, icons — one authoring location.
3. **No frontend fallbacks.** Missing data surfaces as a visible gap
   so the backend bug is obvious, not masked.
4. **Stateful services stay in `services/`.** AIService, MapsService,
   NodeJSClient, etc. Plugins call them; never inline them.
5. **Per-handler helpers move WITH the handler.**
   `_format_console_output`, `_extract_text`, … inline into the
   plugin file. Cross-handler helpers (like `edge_walker`) extract
   to shared modules.
6. **Container injection.** Plugins do
   `from core.container import container; svc = container.X()` —
   never instantiate services directly.
7. **Pydantic for everything.** Params, Output, Credential config,
   Routing — all Pydantic. Validation at the boundary, typed at the
   core.

## Migration history (for future readers)

- Wave 6 — Output schemas on backend.
- Wave 10 — Input schemas + metadata on backend; `@register_node`
  decorator (dict form); filesystem-as-catalog.
- Wave 11.A — `services/plugin/` package with `BaseNode` hierarchy.
- Wave 11.B — Reference migrations (5 nodes across all kinds).
- Wave 11.B.1 — Unified tool dispatch via plugin fast-path.
- Wave 11.C — 111/111 nodes migrated across 5 batches; folder layout
  mirrors palette groups.
- Wave 11.D.0 — `edge_walker` extracted to services/plugin/.
- Wave 11.D.1-6 — Handler bodies inlined into plugins (trivial
  wrappers, code executors, HTTP/proxy, polling triggers, agents).
- Wave 11.D.4 — Google Workspace (gmail / calendar / drive / sheets /
  tasks / contacts) inlined under `nodes/google/`, shared
  `_base.py` + `_gmail.py` helpers.
- Wave 11.D.7 — Document pipeline (httpScraper, fileDownloader,
  documentParser, textChunker, embeddingGenerator, vectorStore)
  inlined under `nodes/document/`.
- Wave 11.D.8 — Twitter / Crawlee / Apify inlined. Twitter shares
  `nodes/twitter/_base.py` for client + XDK helpers.
- Wave 11.D.9 — WhatsApp + Social inlined into `nodes/whatsapp/_base.py`
  and `nodes/social/_base.py` (full bodies, RPC dispatch via
  `services.whatsapp_service`; renamed from `routers/whatsapp.py` in
  Wave 11.E.2 since it was never an APIRouter).
- Wave 11.D.10 — `utility.py` split across 12 plugin files (maps,
  text, workflow start, timer, cron, console, team monitor, chat).
- Wave 11.D.11 — Auto-populate trigger registries.
- Wave 11.D.12 — Fast-path contract invariants.
- Wave 11.D.13 — Sunset empty bulk files + dead dispatch.
- Wave 11.F — Per-plugin Temporal activities + worker pools.
- Wave 11.E — Declarative credentials: 18 `Credential` subclasses
  (GoogleCredential + GoogleMapsCredential + TwitterCredential +
  TelegramCredential + ApifyCredential + 10 LLM providers + 3 inline
  search credentials). 29 plugins now declare `credentials = (...)`.
  Agents stay poly-provider (empty tuple).
- Wave 11.E.1 — Modularised credentials into per-domain
  `nodes/<group>/_credentials.py` files. `server/credentials/`
  directory deleted; auto-discovery rides on node-package import.
- Wave 11.E.2 — Dead-code sweep: fixed 2 broken agent imports,
  stripped 13 dead dispatch branches in `tools.py`, deleted duplicate
  `handlers/proxy.py`, moved misnamed `routers/whatsapp.py` →
  `services/whatsapp_service.py`, dedup'd `TRIGGER_NODE_TYPES`.
- Wave 11.E.3 — Inlined the last per-domain handler bodies into
  plugins. Deleted 8 fully-orphan handler files (search, code,
  telegram, http, filesystem, email, process, todo) and 5
  still-referenced ones (browser, android, claude_code, rlm,
  deep_agent) by inlining into their plugins. Split `handlers/ai.py`
  4 ways: `handle_ai_chat_model` → `ChatModelBase.chat`,
  `handle_simple_memory` → `SimpleMemoryNode.read`,
  `handle_ai_agent` / `handle_chat_agent` → deleted entirely.
  `tools.py:_execute_delegated_agent` now looks up the child agent's
  plugin class via `services.node_registry.get_node_class(node_type)`,
  builds `NodeContext.from_legacy(...)`, and calls
  `instance.execute(node_id, params, ctx)` directly — no handler shell
  in the path.
- Wave 11.E.4 — Relocated `tools.py` movables: proxyConfig 10-op
  matrix → `nodes/proxy/proxy_config.execute_proxy_config` (shared by
  the plugin's `dispatch` op and the AI-tool branch in `tools.py`);
  Android AI-tool dispatch (toolkit + direct service) →
  `nodes/android/_base.{execute_android_toolkit,
  execute_android_service_tool}` with a single canonical
  `SERVICE_ID_MAP` and a shared `_execute_with_broadcast` helper
  (previously duplicated in `tools.py`). `tools.py` from 1,255 → 821
  LOC.
- Wave 11.G — Nodes cookbook (`server/nodes/README.md`) + CLAUDE.md
  plugin section + this file refreshed to match shipped state.

`services/handlers/` is now **4 files / 1,112 LOC** (down from 16
files / 12,800 LOC):

| File | LOC | Purpose |
|---|---|---|
| `tools.py` | 821 | AI-tool dispatcher, plugin fast-path, agent delegation infrastructure (shared `_delegated_tasks` / `_delegation_results` state). |
| `google_auth.py` | 142 | Shared OAuth helper for the 7 Google plugins. |
| `triggers.py` | 126 | Generic event-trigger handler for `twitterReceive` and other polling triggers. |
| `__init__.py` | 23 | Package docstring; nothing imports from `services.handlers` at package level. |

Every domain owns its own code under `nodes/<group>/` — plugin file +
optional `_base.py` / `_inline.py` / `_credentials.py` siblings. No
handler shells, no central credential registry, no cross-domain reach.
