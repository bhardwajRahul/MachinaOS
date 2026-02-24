# Dual-Purpose Tool Node Creation Guide

This guide provides a complete walkthrough for creating **dual-purpose nodes** - nodes that work both as standalone workflow nodes AND as AI Agent/Zeenie tools. This pattern allows existing workflow nodes to be connected directly to an AI Agent's `input-tools` handle, where the LLM fills in the node's parameter schema.

> **Related Documentation:**
> - [AI Agent Tool Node Creation Guide](./ai_tool_node_creation.md) - Dedicated tool nodes (passive, tool-only)
> - [Node Creation Guide](./node_creation.md) - General node creation patterns
> - [CLAUDE.md](../CLAUDE.md) - Project overview and architecture

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dual-Purpose vs Dedicated Tool Nodes](#dual-purpose-vs-dedicated-tool-nodes)
3. [Creating a Dual-Purpose Tool Node](#creating-a-dual-purpose-tool-node)
4. [Backend Implementation](#backend-implementation)
5. [Complete Example: WhatsApp Nodes](#complete-example-whatsapp-nodes)
6. [Checklist](#checklist)

---

## Architecture Overview

### Dual-Purpose Node Design

```
                    ┌─────────────────────────────────────────┐
                    │         Dual-Purpose Node               │
                    │         (e.g., whatsappSend)            │
                    │                                         │
   Workflow Input ──┤  input-main                             │
                    │         │                               │
                    │         ▼                               │
                    │   ┌───────────┐   ┌───────────────────┐ │
                    │   │ Parameters│   │ Tool Output       │─┼──→ AI Agent input-tools
                    │   └───────────┘   └───────────────────┘ │
                    │         │                               │
                    │         ▼                               │
   Workflow Output ◄┼── output-main                           │
                    │                                         │
                    └─────────────────────────────────────────┘
```

### Two Usage Modes

**Mode 1: Workflow Node**
```
[Trigger] → [WhatsApp Send] → [Next Node]
                  │
           Executes with configured parameters
```

**Mode 2: AI Tool**
```
[WhatsApp Send] ──(tool output)──→ [AI Agent input-tools]
                                        │
                              LLM fills parameter schema
                              Tool handler executes
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Node Definition | `client/src/nodeDefinitions/*.ts` | Frontend structure with both outputs |
| Tool Schema | `server/services/ai.py` | Pydantic schema for LLM |
| Tool Handler | `server/services/handlers/tools.py` | Tool execution logic |
| Node Handler | `server/services/handlers/*.py` | Workflow execution logic |
| Execution Logic | `server/services/execution/models.py` | Dynamic exclusion when used as tool |

---

## Dual-Purpose vs Dedicated Tool Nodes

### Dedicated Tool Nodes (Passive)

Nodes that ONLY work as AI tools, not as workflow nodes.

**Characteristics:**
- `inputs: []` - No main input
- `outputs: [{ name: 'tool' }]` - Single tool output
- Added to `AI_TOOL_TYPES` constant
- Excluded from workflow execution via `CONFIG_NODE_TYPES`

**Examples:** `calculatorTool`, `currentTimeTool`, `duckduckgoSearch`

### Dual-Purpose Tool Nodes (Active)

Nodes that work BOTH as workflow nodes AND as AI tools.

**Characteristics:**
- Has main input AND main output for workflow data flow
- Has additional `tool` output for AI Agent connection
- `group` includes `'tool'` marker
- NOT in `AI_TOOL_TYPES` (would break workflow execution)
- Dynamically excluded when connected to `input-tools` handle

**Examples:** `whatsappSend`, `whatsappDb`, `twitterSend`, `twitterSearch`, `twitterUser`, `httpRequest`, `pythonExecutor`, `javascriptExecutor`, `addLocations`, `showNearbyPlaces`, `braveSearch`, `serperSearch`, `perplexitySearch`

### Comparison Table

| Feature | Dedicated Tool | Dual-Purpose Tool |
|---------|----------------|-------------------|
| Workflow execution | No | Yes |
| AI tool usage | Yes | Yes |
| Main input | No | Yes |
| Main output | No | Yes |
| Tool output | Yes | Yes |
| In `AI_TOOL_TYPES` | Yes | **No** |
| Group array | `['ai', 'tool']` | `['category', 'tool']` |

---

## Creating a Dual-Purpose Tool Node

### Step 1: Frontend Node Definition

Add/modify the node definition with both workflow handles AND tool output:

```typescript
// client/src/nodeDefinitions/myNodes.ts
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const myNodes: Record<string, INodeTypeDescription> = {
  myDualPurposeNode: {
    displayName: 'My Node',
    name: 'myDualPurposeNode',
    icon: '...',
    // CRITICAL: Include 'tool' in group for dual-purpose behavior
    group: ['myCategory', 'tool'],
    version: 1,
    subtitle: 'Description',
    description: 'Works as workflow node and AI tool',
    defaults: { name: 'My Node', color: '#6366f1' },

    // Main input for workflow data flow
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Trigger input'
    }],

    // BOTH outputs: main for workflow, tool for AI Agent
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Result output'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],

    // Full parameter schema - LLM will fill these when used as tool
    properties: [
      {
        displayName: 'Action',
        name: 'action',
        type: 'options',
        default: 'default_action',
        options: [
          { name: 'Action 1', value: 'action1' },
          { name: 'Action 2', value: 'action2' }
        ],
        description: 'Action to perform'
      },
      {
        displayName: 'Parameter',
        name: 'param1',
        type: 'string',
        default: '',
        description: 'Required parameter'
      },
      // ... more parameters
    ]
  }
};
```

### Step 2: Define Tool Schema (Backend)

In `server/services/ai.py`, add the Pydantic schema in `_get_tool_schema()`:

```python
from pydantic import BaseModel, Field
from typing import Optional

def _get_tool_schema(node_type: str) -> Optional[type]:
    """Get Pydantic schema for tool type."""

    # ... existing schemas ...

    # My dual-purpose node schema
    if node_type == 'myDualPurposeNode':
        class MyNodeSchema(BaseModel):
            """Description for LLM to understand the tool."""
            action: str = Field(
                default="action1",
                description="Action to perform: 'action1' or 'action2'"
            )
            param1: str = Field(
                description="Required parameter description"
            )
            optional_param: Optional[str] = Field(
                default=None,
                description="Optional parameter"
            )
        return MyNodeSchema

    return None
```

**Schema Design Tips:**
- Use snake_case for field names (LLM convention)
- Provide clear descriptions with examples
- Use `Optional` for non-required fields
- Include validation in Field() where appropriate

### Step 3: Add Tool Handler (Backend)

In `server/services/handlers/tools.py`:

```python
from typing import Dict, Any
from core.logging import get_logger

logger = get_logger(__name__)


async def _execute_my_dual_purpose_node(
    tool_args: Dict[str, Any],
    node_params: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute my dual-purpose node as a tool.

    Args:
        tool_args: LLM-provided arguments matching the schema
        node_params: Node configuration parameters (from node definition)

    Returns:
        Dict with execution result
    """
    # Import the existing node handler
    from services.handlers.my_handlers import handle_my_node

    # Map LLM args (snake_case) to node params (camelCase)
    parameters = {
        'action': tool_args.get('action', 'action1'),
        'param1': tool_args.get('param1', ''),
        'optionalParam': tool_args.get('optional_param', ''),
    }

    # Validate required fields
    if not parameters['param1']:
        return {"error": "param1 is required"}

    logger.info(f"[MyNode Tool] Executing {parameters['action']}...")

    try:
        # Call the existing node handler
        result = await handle_my_node(
            node_id="tool_my_node",
            node_type="myDualPurposeNode",
            parameters=parameters,
            context={}
        )

        if result.get('success'):
            return {
                "success": True,
                "action": parameters['action'],
                "result": result.get('result', {})
            }
        else:
            return {"error": result.get('error', 'Unknown error')}

    except Exception as e:
        logger.error(f"[MyNode Tool] Error: {e}")
        return {"error": f"Execution failed: {str(e)}"}
```

### Step 4: Register in Tool Dispatcher

In `server/services/handlers/tools.py`, add to `execute_tool()`:

```python
async def execute_tool(tool_name: str, tool_args: Dict[str, Any],
                       config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a tool by name using the appropriate handler."""
    node_type = config.get('node_type', '')

    # ... existing tool handlers ...

    # My dual-purpose node (existing node used as tool)
    if node_type == 'myDualPurposeNode':
        return await _execute_my_dual_purpose_node(tool_args, config.get('parameters', {}))

    # Generic fallback
    logger.warning(f"[Tool] Unknown tool type: {node_type}")
    return await _execute_generic(tool_args, config)
```

### Step 5: DO NOT Add to AI_TOOL_TYPES

**Important:** Dual-purpose nodes should NOT be added to `AI_TOOL_TYPES` in `server/constants.py`.

Why? Because `AI_TOOL_TYPES` is included in `CONFIG_NODE_TYPES`, which excludes nodes from independent workflow execution. Adding a dual-purpose node there would break its workflow functionality.

The execution engine dynamically detects when a node is connected to `input-tools` handle and excludes it from parallel execution in that specific workflow only.

---

## Backend Execution Logic

### Dynamic Tool Detection

The execution engine in `server/services/execution/models.py` dynamically detects tools:

```python
# In ExecutionContext.create()
# Nodes connected to AI Agent/Zeenie config handles are sub-nodes
# These handles: input-memory, input-tools, input-skill
if target in ai_agent_node_ids and source and target_handle:
    if target_handle in ('input-memory', 'input-tools', 'input-skill'):
        subnode_ids.add(source)

# Skip toolkit sub-nodes - they execute only via toolkit tool calls
if node_id in subnode_ids:
    continue
```

This means:
1. When `whatsappSend` is used in a normal workflow → executes independently
2. When `whatsappSend` is connected to AI Agent's `input-tools` → excluded from independent execution, only executes via tool call

---

## Complete Example: WhatsApp Nodes

The `whatsappSend` and `whatsappDb` nodes are canonical examples of dual-purpose tools.

### Frontend Definition (whatsappNodes.ts)

```typescript
whatsappSend: {
  displayName: 'WhatsApp Send',
  name: 'whatsappSend',
  icon: WHATSAPP_SEND_ICON,
  group: ['whatsapp', 'tool'],  // Include 'tool' for dual-purpose
  version: 1,
  subtitle: 'Send WhatsApp Message',
  description: 'Send text, media, location, or contact messages via WhatsApp',
  defaults: { name: 'WhatsApp Send', color: '#25D366' },

  // Main input for workflow
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Message input'
  }],

  // Both outputs
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Message output'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],

  // Full parameter schema
  properties: [
    {
      displayName: 'Send To',
      name: 'recipientType',
      type: 'options',
      options: [
        { name: 'Phone Number', value: 'phone' },
        { name: 'Group', value: 'group' }
      ],
      default: 'phone'
    },
    {
      displayName: 'Phone Number',
      name: 'phone',
      type: 'string',
      default: '',
      displayOptions: { show: { recipientType: ['phone'] } }
    },
    {
      displayName: 'Message Type',
      name: 'messageType',
      type: 'options',
      options: [
        { name: 'Text', value: 'text' },
        { name: 'Image', value: 'image' },
        { name: 'Location', value: 'location' },
        // ...
      ],
      default: 'text'
    },
    // ... more parameters
  ]
}
```

### Backend Schema (ai.py)

```python
if node_type == 'whatsappSend':
    class WhatsAppSendSchema(BaseModel):
        """Send WhatsApp messages to contacts or groups."""
        recipient_type: str = Field(
            default="phone",
            description="Send to: 'phone' for individual or 'group' for group chat"
        )
        phone: Optional[str] = Field(
            default=None,
            description="Phone number without + prefix (e.g., 1234567890). Required for recipient_type='phone'"
        )
        group_id: Optional[str] = Field(
            default=None,
            description="Group JID (e.g., 123456789@g.us). Required for recipient_type='group'"
        )
        message_type: str = Field(
            default="text",
            description="Message type: 'text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact'"
        )
        message: Optional[str] = Field(
            default=None,
            description="Text message content. Required for message_type='text'"
        )
        media_url: Optional[str] = Field(
            default=None,
            description="URL for media (image/video/audio/document/sticker)"
        )
        caption: Optional[str] = Field(
            default=None,
            description="Caption for media messages"
        )
        latitude: Optional[float] = Field(default=None, description="Latitude for location")
        longitude: Optional[float] = Field(default=None, description="Longitude for location")
        location_name: Optional[str] = Field(default=None, description="Location name")
        address: Optional[str] = Field(default=None, description="Address")
        contact_name: Optional[str] = Field(default=None, description="Contact name")
        vcard: Optional[str] = Field(default=None, description="vCard 3.0 format")
    return WhatsAppSendSchema
```

### Backend Handler (tools.py)

```python
async def _execute_whatsapp_send(args: Dict[str, Any],
                                  node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Send WhatsApp message with full message type support."""
    from services.handlers.whatsapp import handle_whatsapp_send

    # Map LLM args (snake_case) to node params (camelCase)
    parameters = {
        'recipientType': args.get('recipient_type', 'phone'),
        'phone': args.get('phone', ''),
        'group_id': args.get('group_id', ''),
        'messageType': args.get('message_type', 'text'),
        'message': args.get('message', ''),
        'mediaSource': 'url' if args.get('media_url') else 'none',
        'mediaUrl': args.get('media_url', ''),
        'caption': args.get('caption', ''),
        'latitude': args.get('latitude'),
        'longitude': args.get('longitude'),
        'locationName': args.get('location_name', ''),
        'address': args.get('address', ''),
        'contactName': args.get('contact_name', ''),
        'vcard': args.get('vcard', ''),
    }

    # Validate based on message type
    recipient_type = parameters['recipientType']
    message_type = parameters['messageType']

    if recipient_type == 'phone' and not parameters['phone']:
        return {"error": "Phone number is required for recipient_type='phone'"}
    if recipient_type == 'group' and not parameters['group_id']:
        return {"error": "Group ID is required for recipient_type='group'"}
    if message_type == 'text' and not parameters['message']:
        return {"error": "Message content is required for message_type='text'"}
    # ... more validation

    try:
        result = await handle_whatsapp_send(
            node_id="tool_whatsapp_send",
            node_type="whatsappSend",
            parameters=parameters,
            context={}
        )

        if result.get('success'):
            return {
                "success": True,
                "recipient": parameters['phone'] or parameters['group_id'],
                "message_type": message_type,
                "details": result.get('result', {})
            }
        else:
            return {"error": result.get('error', 'Unknown error')}

    except Exception as e:
        logger.error(f"[WhatsApp Tool] Error: {e}")
        return {"error": f"WhatsApp send failed: {str(e)}"}
```

### WhatsApp DB Node (Multi-Operation Pattern)

The `whatsappDb` node demonstrates a multi-operation pattern with 6 different operations in a single dual-purpose node.

**Frontend Definition:**
```typescript
whatsappDb: {
  displayName: 'WhatsApp DB',
  name: 'whatsappDb',
  icon: DATABASE_ICON,
  group: ['whatsapp', 'tool'],
  version: 1,
  description: 'Query WhatsApp database - contacts, groups, messages',

  inputs: [{ name: 'main', type: 'main' }],
  outputs: [
    { name: 'main', type: 'main', description: 'Query result' },
    { name: 'tool', type: 'main', description: 'Connect to AI Agent tool handle' }
  ],

  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      default: 'chat_history',
      options: [
        { name: 'Chat History', value: 'chat_history' },
        { name: 'Search Groups', value: 'search_groups' },
        { name: 'Get Group Info', value: 'get_group_info' },
        { name: 'Get Contact Info', value: 'get_contact_info' },
        { name: 'List Contacts', value: 'list_contacts' },
        { name: 'Check Contacts', value: 'check_contacts' },
      ],
    },
    // Conditional parameters per operation using displayOptions...
  ]
}
```

**Backend Schema (ai.py):**
```python
if node_type == 'whatsappDb':
    class WhatsAppDbSchema(BaseModel):
        """Query WhatsApp database - contacts, groups, messages."""
        operation: str = Field(
            default="chat_history",
            description="Operation: 'chat_history', 'search_groups', 'get_group_info', 'get_contact_info', 'list_contacts', 'check_contacts'"
        )
        # chat_history params
        chat_type: Optional[str] = Field(default="individual", description="'individual' or 'group'")
        phone: Optional[str] = Field(default=None, description="Phone number for individual chat")
        group_id: Optional[str] = Field(default=None, description="Group JID for group operations")
        limit: Optional[int] = Field(default=50, description="Max messages (1-500)")
        offset: Optional[int] = Field(default=0, description="Pagination offset")
        message_filter: Optional[str] = Field(default="all", description="'all' or 'text_only'")
        # contact params
        query: Optional[str] = Field(default=None, description="Search query for contacts/groups")
        phones: Optional[str] = Field(default=None, description="Comma-separated phones for check_contacts")
    return WhatsAppDbSchema
```

**Backend Handler (tools.py):**
```python
async def _execute_whatsapp_db(args: Dict[str, Any], node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute WhatsApp DB query operations."""
    from services.handlers.whatsapp import handle_whatsapp_db

    operation = args.get('operation', 'chat_history')

    # Map LLM args to node parameters
    parameters = {
        'operation': operation,
        'chatType': args.get('chat_type', 'individual'),
        'phone': args.get('phone', ''),
        'group_id': args.get('group_id', ''),
        'limit': args.get('limit', 50),
        'offset': args.get('offset', 0),
        'messageFilter': args.get('message_filter', 'all'),
        'query': args.get('query', ''),
        'phones': args.get('phones', ''),
        'groupIdForInfo': args.get('group_id', ''),
        'contactPhone': args.get('phone', ''),
    }

    result = await handle_whatsapp_db(
        node_id="tool_whatsapp_db",
        node_type="whatsappDb",
        parameters=parameters,
        context={}
    )

    if result.get('success'):
        return {"success": True, "operation": operation, **result.get('result', {})}
    return {"error": result.get('error', 'Query failed')}
```

### Skill Documentation (SKILL.md)

Update the skill documentation to reflect tool capabilities:

```markdown
---
name: whatsapp-skill
description: Send WhatsApp messages, query contacts/groups, retrieve chat history.
allowed-tools: whatsapp_send whatsapp_db
metadata:
  author: machina
  version: "3.0"
  category: messaging
---

# WhatsApp Messaging Skill

## whatsapp_send

Send messages to contacts or groups.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| recipient_type | string | Yes | "phone" or "group" |
| phone | string | If phone | Phone number without + prefix |
| group_id | string | If group | Group JID |
| message_type | string | Yes | "text", "image", "video", etc. |
| message | string | If text | Text content |
| media_url | string | If media | URL for media |

## whatsapp_db

Query WhatsApp database - contacts, groups, messages.

### Operations

| Operation | Description |
|-----------|-------------|
| chat_history | Retrieve message history |
| search_groups | Search groups by name |
| get_group_info | Get group details with participant names |
| get_contact_info | Get contact info (name, phone, photo) |
| list_contacts | List all contacts with saved names |
| check_contacts | Check WhatsApp registration status |

### Examples

**Get chat history:**
```json
{
  "operation": "chat_history",
  "chat_type": "individual",
  "phone": "1234567890",
  "limit": 20
}
```

**Find contact by name:**
```json
{
  "operation": "list_contacts",
  "query": "mom"
}
```

**Get group participants:**
```json
{
  "operation": "get_group_info",
  "group_id": "120363123456789@g.us"
}
```
```

---

## Complete Example: Twitter/X Nodes

The `twitterSend`, `twitterSearch`, and `twitterUser` nodes are examples of dual-purpose tools using OAuth 2.0 authentication and the XDK Python SDK.

### Frontend Definition (twitterNodes.ts)

```typescript
twitterSend: {
  displayName: 'Twitter Send',
  name: 'twitterSend',
  icon: TWITTER_ICON,
  group: ['social', 'tool'],  // Include 'tool' for dual-purpose
  version: 1,
  subtitle: 'Post to Twitter/X',
  description: 'Post tweets, reply, retweet, like/unlike, delete',
  defaults: { name: 'Twitter Send', color: '#000000' },

  // Main input for workflow
  inputs: [{
    name: 'main',
    displayName: 'Input',
    type: 'main' as NodeConnectionType,
    description: 'Trigger input'
  }],

  // Both outputs
  outputs: [
    {
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Action result'
    },
    {
      name: 'tool',
      displayName: 'Tool',
      type: 'main' as NodeConnectionType,
      description: 'Connect to AI Agent tool handle'
    }
  ],

  properties: [
    {
      displayName: 'Action',
      name: 'action',
      type: 'options',
      default: 'tweet',
      options: [
        { name: 'Post Tweet', value: 'tweet' },
        { name: 'Reply', value: 'reply' },
        { name: 'Retweet', value: 'retweet' },
        { name: 'Like', value: 'like' },
        { name: 'Unlike', value: 'unlike' },
        { name: 'Delete', value: 'delete' }
      ]
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      description: 'Tweet text (max 280 characters)',
      displayOptions: { show: { action: ['tweet', 'reply'] } }
    },
    {
      displayName: 'Tweet ID',
      name: 'tweet_id',
      type: 'string',
      default: '',
      description: 'Target tweet ID',
      displayOptions: { show: { action: ['retweet', 'like', 'unlike', 'delete'] } }
    },
    {
      displayName: 'Reply To ID',
      name: 'reply_to_id',
      type: 'string',
      default: '',
      description: 'Tweet ID to reply to',
      displayOptions: { show: { action: ['reply'] } }
    }
  ]
}
```

### Backend Schema (ai.py)

```python
if node_type == 'twitterSend':
    class TwitterSendSchema(BaseModel):
        """Post tweets, reply, retweet, like/unlike, and delete on Twitter/X."""
        action: str = Field(
            default="tweet",
            description="Action: 'tweet', 'reply', 'retweet', 'like', 'unlike', 'delete'"
        )
        text: Optional[str] = Field(
            default=None,
            description="Tweet text (max 280 chars). Required for 'tweet' and 'reply'"
        )
        tweet_id: Optional[str] = Field(
            default=None,
            description="Target tweet ID. Required for 'retweet', 'like', 'unlike', 'delete'"
        )
        reply_to_id: Optional[str] = Field(
            default=None,
            description="Tweet ID to reply to. Required for 'reply'"
        )
    return TwitterSendSchema

if node_type == 'twitterSearch':
    class TwitterSearchSchema(BaseModel):
        """Search recent tweets on Twitter/X."""
        query: str = Field(
            description="Search query (supports operators: from:, to:, #, @, OR, -exclude, lang:, has:links, has:media)"
        )
        max_results: int = Field(
            default=10,
            description="Maximum results (10-100)"
        )
    return TwitterSearchSchema

if node_type == 'twitterUser':
    class TwitterUserSchema(BaseModel):
        """Look up Twitter/X user profiles and social connections."""
        operation: str = Field(
            default="me",
            description="Operation: 'me', 'by_username', 'by_id', 'followers', 'following'"
        )
        username: Optional[str] = Field(
            default=None,
            description="Twitter username without @ (for 'by_username')"
        )
        user_id: Optional[str] = Field(
            default=None,
            description="Twitter user ID (for 'by_id', 'followers', 'following')"
        )
        max_results: int = Field(
            default=100,
            description="Max results for followers/following (1-1000)"
        )
    return TwitterUserSchema
```

### Backend Handler (tools.py)

```python
async def _execute_twitter_send(args: Dict[str, Any], node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Twitter send actions."""
    from services.handlers.twitter import handle_twitter_send

    parameters = {
        'action': args.get('action', 'tweet'),
        'text': args.get('text', ''),
        'tweet_id': args.get('tweet_id', ''),
        'reply_to_id': args.get('reply_to_id', ''),
    }

    action = parameters['action']
    if action in ('tweet', 'reply') and not parameters['text']:
        return {"error": "Text is required for tweet/reply actions"}
    if action in ('retweet', 'like', 'unlike', 'delete') and not parameters['tweet_id']:
        return {"error": "tweet_id is required for this action"}
    if action == 'reply' and not parameters['reply_to_id']:
        return {"error": "reply_to_id is required for reply action"}

    result = await handle_twitter_send(
        node_id="tool_twitter_send",
        node_type="twitterSend",
        parameters=parameters,
        context={}
    )

    if result.get('success'):
        return {"success": True, "action": action, "result": result.get('result', {})}
    return {"error": result.get('error', 'Twitter action failed')}


async def _execute_twitter_search(args: Dict[str, Any], node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Twitter search."""
    from services.handlers.twitter import handle_twitter_search

    parameters = {
        'query': args.get('query', ''),
        'max_results': min(args.get('max_results', 10), 100),
    }

    if not parameters['query']:
        return {"error": "Search query is required"}

    result = await handle_twitter_search(
        node_id="tool_twitter_search",
        node_type="twitterSearch",
        parameters=parameters,
        context={}
    )

    if result.get('success'):
        return result.get('result', {})
    return {"error": result.get('error', 'Search failed')}


async def _execute_twitter_user(args: Dict[str, Any], node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Twitter user lookup."""
    from services.handlers.twitter import handle_twitter_user

    parameters = {
        'operation': args.get('operation', 'me'),
        'username': args.get('username', ''),
        'user_id': args.get('user_id', ''),
        'max_results': min(args.get('max_results', 100), 1000),
    }

    operation = parameters['operation']
    if operation == 'by_username' and not parameters['username']:
        return {"error": "Username is required for by_username operation"}
    if operation == 'by_id' and not parameters['user_id']:
        return {"error": "user_id is required for by_id operation"}

    result = await handle_twitter_user(
        node_id="tool_twitter_user",
        node_type="twitterUser",
        parameters=parameters,
        context={}
    )

    if result.get('success'):
        return result.get('result', {})
    return {"error": result.get('error', 'User lookup failed')}
```

### XDK SDK Authentication Pattern

Twitter nodes use OAuth 2.0 PKCE authentication stored via `auth_service`:

```python
# In server/services/handlers/twitter.py
async def _get_twitter_client() -> Client:
    """Get authenticated Twitter client from stored OAuth 2.0 credentials."""
    from core.container import container
    auth_service = container.auth_service()
    access_token = await auth_service.get_api_key("twitter_access_token")
    if not access_token:
        raise ValueError("Twitter not connected. Please authenticate via Credentials.")
    # OAuth 2.0 user token (not bearer_token which is app-only)
    return Client(access_token=access_token)
```

### Skill Documentation (SKILL.md)

```markdown
---
name: twitter-send-skill
description: Post tweets, reply, retweet, like/unlike, delete on Twitter/X.
allowed-tools: twitter_send
metadata:
  author: machina
  version: "1.0"
  category: social
---

# Twitter Send Tool

## twitter_send

Post and interact with tweets on Twitter/X.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | 'tweet', 'reply', 'retweet', 'like', 'unlike', 'delete' |
| text | string | If tweet/reply | Tweet text (max 280 chars) |
| tweet_id | string | If retweet/like/unlike/delete | Target tweet ID |
| reply_to_id | string | If reply | Tweet ID to reply to |

### Examples

**Post a tweet:**
```json
{"action": "tweet", "text": "Hello from AI!"}
```

**Reply to a tweet:**
```json
{"action": "reply", "text": "Great point!", "reply_to_id": "1234567890"}
```

**Like a tweet:**
```json
{"action": "like", "tweet_id": "1234567890"}
```
```

---

## Checklist

### Frontend

- [ ] Add node definition with both `main` input AND outputs (`main` + `tool`)
- [ ] Include `'tool'` in the `group` array
- [ ] Define comprehensive `properties` (LLM will fill these)
- [ ] Ensure node renders correctly (SquareNode handles multiple outputs)
- [ ] **Add to `executionService.ts` `isNodeTypeSupported()`** (CRITICAL - enables Run button)

### Backend Schema (ai.py)

- [ ] Create Pydantic schema matching node properties
- [ ] Use snake_case for field names
- [ ] Add clear descriptions with examples
- [ ] Use `Optional` for non-required fields
- [ ] Add schema to `_get_tool_schema()` function

### Backend Handler (tools.py)

- [ ] Create `_execute_*` handler function
- [ ] Map LLM args (snake_case) to node params (camelCase)
- [ ] Add validation for required fields based on options
- [ ] Call existing node handler (reuse workflow logic)
- [ ] Return structured result or error
- [ ] Add dispatcher case in `execute_tool()`

### DO NOT Do

- [ ] Do NOT add to `AI_TOOL_TYPES` in constants.py
- [ ] Do NOT add to `CONFIG_NODE_TYPES`

### Documentation

- [ ] Update skill SKILL.md with tool parameters and examples
- [ ] Update CLAUDE.md with new tool capabilities

### Testing

- [ ] Verify node works in normal workflow
- [ ] Connect node to AI Agent's `input-tools` handle
- [ ] Verify LLM can call the tool with correct parameters
- [ ] Verify node is excluded from parallel execution when used as tool
- [ ] Test all parameter combinations

---

## Best Practices

1. **Reuse Existing Handlers**: The tool handler should call the existing node handler, not duplicate logic

2. **Parameter Mapping**: Always map LLM snake_case to node camelCase consistently

3. **Validation**: Validate required parameters based on conditional logic (e.g., phone required if recipient_type='phone')

4. **Error Messages**: Return clear error messages the LLM can understand and act on

5. **Schema Descriptions**: Write detailed Field descriptions with examples for the LLM

6. **Testing Both Modes**: Always test the node in both workflow mode and tool mode
