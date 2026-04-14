"""Per-node display metadata.

Receives the UI-only fields (``displayName``, ``icon``, ``group``,
``subtitle``, ``description``) that today live in the frontend
``client/src/nodeDefinitions/*.ts`` files. Wave 6 Phase 3 migrates each
node-definition file's display metadata into this dict; until then
NodeSpec falls back to the node type id for missing entries.

Single source of truth for everything the parameter panel + palette
needs to render a node header. Kept as a plain dict (not Pydantic) for
fast iteration during the migration — switch to a TypedDict / Pydantic
model once the schema stabilises.
"""

from typing import Any, Optional, TypedDict


class NodeMetadata(TypedDict, total=False):
    displayName: str
    icon: str
    group: list[str]
    subtitle: str
    description: str
    version: int


# Seeded incrementally per Wave 6 Phase 3 sub-commit. Sub-commit 3a
# covers utility + code + process + workflow groups (12 types). Later
# sub-commits add messaging (3b), agents/models (3c), and the rest.
# Source: client/src/nodeDefinitions/*.ts at the time of migration.
NODE_METADATA: dict[str, NodeMetadata] = {
    # Workflow group ---------------------------------------------------------
    "start": {
        "displayName": "Start",
        "icon": "▶",
        "group": ["workflow"],
        "description": "Starting point for workflow execution. Provides initial data to connected nodes.",
        "version": 1,
    },
    "taskTrigger": {
        "displayName": "Task Completed",
        "icon": "📨",
        "group": ["trigger", "workflow"],
        "description": "Triggers when a delegated child agent completes its task (success or error)",
        "version": 1,
    },
    # Utility group ----------------------------------------------------------
    "httpRequest": {
        "displayName": "HTTP Request",
        "icon": "🌐",
        "group": ["utility", "tool"],
        "description": "Make HTTP requests to external APIs",
        "version": 1,
    },
    "webhookTrigger": {
        "displayName": "Webhook Trigger",
        "icon": "🪝",
        "group": ["trigger"],
        "description": "Start workflow when HTTP request is received",
        "version": 1,
    },
    "webhookResponse": {
        "displayName": "Webhook Response",
        "icon": "↩️",
        "group": ["utility"],
        "description": "Send response back to webhook caller",
        "version": 1,
    },
    "chatTrigger": {
        "displayName": "Chat Trigger",
        "icon": "💬",
        "group": ["utility", "trigger"],
        "description": "Trigger workflow when user sends a chat message from the console input",
        "version": 1,
    },
    "console": {
        "displayName": "Console",
        "icon": "🖥️",
        "group": ["utility"],
        "description": "Log data to console panel for debugging during execution",
        "version": 1,
    },
    "teamMonitor": {
        "displayName": "Team Monitor",
        "icon": "📊",
        "group": ["utility", "agent"],
        "description": "Monitor agent team operations, tasks, and messages in real-time",
        "version": 1,
    },
    # Code group -------------------------------------------------------------
    "pythonExecutor": {
        "displayName": "Python Executor",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
        "group": ["code", "tool"],
        "description": "Execute Python code with input data access",
        "version": 1,
    },
    "javascriptExecutor": {
        "displayName": "JavaScript Executor",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
        "group": ["code", "tool"],
        "description": "Execute JavaScript code with input data access",
        "version": 1,
    },
    "typescriptExecutor": {
        "displayName": "TypeScript Executor",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
        "group": ["code", "tool"],
        "description": "Execute TypeScript code with input data access and type safety",
        "version": 1,
    },
    # Process management -----------------------------------------------------
    "processManager": {
        "displayName": "Process Manager",
        "icon": "⚙️",
        "group": ["utility", "tool"],
        "description": "Start, stop, and manage long-running processes (dev servers, watchers, build tools). Streams output to Terminal tab.",
        "version": 1,
    },
    # Phase 3b: Messaging group ---------------------------------------------
    # Icons left blank for SVG-icon nodes - frontend resolves the SVG asset
    # via its own icon imports until we move SVG payload to the server too.
    "whatsappSend": {
        "displayName": "WhatsApp Send",
        "icon": "",
        "group": ["whatsapp", "tool"],
        "description": "Send WhatsApp messages (text, media, location, contact, sticker)",
        "version": 1,
    },
    "whatsappReceive": {
        "displayName": "WhatsApp Receive",
        "icon": "",
        "group": ["whatsapp", "trigger"],
        "description": "Trigger workflow when WhatsApp message is received",
        "version": 1,
    },
    "whatsappDb": {
        "displayName": "WhatsApp DB",
        "icon": "",
        "group": ["whatsapp", "tool"],
        "description": "Query WhatsApp database (chat history, contacts, groups, channels)",
        "version": 1,
    },
    "telegramSend": {
        "displayName": "Telegram Send",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Send text, photo, document, location, or contact messages via Telegram bot",
        "version": 1,
    },
    "telegramReceive": {
        "displayName": "Telegram Receive",
        "icon": "",
        "group": ["social", "trigger"],
        "description": "Trigger workflow when Telegram message is received",
        "version": 1,
    },
    "twitterSend": {
        "displayName": "Twitter Send",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Post tweets, reply, retweet, like, or delete tweets on Twitter/X",
        "version": 1,
    },
    "twitterReceive": {
        "displayName": "Twitter Receive",
        "icon": "",
        "group": ["social", "trigger"],
        "description": "Trigger workflow on Twitter mentions, search results, or timeline updates (polling-based)",
        "version": 1,
    },
    "twitterSearch": {
        "displayName": "Twitter Search",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Search recent tweets on Twitter/X using the Search API",
        "version": 1,
    },
    "twitterUser": {
        "displayName": "Twitter User",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Look up Twitter/X user profiles, followers, and following",
        "version": 1,
    },
    "socialReceive": {
        "displayName": "Social Receive",
        "icon": "",
        "group": ["social"],
        "description": "Unified receive trigger for any social platform (whatsapp, telegram, twitter, ...)",
        "version": 1,
    },
    "socialSend": {
        "displayName": "Social Send",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Unified send action for any social platform",
        "version": 1,
    },
}


def get_node_metadata(node_type: str) -> Optional[NodeMetadata]:
    """Return display metadata for a node type, or None if not seeded."""

    return NODE_METADATA.get(node_type)


def fallback_metadata(node_type: str) -> NodeMetadata:
    """Minimal metadata for a node type without a seeded entry. Keeps
    NodeSpec emission valid even before Phase 3 migrations land."""

    return {
        "displayName": node_type,
        "icon": "",
        "group": [],
        "description": "",
        "version": 1,
    }
