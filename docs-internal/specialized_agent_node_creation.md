# Specialized AI Agent Node Creation Guide

## Overview

Specialized Agent nodes are AI Agents pre-configured for specific domains and use cases. They inherit full AI Agent functionality (provider selection, model configuration, prompt templates, thinking/reasoning) while being tailored for specific capabilities like Android control, coding, web automation, task management, or social messaging.

## Full Capabilities

All specialized agents support:

| Capability | Description |
|------------|-------------|
| **LangGraph Execution** | Full StateGraph with iterative tool-calling loop (max 10 iterations) |
| **6 AI Providers** | OpenAI, Anthropic (Claude), Google (Gemini), Groq, OpenRouter, Cerebras |
| **Extended Thinking** | Thinking/reasoning for Claude, Gemini, Groq, OpenAI o-series with output available for downstream nodes |
| **Skill Injection** | Master Skill expansion with `get_registry_prompt()` system message enhancement |
| **Tool Calling** | Connect tool nodes to `input-tools` for LLM tool invocation |
| **Two-Tier Memory** | Short-term (markdown window) + long-term (vector store) via `input-memory` |
| **Task Delegation** | Fire-and-forget async delegation, receive results via `input-task` handle |
| **Input Auto-Fallback** | Empty prompt extracts text from connected `input-main` nodes |
| **taskTrigger Integration** | React to child agent completion events via `input-task` handle |

## Architecture

```
Skill Nodes                     Specialized Agent              Output
[Android Skill] ----+
                    +---> [Android Control Agent] ---> Workflow Output
Memory Node --------+           (AI Agent)
                    +
Tool Nodes ---------+
[Battery Monitor]
[WiFi Automation]
Task Trigger -------+  (input-task handle)
```

**Key Characteristics:**
- **Full AI Agent Inheritance**: Same AI configuration options as base AI Agent (provider, model, prompt, system message, temperature, thinking)
- **Left Input Handles**: Main input (30%), Memory input (55%), Task input (85%) on the left side
- **Bottom Handles**: Skill (25%) and Tool (75%) connections at the bottom
- **Right Output Handle**: Agent output for workflow continuation
- **Task Input**: Receives task completion events from taskTrigger nodes for delegation result handling
- **Domain-Specific**: Pre-configured descriptions and use cases for specific capabilities

## Existing Specialized Agents

All agent colors use centralized dracula theme constants from `client/src/styles/theme.ts`.

| Node | Name | Description | Dracula Color |
|------|------|-------------|---------------|
| `android_agent` | Android Control Agent | Android device control agent | `dracula.green` |
| `coding_agent` | Coding Agent | Code execution agent | `dracula.cyan` |
| `web_agent` | Web Control Agent | Web automation agent | `dracula.pink` |
| `task_agent` | Task Management Agent | Task automation agent | `dracula.purple` |
| `social_agent` | Social Media Agent | Social messaging agent | `dracula.green` |
| `travel_agent` | Travel Agent | Travel planning agent | `dracula.orange` |
| `tool_agent` | Tool Agent | Tool orchestration agent | `dracula.yellow` |
| `productivity_agent` | Productivity Agent | Productivity workflows agent | `dracula.cyan` |
| `payments_agent` | Payments Agent | Payment processing agent | `dracula.green` |
| `consumer_agent` | Consumer Agent | Consumer interactions agent | `dracula.purple` |
| `autonomous_agent` | Autonomous Agent | Autonomous operations with Code Mode patterns | `dracula.purple` |
| `orchestrator_agent` | Orchestrator Agent | Multi-agent coordination and task delegation | `dracula.cyan` |

## Shared AI Agent Properties

All specialized agents share the same AI configuration properties defined in `AI_AGENT_PROPERTIES`:

