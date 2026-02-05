# AI Agent Tool Node Creation Guide

This guide provides a complete walkthrough for creating **dedicated AI Agent tool nodes** - nodes that ONLY work as AI tools (passive, no workflow execution). For nodes that work as BOTH workflow nodes AND AI tools, see the [Dual-Purpose Tool Node Guide](./dual_purpose_tool_node_creation.md).

> **Related Documentation:**
> - [Specialized Agent Guide](./specialized_agent_node_creation.md) - Create specialized AI agents (Android, Coding, Web, Social, Task)
> - [Dual-Purpose Tool Node Guide](./dual_purpose_tool_node_creation.md) - Nodes that work as workflow nodes AND AI tools
> - [Node Creation Guide](./node_creation.md) - General node creation patterns
> - [CLAUDE.md](../CLAUDE.md) - Project overview, toolkit sub-node execution pattern

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tool Calling Architecture](#tool-calling-architecture)
3. [Tool Types](#tool-types)
4. [Creating a Simple Tool Node](#creating-a-simple-tool-node)
5. [Backend Implementation](#backend-implementation)
6. [Status Broadcasting](#status-broadcasting)
7. [Complete Example: Weather Tool](#complete-example-weather-tool)
8. [Checklist](#checklist)

> **Note:** For creating **Specialized Agents** (like Android Control Agent, Social Media Agent), see the [Specialized Agent Guide](./specialized_agent_node_creation.md).

---

## Architecture Overview

### Tool Execution Flow

```
User Query → AI Agent → LLM decides to use tool
                            ↓
                    LangGraph tool binding
                            ↓
                    Tool executor callback
                            ↓
                    Status broadcast (executing)
                            ↓
                    Handler executes tool logic
                            ↓
                    Status broadcast (success)
                            ↓
                    Result returned to LLM
                            ↓
                    LLM continues reasoning
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Tool Node Definition | `client/src/nodeDefinitions/toolNodes.ts` | Frontend node structure |
| Tool Building | `server/services/ai.py` → `_build_tool_from_node()` | Build LangChain tools from nodes |
| Tool Schema | `server/services/ai.py` → `_get_tool_schema()` | Pydantic schema for LLM |
| Tool Handler | `server/services/handlers/tools.py` → `execute_tool()` | Execution dispatch |
| Constants | `server/constants.py` | Type definitions |
| Status Broadcaster | `server/services/status_broadcaster.py` | UI updates |

---

## Tool Calling Architecture

### Overview

Tool nodes connect to AI Agent's `input-tools` handle. The LLM uses the tool's Pydantic schema to understand parameters and fills them automatically during reasoning.

**Key Principle**: Skills (`input-skill`) provide SKILL.md context only. Actual tool execution happens via nodes connected to `input-tools`.

### Tool Building Pipeline

```
Tool Node (connected to input-tools)
        ↓
handle_ai_agent() / handle_chat_agent() collects tool_data
        ↓
_build_tool_from_node() creates StructuredTool from node config
        ↓
_get_tool_schema() returns Pydantic schema for LLM
        ↓
LangGraph binds tools to LLM
        ↓
LLM decides to call tool with auto-filled arguments
        ↓
tool_executor callback → execute_tool() in handlers/tools.py
        ↓
Dispatch to handler: _execute_calculator(), _execute_http_request(), etc.
```

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `_build_tool_from_node()` | `ai.py` | Converts node config to LangChain StructuredTool |
| `_get_tool_schema()` | `ai.py` | Returns Pydantic schema for tool's LLM-visible parameters |
| `execute_tool()` | `handlers/tools.py` | Dispatches tool execution to appropriate handler |

### Supported Tool Types

All tools use the same schema-based approach:

| Tool Type | Schema | Handler |
|-----------|--------|---------|
| `calculatorTool` | `CalculatorSchema` | `_execute_calculator()` |
| `currentTimeTool` | `CurrentTimeSchema` | `_execute_current_time()` |
| `webSearchTool` | `WebSearchSchema` | `_execute_web_search()` |
| `httpRequest` | `HttpRequestSchema` | `_execute_http_request()` |
| `pythonExecutor` | `PythonCodeSchema` | `_execute_python_code()` |
| `whatsappSend` | `WhatsAppSendSchema` | `_execute_whatsapp_send()` |
| `whatsappDb` | `WhatsAppDbSchema` | `_execute_whatsapp_db()` |
| `androidTool` | `AndroidToolSchema` | `_execute_android_toolkit()` |
| `aiAgent` | `DelegateToAgentSchema` | `_execute_delegated_agent()` |
| `chatAgent` | `DelegateToAgentSchema` | `_execute_delegated_agent()` |
| Specialized Agents | `DelegateToAgentSchema` | `_execute_delegated_agent()` |

> **Note:** AI Agents and Specialized Agents can be used as tools by other agents. When connected to `input-tools`, they use the `DelegateToAgentSchema` with `task` and optional `context` fields. Execution is fire-and-forget (async) - the parent agent continues immediately while the child executes in background. See [Specialized Agent Guide](./specialized_agent_node_creation.md#async-agent-delegation) for details.

### Skills vs Tools

| Aspect | Skills (`input-skill`) | Tools (`input-tools`) |
|--------|------------------------|----------------------|
| Purpose | Provide context/instructions | Execute actions |
| Content | SKILL.md markdown loaded into system message | Node configuration with Pydantic schema |
| Execution | None - context only | LLM calls tool, handler executes |
| Connection | Connect to `input-skill` handle | Connect to `input-tools` handle |
| Example | `httpSkill` provides HTTP capability context | `httpRequest` tool actually makes requests |

---

## Tool Types

### Simple Tool Nodes

Self-contained tools with all logic in a single handler.

**Examples:** `calculatorTool`, `currentTimeTool`, `webSearchTool`

```
[Calculator Tool] ──────────────────────→ [AI Agent]
     │                                        │
     └─ Pydantic schema + handler            └─ Uses tool during reasoning
```

> **For Specialized Agents** (like Android Control Agent, Social Media Agent), see the [Specialized Agent Guide](./specialized_agent_node_creation.md).

---

## Creating a Simple Tool Node

### Step 1: Frontend Node Definition

Create or update `client/src/nodeDefinitions/toolNodes.ts`:

```typescript
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

// Tool-specific icon (use Unicode symbols for consistency)
const WEATHER_TOOL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="5"/>
  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
</svg>`;

export const toolNodes: Record<string, INodeTypeDescription> = {
  // ... existing tools ...

  weatherTool: {
    displayName: 'Weather Tool',
    name: 'weatherTool',
    icon: WEATHER_TOOL_ICON,
    group: ['ai', 'tool'],              // CRITICAL: 'tool' marks it as AI tool
    version: 1,
    subtitle: 'Weather Information',
    description: 'Allow AI Agent to get current weather and forecasts',
    defaults: {
      name: 'Weather',
      color: '#3b82f6'                  // Blue accent
    },

    // Tool nodes are passive - no main input
    inputs: [],

    // Single output connects to AI Agent's input-tools handle
    outputs: [{
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }],

    // Tool parameters
    properties: [
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'get_weather',
        required: true,
        description: 'Name the AI will use to call this tool'
      },
      {
        displayName: 'Tool Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Get current weather conditions and forecast for a location. Returns temperature, humidity, conditions, and forecast.',
        typeOptions: { rows: 3 },
        description: 'Description helps the AI understand when to use this tool'
      },
      {
        displayName: 'API Provider',
        name: 'apiProvider',
        type: 'options',
        default: 'openweathermap',
        options: [
          { name: 'OpenWeatherMap', value: 'openweathermap' },
          { name: 'WeatherAPI', value: 'weatherapi' }
        ],
        description: 'Weather data provider'
      },
      {
        displayName: 'Units',
        name: 'units',
        type: 'options',
        default: 'metric',
        options: [
          { name: 'Metric (Celsius)', value: 'metric' },
          { name: 'Imperial (Fahrenheit)', value: 'imperial' }
        ]
      }
    ]
  }
};

// Add to TOOL_NODE_TYPES array
export const TOOL_NODE_TYPES = [
  'calculatorTool',
  'currentTimeTool',
  'webSearchTool',
  'androidTool',
  'weatherTool'          // Add new tool here
];
```

### Step 2: Register in Node Definitions

Update `client/src/nodeDefinitions.ts`:

```typescript
import { toolNodes, TOOL_NODE_TYPES } from './nodeDefinitions/toolNodes';

export const nodeDefinitions: Record<string, INodeTypeDescription> = {
  // ... other nodes ...
  ...toolNodes,
};

export { TOOL_NODE_TYPES };
```

### Step 3: Add to Constants

Update `server/constants.py`:

```python
# Tool node types (connect to AI Agent's input-tools handle)
AI_TOOL_TYPES: FrozenSet[str] = frozenset([
    'calculatorTool',
    'currentTimeTool',
    'webSearchTool',
    'androidTool',
    'weatherTool',          # Add new tool here
])
```

---

## Backend Implementation

### Step 4: Add Pydantic Schema to `_get_tool_schema()`

In `server/services/ai.py`, add the tool schema inside the `_get_tool_schema()` method. Schemas are defined inline using Pydantic:

```python
def _get_tool_schema(self, node_type: str, params: Dict[str, Any]) -> Type[BaseModel]:
    """Get Pydantic schema for tool based on node type."""

    # ... existing schemas ...

    # Weather tool schema
    if node_type == 'weatherTool':
        class WeatherToolSchema(BaseModel):
            """Schema for weather tool - defines what parameters the LLM can pass."""
            location: str = Field(
                description="City name or coordinates (e.g., 'London', 'New York, US', '51.5,-0.1')"
            )
            include_forecast: bool = Field(
                default=False,
                description="Whether to include 5-day forecast"
            )

        return WeatherToolSchema

    # Fallback: generic schema
    class GenericSchema(BaseModel):
        input: str = Field(description="Input for the tool")

    return GenericSchema
```

**Important**: Schemas define what the LLM can pass to the tool. Use clear `Field(description=...)` to help the LLM understand each parameter.

### Step 5: Create Tool Handler

In `server/services/handlers/tools.py`, add a handler function and register it in the dispatcher:

```python
import httpx
from typing import Dict, Any
from core.logging import get_logger

logger = get_logger(__name__)


async def _execute_weather_tool(
    llm_params: Dict[str, Any],
    tool_params: Dict[str, Any]
) -> str:
    """Execute weather tool.

    Args:
        llm_params: Parameters from LLM (auto-filled based on schema)
        tool_params: Node configuration from frontend (apiProvider, units, etc.)

    Returns:
        Weather information as string for LLM
    """
    # LLM-provided parameters (from schema)
    location = llm_params.get('location', '')
    include_forecast = llm_params.get('include_forecast', False)

    # Node configuration parameters (from frontend)
    api_provider = tool_params.get('apiProvider', 'openweathermap')
    units = tool_params.get('units', 'metric')
    api_key = tool_params.get('api_key', '')

    if not location:
        return "Error: No location provided"

    if not api_key:
        return "Error: Weather API key not configured"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if api_provider == 'openweathermap':
                url = "https://api.openweathermap.org/data/2.5/weather"
                params = {'q': location, 'appid': api_key, 'units': units}
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                temp_unit = "C" if units == "metric" else "F"
                result = f"""Weather in {data['name']}:
- Temperature: {data['main']['temp']}{temp_unit}
- Conditions: {data['weather'][0]['description']}
- Humidity: {data['main']['humidity']}%"""

                if include_forecast:
                    forecast_url = "https://api.openweathermap.org/data/2.5/forecast"
                    forecast_response = await client.get(forecast_url, params=params)
                    if forecast_response.status_code == 200:
                        forecast_data = forecast_response.json()
                        result += "\n\n5-Day Forecast:"
                        for item in forecast_data['list'][:5]:
                            result += f"\n- {item['dt_txt']}: {item['main']['temp']}{temp_unit}"

                return result
            else:
                return f"Error: Unknown API provider: {api_provider}"

    except httpx.HTTPStatusError as e:
        logger.error(f"Weather API error: {e}")
        return f"Error: Weather API returned {e.response.status_code}"
    except Exception as e:
        logger.error(f"Weather tool error: {e}")
        return f"Error fetching weather: {str(e)}"
```

### Step 6: Register in `execute_tool()` Dispatcher

The `execute_tool()` function dispatches to the appropriate handler based on node type:

```python
async def execute_tool(
    tool_type: str,
    tool_params: Dict[str, Any],
    llm_params: Dict[str, Any]
) -> str:
    """Dispatch tool execution to appropriate handler.

    Args:
        tool_type: Node type (e.g., 'weatherTool', 'calculatorTool')
        tool_params: Node configuration from frontend
        llm_params: Parameters auto-filled by LLM based on schema

    Returns:
        Tool result as string for LLM consumption
    """
    if tool_type == 'calculatorTool':
        return await _execute_calculator(llm_params)
    elif tool_type == 'currentTimeTool':
        return await _execute_current_time(llm_params)
    elif tool_type == 'webSearchTool':
        return await _execute_web_search(llm_params, tool_params)
    elif tool_type == 'httpRequest':
        return await _execute_http_request(llm_params, tool_params)
    elif tool_type == 'pythonExecutor':
        return await _execute_python_code(llm_params, tool_params)
    elif tool_type == 'whatsappSend':
        return await _execute_whatsapp_send(llm_params, tool_params)
    elif tool_type == 'whatsappDb':
        return await _execute_whatsapp_db(llm_params, tool_params)
    elif tool_type == 'androidTool':
        return await _execute_android_toolkit(llm_params, tool_params)
    elif tool_type == 'weatherTool':
        return await _execute_weather_tool(llm_params, tool_params)
    else:
        return f"Unknown tool type: {tool_type}"
```

### Step 7: Add to Default Tool Names/Descriptions

In `server/services/ai.py`, add the tool to `_build_tool_from_node()`:

```python
DEFAULT_TOOL_NAMES = {
    'calculatorTool': 'calculator',
    'currentTimeTool': 'get_current_time',
    'webSearchTool': 'web_search',
    'androidTool': 'android_device',
    'whatsappSend': 'whatsapp_send',
    'whatsappDb': 'whatsapp_db',
    'weatherTool': 'get_weather',          # Add new tool
}

DEFAULT_TOOL_DESCRIPTIONS = {
    'calculatorTool': 'Perform mathematical calculations.',
    'currentTimeTool': 'Get the current date and time.',
    'webSearchTool': 'Search the web for information.',
    'androidTool': 'Control Android device.',
    'whatsappSend': 'Send WhatsApp messages.',
    'whatsappDb': 'Query WhatsApp database.',
    'weatherTool': 'Get current weather and forecasts.',  # Add description
}
```

---

## Status Broadcasting

Tool nodes should show execution status in the UI when the AI Agent calls them.

### Backend: Broadcast Status

In `server/services/ai.py`, the `execute_agent` function broadcasts status:

```python
async def execute_agent(
    self,
    node_id: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute AI Agent with tools."""
    workflow_id = context.get('workflow_id')
    broadcaster = get_status_broadcaster()

    # Build tool executor with status broadcasting
    async def tool_executor(tool_name: str, tool_args: Dict) -> Any:
        config = tool_configs.get(tool_name, {})
        tool_node_id = config.get('node_id')
        tool_type = config.get('tool_type')

        # Broadcast "executing" to tool node
        if tool_node_id and broadcaster:
            await broadcaster.update_node_status(
                tool_node_id,
                "executing",
                {"message": f"Executing {tool_name}", "tool_name": tool_name},
                workflow_id=workflow_id
            )

        # Execute tool
        result = await execute_tool(tool_type, config, tool_args)

        # Broadcast "success" to tool node
        if tool_node_id and broadcaster:
            await broadcaster.update_node_status(
                tool_node_id,
                "success",
                {"message": f"{tool_name} completed", "result": str(result)[:200]},
                workflow_id=workflow_id
            )

        return result

    # ... rest of agent execution
```

### Frontend: Status Display

Tool nodes use the same status mechanism as other nodes via `useNodeStatus`:

```typescript
// In SquareNode.tsx or custom component
const nodeStatus = useNodeStatus(id);
const isExecuting = nodeStatus?.status === 'executing';

// Apply visual effects
style={{
  animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none',
  boxShadow: isExecuting ? `0 0 10px ${theme.dracula.cyan}` : 'none'
}}
```

---

## Complete Example: Weather Tool

Here's a complete implementation checklist:

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `client/src/nodeDefinitions/toolNodes.ts` | Modify | Add node definition |
| `server/constants.py` | Modify | Add to AI_TOOL_TYPES |
| `server/services/ai.py` | Modify | Add schema + DEFAULT_TOOL_NAMES |
| `server/services/handlers/tools.py` | Modify | Add handler + dispatcher case |

### Frontend Code

```typescript
// toolNodes.ts
weatherTool: {
  displayName: 'Weather Tool',
  name: 'weatherTool',
  icon: '...',
  group: ['ai', 'tool'],
  outputs: [{
    name: 'tool',
    displayName: 'Tool',
    type: 'main' as NodeConnectionType,
    description: 'Connect to AI Agent tool handle'
  }],
  properties: [
    { name: 'toolName', type: 'string', default: 'get_weather' },
    { name: 'toolDescription', type: 'string', default: 'Get weather...' },
    { name: 'apiProvider', type: 'options', default: 'openweathermap', ... },
    { name: 'units', type: 'options', default: 'metric', ... }
  ]
}

// Add to TOOL_NODE_TYPES
export const TOOL_NODE_TYPES = [..., 'weatherTool'];
```

### Backend Code

```python
# constants.py
AI_TOOL_TYPES: FrozenSet[str] = frozenset([
    ...,
    'weatherTool',
])

# ai.py - in _get_tool_schema()
if node_type == 'weatherTool':
    class WeatherToolSchema(BaseModel):
        location: str = Field(description="City name or coordinates")
        include_forecast: bool = Field(default=False, description="Include 5-day forecast")
    return WeatherToolSchema

# ai.py - in _build_tool_from_node()
DEFAULT_TOOL_NAMES = {
    ...,
    'weatherTool': 'get_weather',
}
DEFAULT_TOOL_DESCRIPTIONS = {
    ...,
    'weatherTool': 'Get current weather conditions and forecast for a location.',
}

# tools.py - handler function
async def _execute_weather_tool(llm_params: Dict, tool_params: Dict) -> str:
    location = llm_params.get('location', '')
    include_forecast = llm_params.get('include_forecast', False)
    api_key = tool_params.get('api_key', '')
    # ... implementation ...

# tools.py - in execute_tool() dispatcher
elif tool_type == 'weatherTool':
    return await _execute_weather_tool(llm_params, tool_params)
```

---

## Checklist

### Tool Node Creation

**Frontend (`client/src/nodeDefinitions/toolNodes.ts`):**
- [ ] Add node definition
  - [ ] Set `group: ['tool', 'ai']` (CRITICAL: 'tool' marks as AI tool)
  - [ ] Define `toolName` and `toolDescription` properties
  - [ ] Set output with `name: 'tool'` connecting to AI Agent's `input-tools`
- [ ] Add to `TOOL_NODE_TYPES` array
- [ ] Verify node appears in Component Palette under "AI Tools" category

**Backend - Constants (`server/constants.py`):**
- [ ] Add to `AI_TOOL_TYPES` frozenset

**Backend - Schema (`server/services/ai.py`):**
- [ ] Add Pydantic schema in `_get_tool_schema()` method
- [ ] Add tool name to `DEFAULT_TOOL_NAMES` dict in `_build_tool_from_node()`
- [ ] Add tool description to `DEFAULT_TOOL_DESCRIPTIONS` dict

**Backend - Handler (`server/services/handlers/tools.py`):**
- [ ] Create handler function `_execute_<tool_name>(llm_params, tool_params)`
- [ ] Add dispatcher case in `execute_tool()` function

**Testing:**
- [ ] Connect tool to AI Agent's `input-tools` handle
- [ ] Verify tool appears in agent's available tools (check logs)
- [ ] Test tool execution via agent query
- [ ] Verify status broadcast shows execution animation in UI

> **For Specialized Agents**, see the [Specialized Agent Guide](./specialized_agent_node_creation.md#testing).

---

## Best Practices

1. **Tool Descriptions**: Write clear, detailed descriptions that help the LLM understand when to use the tool. The `DEFAULT_TOOL_DESCRIPTIONS` in `ai.py` is what the LLM sees.

2. **Schema Fields**: Use descriptive `Field(description=...)` parameters. The LLM reads these to understand what values to provide.

3. **Parameter Separation**:
   - `llm_params`: Values the LLM provides based on schema (e.g., `location`, `query`)
   - `tool_params`: Node configuration from frontend (e.g., `api_key`, `apiProvider`)

4. **Error Handling**: Return clear error messages as strings. The LLM can understand and act on them.

5. **Status Broadcasting**: The AI Agent handles status broadcasting automatically when tools execute.

6. **Logging**: Use structured logging with tool name and parameters:
   ```python
   logger.info(f"[{tool_type}] Executing with params: {llm_params}")
   ```

7. **Timeouts**: Set reasonable timeouts for external API calls (default 10-30 seconds).

8. **API Keys**: Retrieve API keys from `tool_params` (node configuration), not `llm_params`.

9. **Return Strings**: Tool handlers should return strings that the LLM can process. Format results clearly.

10. **Skills Provide Context Only**: Remember that SKILL.md files only provide context to the system message. Actual tool execution happens via nodes connected to `input-tools`.
