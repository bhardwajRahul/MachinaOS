# MachinaOs - Claude Documentation

## Project Overview
This is a React Flow-based workflow automation platform implementing n8n-inspired architectural patterns. The project has undergone a comprehensive refactoring to implement modern INodeProperties interface system with full TypeScript compliance and code cleanup.

## Documentation Reference

**Always refer to these documentation files for detailed guides:**

| Document | Description |
|----------|-------------|
| **[Node Creation Guide](./docs-internal/node_creation.md)** | Complete guide for creating new nodes (frontend definitions, backend handlers, config nodes, triggers) |
| **[AI Tool Node Guide](./docs-internal/ai_tool_node_creation.md)** | Detailed guide for creating dedicated AI Agent tool nodes (schemas, handlers, toolkits) |
| **[Specialized Agent Guide](./docs-internal/specialized_agent_node_creation.md)** | Guide for creating specialized AI agents (Android, Coding, Web, Task, Social, Travel, Tool, Productivity, Payments, Consumer) with full AI configuration |
| **[Dual-Purpose Tool Guide](./docs-internal/dual_purpose_tool_node_creation.md)** | Guide for nodes that work as both workflow nodes AND AI Agent tools (e.g., whatsappSend) |
| **[Agent Architecture](./docs-internal/agent_architecture.md)** | How AI Agent and Chat Agent discover skills/tools, inject them into LLM prompts, and execute via LangGraph |
| **[Agent Delegation](./docs-internal/agent_delegation.md)** | How memory, parameters, and execution context flow when one AI agent delegates work to another agent connected as a tool |
| **[Agent Teams](./docs-internal/agent_teams.md)** | Claude SDK Agent Teams pattern - AI Employee and Orchestrator nodes with input-teammates handle for multi-agent coordination |
| **[Memory Compaction](./docs-internal/memory_compaction.md)** | Token tracking and memory compaction service using native provider APIs (Anthropic, OpenAI) |
| **[Pricing Service](./docs-internal/pricing_service.md)** | Centralized cost tracking for LLM tokens and API services (Twitter, Google Maps) with HTTPX event hooks |
| **[CI/CD Pipeline](./docs-internal/ci_cd.md)** | GitHub Actions workflows, predeploy validation, release publishing, and composite setup action |
| **[Workflow Schema](./docs-internal/workflow-schema.md)** | JSON schema for workflows, edge handle conventions, config node architecture |
| **[Execution Engine Design](./docs-internal/DESIGN.md)** | Architecture patterns, design standards, and implementation details for the workflow execution engine |
| **[Execution Roadmap](./docs-internal/ROADMAP.md)** | Implementation status, completed phases, and pending features |
| **[Setup Guide](./docs-internal/SETUP.md)** | Development environment setup and installation instructions |
| **[Scripts Reference](./docs-internal/SCRIPTS.md)** | Available npm/shell scripts and their usage |
| **[Server Documentation](./docs-internal/server-readme.md)** | Python backend architecture and API documentation |
| **[Skill Creation Guide](./server/skills/GUIDE.md)** | How to create new skills (folder structure, SKILL.md format, metadata, supporting files) |
| **[New Service Integration](./docs-internal/new_service_integration.md)** | Complete guide for integrating external services (OAuth, database, handlers, nodes, AI tools) - use Google Workspace as reference |
| **[Onboarding Service](./docs-internal/onboarding.md)** | First-launch welcome wizard with 5 steps, database persistence, and replay from Settings |
| **[Polyglot Server](../polyglot-server/ARCHITECTURE.md)** | Plugin registry microservice with MCP gateway (optional integration) |

## Design Principles & Standards

**CRITICAL: Always follow these principles when modifying backend execution code:**

### 1. Use Existing Patterns - No Tribal Code
- **Never add ad-hoc workarounds** - Use the established patterns documented in DESIGN.md
- **Conductor Decide Pattern** - All orchestration goes through `_workflow_decide()` loop
- **Fork/Join Parallelism** - Use `asyncio.gather()` for concurrent node execution
- **Prefect Task Caching** - Cache results via `hash_inputs()` and `generate_cache_key()`
- **Distributed Locking** - Use Redis SETNX pattern for concurrent access control

### 2. State Management
- **Isolated Execution Contexts** - Each workflow run has its own `ExecutionContext`
- **No Global State** - Never use module-level variables for execution state
- **Cache Persistence** - Execution state persists to Redis (production) or SQLite (local development)
- **Explicit State Machines** - Tasks follow `TaskStatus` enum, workflows follow `WorkflowStatus`

### 3. Separation of Concerns
- **Models** (`models.py`) - Pure data structures, JSON-serializable, no business logic
- **Cache** (`cache.py`) - Redis persistence abstraction only
- **Executor** (`executor.py`) - Orchestration logic, decide pattern implementation
- **Recovery** (`recovery.py`) - Heartbeat and crash recovery only
- **Conditions** (`conditions.py`) - Edge condition evaluation for runtime branching

### Backend Service Architecture (n8n-inspired)
The workflow backend follows modular architecture patterns from n8n, Temporal, and Conductor:

```
server/services/
├── workflow.py              # Facade (~460 lines) - thin coordinator
├── node_executor.py         # Single node execution with registry pattern
├── parameter_resolver.py    # Template variable resolution
├── agent_team.py            # AgentTeamService for multi-agent coordination
├── nodejs_client.py         # HTTP client for Node.js code executor
├── pricing.py               # LLM and API cost calculation (loads config/pricing.json)
├── tracked_http.py          # HTTPX event hooks for automatic API cost tracking
├── deployment/              # Event-driven deployment lifecycle
│   ├── __init__.py
│   ├── state.py             # DeploymentState, TriggerInfo dataclasses
│   ├── triggers.py          # TriggerManager (cron, event triggers)
│   └── manager.py           # DeploymentManager (deploy, cancel, status)
├── execution/               # Parallel workflow orchestration
│   ├── models.py            # ExecutionContext, TaskStatus
│   ├── executor.py          # WorkflowExecutor with decide pattern
│   ├── cache.py             # Cache persistence (Redis/SQLite)
│   └── recovery.py          # Crash recovery
└── temporal/                # Distributed workflow execution (optional)
    ├── __init__.py          # Exports TemporalExecutor, TemporalClientWrapper
    ├── workflow.py          # MachinaWorkflow orchestrator
    ├── activities.py        # Class-based activities with connection pooling
    ├── worker.py            # TemporalWorkerManager + run_standalone_worker()
    ├── executor.py          # TemporalExecutor interface
    ├── client.py            # Temporal client wrapper
    └── ws_client.py         # WebSocket connection pool

server/core/
├── container.py             # Dependency injection container
├── database.py              # SQLite database with cache CRUD methods
├── cache.py                 # CacheService with Redis/SQLite/Memory fallback
├── config.py                # Application configuration
├── logging.py               # Logging configuration
├── encryption.py            # Fernet encryption with PBKDF2 key derivation
├── credentials_database.py  # Async SQLite for encrypted API keys and OAuth tokens
└── credential_backends.py   # Multi-backend abstraction (Fernet, Keyring, AWS)

server/models/
├── cache.py                 # CacheEntry SQLModel for SQLite cache
├── auth.py                  # User model with bcrypt
└── database.py              # ConversationMessage, NodeParameter, ToolSchema, ChatMessage, TokenUsageMetric, APIUsageMetric, CompactionEvent, SessionTokenState, UserSettings, ProviderDefaults, AgentTeam, TeamMember, TeamTask, AgentMessage tables

server/config/
├── llm_defaults.json        # Default models per provider (edit to change defaults)
└── pricing.json             # LLM and API pricing config

server/nodejs/                   # Persistent Node.js server for JS/TS execution
├── package.json                 # Dependencies: express, tsx
├── tsconfig.json                # TypeScript config (ES2024)
├── src/
│   └── index.ts                 # Express server (/execute, /health, /packages/*)
└── user-packages/               # User-installed npm packages
```

### Polyglot Server Integration (Optional)
MachinaOs can optionally integrate with **polyglot-server** - a centralized plugin registry microservice that exposes integrations through REST API, MCP (Model Context Protocol), and WebSocket.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      MachinaOs                                   │
│  ┌────────────────┐    ┌────────────────┐                       │
│  │ React Flow     │───▶│ FastAPI Backend│                       │
│  │ Frontend       │    │ (port 3010)    │                       │
│  └────────────────┘    └───────┬────────┘                       │
│                                │                                 │
│              ┌─────────────────┴─────────────────┐              │
│              │         NodeExecutor              │              │
│              │  (registry-based dispatch)        │              │
│              └─────────────────┬─────────────────┘              │
└────────────────────────────────│────────────────────────────────┘
                                 │ HTTP (aiohttp)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Polyglot Server (port 8080)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   REST API  │  │     MCP     │  │  WebSocket  │              │
│  │   Gateway   │  │   Server    │  │   Handler   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │    Plugin Registry    │                          │
│              │  Discord, Telegram,   │                          │
│              │  Notion, GitHub, etc. │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

**Files:**
```
server/services/
├── polyglot_client.py          # HTTP client for polyglot-server
└── handlers/
    └── polyglot.py             # Standalone handler (not wired to NodeExecutor)
```

**PolyglotClient** (`server/services/polyglot_client.py`):
```python
class PolyglotClient:
    """HTTP client for polyglot-server plugin registry."""

    async def list_plugins(self) -> List[Dict[str, Any]]:
        """List all available plugins."""

    async def get_schema(self, plugin_name: str) -> Optional[Dict[str, Any]]:
        """Get plugin input/output schema for workflow node integration."""

    async def execute(self, plugin_name: str, action: str, params: Dict) -> Dict:
        """Execute a plugin action."""
```

**Polyglot Handler** (`server/services/handlers/polyglot.py`):
```python
async def handle_polyglot_node(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    polyglot_client,  # Injected via functools.partial
) -> Dict[str, Any]:
    """Execute a workflow node via polyglot-server plugin registry."""
    plugin_name = node_type.replace("Node", "").lower()
    result = await polyglot_client.execute(plugin_name, action, params)
    return {"success": True, "result": result.get("result", {}), ...}

# Node types that can be routed to polyglot-server
POLYGLOT_NODE_TYPES = frozenset([
    "discordNode", "telegramNode", "slackNode", "notionNode",
    "todoistNode", "gmailNode", "twitterNode", "githubNode", ...
])
```

**Configuration** (when enabled):
```bash
# In server/.env
POLYGLOT_SERVER_URL=http://localhost:8080  # polyglot-server address
```

**Current Status**: Standalone integration files created. Not wired into NodeExecutor to avoid disturbing existing workflow execution flow. Future integration will add polyglot node types to handler registry via `functools.partial` pattern.

### Node.js Code Executor
Persistent Node.js server for JavaScript/TypeScript code execution, replacing subprocess spawning per execution.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                  Python Backend (port 3010)                  │
│  ┌────────────────┐     HTTP/JSON      ┌──────────────────┐ │
│  │ NodeJSClient   │◄──────────────────►│  Node.js Server  │ │
│  │ (aiohttp)      │   localhost:3020   │  (Express + tsx) │ │
│  └────────────────┘                    └──────────────────┘ │
│         ▲                                                    │
│         │                                                    │
│  ┌──────┴─────────┐                                         │
│  │ code.py        │                                         │
│  │ handlers       │                                         │
│  └────────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
```

**Files:**
```
server/nodejs/
├── package.json              # Dependencies: express, tsx
├── tsconfig.json             # TypeScript config (ES2024)
├── src/
│   └── index.ts              # Express server with /execute, /health, /packages/*
└── user-packages/            # User npm packages directory
    └── package.json

server/services/
├── nodejs_client.py          # Async HTTP client for Node.js server
└── handlers/
    └── code.py               # handle_javascript_executor, handle_typescript_executor
```

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with Node.js version |
| `/execute` | POST | Execute JS/TS code with input_data and timeout |
| `/packages/install` | POST | Install npm packages to user-packages |
| `/packages` | GET | List installed packages |

**Environment Variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `NODEJS_EXECUTOR_URL` | `http://localhost:3020` | Server URL for Python client |
| `NODEJS_EXECUTOR_TIMEOUT` | `30` | Request timeout in seconds |
| `NODEJS_EXECUTOR_PORT` | `3020` | Server port |
| `NODEJS_EXECUTOR_HOST` | `localhost` | Server host |
| `NODEJS_EXECUTOR_BODY_LIMIT` | `10mb` | Max request body size |

**Key Modules:**

| Module | Responsibility | Pattern |
|--------|---------------|---------|
| `workflow.py` | Facade delegating to specialized modules | Facade Pattern |
| `node_executor.py` | Execute single node via handler registry | Registry + functools.partial |
| `parameter_resolver.py` | Resolve `{{node.field}}` templates | Compiled regex |
| `deployment/manager.py` | Deploy/cancel workflows, spawn runs | n8n Deployment |
| `deployment/triggers.py` | Setup cron/event triggers | Event-driven |
| `deployment/state.py` | Immutable state dataclasses | Dataclass |
| `temporal/executor.py` | Temporal-based distributed execution | Per-node Activities |
| `temporal/workflow.py` | Pure orchestrator (no business logic) | FIRST_COMPLETED |
| `temporal/worker.py` | Worker lifecycle + horizontal scaling | Connection Pooling |

**NodeExecutor Registry Pattern:**
```python
class NodeExecutor:
    def _build_handler_registry(self) -> Dict[str, Callable]:
        return {
            'start': handle_start,
            'aiAgent': partial(handle_ai_agent, ai_service=self.ai_service),
            # ... registry-based dispatch instead of if-else chains
        }
```

### 4. Dependency Injection
```python
# Correct: Receive dependencies via constructor
class WorkflowExecutor:
    def __init__(self, cache: ExecutionCache, node_executor: Callable):
        self.cache = cache
        self.node_executor = node_executor

# Wrong: Import and use global singletons
from services.some_service import global_instance
```

### 5. Error Handling & Logging
- **Log at appropriate levels**: DEBUG for routine operations, INFO for significant events, ERROR for failures
- **Never suppress errors silently** - Always log or propagate
- **Use structured logging** - Include context (node_id, execution_id, etc.)
- **Configurable via `.env`**: Set `LOG_LEVEL=DEBUG` for verbose output, `LOG_LEVEL=INFO` for production

#### Logging Configuration
```bash
# In server/.env
LOG_LEVEL=INFO      # Default: INFO, DEBUG for verbose
LOG_FORMAT=text     # text or json
```

**What logs at each level:**
- `DEBUG`: Template resolution, parameter resolution, node execution details, event waiter registration, downstream traversal
- `INFO`: Workflow completion, deployment start/stop, significant state changes
- `ERROR`: Failures, exceptions, validation errors

### 6. Cleanup & Lifecycle
- **Use existing teardown methods** - e.g., `_teardown_all_cron_triggers()` for cron cleanup
- **Cleanup in finally blocks** - Ensure resources are released even on error
- **No orphan prevention hacks** - Trust the existing lifecycle management

### 7. Cache System Architecture (n8n Pattern)
The cache system follows n8n's pattern with automatic fallback:

```
Production (Docker):  Redis → SQLite → Memory
Local Development:    SQLite → Memory (Redis disabled)
```

**Configuration** (`server/.env`):
```bash
REDIS_ENABLED=false           # Local dev: use SQLite
REDIS_URL=redis://redis:6379  # Production: Docker Redis
```

**CacheService** (`server/core/cache.py`):
```python
class CacheService:
    def __init__(self, database: Database, settings: Settings):
        self._database = database
        self._settings = settings
        self._redis: Optional[Redis] = None
        self._memory_cache: Dict[str, Any] = {}

    async def get(self, key: str) -> Optional[str]:
        # Try Redis first (if enabled)
        if self._redis:
            value = await self._redis.get(key)
            if value: return value
        # Fall back to SQLite
        entry = await self._database.get_cache_entry(key)
        if entry: return entry.value
        # Fall back to memory
        return self._memory_cache.get(key)
```

**SQLite Cache Model** (`server/models/cache.py`):
```python
class CacheEntry(SQLModel, table=True):
    __tablename__ = "cache_entries"
    key: str = Field(primary_key=True)
    value: str
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

**Key Methods** (`server/core/database.py`):
- `get_cache_entry(key)` - Get cache entry by key
- `set_cache_entry(key, value, ttl)` - Set with optional TTL
- `delete_cache_entry(key)` - Delete by key
- `cleanup_expired_cache()` - Remove expired entries

## Codebase Summary
- **Hybrid architecture**: Node.js + Python + React TypeScript
- **89 implemented workflow nodes** with clean service separation (6 AI models + 3 AI agents/memory + 13 specialized agents + 11 skills + 3 dedicated tools + 9 dual-purpose tools + 16 Android + 3 WhatsApp + 4 Twitter + 2 Social + 3 Location + 3 Code + 6 Utility + 6 Document + 2 Chat + 2 Scheduler + 1 Workflow + 7 Google Workspace + 1 Apify + 3 Search)
- **WebSocket-First Architecture**: WebSocket as primary frontend-backend communication (87 message handlers)
- **Recent optimizations**: REST APIs replaced with WebSocket, AI endpoints migrated to Python, Android automation integrated

## Architecture Refactoring
The project was completely refactored from schema-based node definitions to explicit INodeProperties interface system inspired by n8n architecture. Key changes:
- **Pure INodeProperties System**: Removed all backward compatibility layers
- **82 Implemented Node Components**: AI models, agents, skills, location services, Android automation, WhatsApp, Twitter/X, social, code execution, HTTP/Webhook utilities, document processing, chat, schedulers, and search
- **WebSocket-First Communication**: 86 WebSocket message handlers replace most REST API calls
- **Resource-Operation Pattern**: Organized by functional categories (AI, Location, Android, WhatsApp)
- **TypeScript-First**: Full type safety with proper interface alignment
- **Code Cleanup**: Removed dead code, unused files, and legacy methods
- **Android Integration**: 16 Android service nodes with ADB-based device automation

## Key Files & Components

### Core Types
- `src/types/INodeProperties.ts` - Core interfaces for n8n-inspired node properties system
- `src/types/NodeTypes.ts` - Legacy compatibility types (NodeParameter, NodeOutput)

### Node System
- `src/nodeDefinitions.ts` - Main registry importing and merging all modular node definitions
- `src/nodeDefinitions/aiModelNodes.ts` - AI chat model definitions using factory pattern
- `src/nodeDefinitions/aiAgentNodes.ts` - AI agent and processing components
- `src/nodeDefinitions/skillNodes.ts` - Skill node definitions (11 nodes including masterSkill and customSkill)
- `src/nodeDefinitions/specializedAgentNodes.ts` - Specialized AI agent definitions (10 nodes) with shared AI_AGENT_PROPERTIES and centralized dracula theming
- `src/nodeDefinitions/toolNodes.ts` - AI Agent tool nodes (calculatorTool, currentTimeTool, duckduckgoSearch)
- `src/nodeDefinitions/searchNodes.ts` - Search API nodes (braveSearch, serperSearch, perplexitySearch)
- `src/nodeDefinitions/androidServiceNodes.ts` - 16 Android service nodes (monitoring, apps, automation, sensors, media)
- `src/nodeDefinitions/locationNodes.ts` - Google Maps and location services
- `src/nodeDefinitions/googleWorkspaceNodes.ts` - All Google Workspace nodes (7 consolidated nodes)
- `src/nodeDefinitions/whatsappNodes.ts` - WhatsApp messaging integration (3 nodes)
- `src/nodeDefinitions/twitterNodes.ts` - Twitter/X integration (4 nodes: send, search, user, receive)
- `src/nodeDefinitions/socialNodes.ts` - Unified social messaging nodes (socialReceive, socialSend)
- `src/nodeDefinitions/codeNodes.ts` - Python, JavaScript, and TypeScript code execution nodes
- `src/nodeDefinitions/utilityNodes.ts` - HTTP, Webhook, chatTrigger, and console nodes
- `src/nodeDefinitions/documentNodes.ts` - Document processing nodes (httpScraper, fileDownloader, documentParser, textChunker, embeddingGenerator, vectorStore)
- `src/nodeDefinitions/chatNodes.ts` - Chat send and history nodes
- `src/nodeDefinitions/schedulerNodes.ts` - Timer and cron scheduler nodes
- `src/nodeDefinitions/workflowNodes.ts` - Workflow start node
- `src/factories/baseChatModelFactory.ts` - Factory for creating standardized chat models
- `src/services/executionService.ts` - Node execution engine with routing to Python backend

### Assets
- `src/assets/icons/google/` - Official Google service SVG icons (Gmail, Calendar, Drive, Sheets, Tasks, Contacts) using n8n pattern with data URI exports

### UI Components
- `src/components/ParameterRenderer.tsx` - Universal parameter renderer (dual interface support)
- `src/components/parameterPanel/MiddleSection.tsx` - Parameter panel middle section with conditional display logic
- `src/components/OutputPanel.tsx` - Connected node output display with drag mapping
- `src/components/LocationParameterPanel.tsx` - Location-specific parameter handling
- `src/components/AIParameterRenderer.tsx` - AI component configuration
- `src/components/AIAgentNode.tsx` - Config-driven AI agent component supporting both aiAgent and chatAgent via AGENT_CONFIGS
- `src/ParameterPanel.tsx` - Main parameter configuration modal

### AI Chat Model Components
- `src/components/base/BaseChatModelNode.tsx` - Unified circular node design for all AI providers
- `src/components/ClaudeChatModelNode.tsx` - Anthropic Claude model component
- `src/components/OpenAIChatModelNode.tsx` - OpenAI GPT model component
- `src/components/GeminiChatModelNode.tsx` - Google Gemini model component
- `src/components/ModelNode.tsx` - Generic AI model node with provider detection
- `src/services/apiKeyManager.ts` - Secure API key storage and validation with LangChain

### Specialized UI
- `src/components/ui/MapSelector.tsx` - Interactive location picker
- `src/components/ui/OutputDisplayPanel.tsx` - Execution result display
- `src/components/ui/ComponentPalette.tsx` - Searchable component library with emoji icons and dracula-themed category colors. Categories: Workflow, Triggers, AI Agents, AI Models, AI Skills, AI Abilities, AI Tools, Google Maps, Social Media Platforms (merged WhatsApp + Social), Android, Chat, Code Executors
- `src/components/ui/ComponentItem.tsx` - Draggable node items with hover effects and icon rendering
- `src/components/ui/CodeEditor.tsx` - Syntax-highlighted code editor using react-simple-code-editor + prismjs with centralized theming

### Hooks & State
- `src/hooks/useParameterPanel.ts` - Parameter management via WebSocket
- `src/hooks/useExecution.ts` - Node execution via WebSocket
- `src/hooks/useApiKeys.ts` - API key management via WebSocket
- `src/hooks/useAndroidOperations.ts` - Android device operations via WebSocket
- `src/hooks/useWhatsApp.ts` - WhatsApp operations via WebSocket
- `src/hooks/useDragAndDrop.ts` - Drag-and-drop functionality
- `src/hooks/useComponentPalette.ts` - Component palette state with localStorage persistence
- `src/store/useAppStore.ts` - Zustand application state with localStorage persistence for UI settings

### Theme System
- `src/styles/theme.ts` - Unified theme with Solarized + Dracula color palettes
- `src/hooks/useAppTheme.ts` - Dynamic theme hook for dark/light mode
- `src/contexts/ThemeContext.tsx` - Theme context with `isDarkMode` and `toggleTheme`
- `src/index.css` - Global CSS including dark mode scrollbar styles

#### Color Palettes
The theme system uses two complementary color palettes:

**Solarized** (backgrounds and text):
- `theme.colors.*` - Dynamic colors based on light/dark mode
- `theme.accent.*` - Solarized accent colors (blue, cyan, green, yellow, orange, red, magenta, violet)

**Dracula** (vibrant action colors):
- `theme.dracula.green` (#50fa7b) - Run/Success actions
- `theme.dracula.purple` (#bd93f9) - Deploy/Save actions
- `theme.dracula.pink` (#ff79c6) - Cancel/Stop actions
- `theme.dracula.cyan` (#8be9fd) - Info/Alternative actions
- `theme.dracula.red` (#ff5555) - Error/Danger states
- `theme.dracula.orange` (#ffb86c) - Settings/Warning
- `theme.dracula.yellow` (#f1fa8c) - Credentials/Highlight

#### UI Components Using Dracula Theme
- **TopToolbar Action Buttons**: Run (green), Deploy (purple), Stop (pink), Save (cyan)
- **TopToolbar Icon Buttons**: Settings (orange), Credentials (yellow), Theme Toggle (yellow/purple)
- **TopToolbar File Button**: Cyan text with medium font size and semibold weight, colorful dropdown menu items
- **ParameterPanel Buttons**: Run (green), Save (purple), Cancel (pink)
- **React Flow Edges**: Default (cyan), Selected/Executing (purple), Completed (green), Error (red), Pending (cyan)
- **Node Execution Glow**: Purple glow animation during execution

#### File Operations Menu Styling
The File dropdown menu uses per-item Dracula colors:
```typescript
// In TopToolbar.tsx
{[
  { label: 'New Workflow', icon: '...', action: onNew, color: theme.dracula.green },
  { label: 'Open', icon: '...', action: onOpen, color: theme.accent.blue },
  { label: 'Export', icon: '...', action: onExportFile, color: theme.accent.cyan },
  { label: 'Import', icon: '...', action: onImportJSON, color: theme.accent.cyan },
  { label: 'Copy as JSON', icon: '...', action: onExportJSON, color: theme.dracula.purple },
].map(...)}