```typescript
const AI_AGENT_PROPERTIES: INodeProperties[] = [
  {
    displayName: 'AI Provider',
    name: 'provider',
    type: 'options',
    options: [
      { name: 'OpenAI', value: 'openai' },
      { name: 'Anthropic (Claude)', value: 'anthropic' },
      { name: 'Google (Gemini)', value: 'gemini' },
      { name: 'Groq', value: 'groq' },
      { name: 'OpenRouter', value: 'openrouter' }
    ],
    default: 'openai',
    description: 'The AI provider to use (configure API keys in Credentials)'
  },
  {
    displayName: 'Model',
    name: 'model',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'Select a model...',
    description: 'AI model to use for the agent',
    typeOptions: {
      dynamicOptions: true,
      dependsOn: ['provider']
    }
  },
  {
    displayName: 'Prompt',
    name: 'prompt',
    type: 'string',
    default: '{{ $json.chatInput }}',
    required: true,
    typeOptions: { rows: 4 },
    description: 'The prompt template for the AI agent',
    placeholder: 'Enter your prompt or use template variables...'
  },
  {
    displayName: 'System Message',
    name: 'systemMessage',
    type: 'string',
    default: 'You are a helpful assistant',
    typeOptions: { rows: 3 },
    description: 'Define the behavior and personality of the AI agent'
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    options: [
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        default: 0.7,
        typeOptions: { minValue: 0, maxValue: 2, numberStepSize: 0.1 },
        description: 'Controls randomness in responses'
      },
      {
        displayName: 'Maximum Tokens',
        name: 'maxTokens',
        type: 'number',
        default: 1000,
        typeOptions: { minValue: 1, maxValue: 8192 },
        description: 'Maximum number of tokens to generate'
      },
      {
        displayName: 'Thinking/Reasoning',
        name: 'thinkingEnabled',
        type: 'boolean',
        default: false,
        description: 'Enable extended thinking for supported providers'
      },
      {
        displayName: 'Thinking Budget',
        name: 'thinkingBudget',
        type: 'number',
        default: 2048,
        typeOptions: { minValue: 1024, maxValue: 16000 },
        description: 'Token budget for thinking (Claude, Gemini, Cerebras)',
        displayOptions: { show: { thinkingEnabled: [true] } }
      },
      {
        displayName: 'Reasoning Effort',
        name: 'reasoningEffort',
        type: 'options',
        options: [
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' }
        ],
        default: 'medium',
        description: 'Reasoning effort level (OpenAI o-series, Groq)',
        displayOptions: { show: { thinkingEnabled: [true] } }
      }
    ]
  }
];
```

## Shared Constants

All specialized agents use shared constants defined in `specializedAgentNodes.ts`:

```typescript
// Inputs shared by AI Agent and all Specialized Agent nodes
export const AI_AGENT_INPUTS = [
  { name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Agent input' },
  { name: 'skill', displayName: 'Skill', type: 'main' as NodeConnectionType, description: 'Skill nodes that provide context and instructions' },
  { name: 'memory', displayName: 'Memory', type: 'main' as NodeConnectionType, description: 'Memory node for conversation history' },
  { name: 'tools', displayName: 'Tool', type: 'main' as NodeConnectionType, description: 'Tool nodes for agent capabilities' },
  { name: 'task', displayName: 'Task', type: 'main' as NodeConnectionType, description: 'Task completion events from taskTrigger' },
];

// Outputs shared by AI Agent and all Specialized Agent nodes
export const AI_AGENT_OUTPUTS = [
  { name: 'main', displayName: 'Output', type: 'main' as NodeConnectionType, description: 'Agent output' }
];

// Properties shared by AI Agent and all Specialized Agent nodes
export const AI_AGENT_PROPERTIES: INodeProperties[] = [
  // Provider, Model, Prompt, System Message, Options (temperature, maxTokens, thinking)
];
```

## Creating a New Specialized Agent

### Step 1: Add Node Definition

Add to `client/src/nodeDefinitions/specializedAgentNodes.ts`:

```typescript
import { dracula } from '../styles/theme';

// Database Agent - AI Agent with database capabilities
database_agent: {
  displayName: 'Database Agent',
  name: 'database_agent',
  icon: '...',
  group: ['agent', 'ai'],  // CRITICAL: 'agent' first for category placement
  version: 1,
  subtitle: 'Data Operations',
  description: 'AI Agent specialized for database operations. Connect skills, memory, and database nodes.',
  defaults: { name: 'Database Agent', color: dracula.cyan },  // Use centralized dracula theme
  inputs: AI_AGENT_INPUTS,    // Use shared constant
  outputs: AI_AGENT_OUTPUTS,  // Use shared constant
  properties: AI_AGENT_PROPERTIES  // Use shared constant
}
```

