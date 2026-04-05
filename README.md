# MachinaOS

<a href="https://www.npmjs.com/package/machinaos" target="_blank"><img src="https://img.shields.io/npm/v/machinaos.svg" alt="npm version"></a>
<a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
<a href="https://discord.gg/c9pCJ7d8Ce" target="_blank"><img src="https://img.shields.io/discord/1455977012308086895?logo=discord&logoColor=white&label=Discord" alt="Discord"></a>
<a href="https://deepwiki.com/trohitg/MachinaOS" target="_blank"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

Personal AI Assistant/Co-Employees that Perform Human Like Tasks. Connect AI Assistant to your email, calendar, messages, phone, and more.

Mashup of N8N + Openclaw but with better visibility of what it's doing and also tighter control of what your AI Assistant can do.

## See It In Action ↓

https://github.com/user-attachments/assets/a30979e0-8066-4412-b466-cc3a70bcf3dd

## Full Capabilities ↓

https://github.com/user-attachments/assets/9785aefb-9424-4a80-bd83-bb1205fc70af

## Prerequisites

- **Node.js 22+** - https://nodejs.org/
- **Python 3.12+** - https://python.org/

## Quick Start

```bash
npm install -g machinaos
machina start
```

Open http://localhost:3000

<details>
<summary><b>One-Line Install (auto-installs dependencies)</b></summary>

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.ps1 | iex
```

</details>

<details>
<summary><b>Clone & Run (for developers)</b></summary>

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOS
npm run build
npm run dev
```

</details>

## What You Can Build

### Personal AI Assistants
Create AI agents that remember conversations, use tools, and work together. Choose from OpenAI, Claude, Gemini, DeepSeek, Kimi, Mistral, Groq, and 200+ models via OpenRouter.

### Automate Your Google Workspace
- Send and search emails
- Create calendar events
- Upload files to Drive
- Update spreadsheets
- Manage tasks and contacts

### Control Your Devices
- Send WhatsApp messages automatically
- Post to Twitter/X
- Send Telegram messages via bot
- Control your Android phone (WiFi, Bluetooth, apps, camera)
- Schedule tasks and reminders

### Process Documents
- Scrape websites
- Route requests through residential proxies with geo-targeting
- Run Apify actors for social media and search engine scraping
- Parse PDFs and documents
- Search your files with AI

### Build Agent Teams

```
                    +------------------+
                    |   AI Employee    |
                    |   (Team Lead)    |
                    +--------+---------+
                             | input-teammates
           +-----------------+------------------+
           |                 |                  |
    +------v------+   +------v------+   +-------v-----+
    | Coding Agent|   |  Web Agent  |   | Task Agent  |
    +-------------+   +-------------+   +-------------+
```

- **AI Employee / Orchestrator** - Team lead agents for coordinating multiple specialized agents
- **Intelligent Delegation** - AI decides when to delegate based on task context
- **Delegation Tools** - Connected agents become `delegate_to_*` tools automatically
- **13 Specialized Agents** - Android, Coding, Web, Task, Social, Travel, Tool, Productivity, Payments, Consumer, Autonomous, Orchestrator
- **Team Monitor** - Real-time visualization of team operations

### Run Code
- Execute Python, JavaScript, and TypeScript code
- Persistent Node.js server for fast JS/TS execution

## Visual Workflow Builder

Drag-and-drop interface to connect AI models, services, and triggers. No code required.

## Configuration

Click **Credentials** in the toolbar to add your API keys for AI providers, Google, WhatsApp, and Twitter.

## Documentation

Full docs: https://docs.zeenie.xyz/

## Community

