# Workflow JSON Schema

> **Related Documentation:**
> - [Node Creation Guide](./node_creation.md) - How to create new nodes (frontend definitions, backend handlers)
> - [CLAUDE.md](../CLAUDE.md) - Project overview, key files, architecture patterns

## Overview

The workflow JSON schema defines the structure and validation rules for workflow automation data. This document describes the schema format, validation, and usage examples.

## Schema Structure

A workflow JSON document contains:

- **Metadata**: ID, name, timestamps, version
- **Nodes**: Array of workflow nodes with their types, positions, and parameters
- **Edges**: Array of connections between nodes

## Complete Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Workflow",
  "description": "A workflow automation definition containing nodes and connections",
  "type": "object",
  "required": ["id", "name", "nodes", "edges", "createdAt", "lastModified"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^workflow_[0-9]+$"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "nodes": {
      "type": "array",
      "items": { "$ref": "#/definitions/node" }
    },
    "edges": {
      "type": "array",
      "items": { "$ref": "#/definitions/edge" }
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "lastModified": {
      "type": "string",
      "format": "date-time"
    },
    "version": {
      "type": "string",
      "default": "1.0.0"
    }
  }
}
```

## Supported Node Types (67 Total)

### Workflow Nodes (1 node)
- `start` - Workflow entry point with initial data

### Scheduler Nodes (2 nodes)
- `timer` - Delay/wait before continuing (seconds, minutes, hours)
- `cronScheduler` - Recurring scheduled execution (seconds to months, timezone support)

### AI Chat Model Nodes (6 nodes)
- `openaiChatModel` - OpenAI GPT models (GPT-4o, GPT-4, o1/o3/o4 series with reasoning)
- `anthropicChatModel` - Anthropic Claude models (Claude 3.5/3 with extended thinking)
- `geminiChatModel` - Google Gemini models (2.5/Flash with thinking support)
- `openrouterChatModel` - OpenRouter unified API (200+ models from multiple providers)
- `groqChatModel` - Groq ultra-fast inference (Llama, Mixtral, Qwen3/QwQ with reasoning)
- `cerebrasChatModel` - Cerebras custom AI hardware (Llama, Qwen)

### AI Agent Nodes (3 nodes)
- `aiAgent` - AI agent with tool calling, memory support (LangGraph)
- `chatAgent` - Conversational agent with skill support
- `simpleMemory` - Conversation history storage (buffer/window modes)

### AI Skill Nodes (9 nodes)
Connect to Chat Agent's `input-skill` handle:
- `claudeSkill` - Default Claude assistant personality
- `whatsappSkill` - WhatsApp messaging via Chat Agent
- `memorySkill` - Long-term memory management
- `mapsSkill` - Location services (geocoding, places, directions)
- `httpSkill` - HTTP requests to external APIs
- `schedulerSkill` - Task scheduling (timers, cron)
- `androidSkill` - Android device control
- `codeSkill` - Python/JavaScript code execution
- `customSkill` - User-created custom skills (database-stored)

### AI Tool Nodes (4 nodes)
Connect to AI Agent's `input-tools` handle:
- `calculatorTool` - Mathematical operations
- `currentTimeTool` - Current date/time with timezone
- `duckduckgoSearch` - DuckDuckGo web search (free, no API key)
- `androidTool` - Android toolkit aggregator (sub-node pattern)

### Search Nodes (3 nodes)
Dual-purpose nodes (workflow + AI tool). Defined in `searchNodes.ts`:
- `braveSearch` - Brave Search API web results
- `serperSearch` - Google SERP via Serper API (web, news, images, places)
- `perplexitySearch` - Perplexity Sonar AI-powered search with markdown answer and citations

### Location Nodes (3 nodes)
- `createMap` - Google Maps creation with center, zoom, map type
- `addLocations` - Google Maps Geocoding (address to coordinates)
- `showNearbyPlaces` - Google Places nearbySearch

### WhatsApp Nodes (4 nodes)
- `whatsappSend` - Send messages (text, media, location, contact)
- `whatsappConnect` - Connection status and QR code
- `whatsappReceive` - Event-driven trigger with filters (type, sender, group, keywords)
- `whatsappChatHistory` - Retrieve message history

### Android Nodes (17 nodes)

#### Device Setup (1 node)
- `androidDeviceSetup` - Connect via local ADB or remote WebSocket relay

#### System Monitoring (4 nodes)
- `batteryMonitor` - Battery status, level, charging, temperature
- `networkMonitor` - Network connectivity and type
- `systemInfo` - Device/OS info, memory, hardware
- `location` - GPS tracking with accuracy

#### App Management (2 nodes)
- `appLauncher` - Launch applications by package name
- `appList` - List installed applications

#### Device Automation (6 nodes)
- `wifiAutomation` - WiFi enable/disable, scan, status
- `bluetoothAutomation` - Bluetooth enable/disable, paired devices
- `audioAutomation` - Volume control, mute/unmute
- `deviceStateAutomation` - Airplane mode, screen, power save, brightness
- `screenControlAutomation` - Brightness, wake, timeout
- `airplaneModeControl` - Airplane mode status and control

#### Sensors (2 nodes)
- `motionDetection` - Accelerometer, gyroscope, shake detection
- `environmentalSensors` - Temperature, humidity, pressure, light

#### Media (2 nodes)
- `cameraControl` - Camera info, take photos
- `mediaControl` - Media playback, volume

### Utility Nodes (5 nodes)
- `httpRequest` - HTTP requests (GET, POST, PUT, DELETE, PATCH) with optional proxy support (`useProxy: true`)
- `webhookTrigger` - Incoming HTTP webhook trigger at `/webhook/{path}`
- `webhookResponse` - Custom response to webhook caller
- `chatTrigger` - Console message input trigger
- `console` - Debug logging output

### Proxy Nodes (3 nodes)
- `proxyRequest` - HTTP requests through residential proxy providers with geo-targeting and failover
- `proxyConfig` - Configure proxy providers, credentials, and routing rules
- `proxyStatus` - View proxy provider health, scores, and usage statistics

### Code Nodes (2 nodes)
- `pythonExecutor` - Python code execution with input_data access
- `javascriptExecutor` - JavaScript code execution

### Chat Nodes (2 nodes)
- `chatSend` - Send via JSON-RPC 2.0 WebSocket
- `chatHistory` - Retrieve chat message history

### Document Processing Nodes (6 nodes)
RAG pipeline nodes for document ingestion, processing, and vector storage:
- `httpScraper` - Scrape links from web pages (date/page pagination modes)
- `fileDownloader` - Parallel file downloads with semaphore concurrency
- `documentParser` - Parse documents to text (PyPDF, Marker OCR, Unstructured, BeautifulSoup)
- `textChunker` - Split text into overlapping chunks (recursive, markdown, token strategies)
- `embeddingGenerator` - Generate vector embeddings (HuggingFace, OpenAI, Ollama providers)
- `vectorStore` - Store/query vectors (ChromaDB, Qdrant, Pinecone backends)

## Example Workflow JSON

### Basic Workflow (Start -> AI Agent)

```json
{
  "id": "workflow_1234567890",
  "name": "AI Agent with Start Node",
  "version": "1.0.0",
  "createdAt": "2025-01-06T12:00:00.000Z",
  "lastModified": "2025-01-06T12:30:00.000Z",
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Start",
        "initialData": "{\"message\": \"Hello World\", \"value\": 123}"
      }
    },
    {
      "id": "aiAgent-1",
      "type": "aiAgent",
      "position": { "x": 400, "y": 100 },
      "data": {
        "label": "AI Agent",
        "provider": "anthropic",
        "model": "claude-haiku-4-5-20251001",
        "prompt": "{{start.message}}",
        "systemMessage": "You are a helpful assistant"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "start-1",
      "target": "aiAgent-1",
      "sourceHandle": "output-main",
      "targetHandle": "input-main"
    }
  ]
}
```

### Workflow with Memory (Conversational AI)

```json
{
  "id": "workflow_1234567891",
  "name": "AI Agent with Memory",
  "version": "1.0.0",
  "createdAt": "2025-01-06T12:00:00.000Z",
  "lastModified": "2025-01-06T12:30:00.000Z",
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Start",
        "initialData": "{\"chatInput\": \"What did we discuss earlier?\"}"
      }
    },
    {
      "id": "simpleMemory-1",
      "type": "simpleMemory",
      "position": { "x": 400, "y": 250 },
      "data": {
        "label": "Memory",
        "sessionId": "user-session-123",
        "memoryType": "window",
        "windowSize": 20
      }
    },
    {
      "id": "aiAgent-1",
      "type": "aiAgent",
      "position": { "x": 400, "y": 100 },
      "data": {
        "label": "AI Agent",
        "provider": "anthropic",
        "model": "claude-haiku-4-5-20251001",
        "prompt": "{{start.chatInput}}",
        "systemMessage": "You are a helpful assistant with memory of our conversation"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-main",
      "source": "start-1",
      "target": "aiAgent-1",
      "sourceHandle": "output-main",
      "targetHandle": "input-main"
    },
    {
      "id": "edge-memory",
      "source": "simpleMemory-1",
      "target": "aiAgent-1",
      "sourceHandle": "output-memory",
      "targetHandle": "input-memory"
    }
  ]
}
```

**Memory Workflow Behavior:**
1. Start node provides the user's chat input
2. Simple Memory connects to AI Agent's memory handle (config connection)
3. When AI Agent runs, it loads conversation history from the memory session
4. AI Agent's response is automatically saved to the memory session
5. Simple Memory node can see Start node's outputs (via AI Agent) for parameter mapping

## Usage Examples

### Export Workflow

```typescript
import { useAppStore } from './store/useAppStore';