**Important**: Always use the shared constants (`AI_AGENT_INPUTS`, `AI_AGENT_OUTPUTS`, `AI_AGENT_PROPERTIES`) instead of defining inputs/outputs inline. This ensures all agents have consistent handles including the `input-task` handle for delegation.

### Step 1b: Add to SPECIALIZED_AGENT_TYPES

```typescript
export const SPECIALIZED_AGENT_TYPES = [
  'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent',
  'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent',
  'database_agent'  // Add new agent
];
```

### Step 2 (Legacy Pattern - NOT RECOMMENDED)

The old pattern defined inputs inline:

```typescript
inputs: [
  {
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Agent input'
  },
  // ... more inputs
],
outputs: [{
  name: 'main',
  displayName: 'Output',
    type: 'main' as NodeConnectionType,
    description: 'Agent output'
  }],
  properties: AI_AGENT_PROPERTIES  // CRITICAL: Use shared properties for full AI configuration
},
```

### Step 2: Add to SPECIALIZED_AGENT_TYPES

In the same file, add to the array:

```typescript
export const SPECIALIZED_AGENT_TYPES = [
  'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent',
  'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent',
  'database_agent'  // Add new agent here
];
```

### Step 3: Add AIAgentNode Config

Add to `client/src/components/AIAgentNode.tsx` in `AGENT_CONFIGS`:

```typescript
database_agent: {
  icon: <span style={{ fontSize: '28px' }}>...</span>,
  title: 'Database Agent',
  subtitle: 'Data Operations',
  themeColorKey: 'cyan',  // References dracula.cyan - resolved at runtime via dracula[config.themeColorKey]
  bottomHandles: [
    { id: 'input-skill', label: 'Skill', position: '25%' },
    { id: 'input-tools', label: 'Tool', position: '75%' },
  ],
  leftHandles: [
    { id: 'input-memory', label: 'Memory', position: '70%' },
  ],
  topOutputHandle: { id: 'output-top', label: 'Output' },
  width: 260,
  height: 160,
},
```

### Step 4: Verify Dashboard Mapping

The `Dashboard.tsx` automatically maps specialized agents via `SPECIALIZED_AGENT_TYPES`:

```typescript
// Pre-register specialized agent nodes explicitly
SPECIALIZED_AGENT_TYPES.forEach(type => {
  types[type] = AIAgentNode;
});
```

No changes needed if you added to `SPECIALIZED_AGENT_TYPES`.

### Step 5: Add to Parameter Panel Arrays

In `client/src/components/parameterPanel/MiddleSection.tsx`, add to `AGENT_WITH_SKILLS_TYPES`:
```typescript
const AGENT_WITH_SKILLS_TYPES = [
  'chatAgent', 'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent',
  'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent',
  'database_agent'  // Add new agent
];
```

In `client/src/components/parameterPanel/InputSection.tsx`, add to both arrays:
- `AGENT_WITH_SKILLS_TYPES` (same as above)
- `aiAgentTypes` (includes `'aiAgent'` as well)

### Step 6: Backend - Add to Constants

In `server/constants.py`, add to `AI_AGENT_TYPES` frozenset:
```python
AI_AGENT_TYPES: FrozenSet[str] = frozenset([
    'aiAgent', 'chatAgent',
    'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent',
    'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent',
    'database_agent',  # Add new agent
])
```

### Step 7: Backend - Add Handler Registry Entry

In `server/services/node_executor.py`, add to `_build_handler_registry()`:
```python
'database_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
```

### Step 8: Backend - Add to Delegation Check

In `server/services/handlers/tools.py`, add to the delegation check tuple in `execute_tool()`:
```python
if node_type in ('aiAgent', 'chatAgent', 'android_agent', ..., 'database_agent'):
    return await _execute_delegated_agent(tool_args, config)
```

### Step 9: Backend - Add Delegation Tool Definitions