Join our [Discord](https://discord.gg/NHUEQVSC) for help, feedback, and updates.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

---

## Nerdy Docs

A detailed look at how MachinaOS works under the hood. For the TL;DR just use the product; this section is for contributors, system designers, and the curious. For a deep, navigable tour the [DeepWiki badge](https://deepwiki.com/trohitg/MachinaOS) at the top of this README covers the same ground with hyperlinks. In-repo docs live under [docs-internal/](docs-internal/).

### System Overview

MachinaOS is three loosely-coupled tiers talking over a single persistent WebSocket connection:

```
+------------------------------------------------------------------------+
|  Frontend tier (client/)                                               |
|    React + TypeScript + React Flow + Zustand + Ant Design              |
|    Dracula-themed canvas, parameter panel, credentials modal           |
+------------------------------------------------------------------------+
                             |
                 WebSocket   |   /ws/status  (single long-lived connection)
                             v
+------------------------------------------------------------------------+
|  Backend tier (server/)                                                |
|    FastAPI + 89 WebSocket handlers + dependency injection container    |
|    WorkflowService (facade) -> NodeExecutor -> per-node handlers       |
|    ParameterResolver -> template {{node.field}} substitution           |
|    AuthService -> encrypted credentials (Fernet + PBKDF2)              |
+------------------------------------------------------------------------+
                             |
                             v
+------------------------------------------------------------------------+
|  Execution tier                                                        |
|    Temporal workers (distributed)  or  local asyncio decide loop       |
|    Redis (cache, locks, streams)   SQLite (machina.db, credentials.db) |
|    Node.js server (JS/TS code exec) WhatsApp RPC (port 9400)           |
|    Android relay WebSocket         Temporal server (ports 7233/8080)   |
+------------------------------------------------------------------------+
                             |
                             v
   External services: OpenAI, Anthropic, Gemini, OpenRouter, xAI,
   DeepSeek, Kimi, Mistral, Groq, Cerebras, Google Workspace, WhatsApp,
   Telegram, Twitter/X, Brave, Serper, Perplexity, Apify, residential
   proxies, webhooks.
```

Notable characteristics at a glance:

- **96 workflow nodes** across AI models, agents, social, Android, document processing, Google Workspace, code executors, proxies, and utilities
- **10 LLM providers**: OpenAI, Anthropic, Gemini, OpenRouter, xAI, DeepSeek, Kimi, Mistral, Groq, Cerebras
- **15 specialized agents**: android, coding, web, task, social, travel, tool, productivity, payments, consumer, autonomous, orchestrator, ai_employee, rlm, claude_code
- **89 WebSocket handlers** replacing most REST endpoints
- **49 built-in skills** across 10 categories (assistant, android_agent, autonomous, coding_agent, productivity_agent, rlm_agent, social_agent, task_agent, travel_agent, web_agent)
- **Three execution modes** with automatic fallback: Temporal distributed -> Redis parallel -> sequential
- **Encrypted credentials** stored in a separate SQLite database using Fernet + PBKDF2 (600K iterations)

<details>
<summary><b>Execution Engine</b></summary>

### Conductor's Decide Pattern

Workflow orchestration is a single function with fork/join parallelism:

```
_workflow_decide(ctx):
  1. Find ready nodes (all dependencies satisfied)
  2. asyncio.gather() the ready layer -> run in parallel
  3. Checkpoint state to Redis/SQLite
  4. Recurse until every node terminal (completed / skipped / failed)
```

Each workflow run has its own isolated `ExecutionContext` (`server/services/execution/models.py`). No shared global state between concurrent runs. Decide loops serialize per execution via Redis `SETNX` distributed locks.

### Three Execution Modes

```
workflow.execute(workflow_id, workflow_data)
                    |
                    v
    TEMPORAL_ENABLED and server reachable?
                    |
         yes -> _execute_temporal() -- per-node activities,
                                        retries, horizontal scaling
                                        (primary production mode)
          no -> Redis available?
                    |
             yes -> _execute_parallel() -- decide loop + Kahn layers
                                            + Prefect-style input hash cache
                                            + DLQ + heartbeat recovery
              no -> _execute_sequential() -- topological walk
                                             (fallback for minimal env)
```

### Layer Computation via Kahn's Algorithm

Before execution, the DAG is sorted into layers. Layer 0 is the set of nodes with no dependencies; each subsequent layer depends only on earlier layers. Parallel execution runs each layer with `asyncio.gather()`:

```
Layer 0: [start, cronScheduler]
Layer 1: [httpRequest, whatsappReceive]
Layer 2: [aiAgent]
Layer 3: [whatsappSend, console]
```

Toolkit sub-nodes (e.g., Android service nodes connected to `androidTool`) are detected and excluded from execution layers -- they run only when the parent toolkit invokes them via tool calling. See the Toolkit Sub-Node Execution Pattern in [CLAUDE.md](CLAUDE.md).

### Result Caching, Recovery, and DLQ

- **Prefect-style caching**: every node result is stored in Redis/SQLite keyed by `hash_inputs(inputs)`. Re-running an identical node returns the cached result with status `TaskStatus.CACHED`.
- **Heartbeat recovery**: `RecoverySweeper` scans `executions:active` every 60s; nodes with stale heartbeats (>5 min) are marked stuck and recovered on next startup.
- **Dead Letter Queue**: failed nodes (after retry exhaustion) are quarantined in `dlq:entries:*` with full input snapshot. Inspect, replay, or purge via the `get_dlq_*` / `replay_dlq_entry` / `purge_dlq` WebSocket handlers.

### Edge Conditions

Edges carry optional conditions for runtime branching with 20+ operators (`eq`, `neq`, `gt`, `lt`, `contains`, `exists`, `matches`, `in`, ...). Unmatched branches are marked `TaskStatus.SKIPPED`.

**Read more**: [DESIGN.md](docs-internal/DESIGN.md) - [TEMPORAL_ARCHITECTURE.md](docs-internal/TEMPORAL_ARCHITECTURE.md) - [workflow-schema.md](docs-internal/workflow-schema.md)

</details>

<details>
<summary><b>Event-Driven Deployment</b></summary>

Deployments are event-driven: each trigger event spawns an **independent concurrent execution run**. There is no iteration loop.

```
deploy_workflow(workflow_id)
        |
        v
  Set up triggers, return
        |
        +-> cronScheduler fires   -> ExecutionRun 1  (isolated context)
        +-> cronScheduler fires   -> ExecutionRun 2  (isolated context)
        +-> whatsappReceive fires -> ExecutionRun 3  (isolated context)
        +-> webhookTrigger fires  -> ExecutionRun 4  (isolated context)
        +-> telegramReceive fires -> ExecutionRun 5  (isolated context)
        +-> taskTrigger fires     -> ExecutionRun 6  (from delegated agent)
```

Multiple runs execute simultaneously with no interference. The firing trigger is marked complete before downstream execution starts; every other trigger node in the same run is auto-marked `_pre_executed` with `{not_triggered: True}` so they never block as event waiters.

### Push vs Polling Triggers

```
Push triggers (asyncio.Future + dispatch):
  whatsappReceive, webhookTrigger, chatTrigger, taskTrigger,
  telegramReceive, start

Polling triggers (asyncio.Queue + poll coroutine):
  twitterReceive   (X API has no webhook on free tier)
  gmailReceive     (Gmail push requires paid Google Cloud setup)

Scheduler:
  cronScheduler    (APScheduler directly, not through event waiter)
```

Every push trigger goes through the generic `event_waiter` module: register a `Waiter` with a filter closure, suspend on `wait_for_event()`, resume when an external service dispatches a matching event. Backend supports both in-memory (`asyncio.Future`) and Redis Streams modes for Temporal multi-worker deployments.

**Read more**: [event_waiter_system.md](docs-internal/event_waiter_system.md) - [workflow-schema.md](docs-internal/workflow-schema.md)

</details>

<details>
<summary><b>Node System (96 Nodes)</b></summary>

### INodeProperties Interface

Node definitions follow an n8n-inspired TypeScript interface system. Every node has a strongly-typed `INodeTypeDescription` with `displayName`, `group`, `inputs`, `outputs`, and `properties`. Parameters support conditional display via `displayOptions.show`, type-specific editors (string, number, boolean, options, collection, file, array), drag-and-drop template variable mapping, and live validation.

Source of truth: `client/src/nodeDefinitions/` (23 files).

### Category Breakdown

| Category | Count | File |
|---|---|---|
| AI Chat Models | 9 | `aiModelNodes.ts` |
| AI Agents + Memory | 3 | `aiAgentNodes.ts` |
| Specialized Agents | 15 | `specializedAgentNodes.ts` |
| AI Tools (dedicated) | 4 | `toolNodes.ts` |
| Skills (masterSkill) | 1 | `skillNodes.ts` |
| Search (dual-purpose) | 3 | `searchNodes.ts` |
| Location / Maps | 3 | `locationNodes.ts` |
| Google Workspace | 7 | `googleWorkspaceNodes.ts` |
| WhatsApp | 3 | `whatsappNodes.ts` |
| Twitter/X | 4 | `twitterNodes.ts` |
| Telegram | 2 | `telegramNodes.ts` |
| Social (unified) | 2 | `socialNodes.ts` |
| Android services | 16 | `androidServiceNodes.ts` |
| Code executors | 3 | `codeNodes.ts` |
| Document processing | 6 | `documentNodes.ts` |
| Utilities | 6 | `utilityNodes.ts` |
| Proxy | 3 | `proxyNodes.ts` |
| Web scraping | 2 | `apifyNodes.ts` + `crawleeNodes.ts` |
| Chat | 2 | `chatNodes.ts` |
| Schedulers | 2 | `schedulerNodes.ts` |
| Workflow triggers | 2 | `workflowNodes.ts` |

### Dispatch Registry (backend)

`NodeExecutor` in `server/services/node_executor.py` uses a registry built with `functools.partial` for dependency injection:

```python
registry = {
    'start':               handle_start,
    'aiAgent':             partial(handle_ai_agent, ai_service=self.ai_service, database=self.database),
    'chatAgent':           partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
    'rlm_agent':           partial(handle_rlm_agent, ai_service=self.ai_service, database=self.database),
    'gmail':               partial(handle_google_gmail, database=self.database),
    'whatsappSend':        partial(handle_whatsapp_send, database=self.database),
    # ... one entry per node type
}
```

No if-else chains, no global singletons.

### Dual-Purpose Nodes

Many nodes work as **both** workflow nodes and AI Agent tools. Examples: `whatsappSend`, `whatsappDb`, `twitterSend`, `twitterSearch`, `twitterUser`, `telegramSend`, `socialSend`, `httpRequest`, `pythonExecutor`, `javascriptExecutor`, `typescriptExecutor`, `braveSearch`, `serperSearch`, `perplexitySearch`, `apifyActor`, `proxyConfig`, `gmaps_locations`, `gmaps_nearby_places`, and all 7 Google Workspace nodes. When connected to an AI agent's `input-tools` handle, the LLM fills the node's parameter schema via structured tool calls.

### Config Node Pattern

Four special handles on agent nodes accept **config nodes** instead of main data flow:

| Handle | Purpose |
|---|---|
| `input-memory` | Connect a `simpleMemory` node for conversation history |
| `input-tools` | Connect tool nodes (dedicated tools or dual-purpose nodes) |
| `input-skill` | Connect skill nodes (`masterSkill` aggregator) |
| `input-teammates` | Connect other agents (team lead pattern only) |

Config nodes are automatically excluded from parallel execution layers and inherit their parent agent's main-input connections for template variable mapping.

**Read more**: [node_creation.md](docs-internal/node_creation.md) - [dual_purpose_tool_node_creation.md](docs-internal/dual_purpose_tool_node_creation.md) - [ai_tool_node_creation.md](docs-internal/ai_tool_node_creation.md)

</details>

<details>
<summary><b>AI Agent System</b></summary>

### 10 LLM Providers

| Provider | Native SDK Path | LangChain Path | Notes |
|---|---|---|---|
| OpenAI | yes (`providers/openai.py`) | yes | GPT 4.x/5.x + o-series reasoning |
| Anthropic | yes (`providers/anthropic.py`) | yes | Extended thinking via `budget_tokens` |
| Gemini | yes (`providers/gemini.py`) | yes (fallback) | Native bypasses LangChain Windows hang |
| OpenRouter | yes (`providers/openrouter.py`) | yes | 200+ models through one API |
| xAI | yes (shared OpenAIProvider) | yes | OpenAI-compatible |
| DeepSeek | yes (shared OpenAIProvider) | yes | Chat + Reasoner (always-on CoT) |
| Kimi | yes (shared OpenAIProvider) | yes | Moonshot K2.5 / K2-thinking |
| Mistral | yes (shared OpenAIProvider) | yes | Large / Small / Codestral |
| Groq | no (LangChain only) | yes | Llama 4, Qwen3, GPT-OSS |
| Cerebras | no (LangChain only) | yes | Llama, Qwen |

### Dual-Path Architecture

```
execute_chat(parameters)                        execute_agent(parameters)
  direct chat completions                         LangGraph tool-calling loop
        |                                               |
        v                                               v
is_native_provider(provider)?              create_model(provider, ...)
        |                                               |
   yes -+-- create_provider() -> LLMResponse            v
        |                                       LangChain ChatOpenAI /
    no -+-- create_model() -> chat_model                ChatAnthropic /
            .invoke() -> LLMResponse                    ChatGoogleGenerativeAI
                                                        |
                                                        v
                                                   bind_tools(...)
                                                        |
                                                        v
                                                 LangGraph StateGraph
                                                 (agent node <-> tools node loop)
```

The native path returns a normalized `LLMResponse` dataclass across all providers. The LangChain path is used for agent tool-calling because LangGraph's checkpointer, state graph, and tool-execution callback layer have no native equivalent today.

### 15 Specialized Agents

All specialized agents share the same handle architecture (`input-main`, `input-memory`, `input-skill`, `input-tools`, `input-task`) and inherit `AI_AGENT_PROPERTIES`. They only differ in icon, title, theme color, and default prompt.

```
android_agent      coding_agent        web_agent         task_agent
social_agent       travel_agent        tool_agent        productivity_agent
payments_agent     consumer_agent      autonomous_agent  orchestrator_agent
ai_employee        rlm_agent           claude_code_agent
```

Routing:

- **13 agents** route to `handle_chat_agent` (LangGraph loop, shared code path)
- **`rlm_agent`** routes to `handle_rlm_agent` -> `RLMService` (REPL-based recursive LM)
- **`claude_code_agent`** routes to `handle_claude_code_agent` -> Claude Code SDK

### Agent Teams Topology

`orchestrator_agent` and `ai_employee` have an extra `input-teammates` handle. Connected agents become `delegate_to_<agent_type>` tools automatically:

```
                   +-------------------------+
                   |     AI Employee         |
                   |   (orchestrator_agent)  |
                   +-----+------+------+-----+
                         |      |      |         input-teammates
           +-------------+      |      +------------+
           |                    |                   |
    +------v------+     +-------v-----+     +-------v-----+
    | coding_agent|     |  web_agent  |     | task_agent  |
    +-------------+     +-------------+     +-------------+
       delegate_         delegate_             delegate_
       to_coding_        to_web_               to_task_
       agent tool        agent tool            agent tool
```

The team lead's LLM decides when to delegate based on task context. Delegation is **fire-and-forget**: the child spawns as `asyncio.create_task()`, the parent continues, and the child broadcasts its own status updates independently. Results can be retrieved via the auto-injected `check_delegated_tasks` tool or consumed by `taskTrigger` nodes elsewhere in the workflow.

### LangGraph StateGraph Flow

```
             +---------+
  START ---> |  agent  |
             | (LLM)   |
             +----+----+
                  |
          should_continue()?
              /        \
       tools /          \ end
            v            v
       +---------+      END
       |  tools  |
       | (exec)  |
       +----+----+
            |
            +---------> loop back to agent
```

Max iterations guard against infinite tool loops. Tools are built as Pydantic-schema `StructuredTool` instances with the node's parameter schema.

**Read more**: [agent_architecture.md](docs-internal/agent_architecture.md) - [agent_teams.md](docs-internal/agent_teams.md) - [agent_delegation.md](docs-internal/agent_delegation.md) - [native_llm_sdk.md](docs-internal/native_llm_sdk.md) - [rlm_service.md](docs-internal/rlm_service.md)

</details>

<details>
<summary><b>Memory, Skills, Tokens, and Cost</b></summary>

### Markdown-Based Memory

The `simpleMemory` node stores conversation history as editable Markdown in the parameter panel. The AI Agent handler reads, parses to LangChain messages, executes, appends the new exchange, trims to a window, and archives removed messages to an `InMemoryVectorStore` (optional) using HuggingFace `BAAI/bge-small-en-v1.5` embeddings.

```
AI Agent reads memoryContent (Markdown)
        |
        v
_parse_memory_markdown() -> LangChain Messages
        |
        v
(optional) vector store similarity_search(prompt, k=retrievalCount)
        |
        v
Execute LLM with full history + retrieved context
        |
        v
Append human + ai messages to Markdown
        |
        v
_trim_markdown_window(windowSize) -> (kept, removed)
        |
        v
If longTermEnabled: store.add_texts(removed)
        |
        v
Save updated Markdown back to node parameters
```

### Skill System

49 built-in skills across 10 folders under `server/skills/`:

```
assistant/ (5)           android_agent/ (12)       autonomous/ (5)
coding_agent/ (2)        productivity_agent/ (6)   rlm_agent/ (1)
social_agent/ (5)        task_agent/ (3)           travel_agent/ (2)
web_agent/ (8)
```

Each skill is a folder with a `SKILL.md` file containing YAML frontmatter (name, description, allowed-tools, metadata) and Markdown instructions. First load seeds the database; after that the database is source of truth so users can edit skill instructions in the UI. "Reset to Default" reloads the original `SKILL.md`.

The `masterSkill` node aggregates multiple skills with enable/disable toggles. A split-panel editor shows the skill list on the left and the selected skill's Markdown on the right. When connected to an agent, the backend expands the `skillsConfig` parameter into individual skill entries injected into the agent's system message.

### Token Tracking and Compaction

Every AI execution stores a `TokenUsageMetric` row with input/output/cache/reasoning token counts and calculated costs (USD) based on `server/config/pricing.json`. Cumulative state per session lives in `SessionTokenState`.

Compaction threshold priority:

1. Per-session `custom_threshold` (user-set)
2. **Model-aware**: 50% of the model's context window (e.g., 500K for Claude Opus 4.6 with 1M context)
3. Global `COMPACTION_THRESHOLD` fallback from `.env`

When the cumulative session tokens cross the threshold, `CompactionService.compact_context()` generates a 5-section summary (Task Overview, Current State, Important Discoveries, Next Steps, Context to Preserve) following the Claude Code pattern and replaces the memory content. Anthropic and OpenAI also have native compaction APIs (`context_management` edits, `compact_threshold`) that are configured transparently via `svc.anthropic_api_config()` and `svc.openai_config()`.

**Read more**: [memory_compaction.md](docs-internal/memory_compaction.md) - [pricing_service.md](docs-internal/pricing_service.md) - [Skill Creation Guide](server/skills/GUIDE.md)

</details>

<details>
<summary><b>Communication Layer</b></summary>

A single persistent WebSocket at `/ws/status` handles all frontend-backend communication. There are **89 WebSocket handlers** registered with the `@ws_handler` decorator in `server/routers/websocket.py`, covering: node parameters, tool schemas, node execution, triggers, dead letter queue, deployment, AI operations, API keys, OAuth flows (Claude, Twitter, Google), Android, WhatsApp, Telegram, workflow storage, chat messages, console logs, skills, memory, user settings, pricing, agent teams, and model registry.

### Request/Response Pattern

```
Frontend                                Backend
   |                                       |
   |-- {type: "execute_node", data: ...}-->|
   |                                       |-- dispatch to handle_execute_node()
   |                                       |-- run node handler
   |                                       |
   |<-- {type: "node_status", ... }---------|  (broadcast)
   |<-- {type: "node_output", ... }---------|  (broadcast)
   |<-- {type: "execute_node_response", ...}|  (direct reply, request_id matched)
```

### Broadcast Message Types

```
node_status         workflow_status      api_key_status
node_output         android_status       token_usage_update
variable_update     compaction_starting  node_parameters_updated
variables_update    compaction_completed
```

### Auto-Reconnect and Keepalive

Frontend sends `{"type": "ping"}` every 30 seconds. On disconnect, the `WebSocketContext` schedules a reconnect after 3 seconds with a 100ms mount delay to avoid React Strict Mode double-connect in development. Connection is gated on `isAuthenticated` so logged-out users never connect.

**Read more**: [status_broadcaster.md](docs-internal/status_broadcaster.md)

</details>

<details>
<summary><b>Cache, Persistence, and Security</b></summary>

### Cache Fallback Hierarchy

MachinaOS follows the n8n cache pattern with automatic environment-based fallback:

```
Production (Docker):  Redis  ->  SQLite (cache_entries)  ->  in-memory dict
Local development:             SQLite (cache_entries)  ->  in-memory dict
                               (Redis disabled via REDIS_ENABLED=false)
```

`CacheService` in `server/core/cache.py` checks each backend in order. TTL expiration is supported across all three. A background `cleanup_expired_cache()` task removes expired SQLite rows.

### Encrypted Credentials

API keys and OAuth tokens live in a **separate SQLite database** (`credentials.db`) isolated from the main `machina.db`. Encryption uses Fernet (AES-128-CBC + HMAC-SHA256) with keys derived from a server-scoped config key via PBKDF2HMAC (600K iterations, OWASP 2024 recommendation).

```
API_KEY_ENCRYPTION_KEY (.env)  +  salt (from credentials.db, 256 bits)
                    |
                    v
           PBKDF2HMAC-SHA256
           (600,000 iterations)
                    |
                    v
        urlsafe_b64encode -> Fernet key
                    |
                    v
           held in memory only
                    |
                    v
      encrypt() / decrypt() inside EncryptionService
```

Two separate credential systems inside `credentials.db`:

- **API key system** (`EncryptedAPIKey` table): provider keys the user enters manually
- **OAuth token system** (`EncryptedOAuthToken` table): tokens from OAuth flows (Google, Twitter, Claude.ai)

All routers access credentials through `AuthService` only. Direct database access is forbidden. Decrypted values are cached in `AuthService` memory dicts and never written to disk or Redis.

For cloud deployments, `CREDENTIAL_BACKEND` can be switched to `keyring` (OS-native) or `aws` (Secrets Manager) via `CredentialBackend` abstraction.

### Authentication

JWT in HttpOnly cookies following the n8n pattern. Two modes:

- `AUTH_MODE=single` - first user becomes owner, registration disabled after
- `AUTH_MODE=multi` - open registration for cloud deployments
- `VITE_AUTH_ENABLED=false` - bypass login entirely for local development

WebSocket connections check the JWT cookie before accepting. Auth context has exponential-backoff retry (5 attempts) to survive race conditions where the frontend starts before the backend is ready.

**Read more**: [credentials_encryption.md](docs-internal/credentials_encryption.md)

</details>

<details>
<summary><b>Full Documentation Index</b></summary>

| Document | Description |
|---|---|
| [DESIGN.md](docs-internal/DESIGN.md) | Execution engine architecture, design patterns, execution modes |
| [TEMPORAL_ARCHITECTURE.md](docs-internal/TEMPORAL_ARCHITECTURE.md) | Distributed execution via Temporal activities |
| [workflow-schema.md](docs-internal/workflow-schema.md) | Workflow JSON schema and full node catalog (96 nodes) |
| [ROADMAP.md](docs-internal/ROADMAP.md) | Implementation status and completed phases |
| [SETUP.md](docs-internal/SETUP.md) | Development environment setup |
| [SCRIPTS.md](docs-internal/SCRIPTS.md) | npm/shell scripts reference |
| [server-readme.md](docs-internal/server-readme.md) | Python backend architecture and API |
| [agent_architecture.md](docs-internal/agent_architecture.md) | AI Agent / Chat Agent skill and tool discovery |
| [agent_delegation.md](docs-internal/agent_delegation.md) | How delegated agents share context and memory |
| [agent_teams.md](docs-internal/agent_teams.md) | Agent Teams pattern with `input-teammates` handle |
| [native_llm_sdk.md](docs-internal/native_llm_sdk.md) | Native LLM SDK layer and provider protocol |
| [rlm_service.md](docs-internal/rlm_service.md) | Recursive Language Model agent via REPL |
| [claude_code_agent_architecture.md](docs-internal/claude_code_agent_architecture.md) | Claude Code SDK integration as a specialized agent |
| [autonomous_agent_creation.md](docs-internal/autonomous_agent_creation.md) | Autonomous agents with Code Mode patterns |
| [event_waiter_system.md](docs-internal/event_waiter_system.md) | Push-based trigger waiters |
| [status_broadcaster.md](docs-internal/status_broadcaster.md) | WebSocket broadcaster and 89 handlers |
| [credentials_encryption.md](docs-internal/credentials_encryption.md) | Fernet + PBKDF2 credentials system |
| [memory_compaction.md](docs-internal/memory_compaction.md) | Token tracking and model-aware compaction |
| [pricing_service.md](docs-internal/pricing_service.md) | LLM and API cost tracking |
| [proxy_service.md](docs-internal/proxy_service.md) | Residential proxy provider management |
| [ci_cd.md](docs-internal/ci_cd.md) | GitHub Actions workflows |
| [node_creation.md](docs-internal/node_creation.md) | How to create new nodes |
| [ai_tool_node_creation.md](docs-internal/ai_tool_node_creation.md) | Creating dedicated AI Agent tool nodes |
| [specialized_agent_node_creation.md](docs-internal/specialized_agent_node_creation.md) | Creating specialized AI agent nodes |
| [dual_purpose_tool_node_creation.md](docs-internal/dual_purpose_tool_node_creation.md) | Dual-purpose workflow + tool nodes |
| [new_service_integration.md](docs-internal/new_service_integration.md) | External service integration guide |
| [cli_services_integration.md](docs-internal/cli_services_integration.md) | CLI service lifecycle management |
| [onboarding.md](docs-internal/onboarding.md) | Welcome wizard and replay |
| [Skill Creation Guide](server/skills/GUIDE.md) | How to create new skills |

</details>
