# MachinaOS

<a href="https://www.npmjs.com/package/machinaos" target="_blank"><img src="https://img.shields.io/npm/v/machinaos.svg" alt="npm version"></a>
<a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
<a href="https://discord.gg/c9pCJ7d8Ce" target="_blank"><img src="https://img.shields.io/discord/1455977012308086895?logo=discord&logoColor=white&label=Discord" alt="Discord"></a>

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