In `server/services/ai.py`, add to three locations:
1. `DEFAULT_TOOL_NAMES`: `'database_agent': 'delegate_to_database_agent'`
2. `DEFAULT_TOOL_DESCRIPTIONS`: `'database_agent': 'Delegate database tasks to the Database Agent'`
3. `DelegateToAgentSchema` condition tuple: add `'database_agent'`

## AgentConfig Interface

```typescript
type ThemeColorKey = 'purple' | 'cyan' | 'green' | 'pink' | 'orange' | 'yellow' | 'red';

interface AgentConfig {
  icon: React.ReactNode;           // Emoji with fontSize 28px
  title: string;                   // Display title
  subtitle: string;                // Subtitle below title
  themeColorKey: ThemeColorKey;    // Dracula theme color key - resolved via dracula[themeColorKey]
  bottomHandles: Array<{
    id: string;                    // Handle ID (e.g., 'input-skill')
    label: string;                 // Handle label
    position: string;              // CSS position (e.g., '25%')
  }>;
  leftHandles?: Array<{...}>;      // Optional left-side handles (below main input)
  rightHandles?: Array<{...}>;     // Optional right-side handles
  topOutputHandle?: {...};         // Optional top output handle
  skipInputHandle?: boolean;       // Skip left input handle
  skipRightOutput?: boolean;       // Skip right output handle
  width?: number;                  // Custom width in pixels
  height?: number;                 // Custom height in pixels
}
```

## Visual Design

Specialized agents render as rectangular cards with AI Agent-style handles:

```
+-------------------------------------------+
|  ...                                    o |  (params button, status indicator)
|                                           |
|  Input o---------                         |  (left handle at 30%)
|                                           |
|                   ...                     |  (icon - emoji)
|              Database Agent               |  (title)
|              Data Operations              |  (subtitle)
|                                           |
|  Memory <>---------                       |  (left handle at 70% - diamond)
|                                           |
|        Skill              Tool            |  (bottom handle labels)
+-----------<>--------------<>--------------+  (bottom handles - diamond)
                                          o---  (right output handle)
```

## Handle Layout

| Handle | Position | ID | Purpose |
|--------|----------|----|---------|
| Left Input | 30% from top | `input-main` | Main workflow data input |
| Left Memory | 70% from top | `input-memory` | Memory node for history |
| Bottom Skill | 25% from left | `input-skill` | Skill nodes for context |
| Bottom Tool | 75% from left | `input-tools` | Tool nodes for capabilities |
| Right Output | Center right | `output-main` | Agent output |

## Handle Styling

All handles use diamond shape (45-degree rotation) with consistent styling:

```typescript
// Left handles (Input, Memory)
style={{
  position: 'absolute',
  left: '-6px',
  top: position,  // '30%' or '70%'
  width: theme.nodeSize.handle,
  height: theme.nodeSize.handle,
  backgroundColor: theme.colors.background,
  border: `2px solid ${theme.colors.textSecondary}`,
  borderRadius: '0',
  transform: 'translateY(-50%) rotate(45deg)'
}}

// Handle labels
style={{
  fontSize: '10px',
  color: theme.colors.text,
  fontWeight: theme.fontWeight.medium,
  opacity: 0.8
}}
```

## Component Palette Category

Specialized agents appear in the **AI Agents** category:
- Group: `['agent', 'ai']` - First element determines category
- Visible in Normal mode (SIMPLE_MODE_CATEGORIES includes 'agent')
- Purple color theme (theme.dracula.purple)

## Backend Handler

Specialized agents use the same backend handler as AI Agents since they inherit the same functionality. The handler should:

1. Collect skill data from `input-skill` handle
2. Collect memory data from `input-memory` handle
3. Collect tool data from `input-tools` handle
4. Execute LangGraph agent with collected context

See `server/services/handlers/ai.py` for the `handle_chat_agent()` implementation.

## Supported AI Features

All specialized agents support:

