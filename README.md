# MachinaOS

<a href="https://www.npmjs.com/package/machinaos" target="_blank"><img src="https://img.shields.io/npm/v/machinaos.svg" alt="npm version"></a>
<a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
<a href="https://discord.gg/NHUEQVSC" target="_blank"><img src="https://img.shields.io/discord/1455977012308086895?logo=discord&logoColor=white&label=Discord" alt="Discord"></a>

Open-source platform to build your own personal AI assistant. A mashup of Claude Code and n8n with better UI, full visibility of each action, and restricted control access.

## Demo

[![MachinaOS Demo](https://img.youtube.com/vi/z_TEyGmeuyQ/maxresdefault.jpg)](https://www.youtube.com/watch?v=z_TEyGmeuyQ)

## Full Capabilities

<img width="1280" height="671" alt="func_img" src="https://github.com/user-attachments/assets/2f14b6c8-3995-4ccc-b076-e40749a83df2" />

**83 nodes** | **6 AI providers** | **13 specialized agents** | **Agent Teams** | **WebSocket-first** | **Self-hosted**

## Prerequisites

- **Node.js 22+** - https://nodejs.org/
- **Python 3.12+** - https://python.org/

## Quick Start

```bash
npm install -g machinaos
machinaos start
```

Open http://localhost:3000

## One-Line Install (auto-installs dependencies)

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.ps1 | iex
```

## Clone & Run

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOS
npm run build
npm run start
```

## Features

### AI Integration (6 Providers)

| Provider | Models | Features |
|----------|--------|----------|
| **OpenAI** | GPT-5, GPT-4o, o1, o3, o4 | 128K output, reasoning effort |
| **Anthropic** | Claude Opus 4.6, Sonnet 4.5 | 128K output, extended thinking |
| **Google** | Gemini 3.0, 2.5 Pro/Flash | 65K output, 1M context |
| **OpenRouter** | 200+ models | Unified API for all providers |
| **Groq** | Llama, Qwen | Ultra-fast inference |
| **Cerebras** | Llama, Qwen | Ultra-fast on custom hardware |

### AI Agents & Skills

- **AI Agent** - LangGraph-powered with tool calling and iterative reasoning
- **Chat Agent** - Conversational agent with skill support for multi-turn chat
- **AI Employee** - Team lead for intelligent task delegation to specialized agents
- **13 Specialized Agents** - Android, Coding, Web, Task, Social, Travel, Tool, Productivity, Payments, Consumer, Autonomous, Orchestrator
- **Agent Teams** - Multi-agent coordination with shared task management and delegation tools
- **11 Skills** - WhatsApp, Maps, HTTP, Scheduler, Android, Code, Memory, Web Search, Custom
- **Simple Memory** - Markdown-based conversation history with vector storage

### Platform Integrations

- **WhatsApp** - Send/receive messages with QR pairing, filters, group support
- **Twitter/X** - Send tweets, search, user lookup with OAuth 2.0 authentication
- **Android** - 16 service nodes for device control (battery, WiFi, Bluetooth, apps, camera, sensors)
- **HTTP/Webhooks** - REST API integration with event-driven triggers
- **Google Maps** - Geocoding, nearby places, directions

### Agent Teams (Multi-Agent Coordination)

Build teams of specialized agents that work together on complex tasks:

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

- **Team Lead** (AI Employee/Orchestrator) coordinates multiple agents
- **Intelligent Delegation** - AI decides when to delegate based on task
- **Delegation Tools** - Connected agents become `delegate_to_*` tools
- **Team Monitor** - Real-time visualization of team operations

### Document Processing (RAG Pipeline)

- **HTTP Scraper** - Scrape URLs with pagination and date ranges
- **File Downloader** - Parallel downloads with semaphore concurrency
- **Document Parser** - PyPDF, Marker (OCR), Unstructured, BeautifulSoup
- **Text Chunker** - Recursive, markdown, or token-based splitting
- **Embedding Generator** - HuggingFace, OpenAI, Ollama embeddings
- **Vector Store** - ChromaDB, Qdrant, Pinecone backends

## Node Categories

| Category | Count | Description |
|----------|-------|-------------|
| AI Models | 6 | OpenAI, Anthropic, Google, OpenRouter, Groq, Cerebras |
| AI Agents | 4 | AI Agent, Chat Agent, AI Employee, Simple Memory |
| Specialized Agents | 13 | Android, Coding, Web, Task, Social, Travel, Orchestrator, etc. |
| AI Skills | 11 | WhatsApp, Maps, HTTP, Scheduler, Android, Code, etc. |
| AI Tools | 9 | Calculator, Time, Search, Android Toolkit, Code Executors |
| WhatsApp | 3 | Send, Receive, Database |
| Twitter | 3 | Send, Search, User |
| Android | 16 | Device control and monitoring |
| Documents | 6 | RAG pipeline nodes |
| Utilities | 6 | HTTP, Webhooks, Chat Trigger, Console, Team Monitor |
| Location | 3 | Google Maps integration |
| Workflow | 3 | Start, Timer, Cron Scheduler |

**Total: 83 nodes**

## CLI Commands

| Command | Description |
|---------|-------------|
| `machinaos start` | Start all services (frontend, backend, WhatsApp) |
| `machinaos stop` | Stop all running services |
| `machinaos build` | Build for production |
| `machinaos clean` | Remove build artifacts and dependencies |
| `machinaos docker:up` | Start with Docker Compose |
| `machinaos docker:down` | Stop Docker containers |
| `machinaos help` | Show all available commands |

## Configuration

**API Keys:** Click **Credentials** button in toolbar to add API keys for OpenAI, Claude, Google Maps, etc.

**Environment:** Copy `.env.template` to `.env` and customize ports, auth settings, database location.

## Other Install Options

<details>
<summary><b>Docker</b></summary>

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOS
npm run docker:up
```

**Production Docker:**
```bash
npm run docker:prod:build
npm run docker:prod:up
```

**Redis (optional):** Set `REDIS_ENABLED=true` in `.env`

</details>

## Project Structure

```
MachinaOS/
├── client/           # React frontend (localhost:3000)
├── server/           # Python FastAPI backend (localhost:3010)
│   ├── services/     # Workflow execution, AI, handlers
│   └── routers/      # API endpoints, WebSocket
├── scripts/          # Cross-platform Node.js scripts
└── bin/cli.js        # CLI entry point
```

## Tech Stack

- **Frontend:** React 19, TypeScript, React Flow, Zustand
- **Backend:** Python 3.12+, FastAPI, SQLite, LangChain/LangGraph
- **Services:** WhatsApp (whatsapp-rpc npm package), WebSocket relay
- **Package Manager:** uv (Python), npm (Node.js)

## Troubleshooting

**Port already in use:**
```bash
machinaos stop   # Kill all services
machinaos start  # Restart
```

**Missing dependencies:**
```bash
machinaos build  # Install all dependencies
```

**Clean install:**
```bash
machinaos clean  # Remove node_modules, .venv, dist
machinaos build  # Reinstall everything
```

## Documentation

Full documentation: https://docs.machinaos.dev

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