// Export to JSON string
const workflow = useAppStore.getState().currentWorkflow;
const jsonString = useAppStore.getState().exportWorkflowToJSON();
console.log(jsonString);

// Export to file download
useAppStore.getState().exportWorkflowToFile();
```

### Import Workflow

```typescript
import { useAppStore } from './store/useAppStore';

// Import from JSON string
const jsonString = '{ ... }';
useAppStore.getState().importWorkflowFromJSON(jsonString);

// Import from file
import { importWorkflowFromFile } from './utils/workflowExport';

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const workflow = await importWorkflowFromFile(file);
    useAppStore.getState().setCurrentWorkflow(workflow);
  }
};
fileInput.click();
```

### Validate Workflow

```typescript
import { validateWorkflow } from './schemas/workflowSchema';

const workflow = {
  id: 'workflow_123',
  name: 'My Workflow',
  nodes: [...],
  edges: [...],
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString()
};

const validation = validateWorkflow(workflow);

if (validation.valid) {
  console.log('Workflow is valid');
} else {
  console.error('Validation errors:', validation.errors);
}
```

## Config Node Architecture

Config nodes (memory, tools) are auxiliary nodes that connect to parent nodes via special handles instead of the main data flow.

### Characteristics of Config Nodes

| Property | Config Node | Standard Node |
|----------|-------------|---------------|
| Group | Contains 'memory' or 'tool' | Other groups |
| Input Handle | None (passive) | `input-main` |
| Output Handle | `output-memory`, `output-model` | `output-main` |
| Target Handle | Parent's `input-memory`, `input-tools` | Parent's `input-main` |
| Parent Visibility | NOT shown in parent's input panel | Shown in parent's input panel |
| Input Inheritance | Inherits parent's main inputs | Only direct connections |

### Config Node Detection

Nodes are identified as config nodes by their group membership:

```typescript
const isConfigNode = (nodeType: string): boolean => {
  const definition = nodeDefinitions[nodeType];
  const groups = definition?.group || [];
  return groups.includes('memory') || groups.includes('tool');
};
```

### Input Inheritance for Config Nodes

When a config node is connected to a parent's config handle:
1. The parent node does NOT see the config node as an input
2. The config node DOES see the parent's main inputs (labeled "via Parent")

This allows memory nodes to access the same input data as the AI Agent they're connected to, enabling template variable mapping like `{{start.chatInput}}` in the memory node's session ID.

```
┌─────────────┐     main      ┌─────────────┐
│   Start     │──────────────▶│  AI Agent   │
└─────────────┘               └─────────────┘
                                    ▲
                                    │ input-memory
                              ┌─────────────┐
                              │   Memory    │
                              │ (sees Start │
                              │  via Agent) │
                              └─────────────┘
