# MachinaOs

Visual workflow automation platform. Build workflows by connecting nodes - like n8n or Zapier.

## Quick Start

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOs
npm run docker:build
npm run docker:up
```

Open http://localhost:3000

## Local Development

**Prerequisites:** Node.js 18+, Python 3.10+, Go 1.21+

```bash
npm run build
npm run start
```

---

## Features

- **AI Workflows** - OpenAI, Claude, Gemini models with tool calling
- **Android Automation** - Control your phone via 17 service nodes
- **WhatsApp Bots** - Send/receive messages with filters
- **HTTP/Webhooks** - API integrations
- **Tool Schema Editor** - Customize AI tool schemas per service

## Docker Commands

### Development (hot reload, larger images)
| Command | Description |
|---------|-------------|
| `npm run docker:build` | Build dev images |
| `npm run docker:up` | Start dev containers |
| `npm run docker:down` | Stop containers |
| `npm run docker:logs` | View logs |

### Production (optimized, smaller images)
| Command | Description |
|---------|-------------|
| `npm run docker:prod:build` | Build prod images |
| `npm run docker:prod:up` | Start prod containers |
| `npm run docker:prod:logs` | View logs |

**Redis (optional):** Set `REDIS_ENABLED=true` in `.env`

## Local Commands

| Command | Description |
|---------|-------------|
| `npm run start` | Start all services |
| `npm run stop` | Stop all services |
| `npm run build` | Install dependencies |

## Configuration

**API Keys:** Click **Credentials** button in toolbar to add API keys for OpenAI, Claude, Google Maps, etc.

**Environment:** Edit `.env` for auth settings, ports, and database location.

## Project Structure

```
MachinaOs/
├── client/          # React frontend (localhost:3000)
├── server/          # Python backend (localhost:3010)
│   └── whatsapp-rpc/  # WhatsApp service
└── package.json
```

## Tech Stack

- **Frontend:** React, TypeScript, React Flow
- **Backend:** Python, FastAPI, SQLite
- **Services:** WhatsApp (Go), WebSocket relay

## License

MIT
