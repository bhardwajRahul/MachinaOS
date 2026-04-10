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

### Universal Email (IMAP/SMTP)
- Send, read, search, and manage emails via the Himalaya CLI
- Works with Gmail, Outlook, Yahoo, iCloud, ProtonMail, Fastmail, or any custom IMAP/SMTP server
- Polling-based trigger for incoming email workflows

### Control Your Devices
- Send WhatsApp messages automatically
- Post to Twitter/X
- Send Telegram messages via bot
- Control your Android phone (WiFi, Bluetooth, apps, camera)
- Schedule tasks and reminders

### Browse the Web
- Interactive browser automation with accessibility-tree navigation (agent-browser)
- Web scraping with BeautifulSoup or Playwright (crawlee)
- Route requests through residential proxies with geo-targeting
- Run Apify actors for social media and search engine scraping
- DuckDuckGo, Brave, Serper (Google), and Perplexity search

### Plan Complex Tasks
- `writeTodos` tool lets any AI agent create and update structured task lists
- Real-time checklist rendering in the UI
- Plan-work-update loop with `pending` / `in_progress` / `completed` states

### Process Documents
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
- **16 Specialized Agents** - Android, Coding, Web, Task, Social, Travel, Tool, Productivity, Payments, Consumer, Autonomous, Orchestrator, AI Employee, RLM, Claude Code, Deep Agent
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

A contributor's map to the codebase. This section tells you *where things live* and *where to start reading* when you want to add a feature. For the full architecture tour, use the [DeepWiki badge](https://deepwiki.com/trohitg/MachinaOS) at the top of this README or browse [docs-internal/](docs-internal/).

### System Overview