// File button style
const textButtonStyle: React.CSSProperties = {
  color: theme.dracula.cyan,
  border: `1px solid ${theme.dracula.cyan}40`,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  ...
};
```

#### Button Style Pattern
Action buttons use a consistent pattern with Dracula colors:
```typescript
const actionButtonStyle = (color: string, isDisabled = false) => ({
  backgroundColor: isDisabled ? `${theme.colors.primary}15` : `${color}25`,
  color: isDisabled ? theme.colors.primary : color,
  border: `1px solid ${isDisabled ? `${theme.colors.primary}40` : `${color}60`}`,
});
```

#### Edge Styles
React Flow edges use dynamic Dracula colors via `getEdgeStyles(theme.dracula)`:
- Default edges: `theme.dracula.cyan`
- Selected/executing: `theme.dracula.purple` with glow animation
- Completed: `theme.dracula.green`
- Error: `theme.dracula.red`
- Pending: `theme.dracula.cyan` with dash animation

### WebSocket-First Architecture
The project uses WebSocket as the primary communication method between frontend and backend, replacing most REST API calls:
- `src/contexts/WebSocketContext.tsx` - Central WebSocket context with request/response pattern
- `server/routers/websocket.py` - WebSocket endpoint with 87 message handlers
- `server/services/status_broadcaster.py` - Connection management and broadcasting

## Implemented Node Types
The following 108 nodes are currently implemented and functional:

### AI Chat Models (6 nodes)
- **openaiChatModel**: OpenAI GPT models with response format options. O-series models (o1, o3, o4) support reasoning effort parameter.
- **anthropicChatModel**: Claude models with extended thinking support (budget_tokens for claude-3-5-sonnet, claude-3-opus)
- **geminiChatModel**: Google Gemini models with multimodal capabilities, safety settings, and thinking support for 2.5/Flash Thinking models
- **openrouterChatModel**: OpenRouter unified API - access 200+ models from OpenAI, Anthropic, Google, Meta, Mistral, and more through a single API. Features free/paid model grouping in dropdown.
- **groqChatModel**: Groq ultra-fast inference with Llama, Mixtral, Gemma, and reasoning-capable Qwen3/QwQ models
- **cerebrasChatModel**: Cerebras ultra-fast inference on custom AI hardware with Llama and Qwen models

### AI Agents & Memory (3 nodes)
- **aiAgent**: Advanced AI agent with tool calling, memory input handle, and iterative reasoning. Uses LangGraph for structured execution. Parameters: Provider, Model, Prompt, System Message, Options.
- **chatAgent**: Conversational AI agent with memory and skill support for multi-turn chat interactions. Parameters: Provider, Model, Prompt (supports `{{chatTrigger.message}}` template or auto-fallback from connected input), System Message. Behavior extended by connected skills.
### AI Agent Tool Nodes (5 dedicated + 9 dual-purpose)
Tool nodes connect to AI Agent's `input-tools` handle to provide capabilities the agent can invoke during reasoning. Both `masterSkill` and `simpleMemory` are in the AI Tools category.

#### Dedicated Tool Nodes (passive, tool-only)
- **masterSkill**: Master Skill (icon: target) - Aggregates multiple skills with enable/disable toggles. Split-panel UI: left panel shows skill list with checkboxes, right panel shows selected skill's markdown editor. Supports both built-in skills (from `server/skills/` folders) and user-created skills (stored in database). User skills can be created/edited/deleted inline via the "+" button.
- **simpleMemory**: Markdown-based conversation memory with editable UI, window-based trimming, and optional vector DB for long-term semantic retrieval

#### Skill Node Architecture
Skills are organized in subfolders under `server/skills/`. Each top-level folder appears as an option in the Master Skill node's folder dropdown. See **[Skill Creation Guide](./server/skills/GUIDE.md)** for full documentation.

```
server/skills/
├── GUIDE.md                              # Skill creation guide
├── assistant/                            # General-purpose assistant skills
│   ├── assistant-personality/SKILL.md
│   ├── compaction-skill/SKILL.md
│   ├── humanify-skill/SKILL.md
│   ├── memory-skill/SKILL.md
│   └── subagent-skill/SKILL.md
├── android_agent/                        # Android device control skills
│   ├── personality/SKILL.md
│   ├── battery-skill/SKILL.md
│   ├── wifi-skill/SKILL.md
│   └── ... (12 skills total)
├── autonomous/                           # Autonomous agent patterns
│   ├── code-mode-skill/SKILL.md
│   ├── agentic-loop-skill/SKILL.md
│   ├── progressive-discovery-skill/SKILL.md
│   ├── error-recovery-skill/SKILL.md
│   └── multi-tool-orchestration-skill/SKILL.md
├── coding_agent/                         # Code execution skills
│   ├── python-skill/SKILL.md
│   └── javascript-skill/SKILL.md
├── productivity_agent/                   # Google Workspace skills
│   ├── gmail-skill/SKILL.md              # Send, search, read emails
│   ├── calendar-skill/SKILL.md           # Create, list, update, delete events
│   ├── drive-skill/SKILL.md              # Upload, download, list, share files
│   ├── sheets-skill/SKILL.md             # Read, write, append spreadsheet data
│   ├── tasks-skill/SKILL.md              # Create, list, complete tasks
│   └── contacts-skill/SKILL.md           # Create, list, search contacts
├── social_agent/                         # Social media platform skills
│   ├── twitter-send-skill/SKILL.md
│   ├── twitter-search-skill/SKILL.md
│   ├── twitter-user-skill/SKILL.md
│   ├── whatsapp-send-skill/SKILL.md
│   └── whatsapp-db-skill/SKILL.md
├── task_agent/                           # Task management skills
│   ├── timer-skill/SKILL.md
│   ├── cron-scheduler-skill/SKILL.md
│   └── task-manager-skill/SKILL.md
├── travel_agent/                         # Location and maps skills
│   ├── geocoding-skill/SKILL.md
│   └── nearby-places-skill/SKILL.md
└── web_agent/                            # Web automation skills
    ├── web-search-skill/SKILL.md
    └── http-request-skill/SKILL.md
```

**SKILL.md Format:**
```yaml
---
name: skill-name
description: Brief description for LLM visibility
allowed-tools: tool1 tool2
metadata:
  author: machina
  version: "1.0"
  category: general
  icon: "🔧"
  color: "#6366F1"
---

# Skill Instructions (Markdown)
Detailed instructions loaded when skill is activated.
```

**Skill Content Lifecycle:**
1. First load reads from SKILL.md on disk, seeds to database
2. Database is source of truth after first activation
3. Users edit instructions in UI, edits saved to DB only
4. "Reset to Default" reloads from original SKILL.md file

#### Skill Content Editor
Skill nodes display an Ant Design `Input.TextArea` (markdown content) to view and edit instructions:
- Instructions loaded automatically when skill node is selected
- Save button writes changes back to database
- Uses `get_skill_content` / `save_skill_content` WebSocket handlers
- **No Input/Output panels**: Skill nodes only show the middle section (parameters + editor) in the parameter panel

**Key Files:**
| File | Description |
|------|-------------|
| `client/src/nodeDefinitions/skillNodes.ts` | Skill node definitions with factory pattern |
| `client/src/hooks/useParameterPanel.ts` | Loads/saves skill content for skill nodes |
| `server/services/skill_loader.py` | SkillLoader for filesystem and database skills |
| `server/routers/websocket.py` | `get_skill_content`, `save_skill_content`, `list_skill_folders`, `scan_skill_folder` handlers |

#### Master Skill Editor
The Master Skill node uses a custom split-panel editor (`MasterSkillEditor.tsx`) instead of standard parameters:

**UI Layout:**
```
+----------------------------------------------------------+
| [Folder Dropdown: assistant v]                            |
+----------------------------------------------------------+
| +--------------------+ +--------------------------------+ |
| | SKILLS LIST        | | SKILL INSTRUCTIONS             | |
| | [Badge: 3 enabled] | |                                | |
| | [Search skills...] | | # WhatsApp Skill               | |
| |                    | |                                | |
| | [x] WhatsApp       | | This skill provides WhatsApp   | |
| | [x] Memory         | | messaging capabilities...      | |
| | [ ] Android        | |                                | |
| | [x] Maps           | | [Reset to Default]             | |
| | [ ] HTTP           | |                                | |
| +--------------------+ +--------------------------------+ |
+----------------------------------------------------------+
```

**Folder Dropdown:**
- Ant Design `Select` listing available skill folders from backend via `list_skill_folders` WebSocket handler
- Shows loading/disabled state while folders are being fetched
- Uses `getPopupContainer` to ensure dropdown renders correctly regardless of parent overflow
- Default folder: `assistant`

**Icon Resolution Priority:**
Skill icons are resolved in this order (node definition first for SVG support):
1. `skillNodes.ts` node definition icon (supports SVG data URIs, e.g., WhatsApp logo)
2. SKILL.md metadata `icon` field (emoji strings)
3. Default fallback

Implemented via `getNodeDefaults()` helper that looks up icon/color from `skillNodes.ts` by matching `skillName` property.

**Keyboard Handling:**
The editor uses a native DOM `addEventListener('keydown')` on a wrapper div (via `useRef`) to `stopPropagation()` for Ctrl/Meta key events. This prevents React Flow's document-level `useKeyPress` hook from intercepting Ctrl+A (select all) and other Ctrl shortcuts inside the textarea. React synthetic `stopPropagation()` is insufficient because React Flow uses native `document.addEventListener`.

**Data Structure:**
```typescript
// skillsConfig parameter stored in node parameters
interface MasterSkillConfig {
  [skillName: string]: {
    enabled: boolean;        // Whether skill is active
    instructions: string;    // Custom or default SKILL.md content
    isCustomized: boolean;   // True if user modified instructions
  };
}
```

**skillsConfig Persistence:**
- `skillsConfig` persists skills from **all folders**, not just the currently selected one. Switching folders does not remove previously enabled skills from config.
- The backend (`handlers/ai.py`) handles stale config entries gracefully at execution time -- it checks `enabled`, tries to load instructions, and logs a warning if a skill file is missing. Stale disabled entries are simply skipped.
- No frontend cleanup of stale skills is performed to avoid race conditions with async skill loading.

**Custom Skill Creation:**
- The `create_user_skill` WebSocket handler requires `name`, `display_name`, and `instructions`. The `description` field is optional (defaults to empty string).

**Backend Expansion:**
When AI Agent executes with a connected Master Skill node, `_collect_agent_connections()` in `handlers/ai.py` expands the skillsConfig into individual skill entries:
```python
if skill_type == 'masterSkill':
    skills_config = skill_params.get('skillsConfig', {})
    for skill_key, skill_cfg in skills_config.items():
        if skill_cfg.get('enabled', False):
            # Load from customized or skill folder
            instructions = skill_cfg.get('instructions') if skill_cfg.get('isCustomized') else skill_loader.load_skill(skill_key).instructions
            skill_data.append({
                'node_id': f"{source_node_id}_{skill_key}",
                'node_type': 'masterSkill',
                'skill_name': skill_key,
                'parameters': {'instructions': instructions},
                'label': skill_key
            })
```

**Key Files:**
| File | Description |
|------|-------------|
| `client/src/components/parameterPanel/MasterSkillEditor.tsx` | Split-panel skill aggregator UI with inline user skill CRUD |
| `client/src/nodeDefinitions/skillNodes.ts` | masterSkill node definition (group: tool) |
| `server/routers/websocket.py` | User skill CRUD: `get_user_skills`, `create_user_skill`, `update_user_skill`, `delete_user_skill` |
| `server/core/database.py` | UserSkill model and database CRUD methods |
| `server/services/handlers/ai.py` | Expands masterSkill into individual skills at execution |
| `server/skills/GUIDE.md` | Skill creation guide for built-in skills |

#### Other Dedicated Tool Nodes
- **calculatorTool**: Mathematical operations (add, subtract, multiply, divide, power, sqrt, mod, abs)
- **currentTimeTool**: Get current date/time with timezone support
- **duckduckgoSearch**: DuckDuckGo web search (free, uses `ddgs` library, no API key required)

#### Dual-Purpose Search Nodes (workflow node + AI tool)
Search API nodes that work BOTH as standalone workflow nodes AND as AI Agent tools. When connected to `input-tools`, the LLM fills the node's parameter schema.
- **braveSearch**: **Dual-purpose node** - Search the web using Brave Search API. Returns web results with titles, snippets, and URLs. Group: `['search', 'tool']`. Parameters: query, maxResults, country, searchLang, safeSearch.
- **serperSearch**: **Dual-purpose node** - Search the web using Google via Serper API. Supports web, news, images, and places search types with knowledge graph. Group: `['search', 'tool']`. Parameters: query, searchType, maxResults, country, language.
- **perplexitySearch**: **Dual-purpose node** - AI-powered search using Perplexity Sonar. Returns a markdown-formatted AI answer with inline citation references and source URLs. Group: `['search', 'tool']`. Parameters: query, model (sonar/sonar-pro/sonar-reasoning/sonar-reasoning-pro), searchRecencyFilter, returnImages, returnRelatedQuestions.

**Key Files:**
| File | Description |
|------|-------------|
| `client/src/nodeDefinitions/searchNodes.ts` | 3 dual-purpose search node definitions |
| `server/services/handlers/search.py` | 3 handler functions with API key fetch + usage tracking |
| `server/services/handlers/tools.py` | Tool dispatch wrappers for AI Agent tool calling |
| `server/services/ai.py` | Tool names, descriptions, and Pydantic schemas |
| `server/constants.py` | `SEARCH_NODE_TYPES` and `SEARCH_TOOL_TYPES` constants |
| `client/src/assets/icons/search/` | SVG icons for Brave, Serper, Perplexity |

**Search API Authentication:**
| Provider | Credential Key | Header | API Endpoint |
|----------|---------------|--------|-------------|
| Brave Search | `brave_search` | `X-Subscription-Token` | `GET https://api.search.brave.com/res/v1/web/search` |
| Serper | `serper` | `X-API-KEY` | `POST https://google.serper.dev/search` |
| Perplexity | `perplexity` | `Authorization: Bearer` | `POST https://api.perplexity.ai/chat/completions` |

**Credentials Modal Layout:**
- Brave Search and Perplexity in **Search** category
- Serper in **Scrapers** category (Google SERP scraping)

### Specialized AI Agents (13 nodes)
Specialized agents are AI Agents pre-configured for specific domains. They inherit full AI Agent functionality (provider, model, prompt, system message, thinking/reasoning) while being tailored for specific capabilities. All specialized agents route to `handle_chat_agent` in the backend and support the same input handles. Node colors use centralized dracula theme constants imported from `client/src/styles/theme.ts`.

**Input Handles:**
- `input-main` - Main data input (auto-prompting fallback)
- `input-skill` - Skill nodes (including Master Skill for aggregated skills)
- `input-memory` - Memory node for conversation history
- `input-tools` - Tool nodes for LLM tool calling
- `input-task` - Task completion events from taskTrigger nodes

**Specialized Agent Types:**
- **android_agent**: Android Control Agent - AI agent for Android device control. Connect Android service nodes (battery, wifi, bluetooth, apps, location, camera, sensors) as tools.
- **coding_agent**: Coding Agent - AI agent for code execution. Connect code executor nodes (Python, JavaScript) as tools.
- **web_agent**: Web Control Agent - AI agent for web automation. Connect web/browser nodes (scraper, HTTP, browser) as tools.
- **task_agent**: Task Management Agent - AI agent for task automation. Connect scheduling nodes (scheduler, reminders) as tools.
- **social_agent**: Social Media Agent - AI agent for social messaging. Connect messaging nodes (WhatsApp, Telegram) as tools.
- **travel_agent**: Travel Agent - AI agent for travel planning. Connect location, maps, and scheduling nodes as tools.
- **tool_agent**: Tool Agent - AI agent for tool orchestration. Connect any combination of tool nodes for flexible automation.
- **productivity_agent**: Productivity Agent - AI agent for productivity workflows. Connect scheduling, task, and utility nodes as tools.
- **payments_agent**: Payments Agent - AI agent for payment processing. Connect payment, invoice, and financial tool nodes.
- **consumer_agent**: Consumer Agent - AI agent for consumer interactions. Connect customer support, product, and order management tools.
- **autonomous_agent**: Autonomous Agent - AI agent for autonomous operations using Code Mode patterns. Uses agentic loops, progressive discovery, error recovery, and multi-tool orchestration for 81-98% token savings. Connect autonomous skills via Master Skill.
- **orchestrator_agent**: Orchestrator Agent - Team lead agent for coordinating multiple agents. Connect specialized agents via `input-teammates` handle; they become `delegate_to_*` tools the AI can invoke.
- **ai_employee**: AI Employee - Team lead agent similar to orchestrator_agent. Connect specialized agents via `input-teammates` handle for intelligent task delegation.

**Backend Routing:**
Specialized agents are detected by `SPECIALIZED_AGENT_TYPES` and routed to `handle_chat_agent`:
```python
# In node_executor.py - all specialized agents route to handle_chat_agent
SPECIALIZED_AGENT_TYPES = {
    'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent',
    'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent',
    'autonomous_agent', 'orchestrator_agent', 'ai_employee'
}
```

**Team Lead Types (Agent Teams Pattern):**
Team leads (`orchestrator_agent`, `ai_employee`) have a special `input-teammates` handle. Agents connected to this handle become delegation tools:
```python
# In handlers/ai.py
TEAM_LEAD_TYPES = {'orchestrator_agent', 'ai_employee'}

# Teammates become delegate_to_* tools automatically
if node_type in TEAM_LEAD_TYPES:
    teammates = await _collect_teammate_connections(node_id, context, database)
    if teammates:
        for tm in teammates:
            tool_data.append({
                'node_id': tm['node_id'],
                'node_type': tm['node_type'],  # e.g., 'coding_agent'
                'label': tm['label'],
            })
        # AI now has delegate_to_coding_agent, delegate_to_web_agent, etc.
```

**Direct Android Service Tools:**
Android service nodes (batteryMonitor, wifiAutomation, etc.) can be connected directly to any agent's `input-tools` handle. The backend maps camelCase node types to snake_case service IDs:
```python
# In handlers/tools.py
service_id_map = {
    'batteryMonitor': 'battery',
    'wifiAutomation': 'wifi_automation',
    'bluetoothAutomation': 'bluetooth_automation',
    # ... etc
}
```

#### Dual-Purpose Tool Nodes (workflow node + AI tool)
Nodes that work BOTH as standalone workflow nodes AND as AI Agent tools. When connected to `input-tools`, the LLM fills the node's parameter schema.
- **whatsappSend**: Send WhatsApp messages (text, media, location, contact). Full schema for all message types.
- **whatsappDb**: Query WhatsApp database - chat history, contacts, groups with filtering and pagination.
- **pythonExecutor**: Execute Python code for calculations, data processing, and automation. Tool name: `python_code`. Available: math, json, datetime, Counter, defaultdict, random.
- **javascriptExecutor**: Execute JavaScript code via persistent Node.js server for calculations, data processing, and JSON manipulation. Tool name: `javascript_code`.
- **typescriptExecutor**: Execute TypeScript code via persistent Node.js server with type safety. Tool name: `typescript_code`.
- **gmaps_locations**: Google Maps Geocoding service for address-to-coordinates conversion. Tool name: `geocode`.
- **gmaps_nearby_places**: Google Places API nearbySearch. Tool name: `nearby_places`.

See [Dual-Purpose Tool Node Guide](./docs-internal/dual_purpose_tool_node_creation.md) for implementation details.

### Location Services (3 nodes)
- **gmaps_create**: Google Maps creation with customizable center, zoom, and map type (display only, not a tool)
- **gmaps_locations**: **Dual-purpose** - Google Maps Geocoding service for address-to-coordinates conversion
- **gmaps_nearby_places**: **Dual-purpose** - Google Places API nearbySearch with detailed place information

#### Google Maps API Key Resolution
The MapsSection component fetches the Google Maps API key from backend credentials:
```typescript
// In MapsSection.tsx
const { getStoredApiKey, isConnected } = useApiKeys();
const [apiKey, setApiKey] = useState<string | undefined>(() => getGoogleMapsApiKey()); // Env fallback
const hasFetchedRef = useRef(false);

useEffect(() => {
  if (!isConnected || hasFetchedRef.current) return;
  const fetchApiKey = async () => {
    hasFetchedRef.current = true;
    const storedKey = await getStoredApiKey('google_maps');
    if (storedKey) setApiKey(storedKey);
  };
  fetchApiKey();
}, [isConnected, getStoredApiKey]);
```
- Falls back to environment variable if no stored key
- Uses `hasFetchedRef` to prevent multiple fetches
- Only fetches when WebSocket is connected

### Android Services (16 nodes)
Android device connection is configured via the Credentials Modal (Android panel), not via workflow nodes.

#### System Monitoring (4 nodes)
- **batteryMonitor**: Monitor battery status, level, charging state, temperature, and health
- **networkMonitor**: Monitor network connectivity, type, and internet availability
- **systemInfo**: Get device and OS information including Android version, API level, memory, and hardware details
- **location**: GPS location tracking with latitude, longitude, accuracy, and provider information

#### App Management (2 nodes)
- **appLauncher**: Launch applications by package name
- **appList**: Get list of installed applications with package names, versions, and metadata

#### Device Automation (6 nodes)
- **wifiAutomation**: WiFi control and scanning - enable, disable, get status, scan for networks
- **bluetoothAutomation**: Bluetooth control - enable, disable, get status, and paired devices
- **audioAutomation**: Volume and audio control - get/set volume, mute, unmute
- **deviceStateAutomation**: Device state control - airplane mode, screen on/off, power save mode, brightness
- **screenControlAutomation**: Screen control - brightness adjustment, wake screen, auto-brightness, screen timeout
- **airplaneModeControl**: Airplane mode status monitoring and control

#### Sensors (2 nodes)
- **motionDetection**: Accelerometer and gyroscope data - detect motion, shake gestures, device orientation
- **environmentalSensors**: Environmental sensors - temperature, humidity, pressure, light level

#### Media (2 nodes)
- **cameraControl**: Camera control - get camera info, take photos, camera capabilities
- **mediaControl**: Media playback control - volume control, playback control, play media files

### WhatsApp Nodes (3 nodes)
- **whatsappSend**: **Dual-purpose node** - Send WhatsApp messages (text, image, video, audio, document, sticker, location, contact). Works as workflow node OR AI Agent tool. Group: `['whatsapp', 'tool']`. Recipient types: Self (connected phone), Phone Number, Group. Full parameter schema for message type, media URL, location coordinates, contact vCard.
- **whatsappDb**: **Dual-purpose node** - Comprehensive WhatsApp database query node with 6 operations. Works as workflow node OR AI Agent tool. Group: `['whatsapp', 'tool']`. Operations:
  - `chat_history`: Retrieve messages from individual or group chats with filtering and pagination
  - `search_groups`: Search groups by name
  - `get_group_info`: Get group details with participant names and phone numbers
  - `get_contact_info`: Get full contact info (name, phone, profile picture) for sending/replying
  - `list_contacts`: List all contacts with saved names
  - `check_contacts`: Check WhatsApp registration status for phone numbers
- **whatsappReceive**: Event-driven trigger that waits for incoming WhatsApp messages with filters (message type, sender, group, keywords, forwarded status). Marked with `['whatsapp', 'trigger']` group for n8n-style trigger identification. Stores group/sender names alongside JID/phone for display persistence. The Go RPC resolves LIDs to phone numbers before sending events - `sender_phone` field is already resolved. Filter options: All Messages, From Self (notes to self chat only), From Any Contact (Non-Group), From Specific Contact, From Specific Group, Contains Keywords

### Social Nodes (2 nodes)
Unified social messaging nodes for multi-platform communication. Supports WhatsApp, Telegram, Discord, Slack, Signal, SMS, Webchat, Email, Matrix, Teams.

- **socialReceive**: Normalizes messages from platform triggers into unified format. Multiple outputs: Message, Media, Contact, Metadata. Filters by channel, message type, sender.
- **socialSend**: **Dual-purpose node** - Send messages to any supported platform. Works as workflow node OR AI Agent tool. Supports text, image, video, audio, document, sticker, location, contact, poll, buttons, list message types.

### Twitter/X Nodes (4 nodes)
Twitter/X integration using the official XDK Python SDK with OAuth 2.0 PKCE authentication.

