# MachinaOS

Open-source workflow automation platform with AI agents, React Flow, and n8n-inspired architecture.

## Quick Start

### Option 1: One-Line Install (Recommended)

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.ps1 | iex
```

This automatically installs all dependencies (Node.js, Python, uv, Go) and MachinaOS.

### Option 2: Clone & Run

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOS
npm run build
npm run start
```

### Option 3: npm Global Install

```bash
npm install -g machinaos
machinaos start
```

Requires Node.js 18+, Python 3.11+, uv, and Go 1.21+ to be pre-installed.

### Option 4: Docker

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOS
npm run docker:up
```

Open http://localhost:3000

## Prerequisites

The install script handles these automatically, but for manual installation:

- **Node.js 18+** - https://nodejs.org/
- **Python 3.11+** - https://python.org/
- **uv** - `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Go 1.21+** - https://go.dev/dl/ (for WhatsApp service)

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

## Local Development

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOS
npm run build
npm run start
```

---

## Features

- **AI Workflows** - OpenAI, Claude, Gemini, Groq, OpenRouter models with tool calling
- **AI Agents** - LangGraph-powered agents with memory and skills
- **Android Automation** - Control your phone via 17 service nodes
- **WhatsApp Bots** - Send/receive messages with filters and triggers
- **HTTP/Webhooks** - API integrations with event-driven triggers
- **Document Processing** - RAG pipeline with vector storage

## Configuration

**API Keys:** Click **Credentials** button in toolbar to add API keys for OpenAI, Claude, Google Maps, etc.

**Environment:** Copy `.env.template` to `.env` and customize ports, auth settings, database location.

## Docker Commands

| Command | Description |
|---------|-------------|
| `machinaos docker:up` | Start containers (detached) |
| `machinaos docker:down` | Stop containers |
| `machinaos docker:build` | Rebuild images |
| `machinaos docker:logs` | View logs (follows) |

**Redis (optional):** Set `REDIS_ENABLED=true` in `.env`

### Production Docker

```bash
npm run docker:prod:build
npm run docker:prod:up
```

## Project Structure

```
MachinaOS/
├── client/           # React frontend (localhost:3000)
├── server/           # Python FastAPI backend (localhost:3010)
│   ├── services/     # Workflow execution, AI, handlers
│   ├── routers/      # API endpoints, WebSocket
│   └── whatsapp-rpc/ # WhatsApp Go service
├── scripts/          # Cross-platform Node.js scripts
└── bin/cli.js        # CLI entry point
```

## Tech Stack

- **Frontend:** React 19, TypeScript, React Flow, Zustand
- **Backend:** Python 3.11+, FastAPI, SQLite, LangChain/LangGraph
- **Services:** WhatsApp (Go + whatsmeow), WebSocket relay
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
