# MachinaOs

Visual workflow automation platform. Build workflows by connecting nodes - like n8n or Zapier.

## Quick Start

**Prerequisites:** Node.js 18+, Python 3.10+

```bash
git clone https://github.com/user/MachinaOs.git
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

Edit `server/.env` for:
- API keys (OpenAI, Google Maps, etc.)
- Authentication settings
- Database location

API keys can also be added through the UI (click the key icon).

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
