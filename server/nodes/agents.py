"""Agent node plugins (Wave 10.C migration batch 1).

Migrates the 20 entries currently hardcoded in
``client/src/components/AIAgentNode.tsx`` ``AGENT_CONFIGS`` so each
agent carries its own visual metadata (icon, color, handles,
componentKind) server-side. Frontend component dispatch (10.D) will
then read handles from NodeSpec instead of from AGENT_CONFIGS.

Each ``register_node`` call is explicit — no group-based derivation,
no color lookup tables. The node declares what it is.

Handlers stay in ``node_executor._build_handler_registry`` for now
(they'd need service-injection via ``functools.partial`` which the
plugin pattern defers to the executor). Pydantic input models stay in
``models/nodes.py`` as part of the discriminated union. This module
only extends the metadata each node already had.
"""

from __future__ import annotations

from services.node_registry import register_node


_STD_SIZE = {"width": 300, "height": 200}
_SOCIAL_SIZE = {"width": 260, "height": 160}

# Wave 10.G.3: every LangGraph-style agent accepts a Skill input handle
# and exposes the "Connected Skills" accordion in the parameter panel.
# The frontend MiddleSection reads `uiHints.hasSkills` directly — no
# tribal AGENT_WITH_SKILLS_TYPES array anymore.
_STD_AGENT_HINTS = {**_STD_SIZE, "hasSkills": True}


def _std_handles(extra_bottom: list[dict] | None = None) -> list[dict]:
    """Skill + Tool + Memory + Task + top Output — the handle set shared
    by 16 of the 20 agent variants. Factored out as a local helper in
    this module only; not a global lookup. Each register_node call
    below still opts in by name.
    """
    bottom = list(extra_bottom) if extra_bottom else [
        {"name": "input-skill", "kind": "input", "position": "bottom", "offset": "25%", "label": "Skill", "role": "skill"},
        {"name": "input-tools", "kind": "input", "position": "bottom", "offset": "75%", "label": "Tool",  "role": "tools"},
    ]
    return [
        *bottom,
        {"name": "input-memory", "kind": "input",  "position": "left",  "offset": "65%", "label": "Memory", "role": "memory"},
        {"name": "input-task",   "kind": "input",  "position": "left",  "offset": "85%", "label": "Task",   "role": "task"},
        {"name": "output-top",   "kind": "output", "position": "top",                    "label": "Output", "role": "main"},
    ]


_TEAM_BOTTOM_HANDLES = [
    {"name": "input-skill",     "kind": "input", "position": "bottom", "offset": "20%", "label": "Skill", "role": "skill"},
    {"name": "input-tools",     "kind": "input", "position": "bottom", "offset": "50%", "label": "Tool",  "role": "tools"},
    {"name": "input-teammates", "kind": "input", "position": "bottom", "offset": "80%", "label": "Team",  "role": "teammates"},
]

_DEEP_BOTTOM_HANDLES = [
    {"name": "input-skill",     "kind": "input", "position": "bottom", "offset": "30%", "label": "Skill", "role": "skill"},
    {"name": "input-teammates", "kind": "input", "position": "bottom", "offset": "55%", "label": "Team",  "role": "teammates"},
    {"name": "input-tools",     "kind": "input", "position": "bottom", "offset": "80%", "label": "Tool",  "role": "tools"},
]


# -- Core agents --------------------------------------------------------------

register_node(
    type="aiAgent",
    metadata={
        "displayName": "AI Agent",
        "subtitle": "LangGraph Agent",
        "icon": "🤖",
        "color": "#bd93f9",
        "group": ["agent"],
        "componentKind": "agent",
        "handles": _std_handles(),
        "description": "LangGraph agent with tool calling, memory, and iterative reasoning",
        "version": 1,
        "uiHints": _STD_AGENT_HINTS,
    },
)

register_node(
    type="chatAgent",
    metadata={
        "displayName": "Zeenie",
        "subtitle": "Personal Assistant",
        "icon": "🧞",
        "color": "#8be9fd",
        "group": ["agent"],
        "componentKind": "agent",
        "handles": _std_handles(),
        "description": "Conversational AI agent with skills and memory",
        "version": 1,
        "uiHints": _STD_AGENT_HINTS,
    },
)


# -- Specialized agents (share the LangGraph Skill/Tool/Memory/Task topology) -