[![System Overview](docs/diagrams/system-overview.svg)](https://raw.githubusercontent.com/trohitg/MachinaOS/main/docs/diagrams/system-overview.svg)

At a glance:

- **106 workflow nodes** across 25 categories (AI, agents, social, Android, Google Workspace, email, browser, documents, code, proxies, utilities)
- **10 LLM providers** via a hybrid native SDK + LangChain architecture
- **16 specialized AI agents** with the Agent Teams delegation pattern
- **127 WebSocket handlers** replacing most REST endpoints
- **55 built-in skills** across 10 categories, editable in-UI with SKILL.md defaults on disk
- **Three execution modes** with automatic fallback: Temporal distributed, Redis parallel, sequential

### How Workflows Execute

[![Execution Flow](docs/diagrams/execution-flow.svg)](https://raw.githubusercontent.com/trohitg/MachinaOS/main/docs/diagrams/execution-flow.svg)

[WorkflowService](server/services/workflow.py) is a thin facade that routes each run through one of three execution modes. Every run has an isolated `ExecutionContext` with no shared global state, orchestrated by Conductor's decide pattern (`_workflow_decide` under a Redis `SETNX` lock). Layers are computed via Kahn's algorithm and each layer runs via `asyncio.gather()`. Results are cached by input hash (Prefect pattern), failed nodes go to a Dead Letter Queue, and a `RecoverySweeper` handles crashes via heartbeats.

Deep dives: [DESIGN.md](docs-internal/DESIGN.md) - [TEMPORAL_ARCHITECTURE.md](docs-internal/TEMPORAL_ARCHITECTURE.md) - [event_waiter_system.md](docs-internal/event_waiter_system.md)

### AI Agent System

[![AI Agent Routing](docs/diagrams/ai-agent-routing.svg)](https://raw.githubusercontent.com/trohitg/MachinaOS/main/docs/diagrams/ai-agent-routing.svg)

AI execution splits into two paths. `execute_chat()` for direct chat completions prefers the native SDK layer in [services/llm/](server/services/llm/) (10 providers, lazy imports, normalized `LLMResponse`), falling back to LangChain for Groq and Cerebras. `execute_agent()` and `execute_chat_agent()` always use LangChain + LangGraph because tool-calling, state graphs, and the checkpointer have no native equivalent today. Team leads (`orchestrator_agent`, `ai_employee`) auto-inject `delegate_to_<type>` tools for every agent connected to their `input-teammates` handle. The Deep Agent variant uses [LangChain DeepAgents](https://github.com/langchain-ai/deepagents) with built-in filesystem tools, sub-agent delegation, and todo planning; the RLM Agent uses a REPL-based recursive language model pattern. Long-running activities (DeepAgent, browser automation) stay alive across Temporal's 2-minute heartbeat window via per-message `activity.heartbeat()` calls in the WebSocket read loop.

Deep dives: [agent_architecture.md](docs-internal/agent_architecture.md) - [native_llm_sdk.md](docs-internal/native_llm_sdk.md) - [agent_teams.md](docs-internal/agent_teams.md) - [memory_compaction.md](docs-internal/memory_compaction.md)

### Repository Map

| Directory | What lives here | Start reading |
|---|---|---|
| `client/src/nodeDefinitions/` | 106 workflow node definitions across 25 TypeScript files | [node_creation.md](docs-internal/node_creation.md) |
| `client/src/components/` | React Flow canvas, parameter panel, modals | [CLAUDE.md](CLAUDE.md) |
| `server/services/` | WorkflowService, NodeExecutor, AI service | [DESIGN.md](docs-internal/DESIGN.md) |
| `server/services/handlers/` | One handler per node type (dispatch targets) | [node_creation.md](docs-internal/node_creation.md) |
| `server/services/llm/` | Native LLM SDK layer (10 providers) | [native_llm_sdk.md](docs-internal/native_llm_sdk.md) |
| `server/services/execution/` | Decide pattern, DLQ, recovery, conditions | [DESIGN.md](docs-internal/DESIGN.md) |
| `server/services/temporal/` | Distributed execution via Temporal | [TEMPORAL_ARCHITECTURE.md](docs-internal/TEMPORAL_ARCHITECTURE.md) |
| `server/routers/websocket.py` | 127 WebSocket handlers | [status_broadcaster.md](docs-internal/status_broadcaster.md) |
| `server/core/` | Cache, encryption, DI container, config | [credentials_encryption.md](docs-internal/credentials_encryption.md) |
| `server/skills/` | 55 skill SKILL.md files across 10 folders | [GUIDE.md](server/skills/GUIDE.md) |
| `server/config/` | llm_defaults.json, pricing.json, model_registry.json, email_providers.json, google_apis.json | [pricing_service.md](docs-internal/pricing_service.md) |
| `docs-internal/` | In-repo architecture deep dives (30 files) | Index below |

### How to Contribute

[![Node Anatomy](docs/diagrams/node-anatomy.svg)](https://raw.githubusercontent.com/trohitg/MachinaOS/main/docs/diagrams/node-anatomy.svg)

The diagram above shows the full lifecycle of a workflow node from TypeScript definition to Python handler. Use these recipes as a starting point:

**Add a workflow node**
- Node definition: `client/src/nodeDefinitions/<yourCategory>.ts`
- Backend handler: `server/services/handlers/<your_handler>.py`
- Register in: `server/services/node_executor.py` registry
- Guide: [node_creation.md](docs-internal/node_creation.md)

**Add an LLM provider**
- OpenAI-compatible (DeepSeek, Kimi, Mistral pattern): config-only in `server/config/llm_defaults.json`
- Custom-SDK provider: new file in `server/services/llm/providers/`, branch in `factory.py`
- Frontend node: `client/src/nodeDefinitions/aiModelNodes.ts`
- Guide: [native_llm_sdk.md](docs-internal/native_llm_sdk.md)

**Add a dual-purpose tool (workflow node + AI tool)**
- Mark node `group: ['category', 'tool']`
- Pydantic schema in `server/services/ai.py` (`_get_tool_schema`)
- Dispatch in `server/services/handlers/tools.py`
- Guide: [dual_purpose_tool_node_creation.md](docs-internal/dual_purpose_tool_node_creation.md)

**Add a specialized AI agent**
- `client/src/nodeDefinitions/specializedAgentNodes.ts`
- Add to `SPECIALIZED_AGENT_TYPES` in `server/constants.py`
- Register in `server/services/node_executor.py`
- Guide: [specialized_agent_node_creation.md](docs-internal/specialized_agent_node_creation.md)

**Add a skill**
- New folder under `server/skills/<category>/`
- Create `SKILL.md` with YAML frontmatter + markdown body
- Guide: [GUIDE.md](server/skills/GUIDE.md)

**Add an event-based trigger**
- Register in `TRIGGER_REGISTRY` in `server/services/event_waiter.py`
- Add a filter builder in the same file
- Frontend node with `group: ['category', 'trigger']`
- Guide: [event_waiter_system.md](docs-internal/event_waiter_system.md)

**Integrate a new external service with OAuth**
- Reference implementation: Google Workspace (7 nodes sharing one OAuth connection)
- Guide: [new_service_integration.md](docs-internal/new_service_integration.md)

### Local Dev Quick Reference

```bash
npm run dev            # start frontend + backend + Temporal + WhatsApp
npm run stop           # stop everything
npx tsc --noEmit       # typecheck client (from client/)
python -m pytest       # run backend tests (from server/)
npm run build          # production build
```

Full setup and scripts reference: [SETUP.md](docs-internal/SETUP.md) - [SCRIPTS.md](docs-internal/SCRIPTS.md)

<details>
<summary><b>Full Documentation Index</b></summary>

| Document | Description |
|---|---|
| [DESIGN.md](docs-internal/DESIGN.md) | Execution engine architecture, design patterns, execution modes |
| [TEMPORAL_ARCHITECTURE.md](docs-internal/TEMPORAL_ARCHITECTURE.md) | Distributed execution via Temporal activities |
| [workflow-schema.md](docs-internal/workflow-schema.md) | Workflow JSON schema and full node catalog (106 nodes) |
| [deep_agent.md](docs-internal/deep_agent.md) | LangChain DeepAgents integration with filesystem tools and sub-agents |
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
