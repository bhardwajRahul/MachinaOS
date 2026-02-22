# MachinaOS

<a href="https://www.npmjs.com/package/machinaos" target="_blank"><img src="https://img.shields.io/npm/v/machinaos.svg" alt="npm version"></a>
<a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
<a href="https://discord.gg/NHUEQVSC" target="_blank"><img src="https://img.shields.io/discord/1455977012308086895?logo=discord&logoColor=white&label=Discord" alt="Discord"></a>

Build your personal AI assistant. Connect AI Assistant to your email, calendar, messages, phone, and more.

Mashup of N8N + Openclaw but with better visibility of what it's doing and also tighter control of what your AI Assistant can do.

## See It In Action ↓

[![MachinaOS Demo](https://img.youtube.com/vi/z_TEyGmeuyQ/maxresdefault.jpg)](https://www.youtube.com/watch?v=z_TEyGmeuyQ)

## Full Capabilities ↓

<img width="1280" height="671" alt="Full Capabilities" src="https://github.com/user-attachments/assets/2f14b6c8-3995-4ccc-b076-e40749a83df2" />

## Prerequisites

- **Node.js 22+** - https://nodejs.org/
- **Python 3.12+** - https://python.org/

## Quick Start

```bash
npm install -g machinaos
machinaos start
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
npm run start
```

</details>

## What You Can Build

### Personal AI Assistants
Create AI agents that remember conversations, use tools, and work together. Choose from OpenAI, Claude, Gemini, Groq, and 200+ models via OpenRouter.

### Automate Your Google Workspace
- Send and search emails
- Create calendar events
- Upload files to Drive
- Update spreadsheets
- Manage tasks and contacts

### Control Your Devices
- Send WhatsApp messages automatically
- Post to Twitter/X
- Control your Android phone (WiFi, Bluetooth, apps, camera)
- Schedule tasks and reminders

### Process Documents
- Scrape websites
- Parse PDFs and documents
- Search your files with AI

### Build Agent Teams
Create teams of specialized agents that delegate tasks to each other - a coding agent, a web agent, and a task agent working together.

## Visual Workflow Builder

Drag-and-drop interface to connect AI models, services, and triggers. No code required.

## Configuration

Click **Credentials** in the toolbar to add your API keys for AI providers, Google, WhatsApp, and Twitter.

## Documentation

Full docs: https://docs.machinaos.dev

## Community

Join our [Discord](https://discord.gg/NHUEQVSC) for help, feedback, and updates.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