register_node(type="android_agent",      metadata={"displayName": "Android Agent",      "subtitle": "Device Control",        "icon": "📱", "color": "#50fa7b", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for Android device control", "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="coding_agent",       metadata={"displayName": "Coding Agent",       "subtitle": "Code Execution",        "icon": "💻", "color": "#8be9fd", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for code execution",        "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="web_agent",          metadata={"displayName": "Web Agent",          "subtitle": "Browser Automation",    "icon": "🌐", "color": "#ff79c6", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for web automation",        "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="task_agent",         metadata={"displayName": "Task Agent",         "subtitle": "Task Automation",       "icon": "📋", "color": "#bd93f9", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for task automation",       "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="social_agent",       metadata={"displayName": "Social Agent",       "subtitle": "Social Messaging",      "icon": "📱", "color": "#50fa7b", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for social messaging",      "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="travel_agent",       metadata={"displayName": "Travel Agent",       "subtitle": "Travel Planning",       "icon": "✈️", "color": "#ffb86c", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for travel planning",       "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="tool_agent",         metadata={"displayName": "Tool Agent",         "subtitle": "Tool Orchestration",    "icon": "🔧", "color": "#f1fa8c", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for tool orchestration",    "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="productivity_agent", metadata={"displayName": "Productivity Agent", "subtitle": "Workflows",             "icon": "⏰", "color": "#8be9fd", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for productivity workflows","version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="payments_agent",     metadata={"displayName": "Payments Agent",     "subtitle": "Payment Processing",    "icon": "💳", "color": "#50fa7b", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for payment processing",    "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="consumer_agent",     metadata={"displayName": "Consumer Agent",     "subtitle": "Consumer Support",      "icon": "🛒", "color": "#bd93f9", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "AI agent for consumer interactions", "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="autonomous_agent",   metadata={"displayName": "Autonomous Agent",   "subtitle": "Autonomous Ops",        "icon": "🎯", "color": "#bd93f9", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "Autonomous agent using Code Mode patterns", "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="rlm_agent",          metadata={"displayName": "RLM Agent",          "subtitle": "Recursive Reasoning",   "icon": "🧠", "color": "#ffb86c", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "Recursive Language Model agent (REPL-based)", "version": 1, "uiHints": _STD_AGENT_HINTS})
register_node(type="claude_code_agent",  metadata={"displayName": "Claude Code",        "subtitle": "Agentic Coding",        "icon": "asset:claude", "color": "#8be9fd", "group": ["agent"], "componentKind": "agent", "handles": _std_handles(), "description": "Claude Code CLI as a specialized agent", "version": 1, "uiHints": _STD_AGENT_HINTS})


# -- Team leads (Skill / Tool / Teammates bottom handles) --------------------

register_node(
    type="orchestrator_agent",
    metadata={
        "displayName": "Orchestrator Agent",
        "subtitle": "Agent Coordination",
        "icon": "🎼",
        "color": "#8be9fd",
        "group": ["agent"],
        "componentKind": "agent",
        "handles": _std_handles(extra_bottom=_TEAM_BOTTOM_HANDLES),
        "description": "Team lead that delegates to connected specialized agents",
        "version": 1,
        "uiHints": _STD_AGENT_HINTS,
    },
)

register_node(
    type="ai_employee",
    metadata={
        "displayName": "AI Employee",
        "subtitle": "Team Orchestration",
        "icon": "👥",
        "color": "#bd93f9",
        "group": ["agent"],
        "componentKind": "agent",
        "handles": _std_handles(extra_bottom=_TEAM_BOTTOM_HANDLES),
        "description": "Team lead for multi-agent coordination",
        "version": 1,
        "uiHints": _STD_AGENT_HINTS,
    },
)

register_node(
    type="deep_agent",
    metadata={
        "displayName": "Deep Agent",
        "subtitle": "LangChain DeepAgents",
        "icon": "\U0001F9E0",
        "color": "#50fa7b",
        "group": ["agent"],
        "componentKind": "agent",
        "handles": _std_handles(extra_bottom=_DEEP_BOTTOM_HANDLES),
        "description": "LangChain DeepAgents with filesystem tools and sub-agent delegation",
        "version": 1,
        "uiHints": _STD_AGENT_HINTS,
    },
)


# -- Social messaging nodes (different handle topology, share component) ----

register_node(
    type="socialReceive",
    metadata={
        "displayName": "Social Receive",
        "subtitle": "Normalize Message",
        "icon": "📡",
        "color": "#bd93f9",
        "group": ["social"],
        "componentKind": "agent",  # Uses AIAgentNode component for multi-handle rendering
        "handles": [
            {"name": "output-message",  "kind": "output", "position": "right", "offset": "20%", "label": "Message",  "role": "main"},
            {"name": "output-media",    "kind": "output", "position": "right", "offset": "40%", "label": "Media",    "role": "main"},
            {"name": "output-contact",  "kind": "output", "position": "right", "offset": "60%", "label": "Contact",  "role": "main"},
            {"name": "output-metadata", "kind": "output", "position": "right", "offset": "80%", "label": "Metadata", "role": "main"},
        ],
        "description": "Normalizes messages from platform triggers into unified format",
        "version": 1,
        "uiHints": _SOCIAL_SIZE,
    },
)

register_node(
    type="socialSend",
    metadata={
        "displayName": "Social Send",
        "subtitle": "Send Message",
        "icon": "📤",
        "color": "#bd93f9",
        "group": ["social", "tool"],
        "componentKind": "agent",
        "handles": [
            {"name": "input-message",  "kind": "input", "position": "left", "offset": "15%", "label": "Message",  "role": "main"},
            {"name": "input-media",    "kind": "input", "position": "left", "offset": "35%", "label": "Media",    "role": "main"},
            {"name": "input-contact",  "kind": "input", "position": "left", "offset": "55%", "label": "Contact",  "role": "main"},
            {"name": "input-metadata", "kind": "input", "position": "left", "offset": "75%", "label": "Metadata", "role": "main"},
        ],
        "description": "Unified send action for any social platform",
        "version": 1,
        "uiHints": _SOCIAL_SIZE,
    },
)