```

## Node Data Structure

Each node contains:

- `id`: Unique identifier (string)
- `type`: Node type (see supported types)
- `position`: { x: number, y: number }
- `data`: Node-specific parameters (object)
  - `label`: Display label
  - Additional parameters based on node type

### Start Node Data

```json
{
  "initialData": "{\"key1\": \"value1\", \"key2\": 123}"
}
```

### AI Agent Node Data

```json
{
  "provider": "anthropic" | "openai" | "gemini" | "openrouter",
  "model": "model-name",
  "apiKey": "api-key-string",
  "prompt": "{{start.message}}",
  "systemMessage": "System instructions",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### OpenRouter Chat Model Node Data

```json
{
  "model": "openai/gpt-4o-mini",
  "prompt": "{{start.message}}",
  "options": {
    "systemMessage": "You are a helpful assistant",
    "temperature": 0.7,
    "maxTokens": 1000,
    "topP": 1,
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "timeout": 60000,
    "maxRetries": 2
  }
}
```

OpenRouter model IDs use the format `provider/model-name`:
- `openai/gpt-4o`, `openai/gpt-4o-mini`
- `anthropic/claude-3.5-sonnet`, `anthropic/claude-3-haiku`
- `google/gemini-pro`, `google/gemini-flash-1.5`
- `meta-llama/llama-3.1-70b-instruct`
- Free models are prefixed with `[FREE]` in the dropdown

### Simple Memory Node Data

```json
{
  "sessionId": "conversation-session-id",
  "memoryType": "buffer" | "window",
  "windowSize": 10
}
```

Memory nodes are config nodes that:
- Connect to AI Agent via `input-memory` handle
- Store conversation history in database (persisted across restarts)
- Support buffer mode (all messages) or window mode (last N messages)
- Inherit parent node's main inputs for parameter mapping

### Trigger Node Data (WhatsApp Trigger)

```json
{
  "messageTypeFilter": "all" | "text" | "image" | "video" | "audio",
  "filter": "all" | "contact" | "group" | "keywords",
  "contactPhone": "+1234567890",
  "groupId": "group-id",
  "keywords": "word1, word2",
  "ignoreOwnMessages": true,
  "includeMediaData": false
}
```

Trigger nodes:
- Wait for external events using asyncio.Future
- Have no main input (they start workflows)
- Output event data when triggered

## Edge Data Structure

Each edge contains:

- `id`: Unique identifier
- `source`: Source node ID
- `target`: Target node ID
- `sourceHandle`: Output handle ID (default: "output-main")
- `targetHandle`: Input handle ID (default: "input-main")
- `type`: Rendering type ("default", "straight", "step", etc.)

### Handle Naming Conventions

#### Main Data Flow Handles
- `output-main` / `input-main` - Primary data flow between nodes

#### Config Handles (for auxiliary nodes)
Config handles connect memory/tool nodes to parent nodes without being part of main data flow:
- `input-memory` - Memory configuration input (AI Agent)
- `input-tools` - Tools configuration input (AI Agent)
- `input-model` - Model configuration input
- `output-model` - Model/config output (circular nodes)
- `output-memory` - Memory output (simpleMemory node)

#### Handle Detection Pattern
Config handles follow the pattern `input-<type>` where type is NOT 'main':
```typescript
const isConfigHandle = (handle: string): boolean => {
  return handle.startsWith('input-') && handle !== 'input-main';
};
```

### Config Node Connection Example

```json
{
  "edges": [
    {
      "id": "edge-memory",
      "source": "simpleMemory-1",
      "target": "aiAgent-1",
      "sourceHandle": "output-memory",
      "targetHandle": "input-memory"
    },
    {
      "id": "edge-main",
      "source": "start-1",
      "target": "aiAgent-1",
      "sourceHandle": "output-main",
      "targetHandle": "input-main"
    }
  ]
}
```

In this example:
- The simpleMemory node connects to AI Agent's `input-memory` handle (config connection)
- The start node connects to AI Agent's `input-main` handle (main data flow)
- AI Agent does NOT see simpleMemory as an input (config handles are filtered)
- simpleMemory DOES see Start node's outputs (inherits parent's main inputs)

