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
    # Phase 3c: Agents + chat models ----------------------------------------
    "aiAgent": {
        "displayName": "AI Agent",
        "icon": "🤖",
        "group": ["agent"],
        "description": "LangGraph agent with tool calling, memory, and iterative reasoning",
        "version": 1,
    },
    "chatAgent": {
        "displayName": "Zeenie",
        "icon": "🧞",
        "group": ["agent"],
        "description": "Conversational AI agent with memory and skill support",
        "version": 1,
    },
    "simpleMemory": {
        "displayName": "Simple Memory",
        "icon": "🧠",
        "group": ["tool", "memory"],
        "description": "Markdown-based conversation memory with optional vector long-term storage",
        "version": 1,
    },
    # Specialized agents (16) -- shared SpecializedAgentParams Pydantic model
    "android_agent": {
        "displayName": "Android Control Agent",
        "icon": "📱",
        "group": ["agent", "ai"],
        "description": "AI agent for Android device control",
        "version": 1,
    },
    "coding_agent": {
        "displayName": "Coding Agent",
        "icon": "💻",
        "group": ["agent", "ai"],
        "description": "AI agent for code execution",
        "version": 1,
    },
    "web_agent": {
        "displayName": "Web Control Agent",
        "icon": "🌐",
        "group": ["agent", "ai"],
        "description": "AI agent for web automation",
        "version": 1,
    },
    "task_agent": {
        "displayName": "Task Management Agent",
        "icon": "📋",
        "group": ["agent", "ai"],
        "description": "AI agent for task automation and scheduling",
        "version": 1,
    },
    "social_agent": {
        "displayName": "Social Media Agent",
        "icon": "📱",
        "group": ["agent", "ai"],
        "description": "AI agent for social messaging",
        "version": 1,
    },
    "travel_agent": {
        "displayName": "Travel Agent",
        "icon": "✈️",
        "group": ["agent", "ai"],
        "description": "AI agent for travel planning",
        "version": 1,
    },
    "tool_agent": {
        "displayName": "Tool Agent",
        "icon": "🔧",
        "group": ["agent", "ai"],
        "description": "AI agent for tool orchestration",
        "version": 1,
    },
    "productivity_agent": {
        "displayName": "Productivity Agent",
        "icon": "⏰",
        "group": ["agent", "ai"],
        "description": "AI agent for productivity workflows",
        "version": 1,
    },
    "payments_agent": {
        "displayName": "Payments Agent",
        "icon": "💳",
        "group": ["agent", "ai"],
        "description": "AI agent for payment processing",
        "version": 1,
    },
    "consumer_agent": {
        "displayName": "Consumer Agent",
        "icon": "🛒",
        "group": ["agent", "ai"],
        "description": "AI agent for consumer interactions",
        "version": 1,
    },
    "autonomous_agent": {
        "displayName": "Autonomous Agent",
        "icon": "🎯",
        "group": ["agent", "ai"],
        "description": "Autonomous agent using Code Mode patterns and agentic loops",
        "version": 1,
    },
    "orchestrator_agent": {
        "displayName": "Orchestrator Agent",
        "icon": "🎼",
        "group": ["agent", "ai"],
        "description": "Team-lead agent for coordinating multiple specialized agents",
        "version": 1,
    },
    "ai_employee": {
        "displayName": "AI Employee",
        "icon": "👥",
        "group": ["agent", "ai"],
        "description": "Team-lead agent for intelligent task delegation",
        "version": 1,
    },
    "rlm_agent": {
        "displayName": "RLM Agent",
        "icon": "🧠",
        "group": ["agent", "ai"],
        "description": "Recursive Language Model agent with REPL-based execution",
        "version": 1,
    },
    "claude_code_agent": {
        "displayName": "Claude Code Agent",
        "icon": ">_",
        "group": ["agent", "ai"],
        "description": "Claude Code SDK as a specialized agent node",
        "version": 1,
    },
    "deep_agent": {
        "displayName": "Deep Agent",
        "icon": "🧠",
        "group": ["agent", "ai"],
        "description": "LangChain DeepAgents with filesystem tools and sub-agent delegation",
        "version": 1,
    },
    # Chat models (9) -- shared AIChatModelParams Pydantic model.
    # Icons left blank so frontend can resolve provider SVG; group set to
    # ['model'] so Dashboard routing keeps SquareNode mapping.
    "openaiChatModel": {
        "displayName": "OpenAI",
        "icon": "",
        "group": ["model"],
        "description": "OpenAI GPT models with response format options",
        "version": 1,
    },
    "anthropicChatModel": {
        "displayName": "Anthropic Claude",
        "icon": "",
        "group": ["model"],
        "description": "Claude models with extended thinking support",
        "version": 1,
    },
    "geminiChatModel": {
        "displayName": "Google Gemini",
        "icon": "",
        "group": ["model"],
        "description": "Google Gemini models with multimodal and thinking support",
        "version": 1,
    },
    "openrouterChatModel": {
        "displayName": "OpenRouter",
        "icon": "",
        "group": ["model"],
        "description": "OpenRouter unified API for 200+ models",
        "version": 1,
    },
    "groqChatModel": {
        "displayName": "Groq",
        "icon": "",
        "group": ["model"],
        "description": "Groq ultra-fast inference (Llama, Qwen3, GPT-OSS)",
        "version": 1,
    },
    "cerebrasChatModel": {
        "displayName": "Cerebras",
        "icon": "",
        "group": ["model"],
        "description": "Cerebras ultra-fast inference on custom AI hardware",
        "version": 1,
    },
    "deepseekChatModel": {
        "displayName": "DeepSeek",
        "icon": "",
        "group": ["model"],
        "description": "DeepSeek V3 models (deepseek-chat, deepseek-reasoner)",
        "version": 1,
    },
    "kimiChatModel": {
        "displayName": "Kimi (Moonshot)",
        "icon": "",
        "group": ["model"],
        "description": "Kimi K2 models with thinking support",
        "version": 1,
    },
    "mistralChatModel": {
        "displayName": "Mistral",
        "icon": "",
        "group": ["model"],
        "description": "Mistral AI models (Large, Small, Codestral)",
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