| Feature | Description |
|---------|-------------|
| **Multi-Provider** | OpenAI, Anthropic, Google, Groq, OpenRouter, Cerebras |
| **Dynamic Models** | Model dropdown populated based on selected provider |
| **Prompt Templates** | Support for `{{ $json.field }}` template variables |
| **System Message** | Customizable agent personality and behavior |
| **Temperature** | Response randomness control (0-2) |
| **Max Tokens** | Output length limit (1-8192) |
| **Thinking/Reasoning** | Extended thinking for Claude, Gemini, Groq, OpenAI o-series |
| **Thinking Budget** | Token budget for reasoning (1024-16000) |
| **Reasoning Effort** | Low/Medium/High for OpenAI o-series and Groq |
| **Thinking Output** | Thinking content available in Input Data & Variables for downstream nodes |
| **Async Delegation** | Can be used as tools by parent agents (fire-and-forget) |
| **Task Completion** | Receive delegated task results via `input-task` handle |
| **Input Auto-Fallback** | Empty prompt extracts text from connected `input-main` nodes |
| **Skill Injection** | Skills appended to system message via `get_registry_prompt()` |
| **Two-Tier Memory** | Short-term (markdown) + long-term (vector store) memory |

### Extended Thinking Details

Thinking content is extracted differently per provider and accumulates across tool-calling iterations:

| Provider | Extraction Method | Notes |
|----------|------------------|-------|
| **Claude** | `content_blocks` with `type='thinking'` | Requires `max_tokens > thinkingBudget` |
| **Gemini** | `response_metadata.candidates[0].content.parts` with `thought=True` | 2.5/Flash Thinking models |
| **Groq** | `additional_kwargs.reasoning` or `response_metadata.reasoning` | Qwen3/QwQ models, `reasoningFormat='parsed'` |
| **OpenAI** | Reasoning summaries | o-series, requires org verification |

The accumulated `thinking` content is available in the agent's output for downstream nodes to use via drag-and-drop in Input Data & Variables.

## Async Agent Delegation

Specialized agents can be used as tools by other agents via the `input-tools` handle. This enables hierarchical agent architectures where a parent agent delegates tasks to specialized child agents.

### Architecture

```
Parent Agent decides to delegate
        |
        v
calls delegate_to_<agent_type>(task="...", context="...")
        |
        v
Tool handler spawns child agent via asyncio.create_task()
        |
        v
Returns immediately: {"status": "delegated", "task_id": "..."}
        |
Parent Agent continues working
        |
Child Agent executes independently in background
        |
Child broadcasts its own status updates
```

### How It Works

1. **Connect agent as tool**: Connect any specialized agent to a parent agent's `input-tools` handle
2. **Parent agent calls tool**: LLM decides to delegate using `delegate_to_<agent_type>` tool
3. **Fire-and-forget**: Child agent spawns as background task, parent continues immediately
4. **Independent execution**: Child agent uses its own connected skills, memory, and tools

### Tool Schema

When connected as a tool, the agent exposes this schema to the parent's LLM:

```python
class DelegateToAgentSchema(BaseModel):
    task: str = Field(description="The task to delegate to the child agent")
    context: Optional[str] = Field(
        default=None,
        description="Additional context for the task"
    )
```

### Example: Parent Delegates to Android Agent

```
[AI Agent] ←──tools── [Android Control Agent] ←──tools── [Battery Monitor]
                                               ←──tools── [WiFi Automation]
```

When the AI Agent needs to control Android devices:
1. LLM calls `delegate_to_android_agent(task="Check battery and enable WiFi if low")`
2. Android Agent spawns as background task
3. AI Agent receives `{"status": "delegated", "task_id": "..."}` immediately
4. Android Agent executes with its own battery and WiFi tools
5. Android Agent broadcasts its own status updates

### Key Design Decisions

- **Non-blocking**: Parent doesn't wait for child completion
- **Memory isolation**: Child uses its own connected memory, not parent's
- **Independent tools**: Child has access to its own connected tools only
- **Error isolation**: Child errors don't propagate to parent
- **Status broadcasting**: Both agents show their own execution status in UI

### Implementation Files

| File | Purpose |
|------|---------|
| `server/services/ai.py` | `DelegateToAgentSchema` in `_get_tool_schema()` |
| `server/services/handlers/tools.py` | `_execute_delegated_agent()` spawns child via `asyncio.create_task()` |
| `server/services/handlers/ai.py` | Passes `context` for nested agent delegation |