- **twitterSend**: **Dual-purpose node** - Post tweets, reply, retweet, like/unlike, and delete tweets. Works as workflow node OR AI Agent tool. Group: `['social', 'tool']`. Actions: `tweet`, `reply`, `retweet`, `like`, `unlike`, `delete`. Parameters: action, text (280 char max), tweet_id, reply_to_id.
- **twitterSearch**: **Dual-purpose node** - Search recent tweets using query operators. Works as workflow node OR AI Agent tool. Group: `['social', 'tool']`. Supports X API v2 query syntax: keywords, hashtags (#), mentions (@), from:user, to:user, -exclude, OR, lang:, has:links, has:media, is:retweet, -is:retweet.
- **twitterUser**: **Dual-purpose node** - Look up user profiles and social connections. Works as workflow node OR AI Agent tool. Group: `['social', 'tool']`. Operations: `me` (get authenticated user), `by_username`, `by_id`, `followers`, `following`.
- **twitterReceive**: Event-driven trigger that waits for incoming Twitter events (mentions, DMs, timeline updates). Group: `['social', 'trigger']`. Polling-based since X API free tier lacks webhooks.

#### Twitter OAuth 2.0 Authentication
Authentication is handled via OAuth 2.0 PKCE flow in the Credentials Modal:
1. User clicks "Login with Twitter" button
2. Backend generates PKCE code challenge and authorization URL
3. Browser opens Twitter authorization page
4. User grants permission, Twitter redirects with auth code
5. Backend exchanges code for access_token + refresh_token
6. Tokens stored in database via auth_service

**Key Files:**
| File | Description |
|------|-------------|
| `server/services/twitter_oauth.py` | OAuth 2.0 PKCE flow implementation |
| `server/services/oauth_utils.py` | Runtime OAuth redirect URI derivation from request context |
| `server/routers/twitter.py` | OAuth callback endpoint, token exchange |
| `server/services/handlers/twitter.py` | Node handlers using XDK SDK |
| `client/src/nodeDefinitions/twitterNodes.ts` | 4 node definitions |
| `client/src/components/CredentialsModal.tsx` | Twitter panel with OAuth button |
| `server/skills/social_agent/twitter-*-skill/` | 3 Twitter skills for AI agents |

**XDK SDK API Patterns:**
```python
from xdk import Client

# Create client with OAuth 2.0 user token
client = Client(access_token=access_token)

# Post tweet
client.posts.create(body={"text": "Hello world!"})

# Reply to tweet
client.posts.create(body={"text": "Reply", "reply": {"in_reply_to_tweet_id": "123"}})

# Retweet
client.users.repost_post(user_id, body={"tweet_id": "123"})

# Like/Unlike
client.users.like_post(user_id, body={"tweet_id": "123"})
client.users.unlike_post(user_id, tweet_id="123")

# Delete
client.posts.delete(tweet_id)

# Search
client.posts.search_recent(query="...", max_results=100, tweet_fields=["author_id", "created_at"])

# User lookup
client.users.get_me(user_fields=["created_at", "description"])
client.users.get_by_usernames(usernames=["user1"], user_fields=["description"])
client.users.get_followers(user_id, max_results=100, user_fields=["created_at"])
```

**Environment Variables:**
```bash
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
# TWITTER_REDIRECT_URI is derived at runtime from request context (no env var needed)
```

### Google Workspace Nodes (7 nodes)
Consolidated Google Workspace integration with 6 unified operation-based nodes + 1 polling trigger. Each service node uses an `operation` parameter to select the action (e.g., gmail with operation: send/search/read). All services share a single OAuth connection with combined scopes.

#### Consolidated Service Nodes (6 nodes)
- **gmail**: **Dual-purpose node** - Operations: `send`, `search`, `read`. Handler: `handle_google_gmail()` dispatcher.
- **calendar**: **Dual-purpose node** - Operations: `create`, `list`, `update`, `delete`.
- **drive**: **Dual-purpose node** - Operations: `upload`, `download`, `list`, `share`.
- **sheets**: **Dual-purpose node** - Operations: `read`, `write`, `append`.
- **tasks**: **Dual-purpose node** - Operations: `create`, `list`, `complete`, `update`, `delete`.
- **contacts**: **Dual-purpose node** - Operations: `create`, `list`, `search`, `get`, `update`, `delete`.

#### Trigger Nodes (1 node)
- **gmailReceive**: Polling-based trigger for incoming emails. Polls Gmail API at configurable interval (10-3600s). Parameters: `filter_query` (default: `is:unread`), `label_filter` (default: `INBOX`), `mark_as_read`, `poll_interval` (default: 60s). In deployment mode, uses `setup_polling_trigger` with baseline detection to avoid triggering on existing emails.

#### Google Workspace OAuth 2.0 Authentication
Authentication is handled via OAuth 2.0 flow in the Credentials Modal:
1. User enters Google Cloud Client ID and Secret (OAuth 2.0 credentials)
2. User clicks "Login with Google"
3. Consent screen shows all requested scopes (Gmail, Calendar, Drive, etc.)
4. User grants permission, Google redirects with auth code
5. Backend exchanges code for access_token + refresh_token
6. Tokens stored via auth_service (owner mode) or google_connections table (customer mode)

**Combined OAuth Scopes:**
```python
GOOGLE_WORKSPACE_SCOPES = [
    # User Info
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    # Gmail
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    # Calendar
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    # Drive
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    # Sheets
    "https://www.googleapis.com/auth/spreadsheets",
    # Tasks
    "https://www.googleapis.com/auth/tasks",
    # Contacts
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/contacts.readonly",
]
```

**Key Files:**
| File | Description |
|------|-------------|
| `server/services/google_oauth.py` | OAuth 2.0 flow (authorization URL, token exchange, `get_callback_paths()`) |
| `server/services/oauth_utils.py` | Runtime OAuth redirect URI derivation from request context |
| `server/services/handlers/google_auth.py` | Shared credential helper (`get_google_credentials()`) used by all 6 handlers |
| `server/config/google_apis.json` | API endpoints, scopes, and OAuth callback paths |
| `server/routers/google.py` | OAuth callback and status endpoints |
| `server/services/handlers/gmail.py` | Gmail handlers + `handle_gmail_receive` polling trigger |
| `server/services/handlers/calendar.py` | Calendar handlers |
| `server/services/handlers/drive.py` | Drive handlers |
| `server/services/handlers/sheets.py` | Sheets handlers |
| `server/services/handlers/tasks.py` | Tasks handlers |
| `server/services/handlers/contacts.py` | Contacts handlers |
| `server/models/database.py` | `GoogleConnection` model |
| `server/skills/productivity_agent/` | Google Workspace skills for AI agents |
| `client/src/nodeDefinitions/googleWorkspaceNodes.ts` | All 7 Google node definitions (consolidated) |
| `client/src/assets/icons/google/` | Official Google service SVG icons (n8n pattern) |
| `client/src/components/CredentialsModal.tsx` | Google Workspace panel |

**Token Storage (Two Separate Systems):**

Client ID and Secret are stored as API keys (user enters manually):
| Key | Storage Method | Description |
|-----|---------------|-------------|
| `google_client_id` | `auth_service.get_api_key()` / `EncryptedAPIKey` table | OAuth 2.0 Client ID |
| `google_client_secret` | `auth_service.get_api_key()` / `EncryptedAPIKey` table | OAuth 2.0 Client Secret |

Access and refresh tokens are stored via OAuth system (after Google login):
| Field | Storage Method | Description |
|-------|---------------|-------------|
| `access_token` | `auth_service.get_oauth_tokens("google")` / `EncryptedOAuthToken` table | Access token for API calls |
| `refresh_token` | `auth_service.get_oauth_tokens("google")` / `EncryptedOAuthToken` table | Refresh token for renewal |
| `email`, `name` | `auth_service.get_oauth_tokens("google")` / `EncryptedOAuthToken` table | Connected user info |

**IMPORTANT**: All handlers use `get_google_credentials()` from `google_auth.py`, which reads tokens via `get_oauth_tokens()`. Never use `get_api_key("google_access_token")` — that reads from the wrong table.

**AI Agent Skills (productivity_agent folder):**
| Skill | Tools | Description |
|-------|-------|-------------|
| `gmail-skill` | `gmail_send`, `gmail_search`, `gmail_read` | Send, search, read emails |
| `calendar-skill` | `calendar_create`, `calendar_list`, `calendar_update`, `calendar_delete` | Manage calendar events |
| `drive-skill` | `drive_upload`, `drive_download`, `drive_list`, `drive_share` | Manage Drive files |
| `sheets-skill` | `sheets_read`, `sheets_write`, `sheets_append` | Read/write spreadsheet data |
| `tasks-skill` | `tasks_create`, `tasks_list`, `tasks_complete` | Manage Google Tasks |
| `contacts-skill` | `contacts_create`, `contacts_list`, `contacts_search` | Manage contacts |

**OAuth Redirect URIs:**
OAuth redirect URIs are derived at runtime from the request/WebSocket context via `server/services/oauth_utils.py`. No environment variable needed -- works automatically in dev (`http://localhost:3010`) and production (`https://domain.com`).

**Google API Pricing:** All Google Workspace APIs are free with rate limits. See `server/config/pricing.json` for configured limits.

### Apify Nodes (1 node)
Web scraping service for social media, search engines, and websites using pre-built actors.

- **apifyActor**: **Dual-purpose node** - Run Apify actors (web scrapers) for Instagram, TikTok, Twitter/X, LinkedIn, Facebook, YouTube, Google Search, Google Maps, and website crawling. Works as workflow node OR AI Agent tool. Group: `['api', 'scraper', 'tool']`. Pre-built actor dropdown with quick input helpers per actor type. Parameters: actorId, actorInput (JSON), maxResults, timeout, memory.

**Key Files:**
| File | Description |
|------|-------------|
| `client/src/nodeDefinitions/apifyNodes.ts` | Node definition with actor presets |
| `server/services/handlers/apify.py` | Actor execution via apify-client SDK |
| `server/skills/web_agent/apify-skill/SKILL.md` | AI agent skill for web scraping |
| `client/src/components/CredentialsModal.tsx` | Apify API token panel |

**Authentication:** Single API token (Personal or Organization) from Apify Console -> Settings -> Integrations.

### Workflow Nodes (2 nodes)
- **start**: Manual workflow trigger to start workflow execution
- **taskTrigger**: Event-driven trigger that fires when a delegated child agent completes its task (success or error). Filters by task_id, agent_name, status (all/completed/error), and parent_node_id. Output includes task_id, status, agent_name, result/error, workflow_id.

### Code Nodes (3 nodes)
- **pythonExecutor**: **Dual-purpose node** - Execute Python code with syntax-highlighted editor, input_data access, and console output. Works as workflow node OR AI Agent tool (`python_code`). Available libraries: math, json, datetime, timedelta, re, random, Counter, defaultdict.
- **javascriptExecutor**: **Dual-purpose node** - Execute JavaScript code via persistent Node.js server with syntax-highlighted editor and console output. Works as workflow node OR AI Agent tool (`javascript_code`).
- **typescriptExecutor**: **Dual-purpose node** - Execute TypeScript code via persistent Node.js server with type safety, syntax-highlighted editor and console output. Works as workflow node OR AI Agent tool (`typescript_code`).

### Utility Nodes (6 nodes)
- **httpRequest**: Make HTTP requests to external APIs (GET, POST, PUT, DELETE, PATCH) with configurable headers, body, and timeout
- **webhookTrigger**: Event-driven trigger that waits for incoming HTTP requests at `/webhook/{path}` with method filtering and authentication options
- **webhookResponse**: Send custom response back to webhook caller with configurable status code, body, and content type
- **chatTrigger**: Trigger node that receives messages from the Console Panel chat interface
- **console**: Console output node for logging workflow execution data
- **teamMonitor**: Real-time monitoring of Agent Team operations. Connect to AI Employee or Orchestrator to display team status, active tasks, and event stream

### Document Processing Nodes (6 nodes)
RAG pipeline nodes for document ingestion, processing, and vector storage. Supports multiple providers and backends.

- **httpScraper**: Scrape links from web pages with date/page pagination support. Modes: single request, date range iteration, page pagination. Outputs: items array with URLs.
- **fileDownloader**: Download files from URLs in parallel using semaphore-based concurrency. Parameters: output directory, max workers (1-32), skip existing, timeout.
- **documentParser**: Parse documents to text using configurable parsers. Parsers: PyPDF (fast), Marker (GPU OCR), Unstructured (multi-format), BeautifulSoup (HTML).
- **textChunker**: Split text into overlapping chunks for embedding. Strategies: recursive (recommended), markdown, token. Parameters: chunk size (100-8000), overlap (0-1000).
- **embeddingGenerator**: Generate vector embeddings from text chunks. Providers: HuggingFace (local), OpenAI, Ollama. Default model: BAAI/bge-small-en-v1.5.
- **vectorStore**: Store and query vector embeddings. Operations: store, query, delete. Backends: ChromaDB (local), Qdrant (production), Pinecone (cloud).

### Chat Nodes (2 nodes)
- **chatSend**: Send messages to chat conversations
- **chatHistory**: Retrieve chat conversation history

### Scheduler Nodes (2 nodes)
- **timer**: Timer-based trigger with configurable delay
- **cronScheduler**: Cron expression-based scheduling trigger

#### Document Processing Dependencies
```
# Required (in server/requirements.txt)
beautifulsoup4>=4.12.0
langchain-text-splitters>=0.3.0
langchain-huggingface>=0.1.0
chromadb>=0.5.0
qdrant-client>=1.12.0
sentence-transformers>=3.0.0
pypdf>=4.0.0

# Optional (GPU OCR and multi-format parsing)
# marker-pdf>=1.0.0    # Requires CUDA
# unstructured>=0.16.0  # Multi-format document parsing
```

#### Document Node Architecture
```
server/services/handlers/
└── document.py           # 6 async handler functions

client/src/nodeDefinitions/
└── documentNodes.ts      # 6 node definitions with conditional properties
```

## Backend Services

### Python Backend (FastAPI)
- **Port**: 3010
- **Base URL**: http://localhost:3010
- **Main File**: `server/main.py`

### API Endpoints
#### Android Services (`server/routers/android.py`)
- `GET /api/android/devices` - List connected Android devices via ADB with model and state info
- `POST /api/android/port-forward` - Setup ADB port forwarding for device communication
- `POST /api/android/{service_id}/{action}` - Execute Android service actions with parameters
- `GET /api/android/health` - Android service health check

#### Remote Android WebSocket
- **WebSocket**: Configurable via environment variable - Persistent WebSocket connection for remote Android devices
- **Health Check**: `{relay-url}/ws-health` - WebSocket proxy health status
- **Stats**: `{relay-url}/ws-stats` - Active connection statistics
- **Implementation**: `server/services/websocket_client.py` - Persistent WebSocket client with background tasks
  - Background message receiver continuously queues incoming messages
  - Keepalive loop sends ping every 25 seconds to maintain connection
  - Message queue (asyncio.Queue) for async message handling
  - Connection reuse across multiple API requests
  - Message filtering to skip non-response messages (presence, pong, ping)

#### Webhook Router (`server/routers/webhook.py`)
- `ANY /webhook/{path}` - Dynamic webhook endpoint for incoming HTTP requests (GET, POST, PUT, DELETE, PATCH)
- Dispatches `webhook_received` event via `broadcaster.send_custom_event()` to trigger waiting webhookTrigger nodes
- Returns immediate 200 OK response (responseNode mode planned for future)
- `GET /webhook/` - Webhook endpoint info and usage documentation

#### Workflow Services (`server/services/workflow.py`)
- Node execution handlers for all 27 node types (including httpRequest, webhookResponse)
- Parameter resolution and template variable substitution
- Result formatting and error handling

#### Frontend-Backend WebSocket (`server/routers/websocket.py`)
- **WebSocket Endpoint**: `/ws/status` - Real-time status updates between React and Python
- **REST Endpoint**: `GET /ws/info` - WebSocket connection info and current status
- **Message Types**:
  - `android_status` - Android device connection status updates
  - `node_status` - Individual node execution status
  - `node_output` - Node execution output data
  - `variable_update` - Single variable value change
  - `variables_update` - Batch variable updates
  - `workflow_status` - Workflow execution progress
  - `ping/pong` - Keep-alive messages

### Development Scripts
- `stop.bat` / `stop.sh` - Stops all development servers with duplicate Python process detection and verification
- `restart.bat` / `restart.sh` - Restarts all services cleanly
- `start.bat` / `start.sh` - Starts frontend and backend servers

### Concurrently Process Management Fix
**Problem**: Starting external services (WhatsApp, etc.) after the dev server would kill the frontend client.
- Root cause: `--kill-others` flag in concurrently npm script
- When uvicorn reloads (exit code 1), concurrently kills all processes including frontend

**Fix Applied**:
1. Removed `--kill-others` from `npm run dev` in package.json
2. Added named colored output: `-n client,python -c blue,green`
3. Added uvicorn reload controls: `--reload-dir .` and `--reload-exclude` patterns

**Result**: Frontend and backend run independently, uvicorn reloads don't cascade

### Temporal Distributed Execution (Optional)

When `TEMPORAL_ENABLED=true`, workflows execute via Temporal for durability and horizontal scaling.

**Architecture**: Each workflow node executes as an independent Temporal activity:
- **Per-node retry** - Failed nodes retry independently (up to 3 attempts)
- **Per-node timeout** - Long AI nodes don't block short nodes (10 min default)
- **Horizontal scaling** - Activities distributed across worker pool
- **Connection pooling** - Shared aiohttp session for WebSocket execution

**Configuration** (`.env`):
```env
TEMPORAL_ENABLED=true
TEMPORAL_SERVER_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=machina-tasks
```

**Start Temporal Server**:
```bash
docker run -d --name temporal-sqlite \
  -p 7233:7233 -p 8233:8233 \
  -v "d:/startup/projects/temporal/data:/data" \
  temporalio/temporal:latest server start-dev \
  --ip 0.0.0.0 --db-filename /data/temporal.db
```

**Execution Routing** (`workflow.py`):
1. If `TEMPORAL_ENABLED=true` and Temporal configured → `_execute_temporal()`
2. Else if Redis available → `_execute_parallel()` (local parallel)
3. Else → `_execute_sequential()` (fallback)

**Running with Temporal**:
The launch scripts auto-detect `TEMPORAL_ENABLED` from `.env`:
```bash
npm run start            # Auto-starts temporal worker if TEMPORAL_ENABLED=true
npm run start:temporal   # Explicit: sets TEMPORAL_ENABLED=true
npm run stop             # Also kills Temporal worker processes
```

**Standalone Worker** (horizontal scaling):
```bash
cd server
python -m services.temporal.worker
```

**Key Files**:
- `services/temporal/workflow.py` - MachinaWorkflow orchestrator (FIRST_COMPLETED pattern)
- `services/temporal/activities.py` - Class-based activities with aiohttp pooling
- `services/temporal/worker.py` - TemporalWorkerManager + `run_standalone_worker()`
- `services/temporal/executor.py` - TemporalExecutor interface matching WorkflowExecutor
- `services/temporal/client.py` - Client wrapper with runtime heartbeat disabled

**Runtime Configuration**: Worker heartbeating is disabled via `Runtime(worker_heartbeat_interval=None)` to avoid warnings on older Temporal server versions.

**Temporal UI**: http://localhost:8233

## Development Commands

### CLI Commands (npx or global install)
```bash
npx machina start      # Start all services
npx machina stop       # Stop all services
npx machina build      # Build for production
npx machina clean      # Clean build artifacts
npx machina docker:up  # Start with Docker
npx machina help       # Show all commands
```

### npm Scripts
```bash
# Core
npm run start            # Start all services (client, backend, WhatsApp)
npm run start:temporal   # Start with Temporal worker
npm run stop             # Stop all services
npm run build            # Build for production
npm run clean            # Clean build artifacts

# Docker (development)
npm run docker:up        # Start dev stack
npm run docker:down      # Stop dev stack
npm run docker:build     # Build images
npm run docker:logs      # View logs

# Docker (production)
npm run docker:prod:up   # Start production
npm run docker:prod:down # Stop production
npm run deploy           # Deploy to server
```

### Cross-Platform Scripts
All scripts in `scripts/` are cross-platform Node.js (Windows, macOS, Linux, WSL, Git Bash):
- `start.js` - Starts services, auto-installs deps, frees ports
- `stop.js` - Kills processes on configured ports
- `build.js` - Full production build (client, Python, WhatsApp)
- `clean.js` - Removes node_modules, dist, .venv
- `docker.js` - Docker Compose wrapper with Redis profile detection

See **[Scripts Reference](./docs-internal/SCRIPTS.md)** for full documentation.

## Current Status
✅ **INodeProperties System**: Fully implemented with 75 functional node components
✅ **WebSocket-First Architecture**: 87 message handlers replacing REST APIs
✅ **Code Editor**: Python, JavaScript, and TypeScript executors with syntax-highlighted editor (react-simple-code-editor + prismjs) and console output
✅ **Node.js Executor**: Persistent Node.js server (Express + tsx) for fast JS/TS execution, replacing subprocess spawning
✅ **Component Palette**: Emoji icons with distinct dracula-themed category colors, localStorage persistence for collapsed sections
✅ **Android Integration**: 16 Android service nodes with ADB automation and remote WebSocket support
✅ **Conditional Parameter Display**: Dynamic UI rendering based on parameter values (displayOptions.show)
✅ **Execution Engine**: Full component execution with result display
✅ **Parameter Mapping**: Drag-and-drop output to parameter connections
✅ **AI Integration**: API key management and model selection
✅ **Location Services**: Interactive map picker with coordinate handling, Google Maps API key fetched from backend credentials
✅ **Code Cleanup**: Dead code removed, unused files deleted
✅ **Process Management**: Robust stop scripts with duplicate process detection
✅ **WhatsApp Integration**: Square node design with QR code viewer, group/sender name persistence, and proper error handling
✅ **Backend Stability**: Fixed dependency injection and error handling preventing crashes
✅ **Development Server**: Running at **http://localhost:3001** (frontend) and **http://localhost:3010** (backend)
✅ **WebSocket Integration**: Persistent WebSocket connections for remote Android devices with background tasks and message queue
✅ **Real-time Status WebSocket**: Frontend-backend WebSocket at `/ws/status` for live Android status, node status, and variable updates
✅ **Event-Driven Trigger Nodes**: WhatsApp Receive and Webhook Trigger with asyncio.Future-based event waiting, filter builders, and cancel support
✅ **Continuous Scheduling Execution**: Temporal/Conductor pattern using `asyncio.wait(FIRST_COMPLETED)` for true parallel pipelines where dependent nodes start immediately when their specific dependency completes
✅ **Event-Driven Deployment**: n8n-style architecture where each trigger event spawns an independent, concurrent execution run (no iteration loop)
✅ **HTTP/Webhook Nodes**: HTTP Request for external APIs, Webhook Trigger for incoming requests, Webhook Response for custom responses
✅ **Theme System**: Solarized + Dracula dual-palette theming with dark mode support, vibrant action buttons, and themed React Flow edges
✅ **Modular Backend Architecture**: workflow.py refactored from 2068 to 460 lines using facade pattern with NodeExecutor, ParameterResolver, and DeploymentManager modules
✅ **Node Rename System**: n8n-style node renaming via F2 keyboard shortcut, double-click on label, or right-click context menu with inline editing
✅ **UI State Persistence**: localStorage persistence for sidebar visibility, component palette visibility, dev mode, and collapsed sections
✅ **Normal/Dev Mode**: Toggle in toolbar to filter Component Palette - Normal mode shows only AI Agents, Models, and Skills; Dev mode shows all categories
✅ **Production Deployment**: Docker Compose deployment (4 containers: Redis, Backend, Frontend, WhatsApp), nginx reverse proxy, and Let's Encrypt SSL
✅ **Authentication System**: n8n-style JWT authentication with HttpOnly cookies, single-owner and multi-user modes
✅ **Cache System**: n8n-pattern cache with Redis (production) / SQLite (local dev) / Memory fallback hierarchy
✅ **AI Thinking/Reasoning**: Extended thinking for Claude, Gemini 2.5/Flash Thinking, Groq Qwen3/QwQ with output available in Input Data & Variables for downstream nodes
✅ **Onboarding Service**: 5-step welcome wizard with Ant Design UI, database persistence, skip/resume/replay support

## Key Features

### Parameter System
- **Universal Renderer**: Supports both INodeProperties and NodeParameter interfaces
- **Type-Specific Controls**: String, number, boolean, select, slider, file, array types
- **Drag-and-Drop**: Map outputs from connected nodes to parameters
- **Validation**: Required field checking and type constraints
- **Conditional Display**: Dynamic parameter visibility using displayOptions.show pattern
  - Implemented in `MiddleSection.tsx` with `shouldShowParameter()` function
  - Supports array-based conditions (e.g., `messageType: ['text']`)
  - Filters parameters before rendering based on other parameter values

### Node Rename System (n8n-style)
Three methods for renaming nodes, following n8n UX patterns:
- **F2 Keyboard Shortcut**: Press F2 with a node selected to enter rename mode
- **Double-click on Label**: Click the node label twice to edit inline
- **Right-click Context Menu**: "Rename" option in the context menu

#### Architecture
```
Global State (useAppStore)          Node Components
├── renamingNodeId: string | null   ├── SquareNode.tsx
├── setRenamingNodeId()             ├── TriggerNode.tsx
        ↓                           ├── GenericNode.tsx
   Coordinates which node           └── StartNode.tsx
   is currently being renamed           ↓
                                    Local State:
                                    ├── isRenaming: boolean
                                    ├── editLabel: string
                                    └── inputRef: HTMLInputElement
```

#### Implementation Files
- **`client/src/store/useAppStore.ts`** - Global rename state (`renamingNodeId`, `setRenamingNodeId`)
- **`client/src/components/ui/NodeContextMenu.tsx`** - Right-click menu with Rename, Copy, Delete
- **`client/src/Dashboard.tsx`** - Context menu handler, F2 keyboard handler
- **`client/src/components/SquareNode.tsx`** - Inline rename for square nodes (Android, WhatsApp)
- **`client/src/components/TriggerNode.tsx`** - Inline rename for trigger nodes
- **`client/src/components/GenericNode.tsx`** - Inline rename for generic colored nodes
- **`client/src/components/StartNode.tsx`** - Inline rename with label support (was hardcoded "Start")

#### Key Pattern (shared by all node components)
```typescript
// Sync with global renaming state
useEffect(() => {
  if (renamingNodeId === id) {
    setIsRenaming(true);
    setEditLabel(data?.label || definition?.displayName || type || '');
  } else {
    setIsRenaming(false);
  }
}, [renamingNodeId, id, data?.label, definition?.displayName, type]);

// Handle save - only save if changed and non-empty
const handleSaveRename = useCallback(() => {
  const newLabel = editLabel.trim();
  if (newLabel && newLabel !== originalLabel) {
    updateNodeData(id, { ...data, label: newLabel });
  }
  setIsRenaming(false);
  setRenamingNodeId(null);
}, [...]);
```

#### NodeContextMenu Features
- Rename (F2), Copy (Ctrl+C), Delete (Del) with keyboard shortcuts shown
- Uses existing `useCopyPaste.copySelectedNodes()` for Copy
- Uses existing `onNodesDelete` for Delete
- Keyboard navigation (Arrow keys, Enter)
- Click outside to close
- Dracula-themed styling

### UI State Persistence
The application persists UI state to localStorage for a consistent user experience across sessions:

#### Persisted Settings
| Setting | Storage Key | Default | Location |
|---------|-------------|---------|----------|
| Sidebar visibility | `ui_sidebar_visible` | `true` | `useAppStore.ts` |
| Component palette visibility | `ui_component_palette_visible` | `true` | `useAppStore.ts` |
| Pro mode | `ui_pro_mode` | `false` | `useAppStore.ts` |
| Collapsed palette sections | `component_palette_collapsed_sections` | All collapsed | `useComponentPalette.ts` |

#### Implementation Pattern
```typescript
// In useAppStore.ts
const STORAGE_KEYS = {
  sidebarVisible: 'ui_sidebar_visible',
  componentPaletteVisible: 'ui_component_palette_visible',
};

const loadBooleanFromStorage = (key: string, defaultValue: boolean): boolean => {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved === 'true';
  } catch { /* Ignore storage errors */ }
  return defaultValue;
};

// Initial state loads from localStorage
sidebarVisible: loadBooleanFromStorage(STORAGE_KEYS.sidebarVisible, true),

// Toggle functions save to localStorage
toggleSidebar: () => {
  set((state) => {
    const newValue = !state.sidebarVisible;
    saveBooleanToStorage(STORAGE_KEYS.sidebarVisible, newValue);
    return { sidebarVisible: newValue };
  });
},
```

### Normal/Dev Mode Toggle
The toolbar includes a mode toggle that filters the Component Palette for different user experience levels:

| Mode | Description | Visible Categories |
|------|-------------|-------------------|
| **Normal** (default) | Simplified view for AI-focused workflows | AI Agents, AI Models, AI Skills, AI Abilities, AI Tools |
| **Dev** | Full access to all node types | All categories |

#### Implementation
- **State**: `proMode` boolean in `useAppStore.ts` with localStorage persistence (internal name unchanged for compatibility)
- **Toggle UI**: Segmented control in toolbar with "Normal" and "Dev" labels
- **Filtering**: `ComponentPalette.tsx` filters by `SIMPLE_MODE_CATEGORIES = ['agent', 'model', 'skill', 'tool']`
- **Category Merging**: WhatsApp and social nodes are merged into "Social Media Platforms" category via `SOCIAL_CATEGORIES = ['whatsapp', 'social']`

```typescript
// In ComponentPalette.tsx
const SIMPLE_MODE_CATEGORIES = ['agent', 'model', 'skill', 'tool'];
const SOCIAL_CATEGORIES = ['whatsapp', 'social'];

// Filter nodes based on mode
if (!proMode) {  // proMode=false means Normal mode
  const categoryKey = (definition.group?.[0] || '').toLowerCase();
  if (!SIMPLE_MODE_CATEGORIES.includes(categoryKey)) {
    return false;
  }
}

// Merge whatsapp and social categories
if (SOCIAL_CATEGORIES.includes(categoryKey.toLowerCase())) {
  categoryKey = 'social';
}
```

### Console Panel
The Console Panel provides a resizable bottom panel with three sections: Chat (AI conversation), Console (node execution logs), and Terminal (planned).

#### Features
- **Resizable**: Drag handle at top to resize, persisted to localStorage
- **Three Tabs**: Chat, Console, Terminal (placeholder)
- **Chat Section**: Send messages to Chat Trigger nodes, view conversation history
- **Console Section**: View and filter node execution logs

#### Node Selector Dropdowns
When multiple chatTrigger or console nodes exist in the workflow, dropdowns appear to select which node to target:

| Selector | Location | Behavior |
|----------|----------|----------|
| Chat Trigger | Chat section header | Select which chatTrigger node receives messages. "All" broadcasts to all triggers |
| Console | Console section controls | Filter logs to show only output from selected console node |

**Implementation** (`client/src/components/ui/ConsolePanel.tsx`):
```typescript
// Node type constants for filtering
const CHAT_TRIGGER_TYPES = ['chatTrigger'];
const CONSOLE_NODE_TYPES = ['console'];

// Filter workflow nodes
const chatTriggerNodes = useMemo(() =>
  nodes.filter(n => CHAT_TRIGGER_TYPES.includes(n.type || '')),
  [nodes]
);
const consoleNodes = useMemo(() =>
  nodes.filter(n => CONSOLE_NODE_TYPES.includes(n.type || '')),
  [nodes]
);

// State for selected nodes
const [selectedChatTriggerId, setSelectedChatTriggerId] = useState<string>('');
const [selectedConsoleId, setSelectedConsoleId] = useState<string>('');
```

#### Chat Message Persistence
Chat messages are persisted to SQLite database and survive server restarts.

**Database Model** (`server/models/database.py`):
```python
class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(default="default", index=True, max_length=255)
    role: str = Field(max_length=20)  # 'user' or 'assistant'
    message: str = Field(max_length=50000)
    created_at: datetime
```

**WebSocket Handlers** (`server/routers/websocket.py`):
| Handler | Description |
|---------|-------------|
| `send_chat_message` | Send message to chat, optionally targeting specific node via `node_id` |
| `get_chat_messages` | Retrieve chat history for session |
| `clear_chat_messages` | Clear all messages for session |

**Database Methods** (`server/core/database.py`):
- `add_chat_message(session_id, role, message)` - Add message to database
- `get_chat_messages(session_id, limit)` - Get messages with pagination
- `clear_chat_messages(session_id)` - Delete all messages for session

#### Console Log Persistence
Console logs are persisted to SQLite database and loaded on page refresh.

**WebSocket Handlers**:
| Handler | Description |
|---------|-------------|
| `get_console_logs` | Retrieve console logs from database (limit: 100) |
| `clear_console_logs` | Clear all console logs from database |

**Database Methods** (`server/core/database.py`):
- `add_console_log(log_data)` - Add console log to database
- `get_console_logs(limit)` - Get console logs
- `clear_console_logs()` - Delete all console logs

#### Key Files
| File | Description |
|------|-------------|
| `client/src/components/ui/ConsolePanel.tsx` | Main panel component with chat/console/terminal tabs |
| `server/models/database.py` | ChatMessage and ConsoleLog SQLModel definitions |
| `server/core/database.py` | Chat message and console log CRUD methods |
| `server/routers/websocket.py` | WebSocket handlers for chat and console operations |

### Execution System
- **Supported Components**: AI models, location services, Android automation, WhatsApp messaging, HTTP requests, webhooks
- **Android Integration**: ADB-based device control with 17 service nodes across monitoring, apps, automation, sensors, and media
- **Result Display**: Formatted output panel with success/error states
- **Performance Metrics**: Execution time and status tracking
- **Error Handling**: Comprehensive error reporting and logging
- **Dynamic Options**: Load options from backend (e.g., Android device list, service actions)
- **Continuous Scheduling**: Temporal/Conductor pattern using `asyncio.wait(FIRST_COMPLETED)` - dependent nodes start immediately when their specific dependency completes
- **Event-Driven Deployment**: n8n-style architecture where triggers spawn independent concurrent execution runs (no iteration loop)

### Event-Driven Deployment Architecture (n8n Pattern)
The deployment system follows modern workflow engine patterns from n8n, Temporal, and Conductor:

```
deploy_workflow() -> Sets up triggers, returns immediately
                 |
                 +-> cronScheduler fires -> spawns ExecutionRun 1
                 +-> cronScheduler fires -> spawns ExecutionRun 2 (concurrent)
                 +-> whatsappReceive fires -> spawns ExecutionRun 3 (concurrent)
                 +-> webhookTrigger fires -> spawns ExecutionRun 4 (concurrent)
```

**Key Concepts:**
- **Workflow Template**: The deployed workflow is a template stored in memory
- **Execution Run**: Each trigger event spawns an independent, isolated run
- **Concurrent Runs**: Multiple runs execute simultaneously without interference
- **No Iteration Loop**: Purely event-driven, not polling or sequential iterations
- **Pre-Executed Triggers**: Trigger nodes are marked complete before downstream execution

**Implementation Files:**
- `server/services/workflow.py`: Thin facade (~460 lines) delegating to specialized modules
- `server/services/node_executor.py`: Single node execution with registry-based dispatch
- `server/services/parameter_resolver.py`: Template variable resolution (`{{node.field}}`)
- `server/services/deployment/manager.py`: Deployment lifecycle, spawn runs, cancel
- `server/services/deployment/triggers.py`: Cron and event trigger management
- `server/services/deployment/state.py`: DeploymentState, TriggerInfo dataclasses
- `server/services/execution/models.py`: `ExecutionContext.create()` with `_pre_executed` support
- `server/services/execution/executor.py`: Continuous scheduling with `asyncio.wait(FIRST_COMPLETED)`

### AI Chat Model System (5-Layer Architecture)
- **Visual Components**: Circular node design with real-time status indicators (green/yellow/red)
- **Node Definitions**: Factory pattern using `createBaseChatModel()` with provider configurations
- **Parameter System**: Universal renderer with drag-and-drop template variables (`{{variable}}`)
- **API Key Management**: Secure localStorage with base64 encryption and LangChain validation
- **Execution Engine**: Routes AI nodes to Python Flask backend with auto-injection of API keys

#### Supported AI Providers & Models
All 6 providers are available across aiAgent, chatAgent (Zeenie), and all specialized agents:
- **OpenAI**: GPT-5, GPT-4o, o-series (o1, o3, o4) with reasoning effort. Max output: 128K tokens.
- **Anthropic**: Claude Opus 4.6, Sonnet 4.5 with extended thinking. Max output: 128K tokens.
- **Google**: Gemini 3.0, 2.5 Pro/Flash with thinking_budget. Max output: 65K tokens.
- **Groq**: Ultra-fast Llama, Qwen3/QwQ with reasoning_format. Max output: 8K tokens.
- **OpenRouter**: Unified API for 200+ models from multiple providers.
- **Cerebras**: Ultra-fast Llama and Qwen models on custom AI hardware.

#### Key Features
- Visual configuration with status indicators and parameter buttons
- Template variable system for dynamic parameter binding from connected nodes
- Provider-specific parameter sets (temperature, max tokens, penalties, safety settings)
- Secure API key validation with automatic model discovery and 30-day expiration
- Execution routing to Python Flask backend for AI model processing
- **Proxy-based authentication** for routing through local servers (Ollama pattern)
- **Provider default parameters** configurable in Credentials Modal (temperature, max_tokens, thinking settings)

#### Provider Default Parameters
Users can configure default parameter values per LLM provider in the Credentials Modal. These defaults are applied to new AI nodes using that provider.

**Configurable Parameters:**
- `temperature` (0-2): Controls randomness in responses
- `max_tokens` (1-128000): Maximum response length
- `thinking_enabled`: Enable extended thinking for supported models
- `thinking_budget` (1024-16000): Token budget for thinking
- `reasoning_effort` (low/medium/high): For OpenAI o-series, Groq
- `reasoning_format` (parsed/hidden): For Groq Qwen models

**Database Model** (`server/models/database.py`):
```python
class ProviderDefaults(SQLModel, table=True):
    provider: str           # openai, anthropic, gemini, groq, openrouter, cerebras
    temperature: float
    max_tokens: int
    thinking_enabled: bool
    thinking_budget: int
    reasoning_effort: str   # low, medium, high
    reasoning_format: str   # parsed, hidden
```

**Key Files:**
| File | Description |
|------|-------------|
| `server/models/database.py` | `ProviderDefaults` SQLModel |
| `server/core/database.py` | `get_provider_defaults()`, `save_provider_defaults()` CRUD |
| `server/routers/websocket.py` | `get_provider_defaults`, `save_provider_defaults` handlers |
| `client/src/hooks/useApiKeys.ts` | `getProviderDefaults()`, `saveProviderDefaults()` methods |
| `client/src/components/CredentialsModal.tsx` | Default Parameters UI section |

#### Proxy-Based Authentication (Ollama Pattern)
AI providers support optional proxy-based authentication, allowing requests to route through a local proxy server that handles authentication. This follows the [Ollama Claude Code integration](https://docs.ollama.com/integrations/claude-code) pattern.

**How it works:**
1. User configures a proxy URL in the Credentials Modal (e.g., `http://localhost:11434`)
2. Requests route through the proxy instead of directly to the provider API
3. Proxy handles authentication (token set to "ollama" automatically)
4. No API key storage needed in MachinaOs - auth delegated to proxy

**Configuration:**
- Proxy URLs stored in database via `{provider}_proxy` pattern (e.g., `anthropic_proxy`, `openai_proxy`)
- Configured in Credentials Modal under each AI provider
- Falls back to direct API key if no proxy configured

**Key Files:**
| File | Description |
|------|-------------|
| `server/services/ai.py` | `create_model()` accepts `proxy_url` parameter, sets `base_url` and token |
| `client/src/components/CredentialsModal.tsx` | Proxy URL input for AI providers |

**Backend Implementation** (`server/services/ai.py`):
```python
def create_model(self, provider: str, api_key: str, model: str,
                temperature: float, max_tokens: int,
                thinking: Optional[ThinkingConfig] = None,
                proxy_url: Optional[str] = None):
    # ...
    if proxy_url:
        kwargs['base_url'] = proxy_url
        kwargs[config.api_key_param] = "ollama"  # Ollama-style token
```

**Use Cases:**
- Claude Code CLI proxy for Anthropic models
- Ollama for local model serving
- Custom authentication proxies
- Development/testing with mock servers

## AI Chat Model Implementation Details

### Component Architecture
1. **BaseChatModelNode** (`src/components/base/BaseChatModelNode.tsx`): Unified circular design with provider props
2. **Provider Components**: Thin wrappers passing provider-specific configuration to base component
3. **ModelNode** (`src/components/ModelNode.tsx`): Generic component with automatic provider detection
4. **Factory Pattern**: `createBaseChatModel()` generates standardized node definitions from configs

### API Key Management (`src/services/apiKeyManager.ts`)
- **Validation**: Uses LangChain for real API testing with provider-specific chat models
- **Storage**: localStorage with base64 encryption and key hashing for security
- **Models**: Automatic discovery and caching of available models per provider
- **Expiration**: 30-day validation period with automatic cleanup

### Execution Flow (`src/services/executionService.ts`)
- **Detection**: `isAIModelNode()` identifies AI chat models for Python routing
- **Enhancement**: `injectStoredApiKeys()` auto-injects stored credentials and models
- **Routing**: AI nodes → Python Flask backend, other nodes → Node.js backend
- **Logging**: Comprehensive debug output for API key injection and model selection
- **Supported Types**: `isNodeTypeSupported()` controls which nodes show Run button - includes AI models, agents, Android, WhatsApp, Twitter, Google Workspace, code executors, schedulers, utilities, and document processing nodes

### Parameter System Integration
- **Template Variables**: Support for `{{nodeId.output}}` syntax in all text parameters
- **Drag-and-Drop**: Visual parameter mapping from connected node outputs
- **Type-Specific**: Provider-specific parameters (OpenAI response format, Gemini safety settings)
- **Validation**: Real-time parameter validation with visual feedback

### AI Thinking/Reasoning System
Extended thinking and reasoning capabilities for supported AI models. When enabled, the model's internal reasoning process is captured and available for downstream nodes.

#### Supported Providers & Configuration

| Provider | Models | Parameter | Notes |
|----------|--------|-----------|-------|
| **Claude** | opus-4.6, sonnet-4.5 | `thinkingBudget` (1024-16000 tokens) | Requires `max_tokens > budget_tokens`. Temperature auto-set to 1. |
| **Gemini** | gemini-3.0, gemini-2.5-pro/flash | `thinkingBudget` (token count) | Uses `thinking_budget` API parameter |
| **Groq** | qwen3-32b, qwq-32b | `reasoningFormat` ('parsed' or 'hidden') | 'parsed' returns reasoning, 'hidden' returns only final answer |
| **OpenAI** | o1, o3, o4, GPT-5 series | `reasoningEffort` (minimal/low/medium/high/xhigh) | GPT-5.2 supports xhigh reasoning |

#### Frontend Parameters (`client/src/factories/baseChatModelFactory.ts`)
```typescript
STANDARD_PARAMETERS = {
  thinkingEnabled: {
    displayName: 'Thinking/Reasoning Mode',
    name: 'thinkingEnabled',
    type: 'boolean',
    default: false,
    description: 'Enable extended thinking for supported models'
  },
  thinkingBudget: {
    displayName: 'Thinking Budget (Tokens)',
    name: 'thinkingBudget',
    type: 'number',
    default: 2048,
    typeOptions: { minValue: 1024, maxValue: 16000 },
    displayOptions: { show: { thinkingEnabled: [true] } }
  },
  reasoningEffort: {
    displayName: 'Reasoning Effort',
    name: 'reasoningEffort',
    type: 'options',
    options: ['minimal', 'low', 'medium', 'high'],
    default: 'medium',
    displayOptions: { show: { thinkingEnabled: [true] } }
  },
  reasoningFormat: {
    displayName: 'Reasoning Format',
    name: 'reasoningFormat',
    type: 'options',
    options: ['parsed', 'hidden'],
    default: 'parsed',
    displayOptions: { show: { thinkingEnabled: [true] } }
  }
}
```

#### Backend Implementation (`server/services/ai.py`)
The AI service extracts thinking content from LangChain response objects:

```python
def extract_thinking_from_response(response, provider: str) -> Optional[str]:
    """Extract thinking/reasoning from AI response based on provider."""
    # Claude: content_blocks with type='thinking'
    # Gemini: response_metadata.candidates[0].content.parts with thought=True
    # Groq: additional_kwargs.reasoning or response_metadata.reasoning
    # OpenAI o-series: requires organization verification
```

**Response Structure:**
```python
{
    "success": True,
    "result": {
        "response": "The final answer text",
        "thinking": "The model's internal reasoning (if available)",
        "model": "claude-3-5-sonnet-20241022",
        "provider": "anthropic",
        "finish_reason": "stop",
        "timestamp": "2025-01-23T..."
    }
}
```

#### Output Schema for Connected Nodes
The `thinking` field is available in Input Data & Variables for downstream nodes. This schema applies to all AI nodes including chat models and specialized agents.

```typescript
// In InputSection.tsx
const sampleSchemas = {
  ai: {
    response: 'string',
    thinking: 'string',  // Available for drag-and-drop mapping
    model: 'string',
    provider: 'string',
    finish_reason: 'string',
    timestamp: 'string'
  }
};

// Node types that use the AI output schema
const aiAgentTypes = [
  'aiAgent', 'chatAgent',
  'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent',
  'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent'
];
const isAI = nodeTypeLower.includes('chatmodel') || aiAgentTypes.includes(nodeType);
```

#### UI Display (`client/src/components/ui/NodeOutputPanel.tsx`)
- **ThinkingBlock Component**: Collapsible display for thinking content
- **Default Expanded**: Thinking block is expanded by default when present
- **Provider-Aware**: Shows appropriate label based on provider (e.g., "Claude Extended Thinking")

#### Limitations
- **OpenAI o-series**: Reasoning summaries are only available to organizations that have completed verification at platform.openai.com. Without verification, `thinking` will be `null`.
- **Claude**: `max_tokens` must be greater than `thinkingBudget`. Temperature is automatically set to 1 when thinking is enabled.
- **Groq**: Only Qwen3 and QwQ models support reasoning. Format 'hidden' suppresses reasoning output.

## AI Agent Node Architecture

### Config-Driven Component Design
The `AIAgentNode.tsx` component uses a configuration-driven pattern to support multiple agent types from a single component.

#### AGENT_CONFIGS Object
```typescript
type ThemeColorKey = 'purple' | 'cyan' | 'green' | 'pink' | 'orange' | 'yellow' | 'red';

interface AgentConfig {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  themeColorKey: ThemeColorKey;  // References dracula theme constant
  bottomHandles: Array<{ id: string; label: string; position: string }>;
  leftHandles?: Array<{ id: string; label: string; position: string }>;
  topOutputHandle?: { id: string; label: string };
  width?: number;
  height?: number;
}

// Color resolved at runtime: dracula[config.themeColorKey]
const AGENT_CONFIGS: Record<string, AgentConfig> = {
  aiAgent: {
    icon: <RobotIcon />,
    title: 'AI Agent',
    subtitle: 'LangGraph Agent',
    themeColorKey: 'purple',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '55%' },
      { id: 'input-task', label: 'Task', position: '85%' },
    ],
  },
  chatAgent: {
    icon: <ZeenieIcon />,
    title: 'Zeenie',
    subtitle: 'Conversational Agent',
    themeColorKey: 'cyan',
    bottomHandles: [
      { id: 'input-skill', label: 'Skill', position: '25%' },
      { id: 'input-tools', label: 'Tool', position: '75%' },
    ],
    leftHandles: [
      { id: 'input-memory', label: 'Memory', position: '55%' },
      { id: 'input-task', label: 'Task', position: '85%' },
    ],
  },
  // ... 11 specialized agents (android_agent, coding_agent, web_agent, task_agent,
  //     social_agent, travel_agent, tool_agent, productivity_agent, payments_agent, consumer_agent, autonomous_agent)
  //     each with themeColorKey, standard Skill/Tool bottom handles, Memory/Task left handles
};
```

#### Component Selection
In `Dashboard.tsx`, both agent types map to the same component:
```typescript
} else if (type === 'aiAgent' || type === 'chatAgent') {
  types[type] = AIAgentNode;
}
```

### AI Agent vs Zeenie

| Feature | AI Agent | Zeenie |
|---------|----------|------------|
| Tool Calling | Yes (LangGraph) | Yes (LangGraph) |
| Memory Support | Yes | Yes |
| Skill Support | Yes | Yes |
| Task Input | Yes (input-task) | Yes (input-task) |
| Bottom Handles | Skill, Tools | Skill, Tools |
| Left Handles | Input, Memory, Task | Input, Memory, Task |
| Backend Method | `execute_agent()` | `execute_chat_agent()` |
| Async Delegation | Yes (fire-and-forget) | Yes (fire-and-forget) |

### Unified Tool Calling Architecture

Both AI Agent and Zeenie use the **same tool calling pattern**:

1. **Tool Building**: Both use `_build_tool_from_node()` to create schema-only tools
2. **Tool Execution**: Both use `execute_tool()` from `handlers/tools.py`
3. **Supported Tools**: `calculatorTool`, `currentTimeTool`, `duckduckgoSearch`, `androidTool`, `httpRequest`, `braveSearch`, `serperSearch`, `perplexitySearch`

**Tool Execution Flow:**
```
Tool Node (connected to input-tools)
        ↓
Handler collects tool_data: {node_id, node_type, parameters, label, connected_services}
        ↓
AIService._build_tool_from_node() → creates schema-only StructuredTool
        ↓
LangGraph binds tools to LLM
        ↓
LLM decides to call tool with arguments
        ↓
tool_executor callback → execute_tool() from handlers/tools.py
        ↓
Dispatch to handler: _execute_http_request(), _execute_calculator(), etc.
```

**Key Files:**
| File | Purpose |
|------|---------|
| `server/services/ai.py` | `_build_tool_from_node()` - builds schema-only tools for both agents |
| `server/services/handlers/tools.py` | `execute_tool()` - dispatches to specific handlers |
| `server/services/handlers/ai.py` | Collects `tool_data` from `input-tools` handle |

### Zeenie Input Methods

Zeenie accepts input in two ways:

1. **Template Variable (Explicit)**: Set the Prompt field to `{{chatTrigger.message}}` or `{{whatsappReceive.text}}`
   - Templates are resolved by `ParameterResolver` before handler execution
   - Supports nested paths: `{{nodeName.nested.field}}`

2. **Auto-Fallback (Implicit)**: Leave the Prompt field empty
   - Handler detects nodes connected to `input-main` handle
   - Reads output from `context.get('outputs', {}).get(source_node_id)`
   - Extracts text from `message`, `text`, `content` fields (in order)
   - Falls back to string representation of entire output

**Example Workflow:**
```
Chat Trigger → Zeenie ← HTTP Skill (SKILL.md context)
                         ← HTTP Request (tool node)
```

The Zeenie will:
- Load SKILL.md instructions from connected skill nodes
- Build tools from connected tool nodes (httpRequest, calculatorTool, etc.)
- Use LangGraph for tool execution when tools are connected

### Backend Handlers
Both agents have dedicated handlers in `server/services/handlers/ai.py`:
- `handle_ai_agent()` - Collects memory, skill, and tool data from connected nodes
- `handle_chat_agent()` - Collects memory, skill, tool, and input data from connected nodes

Both use the shared `_collect_agent_connections()` base function that:
- Scans edges for nodes connected to `input-memory`, `input-skill`, `input-tools`, `input-main`/`input-chat` handles
- Returns a 4-tuple: `(memory_data, skill_data, tool_data, input_data)`
- Handles MasterSkill expansion into individual skill entries

Both call corresponding AI service methods:
- `AIService.execute_agent()` - Full LangGraph execution with tool binding
- `AIService.execute_chat_agent()` - LangGraph execution with skills providing context + tools

### Async Agent Delegation (Nested Agents)

AI Agents can delegate tasks to other agents connected to their `input-tools` handle. This enables hierarchical agent architectures where a parent agent can spawn child agents that work independently.

**Architecture: Fire-and-Forget Pattern**
```
Parent Agent calls "delegate_to_ai_agent" tool
       |
Tool handler spawns asyncio.Task for Child Agent
       |
Returns immediately: {"status": "delegated", "task_id": "..."}
       |
Parent Agent continues working
       |
Child Agent executes independently in background
       |
Child broadcasts its own status updates (executing, success, error)
```

**How It Works:**
1. Connect a Child Agent (aiAgent/chatAgent) to Parent Agent's `input-tools` handle
2. Parent sees a tool like `delegate_to_ai_agent` with schema `{task: string, context?: string}`
3. When Parent calls the tool, handler spawns Child as `asyncio.create_task()`
4. Tool returns immediately with `{"status": "delegated", "task_id": "..."}`
5. Parent continues without waiting
6. Child executes with its own connected tools, skills, and memory
7. Both agents can execute simultaneously with independent status indicators

**Key Files:**
| File | Purpose |
|------|---------|
| `server/services/ai.py` | `DelegateToAgentSchema` in `_get_tool_schema()`, injects `ai_service`, `database`, `nodes`, `edges` into tool config |
| `server/services/handlers/tools.py` | `_execute_delegated_agent()` - spawns child as background task, `get_delegated_task_status()` utility |
| `server/services/handlers/ai.py` | Passes `context` to `execute_agent()`/`execute_chat_agent()` for nested delegation |

**Design Decisions:**
- **Memory Isolation**: Child uses its own connected memory, not shared with Parent
- **Error Isolation**: Child errors don't propagate to Parent - logged and broadcast independently
- **Task Tracking**: Background tasks tracked in `_delegated_tasks` dict, cleaned up on completion

### Specialized AI Agents

The system supports specialized agent variants that inherit from the base AI Agent architecture:

| Agent Type | Node Type | Icon | Theme Color (dracula) |
|------------|-----------|------|-----------------------|
| AI Agent | `aiAgent` | Robot SVG | purple |
| Zeenie | `chatAgent` | Chat SVG | cyan |
| Android Control | `android_agent` | robot | green |
| Coding Agent | `coding_agent` | laptop | cyan |
| Web Control | `web_agent` | globe | pink |
| Task Management | `task_agent` | clipboard | purple |
| Social Media | `social_agent` | phone | green |
| Travel Agent | `travel_agent` | plane | orange |
| Tool Agent | `tool_agent` | wrench | yellow |
| Productivity | `productivity_agent` | clock | cyan |
| Payments | `payments_agent` | credit card | green |
| Consumer | `consumer_agent` | cart | purple |
| Autonomous | `autonomous_agent` | target | purple |
| Orchestrator | `orchestrator_agent` | conductor | cyan |
| AI Employee | `ai_employee` | briefcase | purple |

All specialized agents share the same handle configuration:
- **Left**: `input-main` (Input, 30%), `input-memory` (Memory, 55%), `input-task` (Task, 85%)
- **Bottom**: `input-skill` (Skill, 25%), `input-tools` (Tool, 75%)
- **Top**: `output-top` (Output)

**Team Lead Agents** (`orchestrator_agent`, `ai_employee`) have an additional handle:
- **Bottom**: `input-teammates` (Teammates, 50%) - Connect specialized agents here for delegation

The `AIAgentNode.tsx` component uses `AGENT_CONFIGS` to render all agent types with their specific icons, titles, and theme colors.

## Architecture Patterns
- **Resource-Operation Pattern**: Nodes organized by functional resources
- **TypeScript-First**: 90.4% TypeScript coverage with strict typing
- **Component-Driven**: Modular UI components with clear responsibilities  
- **State Management**: Zustand for reactive application state
- **Interface Compatibility**: Dual interface support for smooth transitions
- **Execution Pipeline**: Async component execution with result handling

## File Structure Cleanup
**Removed Files:**
- `src/nodeDefinitions.backup.ts` (backup file)
- `src/schemas/` directory (unused schema system)  
- `src/utils/schemaParser.ts` (legacy parser)
- `src/utils/nodeSchemaParser.ts` (unused modern parser)
- `src/types/NodeSchema.ts` (legacy schema types)

**Cleaned Code:**
- Removed unused imports and dead functions
- Eliminated legacy NodeDefinition interface  
- Streamlined parameter handling logic
- Maintained backward compatibility only where actively used

## Testing & Validation
```bash
# Development server test
curl -I http://localhost:3001

# TypeScript validation
npx tsc --noEmit

# Build verification
npm run build

# Test WebSocket connection for remote Android devices
python test_websocket.py
```

### WebSocket Testing (`test_websocket.py`)
- Tests health endpoint configured via `WEBSOCKET_URL` environment variable
- Tests stats endpoint
- Tests WebSocket connection
- Validates connection establishment and ping/pong messaging
- Comprehensive test results with pass/fail status

## Production Deployment

### Docker Deployment
The project deploys using Docker Compose with nginx reverse proxy.

#### Deploy Script (`deploy.sh`)
```bash
# Deploy to server (configure DEPLOY_HOST in .env)
./deploy.sh [HOST]
```

**Deployment Steps:**
1. Build Docker images locally (`docker-compose -f docker-compose.prod.yml build`)
2. Save and compress images (`docker save | gzip`)
3. Upload to GCP via SCP
4. Deploy on remote (`docker-compose up -d`)
5. Configure nginx reverse proxy with SSL
6. Auto-cleanup dangling Docker images

#### Docker Configuration (4-Container Stack)

**Services:**
| Container | Image | Port | Description |
|-----------|-------|------|-------------|
| redis | redis:7-alpine | 6379 | Cache and pub/sub for workflows |
| backend | machinaos-backend | 3010 | FastAPI Python backend |
| frontend | machinaos-frontend | 3000 | React app via nginx |
| whatsapp | machinaos-whatsapp | 5000 | Go WhatsApp bridge service |

**Frontend (`client/Dockerfile`):**
- Multi-stage build: Node.js builder → nginx:alpine production
- Serves static files via nginx on port 80 (mapped to 3000)
- Size: ~54 MB

**Backend (`server/Dockerfile`):**
- Python 3.12-slim base with Node.js 22.x for JS/TS execution
- Includes persistent Node.js server (Express + tsx) on port 3020
- Optimized bytecode compilation (`python -O -m compileall`)
- Health check endpoint on port 3010
- Startup script (`start.sh`) runs both Python and Node.js servers
- Depends on: redis, whatsapp
- Size: ~600 MB

**WhatsApp (`docker/Dockerfile.whatsapp`):**
- Uses npm package `whatsapp-rpc` with pre-built binaries
- Node.js 20-alpine base with `npx whatsapp-rpc api --foreground`
- Binary downloaded from GitHub releases during npm postinstall
- Exposed on port 9400 (configurable via `PORT`, `WHATSAPP_RPC_PORT` env vars, or `--port` CLI flag)
- QR codes generated as base64 PNG in memory (no file I/O)
- Also published to PyPI as `whatsapp-rpc` (async Python client)
- Size: ~150 MB (includes Node.js runtime)

**Redis:**
- Official redis:7-alpine image
- Healthcheck: `redis-cli ping`
- Persistent volume: `redis_data`
- No authentication (internal network only)

**Development Compose (`docker-compose.yml`):**
```yaml
services:
  # Redis uses profiles - only starts when REDIS_ENABLED=true
  redis:
    image: redis:7-alpine
    profiles:
      - redis  # Only starts with --profile redis flag
    ports: ["${REDIS_PORT:-6379}:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  backend:
    build: ./server
    ports: ["${PYTHON_BACKEND_PORT:-3010}:${PYTHON_BACKEND_PORT:-3010}"]
    depends_on:
      whatsapp: { condition: service_healthy }  # No Redis dependency
    environment:
      - REDIS_ENABLED=${REDIS_ENABLED:-false}
      - REDIS_URL=redis://redis:6379

  frontend:
    build: ./client
    ports: ["${VITE_CLIENT_PORT:-3000}:${VITE_CLIENT_PORT:-3000}"]

  whatsapp:
    build:
      context: .
      dockerfile: docker/Dockerfile.whatsapp
    ports: ["${WHATSAPP_RPC_PORT:-9400}:${WHATSAPP_RPC_PORT:-9400}"]
```

**Docker Scripts Wrapper (`scripts/docker.js`):**
Auto-detects `REDIS_ENABLED` in `.env` and adds `--profile redis` flag when enabled:
```javascript
// Reads .env and checks REDIS_ENABLED value
function isRedisEnabled() {
  const content = readFileSync(resolve(ROOT, '.env'), 'utf8');
  const match = content.match(/^REDIS_ENABLED\s*=\s*(.+)$/m);
  const value = match?.[1].trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

// Adds --profile redis when enabled
if (isRedisEnabled()) {
  composeArgs.push('--profile', 'redis');
}
```

**Production Compose (`docker-compose.prod.yml`):**
```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  whatsapp:
    build:
      context: .
      dockerfile: docker/Dockerfile.whatsapp
    ports: ["9400:9400"]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:9400/health"]

  backend:
    build: ./server
    ports: ["3010:3010"]
    depends_on:
      redis: { condition: service_healthy }
      whatsapp: { condition: service_healthy }
    environment:
      - REDIS_ENABLED=true
      - REDIS_URL=redis://redis:6379

  frontend:
    build: ./client
    ports: ["3000:80"]
```

#### Nginx Configuration
Located at `/etc/nginx/sites-available/flow.zeenie.xyz`:
- Frontend: `/` → `http://127.0.0.1:3000`
- Backend API: `/api/` → `http://127.0.0.1:3010/api/`
- WebSocket: `/ws/` → `http://127.0.0.1:3010/ws/` (with upgrade headers)
- Webhook: `/webhook/` → `http://127.0.0.1:3010/webhook/`
- Health: `/health` → `http://127.0.0.1:3010/health`
- SSL via Let's Encrypt certbot

#### Environment Configuration

**Development** (`server/.env`):
- `DEBUG=true`
- `CORS_ORIGINS` includes localhost ports
- `REDIS_ENABLED=false` (uses SQLite cache for local dev)

**Production** (Docker environment variables):
- `DEBUG=false`
- `CORS_ORIGINS=["https://your-domain.com"]`
- `REDIS_ENABLED=true` (Docker Redis container)
- `REDIS_URL=redis://redis:6379`
- Environment set in `docker-compose.prod.yml`, not `.env` file

#### Frontend API URL Resolution
The frontend automatically detects production vs development:

```typescript
// client/src/config/api.ts
const isProduction = typeof window !== 'undefined' &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1');

return {
  PYTHON_BASE_URL: isProduction ? '' : 'http://localhost:3010',
};
```

- **Production**: Empty base URL = relative URLs (same origin)
- **Development**: Explicit `http://localhost:3010`

WebSocket URL derived from base URL:
```typescript
// client/src/contexts/WebSocketContext.tsx
if (!baseUrl) {
  // Production: use current origin
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProtocol}://${window.location.host}/ws/status`;
}
```

#### Resource Usage (GCP e2-micro)
| Resource | Value |
|----------|-------|
| CPU | 2 cores (Intel Xeon @ 2.20GHz) |
| RAM | 1.9 GB total, ~820 MB used |
| Disk | 14 GB total, ~9.2 GB used |
| Backend Memory | ~144 MB |
| Frontend Memory | ~3.4 MB |

#### Useful Commands
```bash
# View logs (all containers)
ssh $DEPLOY_HOST 'cd /opt/machinaos && docker-compose logs -f'

# View specific service logs
ssh $DEPLOY_HOST 'cd /opt/machinaos && docker-compose logs -f backend'
ssh $DEPLOY_HOST 'cd /opt/machinaos && docker-compose logs -f whatsapp'

# Restart all services
ssh $DEPLOY_HOST 'cd /opt/machinaos && docker-compose restart'

# Restart specific service
ssh $DEPLOY_HOST 'cd /opt/machinaos && docker-compose restart backend'

# Check container status
ssh $DEPLOY_HOST 'docker ps'

# Check resource usage
ssh $DEPLOY_HOST 'docker stats --no-stream'

# Check Redis connection
ssh $DEPLOY_HOST 'docker exec machinaos-redis-1 redis-cli ping'

# Check backend health (shows redis_enabled status)
curl -s https://$DEPLOY_DOMAIN/health | jq

# Clean up Docker resources (if disk full)
ssh $DEPLOY_HOST 'docker system prune -af && docker builder prune -af'
```

### Local Docker Development
For testing the full production stack locally:

```bash
# Build and start all containers
docker-compose -f docker-compose.prod.yml up --build

# Access locally
# Frontend: http://localhost:3000
# Backend API: http://localhost:3010
# WhatsApp RPC: http://localhost:9400
# Redis: localhost:6379

# Stop all containers
docker-compose -f docker-compose.prod.yml down

# Remove volumes (clean slate)
docker-compose -f docker-compose.prod.yml down -v
```

### Local Development Build
```bash
# Create optimized build
npm run build

# Serve built files locally
npm run preview
```

## Authentication System

### Overview
n8n-inspired authentication system with JWT tokens stored in HttpOnly cookies. Authentication can be completely disabled for development or supports two deployment modes for different use cases.

### Authentication Toggle
| Setting | Environment Variable | Description |
|---------|---------------------|-------------|
| **Enabled** | `VITE_AUTH_ENABLED=true` | Require login (default) |
| **Disabled** | `VITE_AUTH_ENABLED=false` | Bypass authentication, anonymous access |

When `VITE_AUTH_ENABLED=false`:
- Frontend skips login page entirely
- User is set to anonymous with owner privileges
- No backend auth API calls are made
- Useful for local development and testing

### Deployment Modes (when auth enabled)
| Mode | Environment Variable | Description |
|------|---------------------|-------------|
| **Single Owner** | `AUTH_MODE=single` | First user becomes owner, registration disabled after |
| **Multi User** | `AUTH_MODE=multi` | Open registration for cloud deployments |

### Architecture
```
Frontend (LoginPage.tsx) → AuthContext → Backend (/api/auth/*) → JWT Cookie
                                              ↓
                                        AuthMiddleware
                                              ↓
                                      Protected Routes
```

### Backend Implementation

#### User Model (`server/models/auth.py`)
```python
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    display_name: str
    is_owner: bool = Field(default=False)
    is_active: bool = Field(default=True)
    created_at: datetime
    last_login: Optional[datetime]

    def set_password(self, password: str) -> None:
        # Uses bcrypt for secure hashing

    def verify_password(self, password: str) -> bool:
        # Verifies against bcrypt hash
```

#### Auth Service (`server/services/user_auth.py`)
- `register_user()` - Creates new user, sets as owner if first user in single mode
- `authenticate_user()` - Validates credentials, returns user
- `create_token()` - Generates JWT token
- `verify_token()` - Validates JWT token
- `get_auth_status()` - Returns mode, registration availability, user count

#### Auth Router (`server/routers/auth.py`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/status` | GET | Get auth mode and registration status |
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login and set cookie |
| `/api/auth/logout` | POST | Clear auth cookie |
| `/api/auth/me` | GET | Get current user info |

#### Auth Middleware (`server/middleware/auth.py`)
Protects all routes except public paths:
```python
PUBLIC_PATHS = frozenset([
    "/health", "/docs", "/openapi.json", "/redoc",
    "/api/auth/status", "/api/auth/login", "/api/auth/register", "/api/auth/logout",
])
PUBLIC_PREFIXES = ("/webhook/",)
```

### Frontend Implementation

#### Auth Context (`client/src/contexts/AuthContext.tsx`)
```typescript
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authMode: 'single' | 'multi';
  canRegister: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
```

#### Protected Route (`client/src/components/auth/ProtectedRoute.tsx`)
Wraps protected content, shows LoginPage if not authenticated:
```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
};
```

#### Login Page (`client/src/components/auth/LoginPage.tsx`)
- Dracula-themed login/register form
- Switches between login and register based on `canRegister`
- Displays errors from auth context

### Configuration
Environment variables in `.env`:
```bash
# Authentication Toggle (frontend - Vite)
VITE_AUTH_ENABLED=true              # 'true' or 'false' - disable to bypass login

# Authentication Mode (backend)
AUTH_MODE=single                    # 'single' or 'multi'
JWT_SECRET_KEY=your-secret-key-32   # Min 32 chars
JWT_EXPIRE_MINUTES=10080            # 7 days
JWT_COOKIE_NAME=machina_token
JWT_COOKIE_SECURE=false             # true for HTTPS
JWT_COOKIE_SAMESITE=lax
```

### Race Condition Handling
The AuthContext includes retry logic with exponential backoff to handle the case where frontend starts before backend is ready:
- 5 retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Shows "Failed to connect to server" only after all retries exhausted
- Prevents false "not authenticated" errors during startup

### Cookie-Based Auth for API Calls
All API calls must include `credentials: 'include'` for HttpOnly cookie:
```typescript
// In workflowApi.ts, all fetch calls include:
fetch(url, { credentials: 'include' })
```

### WebSocket Authentication
WebSocket checks cookie before accepting connection:
```python
# In websocket.py
token = websocket.cookies.get(settings.jwt_cookie_name)
if not token:
    await websocket.close(code=4001, reason="Not authenticated")
    return
```

WebSocketProvider only connects when authenticated:
```typescript
// In WebSocketContext.tsx
const { isAuthenticated, isLoading: authLoading } = useAuth();

useEffect(() => {
  if (authLoading || !isAuthenticated) {
    // Disconnect if logged out
    return;
  }
  connect();
}, [isAuthenticated, authLoading]);
```

### Key Files
| File | Description |
|------|-------------|
| `client/src/config/api.ts` | API config with AUTH_ENABLED toggle |
| `client/src/contexts/AuthContext.tsx` | React auth state with retry logic |
| `client/src/components/auth/LoginPage.tsx` | Login UI |
| `client/src/components/auth/ProtectedRoute.tsx` | Route guard |
| `server/models/auth.py` | User SQLModel with bcrypt |
| `server/services/user_auth.py` | JWT creation/verification |
| `server/routers/auth.py` | REST endpoints |
| `server/middleware/auth.py` | Route protection |
| `server/core/config.py` | Settings with vite_auth_enabled field |

### Dependencies
```
# server/pyproject.toml
bcrypt>=4.1.0
python-jose[cryptography]>=3.3.0
email-validator>=2.0.0
```

## Encrypted Credentials System

### Overview
API keys and OAuth tokens are stored in a separate encrypted database (`credentials.db`) using Fernet encryption (AES-128-CBC + HMAC-SHA256). Following the n8n pattern, the encryption key is derived from a server-scoped config key (`API_KEY_ENCRYPTION_KEY` in `.env`) using PBKDF2, initialized at startup and persisting across restarts.

### Security Architecture
```
Server Startup
       ↓
API_KEY_ENCRYPTION_KEY (from .env) + Salt (from credentials.db)
       ↓
PBKDF2HMAC (SHA256, 600K iterations)
       ↓
Fernet Key (in-memory for application lifetime)
       ↓
EncryptionService.encrypt()/decrypt()
       ↓
credentials.db (encrypted ciphertext)
```

**Key Security Properties:**
- Server-scoped encryption key from `API_KEY_ENCRYPTION_KEY` in `.env` (n8n pattern)
- Key initialized at startup, persists across application lifetime
- Not tied to user sessions -- survives server restarts with valid JWT
- Salt stored in credentials database (not the main database)
- OWASP 2024 compliant: 600,000 PBKDF2 iterations

### Single Point of Access Pattern
**IMPORTANT**: All credential operations MUST go through `AuthService`. Routers should NEVER access `CredentialsDatabase` directly.

```python
# Correct: Use auth_service
auth_service = get_auth_service()
await auth_service.store_oauth_tokens(provider="google", ...)
tokens = await auth_service.get_oauth_tokens("google", customer_id="owner")

# Wrong: Direct database access
credentials_db = get_credentials_db()  # Don't do this in routers
await credentials_db.save_oauth_tokens(...)  # Don't do this
```

### Backend Implementation

#### EncryptionService (`server/core/encryption.py`)
```python
class EncryptionService:
    """Fernet encryption with PBKDF2 key derivation."""

    def initialize(self, password: str, salt: bytes) -> None:
        """Derive key from password using PBKDF2HMAC."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=600_000,  # OWASP 2024 recommendation
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        self._fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt and return base64 ciphertext."""

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt base64 ciphertext."""

    def clear(self) -> None:
        """Clear encryption key from memory."""

    def is_initialized(self) -> bool:
        """Check if encryption is ready."""
```

#### CredentialsDatabase (`server/core/credentials_database.py`)
```python
class CredentialsDatabase:
    """Async SQLite database for encrypted credentials."""

    async def initialize(self) -> bytes:
        """Initialize database, create tables, return salt."""

    async def save_api_key(self, provider: str, key: str, metadata: Dict = None) -> bool
    async def get_api_key(self, provider: str) -> Optional[str]
    async def delete_api_key(self, provider: str) -> bool

    async def save_oauth_tokens(self, provider, access_token, refresh_token, ...) -> bool
    async def get_oauth_tokens(self, provider, customer_id="owner") -> Optional[Dict]
    async def delete_oauth_tokens(self, provider, customer_id="owner") -> bool
```

#### AuthService OAuth Methods (`server/services/auth.py`)
```python
class AuthService:
    """Single point of access for all credentials."""

    # Memory-only cache for decrypted credentials
    _api_key_cache: Dict[str, str] = {}
    _oauth_cache: Dict[str, Dict[str, Any]] = {}

    async def store_api_key(self, provider: str, key: str) -> bool
    async def get_api_key(self, provider: str) -> Optional[str]
    async def delete_api_key(self, provider: str) -> bool

    async def store_oauth_tokens(self, provider, access_token, refresh_token, ...) -> bool
    async def get_oauth_tokens(self, provider, customer_id="owner") -> Optional[Dict]
    async def remove_oauth_tokens(self, provider, customer_id="owner") -> bool

    def clear_cache(self) -> None:
        """Clear all cached credentials."""
```

#### UserAuthService Integration (`server/services/user_auth.py`)
```python
async def login(self, email: str, password: str):
    # ... verify credentials ...
    # Initialize encryption with user's password
    await self._initialize_encryption(password)
    return user, None

async def _initialize_encryption(self, password: str) -> None:
    salt = await self.credentials_db.initialize()
    self.encryption.initialize(password, salt)

def logout(self) -> None:
    self.encryption.clear()  # Clear key from memory
```

### Multi-Backend Support

For deployment flexibility, credentials can be stored in different backends:

#### Backend Options
| Backend | Use Case | Configuration |
|---------|----------|---------------|
| **Fernet** (default) | Local development, single-server | `CREDENTIAL_BACKEND=fernet` |
| **Keyring** | Desktop apps (OS-native storage) | `CREDENTIAL_BACKEND=keyring` |
| **AWS Secrets Manager** | Cloud deployments | `CREDENTIAL_BACKEND=aws` |

#### credential_backends.py
```python
class CredentialBackend(ABC):
    async def store(self, key: str, value: str, metadata: Dict = None) -> bool
    async def retrieve(self, key: str) -> Optional[str]
    async def delete(self, key: str) -> bool
    def is_available(self) -> bool

class FernetBackend(CredentialBackend):
    """Default: Fernet-encrypted SQLite."""

class KeyringBackend(CredentialBackend):
    """OS-native: Windows Credential Locker, macOS Keychain, Linux Secret Service."""
    SERVICE_NAME = "MachinaOS"

class AWSSecretsBackend(CredentialBackend):
    """AWS Secrets Manager for cloud deployments."""

def create_backend(settings, credentials_db=None) -> CredentialBackend:
    """Factory with automatic fallback to Fernet."""
```

### Configuration

Environment variables in `.env`:
```bash
# Credentials Database
CREDENTIALS_DB_PATH=credentials.db

# Backend Selection
CREDENTIAL_BACKEND=fernet    # fernet, keyring, or aws

# AWS Secrets Manager (when CREDENTIAL_BACKEND=aws)
AWS_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:machinaos-creds
AWS_REGION=us-east-1
```

### Key Files
| File | Description |
|------|-------------|
| `server/core/encryption.py` | Fernet encryption with PBKDF2 key derivation |
| `server/core/credentials_database.py` | Async SQLite for encrypted credentials |
| `server/core/credential_backends.py` | Multi-backend abstraction (Fernet, Keyring, AWS) |
| `server/services/auth.py` | AuthService with OAuth methods (single point of access) |
| `server/services/user_auth.py` | Encryption initialization on login/logout |
| `server/core/config.py` | credential_backend, aws_secret_arn settings |

### Dependencies
```toml
# server/pyproject.toml
[project]
dependencies = [
    "cryptography>=44.0.0",  # Fernet encryption
]

[project.optional-dependencies]
keyring = ["keyring>=25.0.0"]  # OS-native credential storage
aws = ["boto3>=1.34.0"]        # AWS Secrets Manager
```

### Design Decisions
- **No Migration**: Users re-enter API keys after upgrade (simpler, more secure)
- **Memory-Only Cache**: Decrypted credentials never written to disk/Redis
- **Separate Database**: `credentials.db` isolated from main `machina.db`
- **Password-Derived Key**: Encryption key not stored anywhere
- **Single Point of Access**: AuthService prevents direct database access from routers

## Example Workflows

### Overview
Example workflows are pre-built workflow templates that auto-load on first use. They provide users with starting points to explore the platform's capabilities. Examples are stored as JSON files in the `workflows/` folder at the project root.

### Architecture
```
workflows/                        # Example workflow JSON files (project root)
├── hello_world.json
├── zeenie_chat.json
└── ...

server/services/
└── example_loader.py             # Loads and imports examples

server/models/database.py         # UserSettings.examples_loaded flag
server/core/database.py           # Migration for examples_loaded column
server/routers/database.py        # Auto-load logic in get_all_workflows
```

### How It Works
1. **First Fetch Detection**: When `get_all_workflows` API is called, it checks `UserSettings.examples_loaded`
2. **Auto-Import**: If `examples_loaded=false`, imports all JSON files from `workflows/` folder
3. **Mark Complete**: Sets `examples_loaded=true` to prevent re-import on subsequent fetches
4. **Anonymous Support**: Uses `user_id="default"` when `VITE_AUTH_ENABLED=false`

### Workflow JSON Format
Example workflows use the same format as UI exports:
```json
{
  "id": "hello_world",
  "name": "Hello World",
  "description": "A simple workflow with a start node",
  "nodes": [
    {
      "id": "start_1",
      "type": "start",
      "position": {"x": 250, "y": 150},
      "data": {"label": "Start"}
    }
  ],
  "edges": [],
  "nodeParameters": {
    "start_1": { "someParam": "value" }
  },
  "version": "0.0.35"
}
```

**Fields:**
| Field | Description |
|-------|-------------|
| `id` | Unique identifier (prefixed with `example_` when imported) |
| `name` | Display name in workflow sidebar |
| `description` | Optional description |
| `nodes` | Array of node objects with id, type, position, data |
| `edges` | Array of edge connections between nodes |
| `nodeParameters` | Optional map of node_id to parameter objects (saved to DB on import) |
| `version` | App version (e.g., "0.0.35") |

### Key Files
| File | Description |
|------|-------------|
| `workflows/*.json` | Example workflow JSON files |
| `server/services/example_loader.py` | `get_example_workflows()`, `import_examples_for_user()` |
| `server/models/database.py` | `UserSettings.examples_loaded` field |
| `server/core/database.py` | Migration adds `examples_loaded` column |
| `server/routers/database.py` | Auto-load check in `get_all_workflows` |

### Example Loader Service
```python
# server/services/example_loader.py
EXAMPLES_DIR = Path(__file__).parent.parent.parent / "workflows"

def get_example_workflows() -> List[Dict[str, Any]]:
    """Load all example workflow JSON files from disk."""

async def import_examples_for_user(database) -> int:
    """Import all examples using existing database.save_workflow().
    Returns count of workflows imported."""
```

### Auto-Load Logic
```python
# server/routers/database.py - get_all_workflows endpoint
user_id = "default"
settings = await database.get_user_settings(user_id)

if not settings or not settings.get("examples_loaded", False):
    count = await import_examples_for_user(database)
    if count > 0:
        logger.info(f"Auto-loaded {count} example workflows")
    current = settings or {}
    current["examples_loaded"] = True
    await database.save_user_settings(current, user_id)
```

### Adding Custom Examples
1. Export a workflow from the UI (File > Export)
2. Copy the JSON file to `workflows/` folder at project root
3. Edit the `id` and `name` fields as needed
4. Delete `server/machina.db` (or set `examples_loaded=false` in database)
5. Restart server - examples auto-load on first workflow list fetch

### Database Migration
The `examples_loaded` column is automatically added to existing databases:
```python
# server/core/database.py - _migrate_user_settings()
if "examples_loaded" not in columns:
    await conn.execute(text(
        "ALTER TABLE user_settings ADD COLUMN examples_loaded BOOLEAN DEFAULT 0"
    ))
```

## Onboarding Service

### Overview
Multi-step welcome wizard that appears after first launch, guiding users through platform capabilities. Database-backed, skippable, resumable, and replayable from Settings.

See **[Onboarding Service](./docs-internal/onboarding.md)** for full documentation.

### Architecture
- **5-step wizard** using existing `Modal` component + Ant Design `Steps`, `Card`, `Button`, `Typography`, `Tag`
- **Database persistence** via `UserSettings.onboarding_completed` + `UserSettings.onboarding_step`
- **No new WebSocket handlers** -- reuses `get_user_settings` / `save_user_settings`
- **Existing users** auto-skip via migration (`examples_loaded=1` -> `onboarding_completed=1`)

### Steps

| Step | Component | Title | Purpose |
|------|-----------|-------|---------|
| 0 | `WelcomeStep` | Welcome to MachinaOs | Platform intro + feature highlights |
| 1 | `ConceptsStep` | Key Concepts | Nodes, Edges, Agents, Skills, Normal/Dev Mode |
| 2 | `ApiKeyStep` | API Key Setup | Provider list + "Open Credentials" button |
| 3 | `CanvasStep` | Canvas Tour | Visual UI layout diagram + keyboard shortcuts |
| 4 | `GetStartedStep` | Get Started | Example workflows, quick recipe, tips |

### Key Files
| File | Description |
|------|-------------|
| `client/src/hooks/useOnboarding.ts` | State hook with WebSocket persistence |
| `client/src/components/onboarding/OnboardingWizard.tsx` | Main wizard with Ant Design Steps |
| `client/src/components/onboarding/steps/*.tsx` | 5 step components using antd + @ant-design/icons |
| `client/src/Dashboard.tsx` | Renders wizard + passes `reopenTrigger` |
| `client/src/components/ui/SettingsPanel.tsx` | "Replay Welcome Guide" button in Help section |
| `server/models/database.py` | `UserSettings.onboarding_completed`, `onboarding_step` |
| `server/core/database.py` | Migration + CRUD for onboarding fields |

### Replay from Settings
- SettingsPanel has a "Replay Welcome Guide" button in the Help section
- Clicking it: closes Settings, increments `onboardingReopenTrigger` in Dashboard
- `useOnboarding` detects trigger change, resets state, reopens wizard from step 0

### Adding New Steps
1. Create `client/src/components/onboarding/steps/NewStep.tsx` using Ant Design components
2. Import in `OnboardingWizard.tsx`, add to `renderStep()` switch and `stepItems` array
3. Update `TOTAL_STEPS` in `useOnboarding.ts`

## AI Chat Model Development Guide

### Adding New AI Providers

Follow these steps to add a new AI provider. OpenRouter is used as a complete example.

#### Step 1: Frontend Node Definition

Create provider config in `client/src/nodeDefinitions/aiModelNodes.ts`:

```typescript
const openrouterConfig: ChatModelConfig = {
  providerId: 'openrouter',
  displayName: 'OpenRouter',
  icon: '🔀',
  color: '#6366F1',
  description: 'OpenRouter unified API - access OpenAI, Claude, Gemini, Llama, and more',
  models: [], // Models fetched dynamically via API
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    STANDARD_PARAMETERS.frequencyPenalty,
    STANDARD_PARAMETERS.presencePenalty,
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      default: 60000,
      typeOptions: { minValue: 1000, maxValue: 180000 },
      description: 'Timeout for the request in milliseconds'
    },
    {
      displayName: 'Max Retries',
      name: 'maxRetries',
      type: 'number',
      default: 2,
      typeOptions: { minValue: 0, maxValue: 5 },
      description: 'Maximum number of retries'
    }
  ]
};

// Add to exports
export const aiModelNodes = {
  // ... existing configs
  openrouterChatModel: createBaseChatModel(openrouterConfig)
};

export { openrouterConfig };
```

#### Step 2: Backend Provider Configuration

Add to `server/services/ai.py`:

```python
# Header function for API authentication
def _openrouter_headers(api_key: str) -> dict:
    return {
        'Authorization': f'Bearer {api_key}',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'MachinaOS'
    }

# Add to PROVIDER_CONFIGS dict
'openrouter': ProviderConfig(
    name='openrouter',
    model_class=ChatOpenAI,  # OpenRouter uses OpenAI-compatible API
    api_key_param='api_key',
    max_tokens_param='max_tokens',
    detection_patterns=('openrouter',),
    default_model='openai/gpt-4o-mini',
    models_endpoint='https://openrouter.ai/api/v1/models',
    models_header_fn=_openrouter_headers
),
```

Add model fetching in `fetch_models` method:

```python
elif provider == 'openrouter':
    response = await client.get(
        'https://openrouter.ai/api/v1/models',
        headers=_openrouter_headers(api_key)
    )
    response.raise_for_status()
    data = response.json()

    models = []
    for model in data.get('data', []):
        model_id = model.get('id', '')
        pricing = model.get('pricing', {})
        is_free = pricing.get('prompt') == '0' and pricing.get('completion') == '0'

        # Add [FREE] prefix for free models
        display_id = f'[FREE] {model_id}' if is_free else model_id
        models.append(display_id)

    return sorted(models, key=lambda x: (not x.startswith('[FREE]'), x))
```

Add to `create_model` method for custom base_url:

```python
if provider == 'openrouter':
    # Strip [FREE] prefix before API call
    actual_model = model.replace('[FREE] ', '')
    kwargs['model'] = actual_model
    kwargs['base_url'] = 'https://openrouter.ai/api/v1'
    kwargs['default_headers'] = {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'MachinaOS'
    }
```

#### Step 3: Provider Detection

Add to `server/constants.py`:

```python
AI_CHAT_MODEL_TYPES = (
    'openaiChatModel', 'anthropicChatModel', 'geminiChatModel', 'openrouterChatModel'
)

def detect_ai_provider(node_type: str, parameters: dict = None) -> str:
    if node_type == 'aiAgent':
        return (parameters or {}).get('provider', 'openai')
    elif 'openrouter' in node_type.lower():
        return 'openrouter'
    elif 'anthropic' in node_type.lower():
        return 'anthropic'
    elif 'gemini' in node_type.lower():
        return 'gemini'
    else:
        return 'openai'
```

#### Step 4: Frontend Credential Mapping

Add to `client/src/components/ModelNode.tsx`:

```typescript
const CREDENTIAL_TO_PROVIDER: Record<string, string> = {
  'openaiApi': 'openai',
  'anthropicApi': 'anthropic',
  'googleAiApi': 'gemini',
  'openrouterApi': 'openrouter'  // Add this
};

// Add fallback detection
if (type?.includes('openrouter')) return 'openrouter';

// Add icon fallback
if (type?.includes('openrouter')) return '🔀';
```

#### Step 5: Dashboard Node Type Mapping

Add to `client/src/Dashboard.tsx`:

```typescript
} else if (type === 'openaiChatModel' || type === 'anthropicChatModel' ||
           type === 'geminiChatModel' || type === 'openrouterChatModel') {
  types[type] = SquareNode;  // AI chat models use square design
}
```

#### Step 6: Add Credentials Modal Entry

Add to `client/src/components/CredentialsModal.tsx`:

```typescript
{
  id: 'openrouter',
  name: 'OpenRouter',
  icon: '🔀',
  fields: [{ name: 'apiKey', label: 'API Key', type: 'password', required: true }]
}
```

#### Step 7: Pydantic Validation (Optional)

Add to `server/models/nodes.py`:

```python
class AIChatModelParams(BaseNodeParams):
    type: Literal["openaiChatModel", "anthropicChatModel", "geminiChatModel", "openrouterChatModel"]
```

### Key Implementation Files

| File | Purpose |
|------|---------|
| `client/src/nodeDefinitions/aiModelNodes.ts` | Provider config with ChatModelConfig |
| `client/src/factories/baseChatModelFactory.ts` | Factory function for node definitions |
| `client/src/components/ModelNode.tsx` | Credential mapping and icon detection |
| `client/src/components/CredentialsModal.tsx` | API key entry UI |
| `client/src/Dashboard.tsx` | Node type to component mapping |
| `server/services/ai.py` | Provider configs, model fetching, LangChain integration |
| `server/constants.py` | Provider detection function |
| `server/models/nodes.py` | Pydantic validation (optional) |

### Special Considerations for OpenRouter

- **OpenAI-Compatible API**: Uses LangChain's `ChatOpenAI` with custom `base_url`
- **Model ID Format**: `provider/model-name` (e.g., `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`)
- **Free Models**: API returns pricing info; models with `0` cost get `[FREE]` prefix
- **Dropdown Grouping**: Frontend uses `<optgroup>` for Free/Paid model separation

## Simple Memory System

### Overview
The Simple Memory node provides markdown-based conversation history storage for AI agents. It connects to the AI Agent's `input-memory` handle to provide context from previous conversations. Memory is stored in markdown format, visible and editable directly in the parameter panel, with optional long-term vector storage for semantic retrieval.

### Architecture
```
Simple Memory Node → (memory output) → AI Agent (input-memory handle)
     ↓                                      ↓
   Markdown editor                    Parses markdown, saves new exchanges
   (visible in UI)                    Trims to window, archives to vector DB
```

### Memory Format
Conversation history is stored in markdown format with timestamps:
```markdown
# Conversation History

### **Human** (2025-01-30 14:23:45)
What is the weather like today?

### **Assistant** (2025-01-30 14:23:48)
I don't have access to real-time weather data...
```

### Key Features
- **Editable UI**: Conversation history visible in markdown editor in parameter panel
- **Window-Based Trimming**: Keeps last N message pairs, archives old messages
- **Long-Term Memory**: Optional vector DB storage for semantic retrieval of archived messages
- **Uses LangChain's InMemoryVectorStore**: Per-session vector stores with HuggingFaceEmbeddings (BAAI/bge-small-en-v1.5)

### Key Files
- **Node Definition**: `client/src/nodeDefinitions/aiAgentNodes.ts` - simpleMemory node config
- **Memory Helpers**: `server/services/ai.py` - `_parse_memory_markdown()`, `_append_to_memory_markdown()`, `_trim_markdown_window()`
- **Vector Store**: `server/services/ai.py` - `_get_memory_vector_store()` with InMemoryVectorStore
- **AI Integration**: `server/services/ai.py` - execute_agent with memory_data parameter
- **Handler**: `server/services/handlers/ai.py` - Collects memory parameters from connected node

### Node Properties
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| sessionId | string | 'default' | Unique identifier for conversation session |
| windowSize | number | 10 | Number of message pairs to keep in short-term memory |
| memoryContent | string (markdown) | Initial template | Editable conversation history in markdown format |
| longTermEnabled | boolean | false | Archive old messages to vector DB for semantic retrieval |
| retrievalCount | number | 3 | Number of relevant memories to retrieve from long-term storage (shown when longTermEnabled=true) |

### Memory Flow
1. **Load**: AI Agent reads `memoryContent` markdown from connected Simple Memory node
2. **Parse**: `_parse_memory_markdown()` converts markdown to LangChain messages
3. **Retrieve** (if enabled): Semantic search of vector store for relevant context
4. **Execute**: AI processes prompt with conversation history
5. **Append**: New human/AI messages appended to markdown
6. **Trim**: `_trim_markdown_window()` keeps last N pairs, returns removed texts
7. **Archive**: Removed messages stored in InMemoryVectorStore (if longTermEnabled)
8. **Save**: Updated markdown saved back to node parameters

### Usage Flow
1. Add Simple Memory node to workflow
2. Connect its output to AI Agent's `input-memory` handle (bottom-left diamond)
3. Configure session ID (use different IDs for separate conversations)
4. Optionally enable long-term memory for semantic retrieval
5. Run AI Agent - it automatically reads/updates memory content
6. View/edit conversation history in the markdown editor

### Design Decisions
- **Passive Node**: Memory node has no Run button - AI Agent reads its configuration directly when executed
- **Markdown Storage**: Human-readable format, editable in UI, easy to debug
- **Per-Session Vector Stores**: `_memory_vector_stores` dict keyed by session_id
- **Window + Archive**: Short-term (recent messages) + long-term (semantic retrieval) memory pattern
- **Auto-Save**: AI Agent automatically saves updated markdown content to node parameters

## Memory Compaction, Token Tracking, and Cost Calculation

### Overview
The compaction service enables automatic memory compaction, token tracking, and **cost calculation** for all LLM providers. Cost is calculated using official pricing (per 1M tokens) and stored alongside token metrics. The Credentials Modal displays per-provider usage and costs.

### Architecture
```
AI Agent Execution
       ↓
CompactionService.track() → PricingService.calculate_cost()
       ↓                   → Save token metrics + cost to DB
       ↓                   → Update cumulative state + cost
       ↓                   → Check if threshold exceeded
       ↓
If needs_compaction:
  - Anthropic: Native compaction via context_management API
  - OpenAI: Native compaction via compact_threshold
  - Others: Client-side summarization fallback
       ↓
CompactionService.record() → Save compaction event to DB
                           → Reset cumulative token count
```

### Native Provider APIs

**Anthropic SDK (tool_runner):**
```python
compaction_control = {
    "enabled": True,
    "context_token_threshold": 100000
}
```

**Anthropic Messages API:**
```python
{
    "betas": ["compact-2026-01-12"],
    "context_management": {
        "edits": [{
            "type": "compact_20260112",
            "trigger": {"type": "input_tokens", "value": 100000}
        }]
    }
}
```

**OpenAI:**
```python
{"context_management": {"compact_threshold": 100000}}
```

### Key Files
| File | Description |
|------|-------------|
| `server/services/compaction.py` | CompactionService with track(), record(), stats(), configure(), compact_context() methods |
| `server/services/pricing.py` | PricingService with official pricing registry for all 6 providers |
| `server/services/ai.py` | `_track_token_usage()` with automatic compaction triggering |
| `server/models/database.py` | TokenUsageMetric, CompactionEvent, SessionTokenState tables (with cost fields) |
| `server/core/database.py` | CRUD methods for token metrics, compaction events, and `get_provider_usage_summary()` |
| `server/core/config.py` | compaction_enabled, compaction_threshold settings |
| `server/core/container.py` | Dependency injection for compaction_service |
| `server/main.py` | Wires AI service to compaction service at startup |
| `server/routers/websocket.py` | get_compaction_stats, configure_compaction, get_provider_usage_summary handlers |
| `client/src/hooks/useApiKeys.ts` | `getProviderUsageSummary()` hook method |
| `client/src/components/CredentialsModal.tsx` | Usage & Costs collapsible section per provider |

### Database Models

**TokenUsageMetric** - Per-execution token usage and cost:
```python
class TokenUsageMetric(SQLModel, table=True):
    session_id: str          # Memory session identifier
    node_id: str             # Agent node ID
    provider: str            # openai, anthropic, gemini, groq, cerebras, openrouter
    model: str               # Model name
    input_tokens: int        # Input token count
    output_tokens: int       # Output token count
    total_tokens: int        # Total tokens
    cache_creation_tokens: int  # Anthropic cache creation
    cache_read_tokens: int      # Anthropic cache read
    reasoning_tokens: int       # OpenAI o-series reasoning
    # Cost fields (USD)
    input_cost: float        # Cost for input tokens
    output_cost: float       # Cost for output tokens
    cache_cost: float        # Cost for cache tokens
    total_cost: float        # Total cost
```

**SessionTokenState** - Cumulative state per session:
```python
class SessionTokenState(SQLModel, table=True):
    session_id: str              # Unique session identifier
    cumulative_total: int        # Running total tokens
    custom_threshold: int        # Per-session threshold override
    compaction_count: int        # Number of compactions
    last_compaction_at: datetime # Last compaction timestamp
    # Cumulative cost fields (USD)
    cumulative_input_cost: float
    cumulative_output_cost: float
    cumulative_total_cost: float
```

**CompactionEvent** - Compaction history:
```python
class CompactionEvent(SQLModel, table=True):
    session_id: str
    trigger_reason: str      # "native" or "threshold"
    tokens_before: int
    tokens_after: int
    summary_content: str     # Compacted summary (if available)
```

### CompactionService API

```python
from services.compaction import get_compaction_service

svc = get_compaction_service()

# Get provider-specific config
anthropic_cfg = svc.anthropic_config(threshold=100000)
openai_cfg = svc.openai_config(threshold=100000)

# Track token usage after AI execution
result = await svc.track(
    session_id="user-123",
    node_id="agent-1",
    provider="anthropic",
    model="claude-3-5-sonnet",
    usage={"input_tokens": 5000, "output_tokens": 1000, "total_tokens": 6000}
)
# result: {"total": 6000, "total_cost": 0.021, "threshold": 100000, "needs_compaction": False}

# Record compaction event after native API handles it
await svc.record(
    session_id="user-123",
    node_id="agent-1",
    provider="anthropic",
    model="claude-3-5-sonnet",
    tokens_before=105000,
    tokens_after=15000,
    summary="Compacted conversation summary..."
)

# Get session statistics
stats = await svc.stats("user-123")
# {"session_id": "user-123", "total": 15000, "threshold": 100000, "count": 1}

# Configure per-session settings
await svc.configure("user-123", threshold=50000, enabled=True)
```

### WebSocket Handlers

| Handler | Description |
|---------|-------------|
| `get_compaction_stats` | Get token statistics for a session |
| `configure_compaction` | Update threshold/enabled settings for a session |
| `get_provider_usage_summary` | Get aggregated usage and cost by provider for Credentials Modal |

### PricingService

Calculates cost based on official pricing (USD per 1M tokens):

```python
from services.pricing import get_pricing_service

pricing = get_pricing_service()

# Calculate cost for token usage
cost = pricing.calculate_cost(
    provider="anthropic",
    model="claude-3-5-sonnet",
    input_tokens=5000,
    output_tokens=1000,
    cache_read_tokens=500
)
# cost: {"input_cost": 0.015, "output_cost": 0.015, "cache_cost": 0.00015, "total_cost": 0.03015}

# Get pricing for a model (supports partial matching)
pricing_info = pricing.get_pricing("anthropic", "claude-3-5-sonnet-20241022")
# pricing_info: ModelPricing(input_per_mtok=3.0, output_per_mtok=15.0, cache_read_per_mtok=0.30)
```

**Supported Providers & Pricing** (February 2026):
| Provider | Example Models | Input $/MTok | Output $/MTok |
|----------|---------------|--------------|---------------|
| OpenAI | gpt-5, gpt-4o, o3 | 1.25-15.00 | 10.00-60.00 |
| Anthropic | claude-opus-4.6, claude-sonnet-4 | 3.00-5.00 | 15.00-25.00 |
| Gemini | gemini-2.5-pro, gemini-2.0-flash | 0.10-1.25 | 0.40-10.00 |
| Groq | llama-4-scout, qwen3-32b | 0.05-0.59 | 0.08-0.79 |
| Cerebras | llama-3.1-70b | 0.10-0.60 | 0.10-0.60 |
| OpenRouter | Pass-through | Varies | Varies |

### Configuration

Environment variables in `.env`:
```bash
COMPACTION_ENABLED=true       # Enable/disable compaction globally
COMPACTION_THRESHOLD=100000   # Default token threshold (min: 10000)
```

### Client-Side Compaction

When the token threshold is exceeded, the service automatically triggers compaction using the AI service to generate a structured summary:

```python
# Automatic compaction in _track_token_usage()
if tracking.get('needs_compaction') and memory_content and api_key:
    result = await svc.compact_context(
        session_id=session_id,
        node_id=node_id,
        memory_content=memory_content,  # Current conversation markdown
        provider=provider,
        api_key=api_key,
        model=model
    )
    # result: {"success": True, "summary": "# Conversation Summary (Compacted)...", "tokens_before": 105000, "tokens_after": 0}
```

**Summary Structure** (Claude Code pattern):
```markdown
# Conversation Summary (Compacted)
*Generated: 2025-02-12T10:30:00Z*

## Task Overview
What the user is trying to accomplish.

## Current State
What's been completed and what's in progress.

## Important Discoveries
Key findings, decisions, or problems encountered.

## Next Steps
What needs to happen next.

## Context to Preserve
Details that must be retained for continuity.
```

### WebSocket Broadcasts

Real-time updates broadcast to frontend:

| Event | Description |
|-------|-------------|
| `token_usage_update` | After each AI execution: `{session_id, data: {total, threshold, needs_compaction}}` |
| `compaction_starting` | Before compaction begins: `{session_id, node_id}` |
| `compaction_completed` | After compaction: `{session_id, success, tokens_before, tokens_after, error}` |

### Token Usage UI

The MiddleSection displays a Token Usage panel for memory nodes with:
- **Progress bar**: Visual tokens used vs threshold
- **Statistics**: Current token count, threshold, compaction count
- **Editable threshold**: Click edit icon to change per-session threshold

```typescript
// In client/src/components/parameterPanel/MiddleSection.tsx
<Collapse.Panel header="Token Usage" key="tokenUsage">
  <Progress percent={Math.round((total / threshold) * 100)} />
  <Statistic title="Tokens Used" value={`${total} / ${threshold}`} />
  <Statistic title="Compactions" value={count} />
  <InputNumber onChange={updateThreshold} />  {/* Edit threshold */}
</Collapse.Panel>
```

### Service Wiring

The compaction service requires AI service for summarization, wired at startup:

```python
# In server/main.py
from services.compaction import get_compaction_service
compaction_svc = container.compaction_service()
compaction_svc.set_ai_service(container.ai_service())
```

### Design Decisions
- **Hybrid Approach**: Native APIs for Anthropic/OpenAI configs, client-side summarization for actual compaction
- **5-Section Summary**: Follows Claude Code's structured summary format for continuity
- **Automatic Triggering**: Compaction triggered in `_track_token_usage()` when threshold exceeded
- **Per-Session State**: Each memory session has independent token tracking and thresholds
- **100K Threshold**: Matches Claude Code's default (configurable per session)
- **Singleton Pattern**: Service accessible via `get_compaction_service()`

## API Cost Tracking

Centralized cost tracking for third-party API services (Twitter/X, Google Maps). See [Pricing Service](./docs-internal/pricing_service.md) for full documentation.

### Two Tracking Methods

**1. Manual Tracking** - For services using native SDKs:
```python
# server/services/handlers/twitter.py
await _track_twitter_usage(node_id, 'tweet', 1, workflow_id, session_id)

# server/services/maps.py
await _track_maps_usage(node_id, 'geocode', 1, workflow_id, session_id)
```

**2. Automatic HTTPX Tracking** - For services using httpx client:
```python
from services.tracked_http import get_tracked_client, set_tracking_context

set_tracking_context(node_id="twitter-1", session_id="user-123")
client = get_tracked_client()
response = await client.post("https://api.twitter.com/2/tweets", json={...})
# Automatically tracked via HTTPX response event hook!
```

### Pricing Configuration

All pricing in `server/config/pricing.json` (user-editable):
- `llm`: Per-model token pricing (USD/MTok)
- `api`: Per-service operation pricing (USD/request)
- `operation_map`: Maps handler actions to pricing operations
- `url_patterns`: Regex patterns for automatic HTTPX tracking

### Database Storage

`APIUsageMetric` table stores: service, operation, endpoint, resource_count, cost (USD)

### Frontend Display

`CredentialsModal.renderApiUsagePanel()` shows per-service usage and costs.

## AI Agent Tool System

### Overview
Tool nodes provide capabilities that AI Agents can invoke during reasoning. Each tool node connects to the AI Agent's `input-tools` handle and defines a schema for the LLM to understand how to call it.

### Architecture
```
Tool Node (calculatorTool) → (tool output) → AI Agent (input-tools handle)
                                                    ↓
                                            LangGraph builds tools from schemas
                                                    ↓
                                            LLM decides when to call tools
                                                    ↓
                                            Tool executor runs handler
                                                    ↓
                                            Result returned to LLM
```

### Tool Execution Flow
1. **Tool Discovery**: AI Agent scans edges for nodes connected to `input-tools` handle
2. **Schema Building**: `_get_tool_schema()` in `ai.py` creates Pydantic schema for each tool type
3. **Tool Binding**: LangGraph binds tools to the LLM model
4. **LLM Decision**: LLM decides when to call tools based on user query
5. **Status Broadcast**: `executing_tool` status broadcast with tool_name for UI animation
6. **Tool Execution**: `execute_tool()` in `tools.py` dispatches to appropriate handler
7. **Result Return**: Tool result returned to LLM for continued reasoning

### Key Files
| File | Description |
|------|-------------|
| `client/src/nodeDefinitions/toolNodes.ts` | Tool node definitions (calculatorTool, currentTimeTool, duckduckgoSearch, androidTool) |
| `client/src/nodeDefinitions/searchNodes.ts` | Search node definitions (braveSearch, serperSearch, perplexitySearch) |
| `client/src/nodeDefinitions/specializedAgentNodes.ts` | Specialized agent definitions (10 nodes) + AI_AGENT_PROPERTIES + SPECIALIZED_AGENT_TYPES |
| `server/services/handlers/tools.py` | Tool execution handlers |
| `server/services/ai.py` | `_get_tool_schema()` - Pydantic schemas for tools |
| `server/services/handlers/ai.py` | Tool discovery from edges |

### Tool Node Definition Pattern
```typescript
// In toolNodes.ts
calculatorTool: {
  displayName: 'Calculator Tool',
  name: 'calculatorTool',
  icon: '...',
  group: ['tool', 'ai'],  // 'tool' marks as tool node
  outputs: [{
    name: 'tool',
    type: 'main' as NodeConnectionType,
    description: 'Connect to AI Agent tool handle'
  }],
  properties: [
    { name: 'toolName', type: 'string', default: 'calculator' },
    { name: 'toolDescription', type: 'string', default: '...' }
  ]
}
```

### Specialized Agent Node Definition Pattern
```typescript
// In specializedAgentNodes.ts - uses shared AI_AGENT_PROPERTIES for full AI configuration
android_agent: {
  displayName: 'Android Control Agent',
  name: 'android_agent',
  icon: '📱',
  group: ['agent', 'ai'],  // 'agent' for category placement
  inputs: [
    { name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType },
    { name: 'skill', displayName: 'Skill', type: 'main' as NodeConnectionType },
    { name: 'memory', displayName: 'Memory', type: 'main' as NodeConnectionType },
    { name: 'tools', displayName: 'Tool', type: 'main' as NodeConnectionType }
  ],
  outputs: [{ name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType }],
  properties: AI_AGENT_PROPERTIES  // Full AI configuration (provider, model, prompt, etc.)
}
```

### Adding New Tools
1. **Frontend**: Add node definition in `toolNodes.ts` with `group: ['tool', 'ai']`
2. **Schema**: Add Pydantic schema in `ai.py` `_get_tool_schema()`
3. **Handler**: Add execution handler in `tools.py` and dispatcher case in `execute_tool()`
4. **TOOL_NODE_TYPES**: Add to array in `toolNodes.ts`

### Adding New Specialized Agents
**Frontend (5 files):**
1. **Node Definition**: Add to `specializedAgentNodes.ts` with `group: ['agent', 'ai']`, `properties: AI_AGENT_PROPERTIES`, and `defaults.color: dracula.<color>`
2. **SPECIALIZED_AGENT_TYPES**: Add to array in `specializedAgentNodes.ts`
3. **AIAgentNode Config**: Add to `AGENT_CONFIGS` in `AIAgentNode.tsx` with icon, title, subtitle, `themeColorKey`, standard handles (Skill 25%, Tool 75%, Memory 70%), 260x160px
4. **MiddleSection.tsx**: Add to `AGENT_WITH_SKILLS_TYPES` array
5. **InputSection.tsx**: Add to both `AGENT_WITH_SKILLS_TYPES` and `aiAgentTypes` arrays

**Backend (4 files):**
6. **constants.py**: Add to `AI_AGENT_TYPES` frozenset
7. **node_executor.py**: Add handler registry entry mapping to `partial(handle_chat_agent, ...)`
8. **handlers/tools.py**: Add to delegation check tuple in `execute_tool()`
9. **ai.py**: Add entries to `DEFAULT_TOOL_NAMES`, `DEFAULT_TOOL_DESCRIPTIONS`, and `DelegateToAgentSchema` condition

**No changes needed:** `Dashboard.tsx` auto-maps via `SPECIALIZED_AGENT_TYPES.forEach()`

### Tool Execution Animation
Tool nodes display execution status via the standard node status system:
- Backend broadcasts `executing` status to tool node when AI Agent calls it
- `SquareNode.tsx` uses `getNodeStatus()` from WebSocket context
- Tool nodes show cyan border and pulse animation when `isExecuting` is true
- **Minimum glow duration**: 500ms ensures fast-executing tools are visible (via `isGlowing` state)
- Dual-purpose tools (Python/JavaScript) fall back to node params when LLM returns empty args

### Implemented Tools
| Tool | Schema | Handler | Description |
|------|--------|---------|-------------|
| calculatorTool | CalculatorSchema | `_execute_calculator()` | Math operations |
| currentTimeTool | CurrentTimeSchema | `_execute_current_time()` | Date/time with timezone |
| duckduckgoSearch | DuckDuckGoSearchSchema | `_execute_duckduckgo_search()` | DuckDuckGo web search (free) |
| braveSearch | BraveSearchSchema | `handle_brave_search()` | Brave Search API web results |
| serperSearch | SerperSearchSchema | `handle_serper_search()` | Google SERP via Serper API |
| perplexitySearch | PerplexitySearchSchema | `handle_perplexity_search()` | AI-powered search with citations |
| androidTool | AndroidToolSchema | `_execute_android_toolkit()` | Android device control via connected services |
| Android service nodes | Per-service schema | `_execute_android_service()` | Direct Android service tools (see below) |

### Direct Android Service Tools
Android service nodes (batteryMonitor, wifiAutomation, etc.) can be connected directly to any agent's `input-tools` handle without using the androidTool aggregator. The `execute_tool()` function detects these via `ANDROID_SERVICE_NODE_TYPES` and routes to `_execute_android_service()`.

**Service ID Mapping** (camelCase node type -> snake_case service ID):
```python
service_id_map = {
    'batteryMonitor': 'battery',
    'networkMonitor': 'network',
    'systemInfo': 'system_info',
    'location': 'location',
    'appLauncher': 'app_launcher',
    'appList': 'app_list',
    'wifiAutomation': 'wifi_automation',
    'bluetoothAutomation': 'bluetooth_automation',
    'audioAutomation': 'audio_automation',
    'deviceStateAutomation': 'device_state',
    'screenControlAutomation': 'screen_control',
    'airplaneModeControl': 'airplane_mode',
    'motionDetection': 'motion_detection',
    'environmentalSensors': 'environmental_sensors',
    'cameraControl': 'camera_control',
    'mediaControl': 'media_control',
}
```

### Android Toolkit Pattern
The androidTool follows n8n Sub-Node and LangChain Toolkit patterns:
- **Gateway Pattern**: Single tool node aggregates multiple Android service nodes
- **Dynamic Schema**: Schema built at runtime from connected services only
- **Service Routing**: Tool execution routes to appropriate connected Android node

```
[Battery Monitor] --+
                    +--> [Android Toolkit] --> [AI Agent]
[WiFi Automation] --+
```

The AI sees a single `android_device` tool with schema showing only connected services:
- `service_id`: Which service to use (e.g., "battery", "wifi_automation")
- `action`: Action to perform (e.g., "status", "enable", "disable")
- `parameters`: Action-specific parameters

### Tool Schema Editor
The Android Toolkit node includes a schema editor UI for customizing the LLM-visible schema of connected services.

#### Architecture
```
ToolSchemaEditor Component
        ↓
  useToolSchema Hook (WebSocket CRUD)
        ↓
  Database (tool_schemas table)
        ↓
  AI Service reads schemas at execution
```

#### Key Files
| File | Description |
|------|-------------|
| `client/src/components/parameterPanel/ToolSchemaEditor.tsx` | Schema editor UI component |
| `client/src/hooks/useToolSchema.ts` | WebSocket hook for schema CRUD operations |
| `server/models/database.py` | `ToolSchema` SQLModel table definition |
| `server/core/database.py` | Database CRUD methods for tool schemas |
| `server/routers/websocket.py` | WebSocket handlers for schema operations |

#### Database Model
```python
class ToolSchema(SQLModel, table=True):
    __tablename__ = "tool_schemas"
    node_id: str          # Service node ID (unique key)
    tool_name: str        # Display name (e.g., "Battery Monitor")
    tool_description: str # Description shown to LLM
    schema_config: Dict   # Schema fields and types (JSON)
    connected_services: Optional[Dict]  # For toolkit aggregation
```

#### UI Features
- **Service Selector**: Dropdown showing only Android service nodes connected to the toolkit
- **Schema Fields Editor**: Add/remove/edit fields with name, type, description, required flag
- **Per-Service Schema**: Each connected service has its own independent schema stored by service node ID
- **Save/Reset**: Changes tracked locally, saved to database on demand

#### WebSocket Messages
| Message Type | Description |
|--------------|-------------|
| `get_tool_schema` | Get schema for a node by ID |
| `save_tool_schema` | Save/update schema for a node |
| `delete_tool_schema` | Delete schema for a node |
| `get_all_tool_schemas` | Get all stored schemas |

#### Default Schema Generation
When no custom schema exists, service-specific defaults are generated:
```typescript
{
  description: `Control ${serviceName} on Android device`,
  fields: {
    action: { type: 'string', description: `Action to perform on ${serviceName}`, required: true },
    parameters: { type: 'object', description: `Parameters for the ${serviceName} action`, required: false }
  }
}
```

### Web Search Implementation

#### DuckDuckGo (duckduckgoSearch - free, no API key)
Uses `ddgs` library for web results:
```python
from ddgs import DDGS
def do_search():
    ddgs = DDGS()
    return list(ddgs.text(query, max_results=max_results))
search_results = await asyncio.get_event_loop().run_in_executor(None, do_search)
```

#### Search API Nodes (braveSearch, serperSearch, perplexitySearch)
Dedicated handlers in `server/services/handlers/search.py` using `httpx.AsyncClient`:
- **Brave Search**: `GET https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token` header. Returns `{query, results: [{title, snippet, url}], result_count, provider}`.
- **Serper**: `POST https://google.serper.dev/search` with `X-API-KEY` header. Supports web/news/images/places search types. Returns `{query, results, result_count, search_type, provider}` with optional `knowledge_graph`.
- **Perplexity Sonar**: `POST https://api.perplexity.ai/chat/completions` with Bearer token. Returns `{query, answer (markdown), citations: [url], results: [{url}], model, provider}` with optional `images` and `related_questions`.

All handlers fetch API keys via `auth_service.get_api_key()` and track usage via `_track_search_usage()` for cost calculation.

## Config Node Architecture

### Overview
Config nodes (memory, tools, models) connect to parent nodes via special "config handles" (e.g., `input-memory`, `input-tools`). These are auxiliary connections for configuration, not main data flow. The UI intelligently handles visibility of connected inputs based on this architecture.

### Config Handle Convention
Config handles follow the pattern `input-<type>` where type is NOT 'main':
- `input-memory` - Memory/context nodes
- `input-tools` - Tool nodes
- `input-model` - Model configuration nodes
- `input-main` - Main data flow (NOT a config handle)

### Config Node Detection
Nodes are identified as config nodes by their `group` array in the node definition:
```typescript
// Config node example (simpleMemory)
group: ['skill', 'memory']  // 'memory' or 'tool' indicates config node
```

### Input Inheritance
Config nodes automatically inherit their parent node's main inputs in the parameter panel:
```
WhatsApp Trigger → AI Agent ← Simple Memory
       ↓              ↑
   main input    config handle

When viewing Simple Memory's parameters:
- Shows: "WhatsApp Trigger (via AI Agent)"
- Can drag WhatsApp outputs into Memory's parameters
```

### Filtering Logic
Located in `InputSection.tsx` and `OutputPanel.tsx`:
1. **Parent nodes** (AI Agent): Skip showing config node connections as inputs
2. **Config nodes** (Memory): Inherit parent's main input connections with "(via Parent)" label

### Key Functions
```typescript
// Check if handle is for config nodes (not main data flow)
const isConfigHandle = (handle: string | null | undefined): boolean => {
  if (!handle) return false;
  return handle.startsWith('input-') && handle !== 'input-main';
};

// Check if node is a config/auxiliary node
const isConfigNode = (nodeType: string | undefined): boolean => {
  const definition = nodeDefinitions[nodeType];
  const groups = definition?.group || [];
  return groups.includes('memory') || groups.includes('tool');
};
```

### Adding New Config Node Types
1. Add 'memory' or 'tool' to node's `group` array in definition
2. Use `input-<type>` naming for the target handle on parent node
3. Input inheritance and filtering work automatically

### Toolkit Sub-Node Execution Pattern

Toolkit nodes (like `androidTool`) aggregate sub-nodes that should only execute when called via the toolkit's tool interface, not as independent workflow nodes.

**Problem**: In parallel execution mode, Kahn's algorithm schedules nodes with in-degree 0 first. Sub-nodes connect TO the toolkit (not from it), so they have in-degree 0 and would be incorrectly scheduled in layer 0.

**Solution**: The executor detects and excludes toolkit sub-nodes from execution layers.

**Key Constants** (`server/constants.py`):
```python
# Toolkit node types that aggregate sub-nodes
TOOLKIT_NODE_TYPES: FrozenSet[str] = frozenset([
    'androidTool',  # Aggregates Android service nodes
])

# Config nodes excluded from execution (includes tool nodes)
CONFIG_NODE_TYPES: FrozenSet[str] = (
    AI_MEMORY_TYPES | AI_TOOL_TYPES | AI_CHAT_MODEL_TYPES
)
```

**Detection Logic** (in `ExecutionContext.create()` and `_compute_execution_layers()`):
```python
# Find toolkit sub-nodes (nodes that connect TO a toolkit)
toolkit_node_ids = {n.get("id") for n in nodes if n.get("type") in TOOLKIT_NODE_TYPES}
subnode_ids: set = set()
for edge in edges:
    source = edge.get("source")
    target = edge.get("target")
    # Any node that connects TO a toolkit is a sub-node
    if target in toolkit_node_ids and source:
        subnode_ids.add(source)
```

**Example Workflow**:
```
[WhatsApp Trigger] → [AI Agent] ← [Android Toolkit] ← [Battery Monitor]
                                                    ← [Location]
```
- `Battery Monitor` and `Location` connect TO `Android Toolkit`
- They are detected as sub-nodes and excluded from execution layers
- They only execute when AI Agent calls the toolkit's tool interface

## Android Services Development Guide

### Architecture
Android services use a factory pattern with `createAndroidServiceNode()` for consistent node structure:
- **SquareNode Component**: Visual representation with configuration status indicators
- **Dynamic Actions**: Load available actions from backend via `loadOptionsMethod`
- **ADB Integration**: All services communicate with Android devices via ADB commands
- **Parameter System**: Flexible JSON parameters for service-specific configuration

### Adding New Android Services
1. **Add Node Definition** in `src/nodeDefinitions/androidServiceNodes.ts`:
   ```typescript
   newService: createAndroidServiceNode({
     name: 'newService',
     displayName: 'New Service',
     serviceId: 'new_service',
     icon: '🎯',
     color: '#FF5722',
     group: ['android', 'category'],
     description: 'Service description',
     defaultAction: 'default_action'
   })
   ```

2. **Add to Node Type Array** in same file:
   ```typescript
   export const ANDROID_SERVICE_NODE_TYPES = [
     // ... existing nodes
     'newService'
   ];
   ```

3. **Implement Backend Handler** in `server/services/workflow.py`:
   - Add execution logic for the new service
   - Handle parameters and return formatted results
   - Use subprocess for ADB commands if needed

4. **Add API Endpoint** (optional) in `server/routers/android.py`:
   - Add endpoints for service-specific operations
   - Implement action handlers with proper error handling

### Key Files
- **Node Factory**: `src/nodeDefinitions/androidServiceNodes.ts` - Creates Android service nodes
- **Backend Router**: `server/routers/android.py` - API endpoints for Android operations
- **Workflow Handler**: `server/services/workflow.py` - Execution logic for all nodes
- **Execution Service**: `src/services/executionService.ts` - Routes Android nodes to Python backend

### Requirements
- **Device Connection**: Configure Android connection via Credentials Modal (Android panel)
- **Permissions**: Android app must have necessary permissions for services

### Android Device Connection
Android device connection is configured via the **Credentials Modal** (Android panel), not via workflow nodes.

**Connection Types:**
1. **Remote Relay** (recommended): Connect to Android device via relay server (QR code pairing)
2. **Local ADB**: Connect via USB with ADB port forwarding

**WebSocket Handlers** (`server/routers/websocket.py`):
- `android_relay_connect` - Connect to relay server, get QR code for pairing
- `android_relay_disconnect` - Disconnect from relay server
- `android_relay_reconnect` - Reconnect to relay server

### Android Relay Client
Located in `server/services/android/`:

**Key Components:**
- `client.py` - RelayWebSocketClient manages persistent connection
- `broadcaster.py` - Status broadcast functions (connected, paired, disconnected)
- `manager.py` - Global client instance management
- `protocol.py` - JSON-RPC 2.0 message handling

**Message Filtering:**
```python
async def receive_message(self, timeout: float = 10.0):
    """Receive response message, skipping non-response types"""
    skip_types = {'presence', 'pong', 'ping', 'connected'}

    while True:
        data = await asyncio.wait_for(self._message_queue.get(), timeout)
        msg_type = data.get('type', '')

        if msg_type in skip_types:
            continue  # Skip and wait for next message

        return data  # Return actual response
```

**Performance Benefits:**
- Initial connection: ~0.18s (WebSocket handshake + registration)
- Reused connection: ~0.0003s (600x faster)
- Background tasks maintain connection health
- Message queue decouples receiving from service execution

### Android Relay Connection vs Device Pairing

The Android relay system uses a **two-state model** for connection status:

| State | Description | Frontend Indicator |
|-------|-------------|-------------------|
| `connected` | WebSocket connection to relay server is active | N/A (not shown directly) |
| `paired` | Android device has scanned QR and is paired via relay | Green/Red status dot |

**Key Concepts:**
- **Relay Connection**: The WebSocket connection to `wss://relay.zeenie.xyz/ws` - can be active without a device
- **Device Pairing**: An Android device scans the QR code and pairs - required for service execution
- **Android service nodes require pairing**, not just relay connection, to execute

**Status Broadcasting Architecture:**
```
server/services/android/
├── client.py        # RelayWebSocketClient - manages WebSocket connection
├── broadcaster.py   # Status broadcast functions
├── manager.py       # Global client instance management
└── protocol.py      # JSON-RPC 2.0 message handling
```

**Broadcast Functions** (`server/services/android/broadcaster.py`):
```python
# Device connected and paired
await broadcast_connected(device_id, device_name)

# Device disconnected but relay still connected (for re-pairing)
await broadcast_device_disconnected(
    relay_connected=True,
    qr_data=qr_data,
    session_token=session_token
)

# Relay connection fully closed
await broadcast_relay_disconnected()

# QR code available for pairing
await broadcast_qr_code(qr_data, session_token)
```

**Frontend Status Indicator** (`client/src/components/SquareNode.tsx`):
```typescript
// Android nodes use 'paired' status, not 'connected'
const isAndroidConnected = isAndroidNode && androidStatus.paired;
```

**Status Flow:**
1. User clicks "Connect" → Relay WebSocket connects → `connected=true, paired=false`
2. QR code displayed → User scans with Android app → `connected=true, paired=true`
3. Android app disconnects → `connected=true, paired=false` (can re-pair)
4. Relay WebSocket closes → `connected=false, paired=false`

**WebSocket Context Interface** (`client/src/contexts/WebSocketContext.tsx`):
```typescript
export interface AndroidStatus {
  connected: boolean;      // Relay WebSocket connected
  paired: boolean;         // Android device paired
  device_id: string | null;
  device_name: string | null;
  connected_devices: string[];
  connection_type: string | null;
  qr_data: string | null;
  session_token: string | null;
}
```

## WhatsApp Integration

### Overview
WhatsApp nodes use square design with integrated QR code viewing and proper error handling. The integration proxies all requests through the Python backend to the WhatsApp RPC service (default port 9400, configurable via `WHATSAPP_RPC_PORT` env var or `--port` CLI flag).

### Architecture
```
Frontend (WhatsAppNode.tsx) → Python Backend (/api/whatsapp/*) → WhatsApp RPC Service (localhost:${WHATSAPP_RPC_PORT:-9400})
```

### Key Features
- **Square Node Design**: 80x80px square nodes with status indicators
- **QR Code Viewer**: Embedded QR code display via Python backend proxy
- **Error Handling**: Robust error handling with proper HTTP status codes (503, 504, 410)
- **No Mock Data**: All endpoints return proper errors instead of mock responses
- **Connection Status**: Real-time status display with device ID, session, and service info

### Backend Endpoints (`server/routers/whatsapp.py`)

#### `/api/whatsapp/status` - Get Connection Status
- Returns WhatsApp connection status from Flask service
- Handles ConnectError, TimeoutException with 503/504 status codes
- Safe JSON parsing with error handling

#### `/api/whatsapp/qr` - Get QR Code
- Checks connection status first
- Returns QR code data if not connected
- Returns "Already connected" message if connected
- Handles errors gracefully without crashing

#### `/api/whatsapp/start` - Start Connection
- Proxies start request to Flask service
- Safe JSON parsing and error handling
- Returns proper HTTP errors on failure

#### `/api/whatsapp/send` - Send Message
- Enhanced messaging endpoint
- Comprehensive error handling with specific exception catches
- Never crashes on service unavailability

### Frontend Component (`client/src/components/WhatsAppNode.tsx`)
- **Node Type**: Square (80x80px, borderRadius: 8px)
- **Status Indicators**: Top-right corner indicator (green/yellow/red)
- **Connect Button**: Bottom-left corner for opening modal
- **QR Code Display**: Fetches QR via `fetchQRCode()` from Python backend
- **Connection Details**: Shows device ID, status, session, service, pairing, timestamp
- **Action Buttons**: Start, Restart, Refresh Status, Close (always visible)

### Critical Bug Fixes

#### 1. Missing Dependency Injection Wiring
**Problem**: `main.py` was missing `"routers.whatsapp"` in `container.wire()` modules list
**Impact**: Uvicorn reloader child process crashed with exit code 1, triggering SIGTERM
**Fix**: Added `"routers.whatsapp"` to wiring list in `server/main.py:38`
```python
container.wire(modules=[
    "routers.auth",
    "routers.ai",
    "routers.workflow",
    "routers.database",
    "routers.maps",
    "routers.nodejs_compat",
    "routers.whatsapp",  # CRITICAL: This was missing
    "routers.android"
])
```

#### 2. Unhandled JSON Parse Errors
**Problem**: `.json()` calls without error handling raised `JSONDecodeError` when Flask returned HTML errors
**Impact**: Server crashes when WhatsApp service unavailable
**Fix**: Wrapped all `.json()` calls in try-except blocks with proper error responses

#### 3. Unhandled HTTP Status Errors
**Problem**: `response.raise_for_status()` raised `httpx.HTTPStatusError` not caught by specific handlers
**Impact**: Unhandled exceptions crashed the server
**Fix**: Removed `.raise_for_status()`, manually check `response.status_code != 200`

#### 4. Missing HTTPException Re-raise
**Problem**: Generic `Exception` handlers didn't re-raise `HTTPException`
**Impact**: Double exception wrapping and unclear errors
**Fix**: Added `except HTTPException: raise` before generic handler

### Error Handling Pattern
All WhatsApp endpoints follow this pattern:
```python
try:
    response = await client.get(url, timeout=10.0)

    # Check status manually
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="...")

    # Safe JSON parsing
    try:
        data = response.json()
        return data
    except Exception as json_err:
        logger.error(f"Failed to parse JSON: {json_err}")
        raise HTTPException(status_code=503, detail="Invalid response")

except httpx.ConnectError as e:
    raise HTTPException(status_code=503, detail="Service not running")
except httpx.TimeoutException as e:
    raise HTTPException(status_code=504, detail="Service timeout")
except HTTPException:
    raise  # Re-raise HTTPException
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(status_code=503, detail="Service unavailable")
```

### Result
- Python backend never crashes when WhatsApp service is down
- Proper HTTP error codes (503, 504, 410) returned
- No SIGTERM crashes
- Frontend receives proper error messages
- QR code viewer works seamlessly
- All mock data removed from production code

### WhatsApp Group/Sender Name Persistence
The WhatsApp Receive node stores human-readable names alongside JIDs/phone numbers:

#### Problem
When reopening the parameter panel, group/sender selectors showed the raw JID (e.g., `120363123456789@g.us`) instead of the group name because the name was only fetched when the dropdown was opened.

#### Solution
Store the name as a separate parameter alongside the ID:
- `group_id` + `group_name` - Group JID and display name
- `phone_number` + `sender_name` - Phone number and contact name

#### Implementation
```typescript
// In ParameterRenderer.tsx - GroupIdSelector
<GroupIdSelector
  value={currentValue || ''}
  onChange={onChange}
  onNameChange={(name) => onParameterChange?.('group_name', name)}
  storedName={allParameters?.group_name || ''}
  ...
/>

// GroupIdSelector stores name when selection changes
const handleChange = (value: string, option: any) => {
  onChange(value);
  if (option?.label && onNameChange) {
    onNameChange(option.label);
  }
};

// Display uses storedName when available
const displayLabel = storedName || (value && !loading ? value : '');
```

#### Key Files
- `client/src/components/ParameterRenderer.tsx` - GroupIdSelector and SenderNumberSelector with `onNameChange` and `storedName` props
- `client/src/components/parameterPanel/MiddleSection.tsx` - Passes `onParameterChange` to ParameterRenderer

## Event-Driven Trigger Node System

### Overview
Trigger nodes wait for external events (WhatsApp messages, webhooks, etc.) using Python's asyncio.Future. The backend handles all event waiting logic with the frontend displaying waiting state and providing cancel functionality.

### Architecture
```
User clicks "Run" on Trigger Node
       ↓
Frontend sends execute_node via WebSocket
       ↓
Python backend detects trigger node type (event_waiter.is_trigger_node)
       ↓
Backend registers asyncio.Future waiter with filter
       ↓
Backend broadcasts "waiting" status to frontend
       ↓
External service sends event (e.g., whatsapp_message_received)
       ↓
event_waiter.dispatch() resolves matching waiters
       ↓
Backend returns execution result with event data as output
       ↓
Frontend displays result in output panel
```

### Backend Implementation

#### Event Waiter Service (`server/services/event_waiter.py`)
Generic event waiting using standard asyncio primitives:

```python
@dataclass
class TriggerConfig:
    node_type: str
    event_type: str  # e.g., 'whatsapp_message_received'
    display_name: str

TRIGGER_REGISTRY: Dict[str, TriggerConfig] = {
    'whatsappReceive': TriggerConfig('whatsappReceive', 'whatsapp_message_received', 'WhatsApp Message'),
    'webhookTrigger': TriggerConfig('webhookTrigger', 'webhook_received', 'Webhook Request'),
    'chatTrigger': TriggerConfig('chatTrigger', 'chat_message_received', 'Chat Message'),
    'taskTrigger': TriggerConfig('taskTrigger', 'task_completed', 'Task Completed'),
    # Future: 'emailTrigger', 'mqttTrigger', 'telegramTrigger', etc.
}

@dataclass
class Waiter:
    id: str
    node_id: str
    node_type: str
    event_type: str
    filter_fn: Callable[[Dict], bool]
    future: asyncio.Future

# Key functions:
def register(node_type: str, node_id: str, params: Dict) -> Waiter
def dispatch(event_type: str, data: Dict) -> int  # Returns count resolved
def cancel(waiter_id: str) -> bool
def cancel_for_node(node_id: str) -> int
def get_active_waiters() -> List[Dict]
```

#### Trigger Node Execution (`server/services/workflow.py`)
```python
async def _execute_trigger_node(self, node_id: str, node_type: str, parameters: Dict) -> Dict:
    config = event_waiter.get_trigger_config(node_type)
    waiter = event_waiter.register(node_type, node_id, parameters)

    # Broadcast waiting status
    await broadcaster.update_node_status(node_id, "waiting", {
        "message": f"Waiting for {config.display_name}...",
        "waiter_id": waiter.id
    })

    # Wait indefinitely (user cancels via cancel_event_wait)
    event_data = await waiter.future
    return {"success": True, "result": event_data, ...}
```

#### Filter Builders
Each trigger type has a filter builder that creates a function to match events:

```python
def build_whatsapp_filter(params: Dict) -> Callable[[Dict], bool]:
    """Build filter for WhatsApp messages based on node parameters."""
    msg_type = params.get('messageTypeFilter', 'all')
    sender_filter = params.get('filter', 'all')  # all, any_contact, contact, group, keywords
    forwarded_filter = params.get('forwardedFilter', 'all')  # all, only_forwarded, ignore_forwarded
    # ... builds closure that checks message fields
```

**Sender Filter Options:**
- `all` - Accept all messages (groups and contacts)
- `any_contact` - Accept only non-group messages (individual chats)
- `contact` - Accept from specific phone number
- `group` - Accept from specific group (optionally filter by sender)
- `keywords` - Accept messages containing specific keywords

### WebSocket Handlers

#### Cancel Event Wait (`server/routers/websocket.py`)
```python
@ws_handler()
async def handle_cancel_event_wait(data: Dict[str, Any], websocket: WebSocket):
    """Cancel by waiter_id or node_id."""
    if waiter_id := data.get("waiter_id"):
        success = event_waiter.cancel(waiter_id)
    elif node_id := data.get("node_id"):
        count = event_waiter.cancel_for_node(node_id)
    return {"success": success, ...}

@ws_handler()
async def handle_get_active_waiters(data: Dict[str, Any], websocket: WebSocket):
    """Get list of active waiters for debugging/UI."""
    return {"waiters": event_waiter.get_active_waiters()}
```

### WhatsApp Receive Node

#### Node Definition (`client/src/nodeDefinitions/whatsappNodes.ts`)
```typescript
whatsappReceive: {
  displayName: 'WhatsApp Receive',
  name: 'whatsappReceive',
  icon: WHATSAPP_RECEIVE_ICON,  // Bell with notification dot
  group: ['whatsapp', 'trigger'],
  outputs: [{
    name: 'main',
    displayName: 'Message',
    type: 'main',
    description: 'message_id, sender, chat_id, message_type, text, timestamp, is_group, is_from_me, push_name, group_info'
  }],
  properties: [
    // Message Type Filter: all, text, image, video, audio, document, location, contact
    // Sender Filter: all, contact (specific phone), group (specific group), keywords
    // Ignore Own Messages: boolean (default true)
    // Include Media Data: boolean (default false)
  ]
}
```

#### Output Schema (`client/src/components/parameterPanel/InputSection.tsx`)
Provides draggable variables for downstream nodes:
```typescript
const sampleSchemas = {
  whatsapp: {
    message_id: 'string',
    sender: 'string',
    sender_phone: 'string',  // Resolved phone number (Go RPC resolves LIDs before sending event)
    chat_id: 'string',
    message_type: 'string',
    text: 'string',
    timestamp: 'string',
    is_group: 'boolean',
    is_from_me: 'boolean',
    push_name: 'string',
    is_forwarded: 'boolean',
    forwarding_score: 'number',
    media: 'object',
    group_info: {
      group_jid: 'string',
      sender_jid: 'string',
      sender_phone: 'string',  // Resolved phone number (Go RPC resolves LIDs)
      sender_name: 'string'
    }
  }
};
```

### Task Trigger Node

The Task Trigger node fires when a delegated child agent completes its task (success or error). This enables parent agents to react to child completion via workflow nodes.

#### Node Definition (`client/src/nodeDefinitions/workflowNodes.ts`)
```typescript
taskTrigger: {
  displayName: 'Task Completed',
  name: 'taskTrigger',
  icon: '📨',
  group: ['trigger', 'workflow'],
  outputs: [{
    name: 'main',
    displayName: 'Output',
    type: 'main',
    description: 'task_id, status, agent_name, result/error, parent_node_id'
  }],
  properties: [
    // Task ID Filter: Optional specific task ID to watch
    // Agent Name Filter: Optional partial match on agent name
    // Status Filter: all, completed, error
    // Parent Node ID: Optional filter by parent agent node
  ]
}
```

#### Output Schema (`client/src/components/parameterPanel/InputSection.tsx`)
```typescript
taskTrigger: {
  task_id: 'string',
  status: 'string',      // 'completed' or 'error'
  agent_name: 'string',
  agent_node_id: 'string',
  parent_node_id: 'string',
  result: 'string',      // Present when status='completed'
  error: 'string',       // Present when status='error'
  workflow_id: 'string',
}
```

#### Event Dispatch (`server/services/handlers/tools.py`)
The `task_completed` event is dispatched when a delegated child agent finishes:
```python
# On success:
await broadcaster.send_custom_event('task_completed', {
    'task_id': task_id,
    'status': 'completed',
    'agent_name': agent_label,
    'agent_node_id': node_id,
    'parent_node_id': config.get('parent_node_id', ''),
    'result': result.get('result', {}).get('response', ...),
    'workflow_id': workflow_id,
})

# On error:
await broadcaster.send_custom_event('task_completed', {
    'task_id': task_id,
    'status': 'error',
    'agent_name': agent_label,
    'agent_node_id': node_id,
    'parent_node_id': config.get('parent_node_id', ''),
    'error': str(e),
    'workflow_id': workflow_id,
})
```

### Adding New Trigger Types

1. **Add to Registry** in `server/services/event_waiter.py`:
   ```python
   TRIGGER_REGISTRY['emailTrigger'] = TriggerConfig('emailTrigger', 'email_received', 'Email')
   ```

2. **Add Filter Builder**:
   ```python
   def build_email_filter(params: Dict) -> Callable[[Dict], bool]:
       # Build filter based on node parameters
   FILTER_BUILDERS['emailTrigger'] = build_email_filter
   ```

3. **Add Node Definition** in `client/src/nodeDefinitions/`:
   - Define properties for filter configuration
   - Set outputs with expected data structure

4. **Add Output Schema** in `InputSection.tsx`:
   ```typescript
   email: { from: 'string', subject: 'string', body: 'string', ... }
   ```

5. **Dispatch Events** from external service:
   ```python
   from services import event_waiter
   event_waiter.dispatch('email_received', email_data)
   ```

### Polling Triggers (Gmail, Twitter)

Some triggers require active API polling instead of waiting for externally dispatched events. These use `setup_polling_trigger` in `TriggerManager` instead of `setup_event_trigger`.

**Architecture:**
```
setup_polling_trigger() → broadcasts "waiting" status
       ↓
   poller task: runs poll_coroutine(queue, is_running_fn)
       ↓                    ↓
   polls API at interval → enqueues new items to asyncio.Queue
       ↓
   processor task: reads queue → calls on_event → spawns execution run
```

**Key differences from event triggers:**
- Event triggers: `event_waiter.register()` + `wait_for_event()` (push-based)
- Polling triggers: Custom poll coroutine + `asyncio.Queue` (pull-based)

**Routing** (`server/services/deployment/manager.py`):
```python
if node_type in POLLING_TRIGGER_TYPES:  # gmailReceive, twitterReceive
    poll_coroutine = self._create_poll_coroutine(node_type, node_id, params)
    await trigger_manager.setup_polling_trigger(...)
```

**Constants** (`server/constants.py`):
- `POLLING_TRIGGER_TYPES`: `frozenset(['gmailReceive', 'twitterReceive'])`
- These are also in `WORKFLOW_TRIGGER_TYPES` for trigger node detection

### Key Design Decisions

- **No Timeout**: Trigger nodes wait indefinitely; users cancel via Cancel button
- **Backend-First**: All event waiting logic in Python backend, minimal frontend changes
- **Generic Architecture**: Same execution flow for all trigger types via registry
- **Filter Functions**: Each trigger type builds its own filter from node parameters
- **asyncio.Future**: Simpler than asyncio.Event for single-value resolution
- **Polling triggers**: Use asyncio.Queue + dedicated poll coroutine for APIs without push support

## Real-time Status WebSocket System

### Overview
The frontend and Python backend communicate via WebSocket for real-time status updates. This replaces API polling with push-based updates for Android connection status, node execution status, and variable changes.

### Architecture
```
React Frontend (WebSocketContext.tsx) <--WebSocket--> Python Backend (status_broadcaster.py)
         |                                                    |
         v                                                    v
   SquareNode.tsx                                   websocket_client.py
   (uses androidStatus)                             (broadcasts Android status)
```

### Backend Implementation

#### Status Broadcaster (`server/services/status_broadcaster.py`)
Central service for managing WebSocket connections and broadcasting status updates:

```python
class StatusBroadcaster:
    def __init__(self):
        self._connections: Set[WebSocket] = set()
        self._status: Dict[str, Any] = {
            "android": {"connected": False, "device_id": None, "connected_devices": [], "connection_type": None},
            "nodes": {},
            "variables": {},
            "workflow": {"executing": False, "current_node": None}
        }

    async def connect(self, websocket: WebSocket): ...
    async def disconnect(self, websocket: WebSocket): ...
    async def update_android_status(self, connected, device_id, connected_devices, connection_type): ...
    async def update_node_status(self, node_id, status, data): ...
    async def update_variable(self, name, value): ...
    async def update_workflow_status(self, executing, current_node, progress): ...
```

Key methods:
- `connect()` - Accepts WebSocket, adds to connection set, sends initial status
- `update_android_status()` - Updates Android status and broadcasts to all clients
- `update_node_status()` - Updates individual node status with data/output
- `update_variable()` - Updates single variable value
- `_broadcast()` - Sends message to all connected clients

#### WebSocket Router (`server/routers/websocket.py`)
FastAPI WebSocket endpoint:

```python
@router.websocket("/ws/status")
async def websocket_status_endpoint(websocket: WebSocket):
    broadcaster = get_status_broadcaster()
    await broadcaster.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif data.get("type") == "get_status":
                await websocket.send_json({"type": "full_status", "data": broadcaster.get_status()})
    except WebSocketDisconnect:
        await broadcaster.disconnect(websocket)
```

### Frontend Implementation

#### WebSocket Context (`client/src/contexts/WebSocketContext.tsx`)
React context providing WebSocket connection and status state:

```typescript
export interface AndroidStatus {
  connected: boolean;
  device_id: string | null;
  connected_devices: string[];
  connection_type: string | null;
}

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [androidStatus, setAndroidStatus] = useState<AndroidStatus>(defaultAndroidStatus);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [variables, setVariables] = useState<Record<string, any>>({});
  // WebSocket connection with auto-reconnect
};

// Hooks for consuming status
export const useWebSocket = (): WebSocketContextValue => { ... }
export const useAndroidStatus = (): AndroidStatus => { ... }
export const useNodeStatus = (nodeId: string): NodeStatus => { ... }
```

Features:
- Auto-connect on mount
- Auto-reconnect after 3 seconds on disconnect
- Ping every 30 seconds to keep connection alive
- Message type handlers for all status update types

#### Usage in Components (`client/src/components/SquareNode.tsx`)
```typescript
const { androidStatus } = useWebSocket();
// Android service nodes use 'paired' status (device must be paired to execute)
const isAndroidConnected = isAndroidNode && androidStatus.paired;
```

### Android Status Broadcasting
The Android relay client (`server/services/android/client.py`) broadcasts status changes via dedicated functions in `broadcaster.py`:

```python
# When device pairs successfully
await broadcast_connected(device_id, device_name)

# When device unpairs (relay may still be connected)
await broadcast_device_disconnected(
    relay_connected=self.is_connected(),
    qr_data=self.qr_data,
    session_token=self.session_token
)

# When relay WebSocket closes unexpectedly
await broadcast_relay_disconnected()
```

**Key distinction:**
- `broadcast_device_disconnected()` - Device unpaired, relay still connected (can re-pair via QR)
- `broadcast_relay_disconnected()` - Full disconnection, need to reconnect

### Real Device Detection
Fixed issue where Android status remained green after device disconnect:

**Problem**: Base name `android_system_services` remained in connected devices set after real device `android_system_services_1764708352672` left.

**Solution**: Added methods to distinguish real devices (with timestamp suffix) from base names:

```python
def _get_discovered_devices(self) -> list:
    """Get list of actual discovered devices (with timestamp suffix)."""
    discovered = []
    for device_id in self._connected_android_devices:
        parts = device_id.rsplit('_', 1)
        if len(parts) == 2 and parts[1].isdigit():
            discovered.append(device_id)
    return discovered

def has_real_android_devices(self) -> bool:
    """Check if there are any real (discovered) Android devices connected."""
    return len(self._get_discovered_devices()) > 0
```

Updated `client_left` and presence handlers use `has_real_android_devices()` instead of checking total device count.

### WebSocket Message Types (86 Handlers)

#### Request/Response Messages (Client -> Server -> Client)
| Category | Message Types |
|----------|--------------|
| **Status/Ping** | `ping`, `get_status`, `get_android_status`, `get_node_status`, `get_variable` |
| **Node Parameters** | `get_node_parameters`, `get_all_node_parameters`, `save_node_parameters`, `delete_node_parameters` |
| **Tool Schemas** | `get_tool_schema`, `save_tool_schema`, `delete_tool_schema`, `get_all_tool_schemas` |
| **Node Execution** | `execute_node`, `execute_workflow`, `cancel_execution`, `get_node_output`, `clear_node_output` |
| **Triggers/Events** | `cancel_event_wait`, `get_active_waiters` |
| **Dead Letter Queue** | `get_dlq_entries`, `get_dlq_entry`, `get_dlq_stats`, `replay_dlq_entry`, `remove_dlq_entry`, `purge_dlq` |
| **Deployment** | `deploy_workflow`, `cancel_deployment`, `get_deployment_status`, `get_workflow_lock`, `update_deployment_settings` |
| **AI Operations** | `execute_ai_node`, `get_ai_models` |
| **API Keys** | `validate_api_key`, `get_stored_api_key`, `save_api_key`, `delete_api_key` |
| **Claude OAuth** | `claude_oauth_login`, `claude_oauth_status` |
| **Android** | `get_android_devices`, `execute_android_action`, `android_relay_connect`, `android_relay_disconnect`, `android_relay_reconnect` |
| **Maps** | `validate_maps_key` |
| **WhatsApp** | `whatsapp_status`, `whatsapp_qr`, `whatsapp_send`, `whatsapp_start`, `whatsapp_restart`, `whatsapp_groups`, `whatsapp_group_info`, `whatsapp_chat_history`, `whatsapp_rate_limit_get`, `whatsapp_rate_limit_set`, `whatsapp_rate_limit_stats`, `whatsapp_rate_limit_unpause` |
| **Workflow Storage** | `save_workflow`, `get_workflow`, `get_all_workflows`, `delete_workflow` |
| **Chat Messages** | `send_chat_message`, `get_chat_messages`, `clear_chat_messages`, `save_chat_message` |
| **Console/Terminal** | `get_console_logs`, `clear_console_logs`, `get_terminal_logs`, `clear_terminal_logs` |
| **User Skills** | `get_user_skills`, `get_user_skill`, `create_user_skill`, `update_user_skill`, `delete_user_skill` |
| **Built-in Skills** | `get_skill_content`, `save_skill_content`, `scan_skill_folder`, `list_skill_folders` |
| **Memory/Skill Reset** | `clear_memory`, `reset_skill` |
| **User Settings** | `get_user_settings`, `save_user_settings` |
| **Provider Defaults** | `get_provider_defaults`, `save_provider_defaults` |

#### Broadcast Messages (Server -> All Clients)
| Message Type | Description |
|--------------|-------------|
| `android_status` | Android device connection update |
| `node_status` | Node execution status change |
| `node_output` | Node execution output data |
| `variable_update` | Single variable value change |
| `workflow_status` | Workflow execution progress |
| `api_key_status` | API key validation status |
| `node_parameters_updated` | Node parameters changed by another client |

#### Status Messages
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `initial_status` | Server -> Client | Full status on connect |
| `full_status` | Server -> Client | Full status response |
| `pong` | Server -> Client | Keep-alive response |
| `error` | Server -> Client | Error response with code and message |

## WebSocket Hooks

### useWhatsApp (`client/src/hooks/useWhatsApp.ts`)
Hook for WhatsApp operations via WebSocket:
```typescript
const { getStatus, getQRCode, sendMessage, startConnection, isLoading, connectionStatus } = useWhatsApp();
```

### useExecution (`client/src/hooks/useExecution.ts`)
Hook for node execution via WebSocket:
```typescript
const { executeNode, cancelExecution, isExecuting, lastResult } = useExecution();
```

### useApiKeys (`client/src/hooks/useApiKeys.ts`)
Hook for API key management via WebSocket:
```typescript
const { validateApiKey, getStoredKey, saveApiKey, deleteApiKey } = useApiKeys();
```

### useAndroidOperations (`client/src/hooks/useAndroidOperations.ts`)
Hook for Android device operations via WebSocket:
```typescript
const { getDevices, executeAction, setupDevice, isConnected, deviceStatus } = useAndroidOperations();
```

### useParameterPanel (`client/src/hooks/useParameterPanel.ts`)
Hook for parameter management via WebSocket:
```typescript
const { parameters, saveParameters, loadParameters, isDirty } = useParameterPanel(nodeId);
```

### Conditional Parameter Display Implementation
Located in `client/src/components/parameterPanel/MiddleSection.tsx`:

```typescript
const shouldShowParameter = (param: INodeProperties, allParameters: Record<string, any>): boolean => {
  if (!param.displayOptions?.show) {
    return true;
  }

  const showConditions = param.displayOptions.show;

  for (const [paramName, allowedValues] of Object.entries(showConditions)) {
    const currentValue = allParameters[paramName];

    if (Array.isArray(allowedValues)) {
      if (!allowedValues.includes(currentValue)) {
        return false;
      }
    } else {
      if (currentValue !== allowedValues) {
        return false;
      }
    }
  }

  return true;
};
```

This function:
- Checks if parameter has displayOptions.show configuration
- Evaluates all show conditions against current parameter values
- Returns false if any condition fails (parameter hidden)
- Returns true if all conditions pass (parameter visible)
- Applied before rendering: `.filter(param => shouldShowParameter(param, parameters))`

## Planned Features

### Workflow-Level Execution (n8n-style Parallel Workflows)

**Current Limitations:**
- Single workflow execution at a time (global `_deployment_running` flag)
- Nodes fetch status on component mount, not when workflow is selected
- Status broadcasts to all clients without workflow filtering
- No isolation between workflow executions

**Planned Architecture:**

1. **Defer Node Status Checks Until Workflow Selected**
   - Remove eager `getStatus()` calls from WhatsAppNode mount (lines 44-48)
   - Remove eager `checkConfiguration()` from SquareNode mount (lines 46-92)
   - Status should only fetch when workflow containing those nodes is selected
   - Use cached status from WebSocket context instead of per-node fetching

2. **Workflow-Isolated Execution Context**
   ```python
   # server/services/workflow.py
   class ExecutionContext:
       def __init__(self, workflow_id: str, session_id: str):
           self.workflow_id = workflow_id
           self.session_id = session_id
           self.outputs: Dict[str, Any] = {}
           self.iteration = 0
           self.running = False
           self.task: Optional[asyncio.Task] = None

   # Replace single deployment state with:
   self._execution_contexts: Dict[str, ExecutionContext] = {}
   ```

3. **Parallel Workflow Deployment**
   - Each workflow gets unique `workflow_id` in execution requests
   - Backend tracks `_execution_contexts[workflow_id]` instead of single `_deployment_running`
   - Cancel by `workflow_id` instead of globally
   - Status broadcasts include `workflow_id` for client filtering

4. **Frontend Changes**
   - `WebSocketContext`: Add `activeWorkflowId`, filter status by workflow
   - `useAppStore`: Add `runningWorkflows: Set<string>` to track parallel executions
   - `WorkflowSidebar`: Show running indicator next to deployed workflows
   - `Dashboard`: Pass `workflow_id` to all execution calls

**Files to Modify:**
- `client/src/components/WhatsAppNode.tsx` - Remove mount status fetch
- `client/src/components/SquareNode.tsx` - Remove mount config check
- `client/src/contexts/WebSocketContext.tsx` - Add workflow filtering
- `client/src/store/useAppStore.ts` - Track running workflows
- `server/services/workflow.py` - ExecutionContext class, parallel support
- `server/routers/websocket.py` - workflow_id in messages
- `server/services/status_broadcaster.py` - workflow_id filtering

## Notes
- **No Legacy Support**: Pure modern methods only, backward compatibility removed
- **Interface Alignment**: ParameterRenderer supports both interface types seamlessly
- **Execution Ready**: Components can be executed with real-time result display
- **Clean Codebase**: Significant file and code reduction while maintaining full functionality
- **Modular Backend**: workflow.py reduced from 2068 to 460 lines via facade pattern
  - NodeExecutor: Registry-based dispatch with `functools.partial` for dependency injection
  - ParameterResolver: Compiled regex for `{{node.field}}` template resolution
  - DeploymentManager: Handles deploy/cancel lifecycle with TriggerManager for cron/events
  - No global state: `_active_cron_jobs` moved to TriggerManager instance variable
- **Performance**: Fast HMR updates and clean TypeScript compilation
- **AI Architecture**: 5-layer system with factory pattern and secure credential management
- **Android Architecture**: Factory-based node creation with ADB integration for device automation
- **WebSocket-First Architecture**: 87 message handlers replace REST APIs for parameters, execution, API keys, Android, WhatsApp, and skill operations
- **WebSocket Hooks**: Dedicated React hooks (useWhatsApp, useExecution, useApiKeys, useAndroidOperations, useParameterPanel) for clean component integration
- **WebSocket Support**: Persistent remote Android device connections via WebSocket proxy with background tasks
  - Connection stays alive across multiple API requests until switched to local ADB
  - Background message receiver and keepalive loop (25s interval)
  - Message queue for async message handling with filtering logic
  - Connection reuse reduces execution time from 0.18s to 0.0003s
- **Real-time Status WebSocket**: Frontend-backend WebSocket at `/ws/status` for live updates
  - Android connection status broadcasts when devices connect/disconnect
  - Node execution status and output updates
  - Variable value changes
  - Workflow execution progress
  - Replaces API polling with push-based updates
  - Auto-reconnect with 3-second delay on disconnect
  - Real device detection distinguishes actual devices (with timestamp suffix) from base names
  - **Android two-state model**: `connected` (relay WebSocket) vs `paired` (device paired)
    - Android service nodes use `paired` status for indicator (green = paired, red = not paired)
    - Relay can be connected without a device (shows QR for pairing)
    - Device disconnect broadcasts `paired=false` while keeping `connected=true` for re-pairing
- **Conditional Display**: Full implementation of displayOptions.show pattern for dynamic UI rendering
- **Process Management**: Robust stop scripts handle duplicate processes with verification and retry
- **Process Independence**: Removed `--kill-others` from concurrently to prevent cascading crashes when uvicorn reloads
- **WhatsApp Integration**: Square node design with QR code viewer, proper error handling, no crashes
  - Critical fix: Added "routers.whatsapp" to dependency injection wiring
  - All endpoints use safe JSON parsing with comprehensive error handling
  - Backend proxies all requests to WhatsApp RPC service (default port 9400, configurable)
  - Returns proper HTTP status codes (503, 504, 410) instead of mock data
  - Python server never crashes when WhatsApp service is unavailable
  - WebSocket handlers for status, QR code, send message, and start connection
  - useWhatsApp hook provides clean React component integration
  - Uses external npm package `whatsapp-rpc` with pre-built Go binaries
- **Event-Driven Triggers**: Generic trigger node architecture with asyncio.Future
  - `server/services/event_waiter.py` - Waiter registration, dispatch, cancellation
  - TRIGGER_REGISTRY for extensible trigger types (WhatsApp, Webhook, future: Email, MQTT, Telegram)
  - Filter builders create closures from node parameters (whatsapp_filter, webhook_filter)
  - No timeout - wait indefinitely until event or user cancel
  - WebSocket handlers: `cancel_event_wait`, `get_active_waiters`
  - **Trigger State Machine** (n8n pattern):
    - `idle` → `waiting` (on deploy, cyan indicator)
    - `waiting` → `idle` (on event received, graph starts executing, green indicator)
    - `idle` → `waiting` (after graph completes, listening again)
    - Triggers NEVER show `executing` status - only downstream nodes do
  - **Sequential Queue Processing**: Events are queued and processed one at a time via `wait_for_completion=True`
- **HTTP/Webhook Integration**: 3 utility nodes for HTTP communication
  - `httpRequest` - Make outgoing HTTP requests with httpx async client
  - `webhookTrigger` - Receive incoming HTTP requests at `/webhook/{path}`
  - `webhookResponse` - Send custom responses back to webhook callers
  - `server/routers/webhook.py` - Dynamic webhook router using broadcaster.send_custom_event()
  - Output panel shows clean summaries (method, path, body for webhooks; status code for HTTP)
- **n8n-Pattern Cache System**: Automatic fallback hierarchy for different environments
  - Production (Docker): Redis → SQLite → Memory
  - Local Development: SQLite → Memory (Redis disabled via `REDIS_ENABLED=false`)
  - `server/core/cache.py` - CacheService with fallback logic
  - `server/models/cache.py` - CacheEntry SQLModel for SQLite persistence
  - `server/core/database.py` - Cache CRUD methods (get/set/delete/cleanup)
  - Supports TTL expiration and automatic cleanup of expired entries
- **Conditional Redis with Docker Profiles**: Redis container only starts when explicitly enabled
  - Uses Docker Compose profiles: Redis service has `profiles: [redis]`
  - `scripts/docker.js` wrapper auto-adds `--profile redis` when `REDIS_ENABLED=true` in `.env`
  - npm scripts (`docker:up`, `docker:down`, etc.) use the wrapper for seamless handling
  - Backend no longer depends on Redis - depends only on WhatsApp service
- **WebSocket Reconnect Fix**: Fixed rapid reconnect loop caused by React effect cleanup
  - Split effects: connect effect, logout effect, unmount cleanup effect
  - Added `isMountedRef` to prevent connections after unmount
  - Added 100ms delay to avoid React Strict Mode double-connection issues
  - WebSocket now stable without 6-9 second reconnect loops
- **Docker Backend Fix**: Backend container uses Python uvicorn directly
  - Changed from `npm run start` (failed - npm not in Python image) to `python -m uvicorn`
  - CMD: `["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3010"]`
- **Configurable Authentication**: `VITE_AUTH_ENABLED` environment variable
  - Set to `false` to bypass login entirely (useful for local development)
  - Frontend creates anonymous user with owner privileges when disabled
  - AuthContext includes retry logic (5 retries, exponential backoff) for startup race conditions
  - Pydantic Settings accepts `vite_auth_enabled` field (required due to `extra="forbid"`)
- **whatsapp-rpc Package**: External dependency for WhatsApp integration
  - Published to npm as `whatsapp-rpc` (unscoped) and GitHub Packages as `@trohitg/whatsapp-rpc`
  - Published to PyPI as `whatsapp-rpc` (async Python client)
  - Cross-platform binaries built via GitHub Actions (linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64)
  - Binary downloaded from GitHub releases during npm postinstall
  - Configurable port via `--port` CLI flag, `PORT` or `WHATSAPP_RPC_PORT` env vars (default: 9400)
  - QR codes generated as base64 PNG in memory (no file I/O, no `data/qr` directory)
  - Source: https://github.com/trohitg/whatsapp-rpc
- **Node Data Architecture**: `node.data` only stores `label` (display name). All parameters are stored in the database via `save_node_parameters` WebSocket handler. This prevents parameter bloat in workflow JSON exports and keeps React Flow state lightweight. `useDragAndDrop.ts` saves default parameters to DB on drop, not to `node.data`.
- **Workflow Export/Import with Parameters**: Exported workflow JSON includes a `nodeParameters` field containing all node configuration (provider, model, prompt, skillsConfig, etc.) fetched from the database at export time. On import, embedded `nodeParameters` are saved back to the database. `sanitizeNodes()` in `workflowExport.ts` still strips `node.data` to UI-only fields (`label`, `disabled`, `condition`). A `parameterSanitizer.ts` utility exists for credential stripping but is currently disabled (pass-through). Old exports without `nodeParameters` import cleanly (backward compatible). Key files: `client/src/utils/workflowExport.ts`, `client/src/utils/parameterSanitizer.ts`, `client/src/Dashboard.tsx` (export/import handlers), `server/services/example_loader.py`.
- **Skill System Architecture**: Skills organized in `server/skills/<folder>/` subfolders. Each folder appears in Master Skill dropdown. DB is source of truth for skill instructions (seeded from SKILL.md on first load). Icon resolution: node definition (SVG) > SKILL.md metadata (emoji) > fallback. Native DOM keydown handler prevents React Flow from intercepting Ctrl shortcuts in skill editor.
- **Example Workflows**: Auto-load example workflows from `workflows/` folder on first use. Uses `UserSettings.examples_loaded` flag to track import status. Supports anonymous users (`user_id="default"`). Reuses existing `database.save_workflow()` for import. Embedded `nodeParameters` in example JSON files are saved to the database on import. See "Example Workflows" section for details.
- **Onboarding Service**: 5-step welcome wizard (Welcome, Concepts, API Keys, Canvas Tour, Get Started) using Ant Design Steps/Card/Button/Typography. Database-backed via `UserSettings.onboarding_completed` + `onboarding_step`. Existing users auto-skip (migration marks `examples_loaded=1` as completed). Replayable from Settings "Help" section. No new WebSocket handlers needed. See [Onboarding Service](./docs-internal/onboarding.md) for details.
- **Node.js Code Executor**: Persistent Node.js server (Express + tsx) at port 3020 for JavaScript/TypeScript execution, replacing subprocess spawning per execution. Handlers in `server/services/handlers/code.py` call `NodeJSClient` which makes HTTP requests to the Node.js server. All config via environment variables (`NODEJS_EXECUTOR_URL`, `NODEJS_EXECUTOR_PORT`, etc.).
- never use emojis in prints