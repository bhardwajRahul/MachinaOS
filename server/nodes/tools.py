"""Dedicated tool node plugins (Wave 10.G.3).

Five nodes that connect to an AI Agent's ``input-tools`` handle as
passive capabilities: calculator, current-time, duckduckgo-search,
task-manager, write-todos. Each emits ``componentKind: "tool"``,
``isToolPanel: True`` so MiddleSection renders the Tool Schema Editor
without consulting a hardcoded ``TOOL_NODE_TYPES`` array.

Handle shape: input-main (trigger) on the left, a top ``output-tool``
handle (so the agent can draw an arc upward). No right-side output —
these are passive tool nodes, not general-purpose squares.
"""

from __future__ import annotations

from services.node_registry import register_node


_TOOL_HANDLES: list[dict] = [
    {"name": "input-main",   "kind": "input",  "position": "left", "label": "Input",       "role": "main"},
    {"name": "output-tool",  "kind": "output", "position": "top",  "label": "Tool",        "role": "tools"},
]


# calculatorTool — migrated to nodes/calculator_tool.py (Wave 11.B class-based plugin).

register_node(
    type="currentTimeTool",
    metadata={
        "displayName": "Current Time",
        "subtitle": "Date / Time",
        "icon": "🕒",
        "color": "#f1fa8c",
        "group": ["tool", "ai"],
        "componentKind": "tool",
        "handles": _TOOL_HANDLES,
        "description": "Get current date/time with timezone support",
        "version": 1,
        "uiHints": {"isToolPanel": True, "hideRunButton": True},
    },
)

# duckduckgoSearch — migrated to nodes/search/duckduckgo_search.py (Wave 11.C).

register_node(
    type="taskManager",
    metadata={
        "displayName": "Task Manager",
        "subtitle": "AI Task Tracking",
        "icon": "📋",
        "color": "#f1fa8c",
        "group": ["tool", "ai"],
        "componentKind": "tool",
        "handles": _TOOL_HANDLES,
        "description": "Task management tool for AI agents to create, track, and manage tasks",
        "version": 1,
        "uiHints": {"isToolPanel": True, "hideRunButton": True},
    },
)

register_node(
    type="writeTodos",
    metadata={
        "displayName": "Write Todos",
        "subtitle": "Plan-Work-Update Loop",
        "icon": "✅",
        "color": "#bd93f9",
        "group": ["tool", "ai"],
        "componentKind": "tool",
        "handles": _TOOL_HANDLES,
        "description": "Structured task list planning for complex multi-step operations",
        "version": 1,
        "uiHints": {"isToolPanel": True, "hideRunButton": True},
    },
)
