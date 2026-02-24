# Node Creation Guide

This guide explains how to create new nodes for MachinaOs, covering frontend definitions, backend handlers, and the complete integration flow.

> **Related Documentation:**
> - [Workflow Schema](./workflow-schema.md) - JSON schema, edge handle conventions, config node architecture
> - [CLAUDE.md](../CLAUDE.md) - Project overview, key files, architecture patterns

## Table of Contents

1. [Node Types Overview](#node-types-overview)
2. [Frontend: Node Definition](#frontend-node-definition)
3. [Frontend: Visual Component](#frontend-visual-component)
4. [Backend: Workflow Handler](#backend-workflow-handler)
5. [Template Resolution](#template-resolution)
6. [Workflow Context and Status Broadcasting](#workflow-context-and-status-broadcasting)
7. [Input & Output Panels](#input--output-panels)
8. [Nodes Without Output Handles](#nodes-without-output-handles)
9. [Config Nodes (Memory, Tools)](#config-nodes)
10. [Trigger Nodes](#trigger-nodes)
11. [AI Provider Nodes](#ai-provider-nodes)
12. [AI Tool Nodes](#ai-tool-nodes)
13. [Complete Examples](#complete-examples)

---

## Node Types Overview

MachinaOs supports 105 nodes across 17 categories:

| Category | Visual Component | Example Nodes | Count |
|----------|-----------------|---------------|-------|
| **Workflow** | StartNode | start, taskTrigger | 2 |
| **Scheduler** | SquareNode | timer, cronScheduler | 2 |
| **AI Chat Models** | SquareNode | openaiChatModel, anthropicChatModel, geminiChatModel, openrouterChatModel, groqChatModel, cerebrasChatModel | 6 |
| **AI Agents** | AIAgentNode | aiAgent, chatAgent | 2 |
| **Specialized Agents** | AIAgentNode | android_agent, coding_agent, web_agent, task_agent, social_agent, travel_agent, tool_agent, productivity_agent, payments_agent, consumer_agent, autonomous_agent, orchestrator_agent | 12 |
| **AI Memory** | SquareNode | simpleMemory | 1 |
| **AI Skills** | SquareNode | masterSkill, customSkill + 9 individual skills | 11 |
| **AI Tools** | SquareNode | calculatorTool, currentTimeTool, webSearchTool, androidTool | 4 |
| **Triggers** | TriggerNode | whatsappReceive, webhookTrigger, chatTrigger, twitterReceive | 4 |
| **Android** | SquareNode | batteryMonitor, wifiAutomation, location, cameraControl (16 services) | 16 |
| **WhatsApp** | SquareNode | whatsappSend, whatsappReceive, whatsappDb | 3 |
| **Twitter/X** | SquareNode | twitterSend, twitterSearch, twitterUser, twitterReceive | 4 |
| **Social** | SquareNode | socialReceive, socialSend | 2 |
| **Location/Maps** | SquareNode | createMap, addLocations, showNearbyPlaces | 3 |
| **Utility** | SquareNode | httpRequest, webhookTrigger, webhookResponse, chatTrigger, console | 5 |
| **Code** | SquareNode | pythonExecutor, javascriptExecutor | 2 |
| **Chat** | SquareNode | chatSend, chatHistory | 2 |
| **Document** | SquareNode | httpScraper, fileDownloader, documentParser, textChunker, embeddingGenerator, vectorStore | 6 |

---

## Frontend: Node Definition

Node definitions are located in `client/src/nodeDefinitions/`. Create your definition in the appropriate file or create a new category file.

### Basic Structure

```typescript
// client/src/nodeDefinitions/yourNodes.ts
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const yourNodes: Record<string, INodeTypeDescription> = {
  yourNodeName: {
    // === Required Fields ===
    displayName: 'Your Node Name',      // Shown in UI
    name: 'yourNodeName',               // Internal identifier (camelCase)
    icon: '🔧',                         // Emoji or image URL
    group: ['category'],                // For palette grouping
    version: 1,
    description: 'What this node does',

    // === Visual Defaults ===
    defaults: {
      name: 'Your Node',
      color: '#FF5722'                  // Hex color for node accent
    },

    // === Connections ===
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Node input'
    }],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'result, status, timestamp'  // Document output fields
    }],

    // === Parameters ===
    properties: [
      // See Parameter Types section below
    ]
  }
};
```

### Parameter Types

```typescript
properties: [
  // String input
  {
    displayName: 'API Key',
    name: 'apiKey',
    type: 'string',
    default: '',
    required: true,
    description: 'Your API key',
    placeholder: 'Enter API key...',
    typeOptions: {
      password: true,              // Masked input
      rows: 4                      // Multiline textarea
    }
  },

  // Number input
  {
    displayName: 'Timeout',
    name: 'timeout',
    type: 'number',
    default: 30,
    typeOptions: {
      minValue: 1,
      maxValue: 300,
      numberStepSize: 1
    }
  },

  // Boolean toggle
  {
    displayName: 'Enable Feature',
    name: 'enableFeature',
    type: 'boolean',
    default: false
  },

  // Dropdown select
  {
    displayName: 'Method',
    name: 'method',
    type: 'options',
    default: 'GET',
    options: [
      { name: 'GET', value: 'GET' },
      { name: 'POST', value: 'POST' },
      { name: 'PUT', value: 'PUT' },
      { name: 'DELETE', value: 'DELETE' }
    ]
  },

  // Conditional display
  {
    displayName: 'Request Body',
    name: 'body',
    type: 'string',
    default: '',
    typeOptions: { rows: 6 },
    displayOptions: {
      show: {
        method: ['POST', 'PUT']    // Only show when method is POST or PUT
      }
    }
  },

  // Collection (grouped options)
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    options: [
      {
        displayName: 'Headers',
        name: 'headers',
        type: 'string',
        default: ''
      }
    ]
  },

  // Dynamic options (loaded from backend)
  {
    displayName: 'Model',
    name: 'model',
    type: 'string',
    default: '',
    typeOptions: {
      dynamicOptions: true,
      dependsOn: ['provider']      // Reload when provider changes
    }
  }
]
```

### Register the Node

Add to the main registry in `client/src/nodeDefinitions.ts`:

```typescript
import { yourNodes } from './nodeDefinitions/yourNodes';

export const nodeDefinitions: Record<string, INodeTypeDescription> = {
  ...existingNodes,
  ...yourNodes,
};
```

---

## Frontend: Visual Component

### Map to Component Type

In `client/src/Dashboard.tsx`, map your node to a visual component:

```typescript
const createNodeTypes = () => {
  const types: NodeTypes = {};

  Object.entries(nodeDefinitions).forEach(([type, def]) => {
    if (type === 'yourNodeName') {
      types[type] = SquareNode;          // Standard square node
    } else if (type === 'yourModelNode') {
      types[type] = ModelNode;           // Circular model node
    } else if (type === 'aiAgent') {
      types[type] = AIAgentNode;         // Special AI agent layout
    }
    // ... etc
  });

  return types;
};
```

### Available Visual Components

| Component | Shape | Use Case |
|-----------|-------|----------|
| `SquareNode` | 80x80px square | Standard nodes, action nodes |
| `TriggerNode` | 80x80px square | Trigger nodes (no input handles) |
| `ModelNode` | 80x80px circle | AI models, config nodes |
| `AIAgentNode` | Rectangle with handles | AI agents with tool/memory inputs |
| `ToolkitNode` | Square with vertical handles | Skill nodes, toolkit aggregators |

### Trigger Node Registration

Trigger nodes must be added to `TRIGGER_NODE_TYPES` array in Dashboard.tsx:

```typescript
// In createNodeTypes()
const TRIGGER_NODE_TYPES = ['start', 'cronScheduler', 'webhookTrigger', 'whatsappReceive', 'chatTrigger', 'taskTrigger'];

// Trigger nodes map to TriggerNode component
if (TRIGGER_NODE_TYPES.includes(type)) {
  types[type] = TriggerNode;
}
```

Also add to the deploy validation array in `handleDeploy()`:

```typescript
const triggerTypes = ['start', 'cronScheduler', 'webhookTrigger', 'whatsappReceive', 'workflowTrigger', 'chatTrigger', 'taskTrigger'];
```

---

## Backend: Workflow Handler

### Add to Execution Service (Enables Run Button)

**CRITICAL:** Add your node type to the supported types whitelist in `client/src/services/executionService.ts`. Without this, the "Run" button will NOT appear in the parameter panel for your node.

```typescript
// client/src/services/executionService.ts

// Option 1: Import and spread node types array (recommended for modules)
import { YOUR_NODE_TYPES } from '../nodeDefinitions/yourNodes';

static isNodeTypeSupported(nodeType: string): boolean {
  const supportedTypes = [
    // ... existing types
    ...YOUR_NODE_TYPES,  // Spread imported array
  ];
  return supportedTypes.includes(nodeType);
}

// Option 2: Add individual node types directly
static isNodeTypeSupported(nodeType: string): boolean {
  const supportedTypes = [
    // ... existing types
    'yourNodeName',
  ];
  return supportedTypes.includes(nodeType);
}
```

**Why this is required:**
- The `isNodeTypeSupported()` method acts as an execution whitelist
- Only nodes in this list show the "Run" button in the parameter panel
- This prevents accidental execution of incomplete/untested nodes

### Create Backend Handler

In `server/services/workflow.py`, add a handler in `_execute_single_node()`:

```python
elif node_type == 'yourNodeName':
    result = await self._execute_your_node(node_id, resolved_parameters)
```

Then implement the execution method:

```python
async def _execute_your_node(self, node_id: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Execute your custom node."""
    start_time = time.time()

    try:
        # Extract parameters
        api_key = parameters.get('apiKey', '')
        timeout = int(parameters.get('timeout', 30))
        method = parameters.get('method', 'GET')

        # Your node logic here
        result_data = {
            "status": "success",
            "data": "your result",
            "timestamp": datetime.now().isoformat()
        }

        return {
            "success": True,
            "node_id": node_id,
            "node_type": "yourNodeName",
            "result": result_data,
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Your node execution failed: {e}")
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "yourNodeName",
            "error": str(e),
            "execution_time": time.time() - start_time
        }
```

---

## Template Resolution

Template resolution allows nodes to reference outputs from other nodes using `{{nodeName.fieldPath}}` syntax.

### How It Works

1. **ParameterResolver** (`server/services/parameter_resolver.py`) gathers outputs from ALL nodes in the workflow
2. Template patterns `{{nodeName.field}}` are replaced with actual values
3. Resolution happens BEFORE the node handler executes

### Template Syntax

```
{{nodeName.field}}           # Simple field access
{{nodeName.nested.field}}    # Nested field access
{{nodeName.array[0]}}        # Array indexing
{{nodeName.data.items[0].name}}  # Complex path
```

### Node Name Resolution

Node names are normalized for template matching:
- `aiAgent-1234567890` → `aiagent`
- `WhatsApp Chat History` (custom label) → `whatsappchathistory`
- Spaces and special characters are removed, converted to lowercase

### Example Usage

```typescript
// In node definition - parameter that accepts templates
{
  displayName: 'Message',
  name: 'message',
  type: 'string',
  default: '',
  description: 'Supports templates: {{aiagent.response}}'
}
```

### Backend Resolution Flow

```
NodeExecutor.execute()
    ↓
ParameterResolver.resolve(params, node_id, nodes, edges, session_id)
    ↓
_gather_all_outputs()  // Collects outputs from ALL nodes
    ↓
_resolve_value()       // Replaces {{templates}} with actual values
    ↓
Handler receives resolved parameters
```

### Important Notes

- Templates are resolved by ParameterResolver, not by individual handlers
- If a template references a node that hasn't executed yet, it resolves to empty string
- Nodes that need raw template values (not resolved) should use a different parameter name

---

## Workflow Context and Status Broadcasting

When a node executes, it receives a context object and can broadcast status updates to the frontend. This is essential for real-time UI updates and per-workflow status scoping.

### Execution Context Structure

The backend passes a `context` dictionary to every node handler:

```python
context = {
    "nodes": List[Dict],           # All nodes in the workflow
    "edges": List[Dict],           # All edges in the workflow
    "session_id": str,             # Execution session ID
    "execution_id": str,           # Unique execution ID
    "workflow_id": str,            # Current workflow ID (for status scoping)
    "get_output_fn": Callable,     # Function to get node outputs
}
```

### Frontend: Passing Workflow ID

When executing a node from the frontend, include `workflow_id` in the request:

```typescript
// In WebSocketContext.tsx
const executeNodeAsync = useCallback(async (
    nodeId: string,
    nodeType: string,
    parameters: Record<string, any>,
    nodes?: any[],
    edges?: any[]
  ): Promise<any> => {
    const response = await sendRequest<any>('execute_node', {
      node_id: nodeId,
      node_type: nodeType,
      parameters,
      nodes,
      edges,
      workflow_id: currentWorkflowId  // CRITICAL: Include for status scoping
    }, timeoutMs);
    return response;
  }, [sendRequest, currentWorkflowId]);
```

**Why This Matters:**
- Without `workflow_id`, status updates are stored under `'unknown'` key
- Frontend retrieves status from `allNodeStatuses[currentWorkflowId][nodeId]`
- Mismatched workflow IDs cause status updates to be "lost" (stored but not displayed)

### Backend: Status Broadcasting

Use the `StatusBroadcaster` to send real-time updates to the frontend:

```python
from services.status_broadcaster import get_status_broadcaster

async def handle_my_node(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    workflow_id = context.get('workflow_id')  # Extract from context
    broadcaster = get_status_broadcaster()

    # Broadcast "executing" status
    await broadcaster.update_node_status(
        node_id,
        "executing",
        {"message": "Starting execution..."},
        workflow_id=workflow_id  # CRITICAL: Include workflow_id
    )

    # Do your work...
    result = do_something()

    # Broadcast "success" status
    await broadcaster.update_node_status(
        node_id,
        "success",
        {"message": "Completed", "result": result},
        workflow_id=workflow_id
    )

    return {"success": True, "result": result, ...}
```

### Status Types

| Status | Description | Visual Effect |
|--------|-------------|---------------|
| `idle` | Node is not executing | Default appearance |
| `executing` | Node is currently running | Cyan glow, pulse animation |
| `waiting` | Trigger node waiting for event | Cyan glow, pulse animation |
| `success` | Node completed successfully | Green border (brief) |
| `error` | Node execution failed | Red border, error message |

### Frontend: Reading Status

Components read status via the `useNodeStatus` hook:

```typescript
import { useNodeStatus } from '../contexts/WebSocketContext';

const MyNodeComponent: React.FC<NodeProps> = ({ id }) => {
  const nodeStatus = useNodeStatus(id);
  const executionStatus = nodeStatus?.status || 'idle';
  const isExecuting = executionStatus === 'executing';

  return (
    <div style={{
      animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none',
      boxShadow: isExecuting ? '0 0 10px cyan' : 'none'
    }}>
      {/* Node content */}
    </div>
  );
};
```

### Status Storage Architecture

```
Frontend                              Backend
────────                              ───────
allNodeStatuses: {                    StatusBroadcaster.broadcast({
  "workflow-123": {                     type: "node_status",
    "node-abc": {                       node_id: "node-abc",
      status: "executing",              workflow_id: "workflow-123",
      data: {...}                       data: {status: "executing", ...}
    }                                 })
  }
}
    ↑                                     │
    │         WebSocket                   │
    └─────────────────────────────────────┘
```

### Example: Tool Node Status Broadcasting

Tool nodes (executed by AI Agent) need proper status flow:

```python
# In ai.py - tool_executor callback
async def tool_executor(tool_name: str, tool_args: Dict) -> Any:
    config = tool_configs.get(tool_name, {})
    tool_node_id = config.get('node_id')

    # Broadcast "executing" to tool node
    if tool_node_id and broadcaster:
        await broadcaster.update_node_status(
            tool_node_id,
            "executing",
            {"message": f"Executing {tool_name}"},
            workflow_id=workflow_id  # From execute_agent closure
        )

    # Execute tool...
    result = await execute_tool(tool_name, tool_args, config)

    # Broadcast "success" to tool node
    if tool_node_id and broadcaster:
        await broadcaster.update_node_status(
            tool_node_id,
            "success",
            {"message": f"{tool_name} completed", "result": result},
            workflow_id=workflow_id
        )

    return result
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Status not updating | Missing `workflow_id` in frontend request | Add `workflow_id: currentWorkflowId` to execute request |
| Status stuck on "executing" | Success broadcast missing | Add success broadcast after execution |
| Wrong workflow shows status | `workflow_id` mismatch | Ensure frontend sends and backend uses same ID |
| Multiple nodes show same status | Broadcasting to wrong `node_id` | Verify correct node ID in broadcast call |

### Checklist for Status Broadcasting

- [ ] Frontend: Include `workflow_id` in execution request
- [ ] Backend: Extract `workflow_id` from context
- [ ] Backend: Pass `workflow_id` to all `update_node_status()` calls
- [ ] Backend: Broadcast "executing" at start
- [ ] Backend: Broadcast "success" or "error" at end
- [ ] Frontend: Use `useNodeStatus(id)` hook to read status

---

## Input & Output Panels

The parameter panel shows inputs from connected upstream nodes and allows drag-and-drop mapping.

### Input Section (`client/src/components/parameterPanel/InputSection.tsx`)

Shows outputs from nodes connected to the current node's input handles:
- Displays source node label and type
- Shows available output fields that can be dragged to parameters
- Config nodes inherit their parent's inputs (labeled "via Parent")

### Output Panel (`client/src/components/OutputPanel.tsx`)

Shows the schema of outputs the node produces:
- Used for drag-and-drop to downstream node parameters
- Schema defined in `outputs[].description` of node definition

### Documenting Output Schema

In your node definition, document output fields in the `description`:

```typescript
outputs: [{
  name: 'main',
  displayName: 'Output',
  type: 'main' as NodeConnectionType,
  description: 'response, model, provider, timestamp'  // Comma-separated fields
}]
```

### Sample Schemas for Common Nodes

Add sample schemas in `InputSection.tsx` for better drag-and-drop UX:

```typescript
const sampleSchemas: Record<string, Record<string, string>> = {
  aiAgent: {
    response: 'string',
    model: 'string',
    provider: 'string',
    iterations: 'number',
    timestamp: 'string'
  },
  httpRequest: {
    status: 'number',
    data: 'object',
    headers: 'object'
  },
  yourNewNode: {
    field1: 'string',
    field2: 'number',
    // ... document your output fields
  }
};
```

---

## Nodes Without Output Handles

Some nodes are input-only (like Console) and should not have output handles.

### Frontend: Hide Output Handle

In `client/src/components/SquareNode.tsx`, add your node type to `NO_OUTPUT_NODE_TYPES`:

```typescript
// Nodes that should not have output handles (input-only nodes)
const NO_OUTPUT_NODE_TYPES = ['console', 'yourInputOnlyNode'];
```

The output handle is conditionally rendered:

```tsx
{/* Square Output Handle - hidden for input-only nodes */}
{!NO_OUTPUT_NODE_TYPES.includes(type || '') && (
  <Handle
    id="output-main"
    type="source"
    position={Position.Right}
    // ...
  />
)}
```

### Backend: Special Handler for Connected Outputs

Input-only nodes typically need access to connected upstream outputs. Register them in `NodeExecutor._dispatch()`:

```python
# server/services/node_executor.py

async def _dispatch(self, node_id: str, node_type: str, params: Dict, context: Dict) -> Dict:
    # Check registry first
    handler = self._handlers.get(node_type)
    if handler:
        return await handler(node_id, node_type, params, context)

    # Special handlers needing connected outputs
    if node_type in ('pythonExecutor', 'javascriptExecutor', 'webhookResponse', 'console', 'yourNode'):
        outputs, source_nodes = await self._get_connected_outputs_with_info(context, node_id)
        if node_type == 'yourNode':
            return await handle_your_node(node_id, node_type, params, context, outputs, source_nodes)
        # ... other handlers
```

### Handler Signature for Connected Outputs

```python
async def handle_your_node(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    connected_outputs: Dict[str, Any] = None,  # Keyed by source node type
    source_nodes: list = None                   # List of {id, type, label}
) -> Dict[str, Any]:
    """Handle node with access to connected upstream outputs."""
    connected_outputs = connected_outputs or {}
    source_nodes = source_nodes or []

    # Merge all connected outputs into single dict
    input_data = {}
    for node_type, output in connected_outputs.items():
        if isinstance(output, dict):
            input_data.update(output)

    # Your logic here using input_data
    # ...
```

---

## Config Nodes

Config nodes (memory, tools) connect to parent nodes via special handles and inherit the parent's inputs.

### Define a Config Node

```typescript
// group must include 'memory' or 'tool'
myConfigNode: {
  displayName: 'My Config',
  name: 'myConfigNode',
  icon: '🔧',
  group: ['ai', 'memory'],        // 'memory' or 'tool' = config node
  version: 1,
  description: 'Configuration node',
  defaults: { name: 'Config', color: '#8b5cf6' },

  // Config nodes typically have no main input
  inputs: [],

  // Output connects to parent's config handle
  outputs: [{
    name: 'config',
    displayName: 'Config Output',
    type: 'main' as NodeConnectionType,
    description: 'Configuration data'
  }],

  properties: [
    // Config-specific parameters
  ]
}
```

### Parent Node with Config Handles

Config handles follow the pattern `input-<type>`:

```tsx
// In your parent node component (e.g., AIAgentNode.tsx)
<Handle
  id="input-memory"              // Config handle naming
  type="target"
  position={Position.Bottom}
  // ... styling
/>

<Handle
  id="input-tools"               // Another config handle
  type="target"
  position={Position.Bottom}
  // ... styling
/>
```

### Input Inheritance

When a config node is connected to a parent's config handle:
1. The parent node does NOT see the config node as an input
2. The config node DOES see the parent's main inputs (labeled "via Parent")

This is handled automatically by `InputSection.tsx` and `OutputPanel.tsx` using:
- `isConfigHandle()` - Detects config handles by pattern
- `isConfigNode()` - Detects config nodes by group

---

## Trigger Nodes

Trigger nodes wait for external events before completing execution.

### Define a Trigger Node

```typescript
myTrigger: {
  displayName: 'My Trigger',
  name: 'myTrigger',
  icon: '⚡',
  group: ['trigger'],
  version: 1,
  description: 'Waits for an event',
  defaults: { name: 'Trigger', color: '#f59e0b' },

  // Triggers typically have no input (they start workflows)
  inputs: [],

  outputs: [{
    name: 'main',
    displayName: 'Event',
    type: 'main' as NodeConnectionType,
    description: 'event_type, data, timestamp'
  }],

  properties: [
    // Filter parameters
    {
      displayName: 'Event Filter',
      name: 'eventFilter',
      type: 'string',
      default: '*',
      description: 'Filter pattern for events'
    }
  ]
}
```

### Register Trigger in Backend

In `server/services/event_waiter.py`:

```python
TRIGGER_REGISTRY: Dict[str, TriggerConfig] = {
    'myTrigger': TriggerConfig(
        node_type='myTrigger',
        event_type='my_event_received',    # Event to listen for
        display_name='My Event'
    ),
}

# Add filter builder
def build_my_filter(params: Dict) -> Callable[[Dict], bool]:
    """Build filter for my events."""
    event_filter = params.get('eventFilter', '*')

    def filter_fn(event_data: Dict) -> bool:
        if event_filter == '*':
            return True
        return event_data.get('type') == event_filter

    return filter_fn

FILTER_BUILDERS['myTrigger'] = build_my_filter
```

### Dispatch Events

From your event source (webhook, WebSocket, etc.):

```python
from services import event_waiter

# When event occurs
event_waiter.dispatch('my_event_received', {
    'type': 'some_type',
    'data': {...},
    'timestamp': datetime.now().isoformat()
})
```

### Example: Task Trigger (Agent Delegation)

The `taskTrigger` node demonstrates a complete trigger implementation that fires when delegated child agents complete:

**Frontend Definition** (`client/src/nodeDefinitions/workflowNodes.ts`):
```typescript
taskTrigger: {
  displayName: 'Task Completed',
  name: 'taskTrigger',
  icon: '📨',
  group: ['trigger', 'workflow'],
  version: 1,
  subtitle: 'Child Agent Completed',
  description: 'Triggers when a delegated child agent completes its task',
  defaults: { name: 'Task Completed', color: '#bd93f9' },
  inputs: [],
  outputs: [{
    name: 'main',
    displayName: 'Output',
    type: 'main' as NodeConnectionType,
    description: 'task_id, status, agent_name, result/error, parent_node_id'
  }],
  properties: [
    { displayName: 'Task ID Filter', name: 'task_id', type: 'string', default: '' },
    { displayName: 'Agent Name Filter', name: 'agent_name', type: 'string', default: '' },
    { displayName: 'Status Filter', name: 'status_filter', type: 'options', default: 'all',
      options: [{ name: 'All', value: 'all' }, { name: 'Completed Only', value: 'completed' }, { name: 'Errors Only', value: 'error' }] },
    { displayName: 'Parent Node ID', name: 'parent_node_id', type: 'string', default: '' }
  ]
}
```

**Backend Registry** (`server/services/event_waiter.py`):
```python
'taskTrigger': TriggerConfig(
    node_type='taskTrigger',
    event_type='task_completed',
    display_name='Task Completed'
),

def build_task_completed_filter(params: Dict) -> Callable[[Dict], bool]:
    """Build filter for task completed events."""
    task_id_filter = params.get('task_id', '')
    agent_name_filter = params.get('agent_name', '')
    status_filter = params.get('status_filter', 'all')
    parent_node_id = params.get('parent_node_id', '')

    def matches(data: Dict) -> bool:
        if task_id_filter and data.get('task_id') != task_id_filter:
            return False
        if agent_name_filter:
            if agent_name_filter.lower() not in data.get('agent_name', '').lower():
                return False
        if status_filter == 'completed' and data.get('status') != 'completed':
            return False
        if status_filter == 'error' and data.get('status') != 'error':
            return False
        if parent_node_id and data.get('parent_node_id') != parent_node_id:
            return False
        return True
    return matches

FILTER_BUILDERS['taskTrigger'] = build_task_completed_filter
```

**Event Dispatch** (`server/services/handlers/tools.py`):
```python
# In _execute_delegated_agent(), after child completes:
await broadcaster.send_custom_event('task_completed', {
    'task_id': task_id,
    'status': 'completed',  # or 'error'
    'agent_name': agent_label,
    'agent_node_id': node_id,
    'parent_node_id': config.get('parent_node_id', ''),
    'result': result.get('result', {}).get('response', ...),
    'workflow_id': workflow_id,
})
```

**Output Schema** (`client/src/components/parameterPanel/InputSection.tsx`):
```typescript
taskTrigger: {
  task_id: 'string',
  status: 'string',
  agent_name: 'string',
  agent_node_id: 'string',
  parent_node_id: 'string',
  result: 'string',
  error: 'string',
  workflow_id: 'string',
}
```

---

## AI Provider Nodes

AI provider nodes use a factory pattern for consistent structure. They connect to the AI service backend and dynamically fetch available models.

### Factory Pattern

AI chat models use `createBaseChatModel()` from `src/factories/baseChatModelFactory.ts`:

```typescript
import { createBaseChatModel, ChatModelConfig, STANDARD_PARAMETERS } from '../factories/baseChatModelFactory';

const myProviderConfig: ChatModelConfig = {
  providerId: 'myprovider',           // Internal identifier
  displayName: 'My Provider',         // Shown in UI
  icon: '🤖',                         // Emoji icon
  color: '#6366F1',                   // Accent color
  description: 'Provider description',
  models: [],                         // Empty - fetched dynamically
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
    // Provider-specific parameters...
  ]
};

export const aiModelNodes = {
  myProviderChatModel: createBaseChatModel(myProviderConfig)
};
```

### Standard Parameters

Available in `STANDARD_PARAMETERS`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.7 | Randomness (0-2) |
| `maxTokens` | number | 1000 | Response length limit |
| `topP` | number | 1 | Nucleus sampling |
| `topK` | number | 40 | Top-K sampling |
| `frequencyPenalty` | number | 0 | Token frequency penalty |
| `presencePenalty` | number | 0 | Token presence penalty |

### Backend Provider Configuration

Add to `server/services/ai.py`:

```python
from dataclasses import dataclass
from langchain_openai import ChatOpenAI

@dataclass
class ProviderConfig:
    name: str
    model_class: type
    api_key_param: str
    max_tokens_param: str
    detection_patterns: tuple
    default_model: str
    models_endpoint: str
    models_header_fn: Callable

# Header function for API authentication
def _myprovider_headers(api_key: str) -> dict:
    return {'Authorization': f'Bearer {api_key}'}

PROVIDER_CONFIGS = {
    'myprovider': ProviderConfig(
        name='myprovider',
        model_class=ChatOpenAI,
        api_key_param='api_key',
        max_tokens_param='max_tokens',
        detection_patterns=('myprovider',),
        default_model='default-model-id',
        models_endpoint='https://api.provider.com/models',
        models_header_fn=_myprovider_headers
    ),
}
```

### Model Fetching

Add model fetching logic in `AIService.fetch_models()`:

```python
elif provider == 'myprovider':
    response = await client.get(
        'https://api.provider.com/models',
        headers=_myprovider_headers(api_key)
    )
    response.raise_for_status()
    data = response.json()

    models = []
    for model in data.get('data', []):
        model_id = model.get('id', '')
        if model_id:
            models.append(model_id)

    return sorted(models)
```

### Provider Detection

Add to `server/constants.py`:

```python
def detect_ai_provider(node_type: str, parameters: dict = None) -> str:
    if 'myprovider' in node_type.lower():
        return 'myprovider'
    # ... other providers
    return 'openai'  # Default fallback
```

### Frontend Integration

1. **Dashboard.tsx** - Map to visual component:
   ```typescript
   } else if (type === 'myProviderChatModel') {
     types[type] = SquareNode;
   }
   ```

2. **ModelNode.tsx** - Credential mapping:
   ```typescript
   const CREDENTIAL_TO_PROVIDER = {
     'myProviderApi': 'myprovider'
   };
   ```

3. **CredentialsModal.tsx** - API key entry:
   ```typescript
   {
     id: 'myprovider',
     name: 'My Provider',
     icon: '🤖',
     fields: [{ name: 'apiKey', label: 'API Key', type: 'password', required: true }]
   }
   ```

### Complete Example: Adding Groq Provider

Groq provides ultra-fast LLM inference. Here's the complete implementation:

#### 1. Frontend Node Definition (`client/src/nodeDefinitions/aiModelNodes.ts`)

```typescript
import { createBaseChatModel, ChatModelConfig, STANDARD_PARAMETERS } from '../factories/baseChatModelFactory';

const groqConfig: ChatModelConfig = {
  providerId: 'groq',
  displayName: 'Groq',
  icon: '⚡',
  color: '#F55036',
  description: 'Groq - Ultra-fast LLM inference with Llama, Mixtral, and Gemma models',
  models: [],  // Fetched dynamically via API
  parameters: [
    STANDARD_PARAMETERS.temperature,
    STANDARD_PARAMETERS.maxTokens,
    STANDARD_PARAMETERS.topP,
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

export const aiModelNodes = {
  // ... other providers
  groqChatModel: createBaseChatModel(groqConfig)
};

export { groqConfig };
```

#### 2. Backend Provider Config (`server/services/ai.py`)

```python
from langchain_groq import ChatGroq

def _groq_headers(api_key: str) -> dict:
    return {'Authorization': f'Bearer {api_key}'}

PROVIDER_CONFIGS = {
    # ... other providers
    'groq': ProviderConfig(
        name='groq',
        model_class=ChatGroq,
        api_key_param='api_key',
        max_tokens_param='max_tokens',
        detection_patterns=('groq', 'llama', 'mixtral', 'gemma'),
        default_model='llama-3.3-70b-versatile',
        models_endpoint='https://api.groq.com/openai/v1/models',
        models_header_fn=_groq_headers
    ),
}
```

#### 3. Model Fetching (`server/services/ai.py` - in `fetch_models` method)

```python
elif provider == 'groq':
    response = await client.get(
        'https://api.groq.com/openai/v1/models',
        headers={'Authorization': f'Bearer {api_key}'}
    )
    response.raise_for_status()
    data = response.json()

    models = []
    for model in data.get('data', []):
        model_id = model.get('id', '')
        if model_id:
            models.append(model_id)

    return sorted(models)
```

#### 4. Chat Execution (`server/services/ai.py` - in `execute_chat` method)

```python
# Determine provider from node_type
if node_type == 'groqChatModel':
    provider = 'groq'
else:
    provider = self.detect_provider(model)
```

#### 5. Backend Constants (`server/constants.py`)

```python
AI_CHAT_MODEL_TYPES: FrozenSet[str] = frozenset([
    'openaiChatModel',
    'anthropicChatModel',
    'geminiChatModel',
    'openrouterChatModel',
    'groqChatModel',  # Add here
])

def detect_ai_provider(node_type: str, parameters: dict = None) -> str:
    # ... existing checks
    elif 'groq' in node_type.lower():
        return 'groq'
    # ... rest of function
```

#### 6. Frontend Provider Mapping (`client/src/components/ParameterRenderer.tsx`)

```typescript
const NODE_TYPE_TO_PROVIDER: Record<string, string> = {
  'openaiChatModel': 'openai',
  'anthropicChatModel': 'anthropic',
  // ... other providers
  'groqChatModel': 'groq'  // Add here
};
```

#### 7. Execution Service (`client/src/services/executionService.ts`)

```typescript
static isNodeTypeSupported(nodeType: string): boolean {
  const supportedTypes = [
    // AI Nodes
    'aiAgent',
    'openaiChatModel',
    'anthropicChatModel',
    'geminiChatModel',
    'openrouterChatModel',
    'groqChatModel',  // Add here
    // ... other nodes
  ];
  return supportedTypes.includes(nodeType);
}
```

#### 8. Credentials Modal (`client/src/components/CredentialsModal.tsx`)

```typescript
const PROVIDERS = [
  // ... other providers
  {
    id: 'groq',
    name: 'Groq',
    placeholder: 'gsk_...',
    color: '#F55036',
    desc: 'Ultra-fast LLM inference - Llama, Mixtral, Gemma'
  },
];
```

#### 9. Model Node Credential Mapping (`client/src/components/ModelNode.tsx`)

```typescript
const CREDENTIAL_TO_PROVIDER: Record<string, string> = {
  // ... other mappings
  'groqApi': 'groq'
};

// In provider detection fallback:
if (type?.includes('groq')) return 'groq';
```

#### 10. AI Provider Icons (`client/src/components/icons/AIProviderIcons.tsx`)

```typescript
import { Groq } from '@lobehub/icons';

// Groq uses Avatar variant (no Color variant available)
export const GroqIcon: React.FC<{ size?: number }> = ({ size = ICON_SIZE }) => (
  <Groq.Avatar size={size} />
);

export const AI_PROVIDER_ICONS: Record<string, React.FC<{ size?: number }>> = {
  // ... other icons
  groq: GroqIcon,
};
```

#### 11. Python Dependency (`server/requirements.txt`)

```
langchain-groq>=0.1.0
```

### OpenRouter Example

OpenRouter demonstrates advanced patterns including:
- OpenAI-compatible API with custom base_url
- Free/paid model grouping with `[FREE]` prefix
- Multi-provider model IDs (e.g., `openai/gpt-4o`)

See the [AI Chat Model Development Guide](../CLAUDE.md#ai-chat-model-development-guide) in CLAUDE.md for the complete OpenRouter implementation.

---

## AI Tool Nodes

AI Tool nodes provide capabilities that AI Agents can invoke during reasoning. They connect to the AI Agent's `input-tools` handle and define schemas that tell the LLM how to call them.

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

### Existing Tool Nodes

| Tool | Icon | Description |
|------|------|-------------|
| `calculatorTool` | `🔢` | Mathematical operations (add, subtract, multiply, divide, power, sqrt, mod, abs) |
| `currentTimeTool` | `🕐` | Get current date/time with timezone support |
| `webSearchTool` | `🔍` | Web search via DuckDuckGo (free) or Serper API |
| `androidTool` | `📱` | Android device control toolkit - aggregates connected Android service nodes |

### Define a Tool Node

Tool nodes are defined in `client/src/nodeDefinitions/toolNodes.ts`:

```typescript
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const toolNodes: Record<string, INodeTypeDescription> = {
  myCustomTool: {
    displayName: 'My Custom Tool',
    name: 'myCustomTool',
    icon: '🔧',
    group: ['ai', 'tool'],           // 'tool' = AI tool node
    version: 1,
    subtitle: 'Custom Operations',
    description: 'Allow AI Agent to perform custom operations',
    defaults: { name: 'My Tool', color: '#50fa7b' },

    // Tool nodes typically have no main input (they're passive)
    inputs: [],

    // Output connects to AI Agent's input-tools handle
    outputs: [{
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }],

    properties: [
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        default: 'my_custom_tool',
        required: true,
        description: 'Name the AI will use to call this tool'
      },
      {
        displayName: 'Description',
        name: 'toolDescription',
        type: 'string',
        default: 'Describe what this tool does for the AI',
        typeOptions: { rows: 2 },
        description: 'Describe the tool capabilities for the AI'
      },
      // Tool-specific parameters...
    ]
  }
};

// Add to TOOL_NODE_TYPES for identification
export const TOOL_NODE_TYPES = ['calculatorTool', 'currentTimeTool', 'webSearchTool', 'androidTool', 'myCustomTool'];
```

### Backend: Tool Schema

Add a Pydantic schema for your tool in `server/services/ai.py`:

```python
from pydantic import BaseModel, Field

class MyCustomToolSchema(BaseModel):
    """Schema for my custom tool."""
    operation: str = Field(description="The operation to perform")
    value: str = Field(description="The value to operate on")

def _get_tool_schema(tool_type: str) -> type:
    """Get Pydantic schema for tool type."""
    schemas = {
        'calculatorTool': CalculatorSchema,
        'currentTimeTool': CurrentTimeSchema,
        'webSearchTool': WebSearchSchema,
        'myCustomTool': MyCustomToolSchema,  # Add here
    }
    return schemas.get(tool_type)
```

### Backend: Tool Handler

Add a handler in `server/services/handlers/tools.py`:

```python
async def _execute_my_custom_tool(params: Dict[str, Any]) -> str:
    """Execute my custom tool."""
    operation = params.get('operation', '')
    value = params.get('value', '')

    # Your tool logic here
    result = f"Performed {operation} on {value}"

    return result

async def execute_tool(tool_type: str, tool_params: Dict, llm_params: Dict) -> str:
    """Dispatch tool execution to appropriate handler."""
    if tool_type == 'calculatorTool':
        return await _execute_calculator(llm_params)
    elif tool_type == 'currentTimeTool':
        return await _execute_current_time(llm_params)
    elif tool_type == 'webSearchTool':
        return await _execute_web_search(llm_params, tool_params)
    elif tool_type == 'myCustomTool':
        return await _execute_my_custom_tool(llm_params)  # Add here
    else:
        return f"Unknown tool type: {tool_type}"
```

### Android Toolkit Pattern

The `androidTool` demonstrates a special pattern for aggregating multiple nodes:

```
[Battery Monitor] --+
                    +--> [Android Toolkit] --> [AI Agent]
[WiFi Automation] --+
```

Key features:
- **Gateway Pattern**: Single tool node aggregates multiple service nodes
- **Dynamic Schema**: Schema built at runtime from connected services only
- **Service Routing**: Tool execution routes to appropriate connected node

The AI sees a single `android_device` tool with schema showing only connected services:
- `service_id`: Which service to use (e.g., "battery", "wifi_automation")
- `action`: Action to perform (e.g., "status", "enable", "disable")
- `parameters`: Action-specific parameters

### Tool Execution Flow

1. **Tool Discovery**: AI Agent scans edges for nodes connected to `input-tools` handle
2. **Schema Building**: `_get_tool_schema()` creates Pydantic schema for each tool type
3. **Tool Binding**: LangGraph binds tools to the LLM model
4. **LLM Decision**: LLM decides when to call tools based on user query
5. **Status Broadcast**: `executing_tool` status broadcast with tool_name for UI animation
6. **Tool Execution**: `execute_tool()` dispatches to appropriate handler
7. **Result Return**: Tool result returned to LLM for continued reasoning

### Checklist for New Tool Nodes

**Frontend:**
- [ ] Add tool definition in `client/src/nodeDefinitions/toolNodes.ts`
- [ ] Add to `TOOL_NODE_TYPES` array in same file
- [ ] Register in `client/src/nodeDefinitions.ts` (if not already importing toolNodes)

**Backend:**
- [ ] Add Pydantic schema in `server/services/ai.py` `_get_tool_schema()`
- [ ] Add handler function in `server/services/handlers/tools.py`
- [ ] Add dispatcher case in `execute_tool()` function
- [ ] Add to `AI_TOOL_TYPES` in `server/constants.py`

---

## Complete Examples

### Example 1: HTTP Request Node

**Frontend Definition:**
```typescript
httpRequest: {
  displayName: 'HTTP Request',
  name: 'httpRequest',
  icon: '🌐',
  group: ['utility'],
  version: 1,
  description: 'Make HTTP requests to external APIs',
  defaults: { name: 'HTTP', color: '#3b82f6' },
  inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
  outputs: [{
    name: 'main',
    displayName: 'Response',
    type: 'main',
    description: 'status, data, headers'
  }],
  properties: [
    { displayName: 'URL', name: 'url', type: 'string', required: true },
    { displayName: 'Method', name: 'method', type: 'options', default: 'GET',
      options: [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }] },
    { displayName: 'Body', name: 'body', type: 'string', typeOptions: { rows: 4 },
      displayOptions: { show: { method: ['POST'] } } }
  ]
}
```

**Backend Handler:**
```python
async def _execute_http_request(self, node_id: str, parameters: Dict) -> Dict:
    import httpx

    url = parameters.get('url', '')
    method = parameters.get('method', 'GET')
    body = parameters.get('body', '')

    async with httpx.AsyncClient(timeout=30) as client:
        if method == 'GET':
            response = await client.get(url)
        else:
            response = await client.post(url, content=body)

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "httpRequest",
        "result": {
            "status": response.status_code,
            "data": response.text,
            "headers": dict(response.headers)
        }
    }
```

### Example 2: Memory Config Node

The Simple Memory node uses markdown-based storage with optional vector DB archival.

**Frontend Definition:**
```typescript
simpleMemory: {
  displayName: 'Simple Memory',
  name: 'simpleMemory',
  icon: '🧠',
  group: ['skill', 'memory'],  // 'skill' = appears in AI Skills category
  version: 1,
  description: 'Markdown-based conversation memory with optional vector DB for long-term retrieval',
  defaults: { name: 'Memory', color: '#8b5cf6' },
  inputs: [],                 // No input - passive config node
  outputs: [{
    name: 'memory',
    displayName: 'Memory',
    type: 'main',
    description: 'session_id, messages, message_count'
  }],
  properties: [
    { displayName: 'Session ID', name: 'sessionId', type: 'string', default: 'default' },
    { displayName: 'Window Size', name: 'windowSize', type: 'number', default: 10,
      typeOptions: { minValue: 1, maxValue: 100 },
      description: 'Number of message pairs to keep in short-term memory' },
    { displayName: 'Conversation History', name: 'memoryContent', type: 'string',
      default: '# Conversation History\n\n*No messages yet.*\n',
      typeOptions: { rows: 15, editor: 'code', editorLanguage: 'markdown' },
      description: 'Recent conversation history (editable)' },
    { displayName: 'Enable Long-Term Memory', name: 'longTermEnabled', type: 'boolean',
      default: false, description: 'Archive old messages to vector DB for semantic retrieval' },
    { displayName: 'Retrieval Count', name: 'retrievalCount', type: 'number', default: 3,
      typeOptions: { minValue: 1, maxValue: 10 },
      displayOptions: { show: { longTermEnabled: [true] } },
      description: 'Number of relevant memories to retrieve from long-term storage' }
  ]
}
```

**Markdown Format:**
```markdown
# Conversation History

### **Human** (2025-01-30 14:23:45)
What is the weather like today?

### **Assistant** (2025-01-30 14:23:48)
I don't have access to real-time weather data...
```

**Backend Flow (in AI Agent handler):**
The AI Agent collects memory_data from connected Simple Memory node:
```python
# In handlers/ai.py - handle_ai_agent()
if target_handle == 'input-memory' and source_node.get('type') == 'simpleMemory':
    memory_params = await database.get_node_parameters(source_node_id) or {}
    memory_data = {
        'node_id': source_node_id,
        'session_id': memory_params.get('sessionId', 'default'),
        'window_size': int(memory_params.get('windowSize', 10)),
        'memory_content': memory_params.get('memoryContent', '# Conversation History\n\n*No messages yet.*\n'),
        'long_term_enabled': memory_params.get('longTermEnabled', False),
        'retrieval_count': int(memory_params.get('retrievalCount', 3))
    }
```

**Memory Processing (in ai.py):**
```python
# Parse markdown to LangChain messages
history_messages = _parse_memory_markdown(memory_content)

# After AI response, append and trim
updated_content = _append_to_memory_markdown(updated_content, 'human', prompt)
updated_content = _append_to_memory_markdown(updated_content, 'ai', response_content)
updated_content, removed_texts = _trim_markdown_window(updated_content, window_size)

# Archive to vector DB if enabled
if removed_texts and memory_data.get('long_term_enabled'):
    store = _get_memory_vector_store(session_id)  # InMemoryVectorStore + HuggingFaceEmbeddings
    store.add_texts(removed_texts)

# Save updated markdown to node parameters
await database.save_node_parameters(memory_node_id, {'memoryContent': updated_content})
```

---

## Checklist for New Nodes

### Frontend
- [ ] Create node definition in `client/src/nodeDefinitions/`
- [ ] Register in `client/src/nodeDefinitions.ts`
- [ ] Map to visual component in `Dashboard.tsx`
- [ ] **Add to supported types in `executionService.ts`** (CRITICAL - enables Run button)
- [ ] Add output schema in `InputSection.tsx` (for drag-and-drop UX)
- [ ] For input-only nodes: Add to `NO_OUTPUT_NODE_TYPES` in `SquareNode.tsx`

### Backend
- [ ] Add handler in `server/services/handlers/` (appropriate file)
- [ ] Export handler in `server/services/handlers/__init__.py`
- [ ] Register in `NodeExecutor._build_handler_registry()` OR add to special handlers in `_dispatch()`
- [ ] For nodes needing connected outputs: Use `_get_connected_outputs_with_info()` pattern
- [ ] For triggers: Register in `event_waiter.py` TRIGGER_REGISTRY
- [ ] For triggers: Add filter builder function

### Template Resolution
- [ ] If node uses template parameters: Templates are auto-resolved by ParameterResolver
- [ ] If node needs raw template values: Use different parameter name to avoid resolution
- [ ] Document template-compatible parameters in node description

### AI Provider Nodes (additional steps)

**Frontend:**
- [ ] Add ChatModelConfig in `client/src/nodeDefinitions/aiModelNodes.ts`
- [ ] Export via `createBaseChatModel()` factory
- [ ] Add to `NODE_TYPE_TO_PROVIDER` in `client/src/components/ParameterRenderer.tsx`
- [ ] Add to supported types in `client/src/services/executionService.ts`
- [ ] Add credential mapping in `client/src/components/ModelNode.tsx` (CREDENTIAL_TO_PROVIDER)
- [ ] Add provider fallback detection in `ModelNode.tsx` (type?.includes check)
- [ ] Add credentials entry in `client/src/components/CredentialsModal.tsx`
- [ ] Add provider icon in `client/src/components/icons/AIProviderIcons.tsx` (if using @lobehub/icons)

**Backend:**
- [ ] Add LangChain dependency in `server/requirements.txt` (e.g., `langchain-groq>=0.1.0`)
- [ ] Import model class in `server/services/ai.py` (e.g., `from langchain_groq import ChatGroq`)
- [ ] Add header function in `server/services/ai.py` (e.g., `_groq_headers()`)
- [ ] Add ProviderConfig in `PROVIDER_CONFIGS` dict
- [ ] Add model fetching case in `AIService.fetch_models()`
- [ ] Add node type check in `AIService.execute_chat()` for provider detection
- [ ] Add to `AI_CHAT_MODEL_TYPES` in `server/constants.py`
- [ ] Add provider detection in `detect_ai_provider()` in `server/constants.py`

### Documentation
- [ ] Add to node count in `CLAUDE.md`
- [ ] Document in appropriate section of `CLAUDE.md`
- [ ] For AI providers: Update AI Chat Models section
- [ ] Add to workflow-schema.md supported node types
