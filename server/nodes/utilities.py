"""Utility / code / process / messaging node plugins (Wave 10.C batch 3).

Migrates the bulk of square-shaped tool nodes that the editor renders
via SquareNode. Each node carries its own icon, brand color, handle
topology, and any uiHints (e.g. hasCodeEditor for code executors).
No global lookup tables.
"""

from __future__ import annotations

from services.node_registry import register_node


# Standard square-node handles: one main input on the left, one main
# output on the right. Most tool/utility nodes use this exact shape.
_SQUARE_HANDLES: list[dict] = [
    {"name": "input-main",  "kind": "input",  "position": "left",  "label": "Input",  "role": "main"},
    {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
]


# -- Utility ---------------------------------------------------------------

register_node(
    type="httpRequest",
    metadata={
        "displayName": "HTTP Request",
        "subtitle": "Outbound HTTP",
        "icon": "🌐",
        "color": "#8be9fd",
        "group": ["utility", "tool"],
        "componentKind": "square",
        "handles": _SQUARE_HANDLES,
        "description": "Make HTTP requests to external APIs",
        "version": 1,
    },
)

register_node(
    type="webhookResponse",
    metadata={
        "displayName": "Webhook Response",
        "subtitle": "Send Response",
        "icon": "↩️",
        "color": "#8be9fd",
        "group": ["utility"],
        "componentKind": "square",
        "handles": _SQUARE_HANDLES,
        "description": "Send response back to webhook caller",
        "version": 1,
    },
)

register_node(
    type="console",
    metadata={
        "displayName": "Console",
        "subtitle": "Debug Logger",
        "icon": "🖥️",
        "color": "#8be9fd",
        "group": ["utility"],
        "componentKind": "square",
        "handles": [
            {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        ],
        "description": "Log data to console panel for debugging during execution",
        "version": 1,
        "uiHints": {"isConsoleSink": True},
        "hideOutputHandle": True,
    },
)

register_node(
    type="teamMonitor",
    metadata={
        "displayName": "Team Monitor",
        "subtitle": "Live Team View",
        "icon": "📊",
        "color": "#bd93f9",
        "group": ["utility", "agent"],
        "componentKind": "square",
        "handles": [
            {"name": "input-main", "kind": "input", "position": "left", "label": "Team", "role": "main"},
        ],
        "description": "Monitor agent team operations, tasks, and messages in real-time",
        "version": 1,
        "uiHints": {"hideInputSection": True, "hideOutputSection": True, "isMonitorPanel": True, "hideRunButton": True},
        "hideOutputHandle": True,
    },
)


# -- Code (with code editor uiHint) ---------------------------------------

register_node(
    type="pythonExecutor",
    metadata={
        "displayName": "Python Executor",
        "subtitle": "Run Python",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
        "color": "#ff79c6",
        "group": ["code", "tool"],
        "componentKind": "square",
        "handles": _SQUARE_HANDLES,
        "description": "Execute Python code with input data access",
        "version": 1,
        "uiHints": {"hasCodeEditor": True},
    },
)

register_node(
    type="javascriptExecutor",
    metadata={
        "displayName": "JavaScript Executor",
        "subtitle": "Run JS",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
        "color": "#ff79c6",
        "group": ["code", "tool"],
        "componentKind": "square",
        "handles": _SQUARE_HANDLES,
        "description": "Execute JavaScript code with input data access",
        "version": 1,
        "uiHints": {"hasCodeEditor": True},
    },
)

register_node(
    type="typescriptExecutor",
    metadata={
        "displayName": "TypeScript Executor",
        "subtitle": "Run TS",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
        "color": "#ff79c6",
        "group": ["code", "tool"],
        "componentKind": "square",
        "handles": _SQUARE_HANDLES,
        "description": "Execute TypeScript code with input data access and type safety",
        "version": 1,
        "uiHints": {"hasCodeEditor": True},
    },
)


# -- Process management ---------------------------------------------------

register_node(
    type="processManager",
    metadata={
        "displayName": "Process Manager",
        "subtitle": "Long-running Procs",
        "icon": "⚙️",
        "color": "#ffb86c",
        "group": ["utility", "tool"],
        "componentKind": "square",
        "handles": _SQUARE_HANDLES,
        "description": "Start, stop, and manage long-running processes (dev servers, watchers, build tools). Streams output to Terminal tab.",
        "version": 1,
    },
)