## Dynamic Parameter Resolution

Template variables in node parameters are resolved using the format `{{nodeName.property}}`:

```json
{
  "prompt": "{{start.message}}"
}
```

This resolves to the `message` property from the Start node's output data.

## Validation Rules

1. Workflow must have required fields: id, name, nodes, edges, createdAt, lastModified
2. Workflow ID must match pattern: `workflow_[0-9]+`
3. Each node must have: id, type, position (with x and y)
4. Each edge must have: id, source, target
5. Edge source and target must reference existing nodes
6. Node types must be one of the supported types

## Version History

- **1.4.0** (2026-01-27): Comprehensive node type expansion to 58 nodes
  - Added Groq and Cerebras AI chat model nodes (6 total AI models)
  - Added 9 AI Skill nodes for Chat Agent (claude, whatsapp, memory, maps, http, scheduler, android, code, custom)
  - Added 4 AI Tool nodes for AI Agent (calculator, currentTime, webSearch, androidTool)
  - Added whatsappChatHistory node (4 WhatsApp nodes total)
  - Added scheduler nodes: timer, cronScheduler (with timezone support)
  - Added chat nodes: chatSend, chatHistory (JSON-RPC 2.0 WebSocket)
  - Added utility nodes: chatTrigger, console (5 utility nodes total)
  - Added javascriptExecutor code node (2 code nodes total)
  - Updated WebSocket handlers count to 51

- **1.3.0** (2026-01-19): OpenRouter AI provider integration
  - Added openrouterChatModel to AI Nodes list
  - Added OpenRouter node data structure with model ID format
  - Updated AI Agent provider options to include openrouter

- **1.2.0** (2025-12-19): Config node architecture and expanded node types
  - Added Config Node Architecture section with input inheritance
  - Added 31 supported node types (AI, Android, WhatsApp, Location, Code)
  - Added handle naming conventions (main vs config handles)
  - Added Simple Memory and Trigger node data structures
  - Added workflow with memory example
  - Updated edge documentation with config handle patterns

- **1.1.0** (2025-01-10): Android and WhatsApp integration
  - Added 17 Android service nodes
  - Added WhatsApp messaging nodes
  - Added trigger node support

- **1.0.0** (2025-01-06): Initial schema definition
  - Basic workflow structure
  - Node and edge definitions
  - Validation rules
  - Export/import functionality
