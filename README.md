# MachinaOs

Visual workflow automation platform. Build workflows by connecting nodes - like n8n or Zapier.

## Quick Start

**Prerequisites:** Node.js 18+, Python 3.10+, Go 1.21+

```bash
git clone https://github.com/trohitg/MachinaOS.git
cd MachinaOs
npm run build
npm run start
```

Open http://localhost:3000 and register your account.

---

## What You Can Build

- **AI Workflows** - Connect OpenAI, Claude, Gemini models
- **Android Automation** - Control your phone (battery, WiFi, apps, sensors)
- **WhatsApp Bots** - Send/receive messages, auto-replies
- **HTTP/Webhooks** - API integrations, triggers

## How It Works

1. Drag nodes onto canvas
2. Connect them together
3. Configure each node
4. Click Run

## Commands

| Command | Description |
|---------|-------------|
| `npm run start` | Start all services |
| `npm run stop` | Stop all services |
| `npm run build` | Install all dependencies |

## Project Structure

```
MachinaOs/
├── client/          # React frontend (localhost:3000)
├── server/          # Python backend (localhost:3010)
│   └── whatsapp-rpc/  # WhatsApp service
└── package.json
```

## Configuration

**API Keys:** Click the **Credentials** button (key icon) in the top toolbar to add API keys for OpenAI, Claude, Google Maps, etc.

**Environment:** Edit `.env` in the project root for authentication settings, ports, and database location.

---

## Docker Deployment

```bash
npm run docker:build
npm run docker:up
```

## Tech Stack

- **Frontend:** React, TypeScript, React Flow
- **Backend:** Python, FastAPI, SQLite
- **Services:** WhatsApp (Go), WebSocket relay

## License

MIT