## Task Completion Handling

The `input-task` handle allows specialized agents to receive and react to task completion events from delegated child agents.

### taskTrigger Node Integration

Connect a `taskTrigger` workflow node to the agent's `input-task` handle. When a delegated child agent completes (success or error), the taskTrigger fires and provides the completion data to the parent agent.

```
[Parent Agent] ←──task── [taskTrigger] ←── (listens for task_completed events)
       ↓
  delegates to
       ↓
[Child Agent] ──(completes)──→ broadcasts task_completed event
```

### Task Completion Event Structure

When a delegated child agent completes, it broadcasts a `task_completed` event:

```python
{
    'task_id': 'uuid-string',
    'status': 'completed' | 'error',
    'agent_name': 'Android Control Agent',
    'agent_node_id': 'node-id',
    'parent_node_id': 'parent-node-id',
    'result': '...',      # Present when status='completed'
    'error': '...',       # Present when status='error'
    'workflow_id': 'workflow-uuid'
}
```

### Tool Stripping Behavior

**Critical**: When an agent receives task completion data via `input-task`, ALL tools are stripped from the agent before execution. This prevents confusion where the agent is instructed to "report the result" but still has tools bound that it might try to use.

```python
# In handlers/ai.py - when task_data is present
if task_data:
    # Strip all tools - agent's job is to report result, not execute
    tool_data = []
```

### Use Case: Parent Reacting to Child Completion

1. Parent agent delegates task: `delegate_to_android_agent(task="Check battery")`
2. Parent continues immediately (fire-and-forget)
3. Child agent executes and completes
4. Child broadcasts `task_completed` event
5. taskTrigger connected to parent's `input-task` fires
6. Parent agent receives task result via `input-task` handle
7. Parent agent (with tools stripped) reports the result naturally

## LangGraph Execution

Specialized agents use LangGraph's StateGraph for structured tool-calling execution.

### StateGraph Construction

When tools are connected to `input-tools`, the agent builds a conditional graph:

```python
# Simplified from server/services/ai.py
graph = StateGraph(AgentState)
graph.add_node("agent", call_model)
graph.add_node("tools", tool_executor)

graph.add_conditional_edges(
    "agent",
    should_continue,  # Check if LLM wants to call tools
    {"continue": "tools", "end": END}
)
graph.add_edge("tools", "agent")  # Loop back after tool execution
```

### Iterative Tool-Calling Loop

- **Max iterations**: 10 (prevents infinite loops)
- **Loop pattern**: LLM → tool call → tool execution → LLM → ... → final response
- **Exit conditions**: LLM returns response without tool calls, or max iterations reached

### Tool-Less Optimization

When no tools are connected to `input-tools`, the agent skips LangGraph entirely for better performance:

```python
if not tools:
    # Direct LLM invocation without graph overhead
    response = await model.ainvoke(messages)
else:
    # Full LangGraph execution with tool loop
    response = await graph.ainvoke(state)
```

## Input Data Auto-Fallback

When the agent's `prompt` parameter is empty, it automatically extracts text from nodes connected to `input-main`.

### Extraction Priority

The agent searches the connected node's output for text in this order:
1. `message` field
2. `text` field
3. `content` field
4. String representation of entire output

### Use Case

Enables simple workflows like:
```
[Chat Trigger] → [Zeenie]
```

Without manually setting `prompt` to `{{chatTrigger.message}}`, the agent auto-extracts the message.

## Skill Injection

Skills connected to `input-skill` are injected into the agent's system message.

### Master Skill Expansion

When a `masterSkill` node is connected, it expands into individual skill entries based on `skillsConfig`:

```python
skillsConfig = {
    'whatsapp-skill': {
        'enabled': True,
        'instructions': '...',
        'isCustomized': False
    },
    'http-skill': {
        'enabled': True,
        'instructions': '...',
        'isCustomized': True  # User modified in UI
    }
}
```

### Registry Prompt Generation

The `SkillLoader.get_registry_prompt()` method generates a skill list appended to the system message:

```markdown
## Available Skills

You have access to the following skills. Use them when appropriate:

- **whatsapp-skill**: Send and receive WhatsApp messages
  - Tools: whatsapp_send, whatsapp_db
- **http-skill**: Make HTTP requests to external APIs
  - Tools: http-request
```

### DB-First Pattern

After first activation, skill instructions are stored in and read from the database:
1. First load: Instructions seeded from SKILL.md file
2. Subsequent loads: Database is source of truth
3. User edits: Saved to database only
4. "Reset to Default": Reloads from SKILL.md file

## Memory Integration

Memory connected to `input-memory` provides conversation history via a two-tier system.

### Short-Term Memory

- **Format**: Markdown with timestamps
- **Window-based trimming**: Keeps last N message pairs (configurable via `windowSize`)
- **Auto-append**: New human/AI messages appended after each execution

### Long-Term Memory

- **Optional**: Enable via `longTermEnabled` parameter
- **Storage**: InMemoryVectorStore per session
- **Semantic retrieval**: Archived messages retrieved by similarity
- **Retrieval count**: Configurable via `retrievalCount` parameter

### Memory Lifecycle

1. Load markdown from `memoryContent` parameter
2. Parse to LangChain messages
3. Retrieve relevant long-term memories (if enabled)
4. Execute agent with conversation history
5. Append new exchange to markdown
6. Trim to window size, archive removed messages
7. Save updated markdown back to node parameters

## Architecture Notes

### Shared Handler Routing

All 12 specialized agents route to the same backend handler:

```python
# In node_executor.py
'android_agent': partial(handle_chat_agent, ai_service=..., database=...),
'coding_agent': partial(handle_chat_agent, ai_service=..., database=...),
# ... all 12 specialized agents use handle_chat_agent
```

This means specialization is purely UI/configuration, not backend behavioral. All agents share:
- Same `_collect_agent_connections()` base function
- Same skill injection pipeline
- Same tool execution flow
- Same memory handling

### Database-First Architecture

Node parameters, memory content, and tool schemas come from database first (not `node.data`):
- Reduces workflow JSON bloat
- Enables user customization persistence
- Separates configuration from workflow structure

## Testing

1. Hard refresh browser (Ctrl+Shift+R) after changes
2. Check React DevTools for node type registration
3. Verify node appears in Component Palette under "AI Agents"
4. Test drag-and-drop to canvas
5. Open parameter panel - verify AI configuration options appear
6. Test left handle connections (Input, Memory)
7. Test bottom handle connections (Skill, Tool)
8. Test right output handle connections
9. Execute agent and verify output

## Files Reference

### Frontend
| File | Purpose |
|------|---------|
| `client/src/nodeDefinitions/specializedAgentNodes.ts` | Node definitions + AI_AGENT_PROPERTIES + SPECIALIZED_AGENT_TYPES |
| `client/src/styles/theme.ts` | Centralized dracula theme constants (colors used in node defaults) |
| `client/src/components/AIAgentNode.tsx` | AGENT_CONFIGS visual configuration with themeColorKey |
| `client/src/components/parameterPanel/MiddleSection.tsx` | AGENT_WITH_SKILLS_TYPES array |
| `client/src/components/parameterPanel/InputSection.tsx` | AGENT_WITH_SKILLS_TYPES + aiAgentTypes arrays |
| `client/src/Dashboard.tsx` | Node type to component mapping (automatic via SPECIALIZED_AGENT_TYPES) |
| `client/src/components/ui/ComponentPalette.tsx` | Category display (automatic via group) |
| `client/src/nodeDefinitions.ts` | Main registry (imports specializedAgentNodes) |

### Backend
| File | Purpose |
|------|---------|
| `server/constants.py` | AI_AGENT_TYPES frozenset (provider detection, config node filtering) |
| `server/services/node_executor.py` | Handler registry mapping agent types to handle_chat_agent |
| `server/services/handlers/ai.py` | Backend handler (shared with AI Agents) |
| `server/services/handlers/tools.py` | Delegation check in execute_tool() |
| `server/services/ai.py` | DEFAULT_TOOL_NAMES, DEFAULT_TOOL_DESCRIPTIONS, DelegateToAgentSchema |
