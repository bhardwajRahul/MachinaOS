"""Trigger node plugins (Wave 10.C migration batch 2).

The 10 trigger types: start, cronScheduler, timer, webhookTrigger,
chatTrigger, taskTrigger, whatsappReceive, telegramReceive,
twitterReceive, gmailReceive, emailReceive.

Triggers all share the same React Flow component (`TriggerNode`) and
the same handle topology: a single output handle on the right that
emits event data to downstream nodes. The legacy frontend hardcoded
`TRIGGER_NODE_TYPES` to recognize them; with each registration declaring
its own ``componentKind: "trigger"`` and handles, that array goes away
in Wave 10.E.

Each register_node call carries everything the frontend needs to
render the trigger correctly. No global lookup tables.
"""

from __future__ import annotations

from services.node_registry import register_node


_TRIGGER_OUTPUT_HANDLES: list[dict] = [
    {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
]


# `start` is special: kept as componentKind "start" so the frontend
# StartNode component (different visual treatment, no input section)
# can render it. Triggers proper start with `componentKind: "trigger"`.

register_node(
    type="start",
    metadata={
        "displayName": "Start",
        "subtitle": "Workflow Start",
        "icon": "▶",
        "color": "#bd93f9",
        "group": ["workflow"],
        "componentKind": "start",
        "handles": _TRIGGER_OUTPUT_HANDLES,
        "description": "Starting point for workflow execution. Provides initial data to connected nodes.",
        "version": 1,
        # `hasInitialDataBlob` tells the InputSection the output shape comes
        # from a user-authored JSON blob on the node itself (the `initialData`
        # field), not a backend Pydantic schema. Used to be an inline
        # `nodeType === 'start'` check on the frontend.
        "uiHints": {"hideInputSection": True, "hideOutputSection": True, "hasInitialDataBlob": True},
    },
)

register_node(
    type="cronScheduler",
    metadata={
        "displayName": "Cron Scheduler",
        "subtitle": "Time-Based Trigger",
        "icon": "⏱",
        "color": "#ffb86c",
        "group": ["scheduler", "trigger"],
        "componentKind": "trigger",
        "handles": _TRIGGER_OUTPUT_HANDLES,
        "description": "Cron expression-based scheduling trigger",
        "version": 1,
    },
)

register_node(
    type="timer",
    metadata={
        "displayName": "Timer",
        "subtitle": "Delay Trigger",
        "icon": "⏰",
        "color": "#ffb86c",
        "group": ["scheduler"],
        "componentKind": "square",  # has input handle, not a trigger node visually
        "handles": [
            {"name": "input-main",  "kind": "input",  "position": "left",  "label": "Input",  "role": "main"},
            {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
        ],
        "description": "Timer-based trigger with configurable delay",
        "version": 1,
    },
)

# webhookTrigger — migrated to nodes/webhook_trigger.py (Wave 11.B class-based plugin).

# chatTrigger — migrated to nodes/trigger/chat_trigger.py (Wave 11.C).

register_node(
    type="taskTrigger",
    metadata={
        "displayName": "Task Completed",
        "subtitle": "Delegated Task Done",
        "icon": "📨",
        "color": "#ffb86c",
        "group": ["trigger", "workflow"],
        "componentKind": "trigger",
        "handles": _TRIGGER_OUTPUT_HANDLES,
        "description": "Triggers when a delegated child agent completes its task (success or error)",
        "version": 1,
    },
)

register_node(
    type="whatsappReceive",
    metadata={
        "displayName": "WhatsApp Receive",
        "subtitle": "Inbound Message",
        "icon": "asset:whatsapp-receive",
        "color": "#25D366",
        "group": ["whatsapp", "trigger"],
        "componentKind": "trigger",
        "handles": _TRIGGER_OUTPUT_HANDLES,
        "description": "Trigger workflow when WhatsApp message is received",
        "version": 1,
    },
)

# telegramReceive — migrated to nodes/telegram/telegram_receive.py (Wave 11.C).

register_node(
    type="twitterReceive",
    metadata={
        "displayName": "Twitter Receive",
        "subtitle": "Mentions / DMs",
        "icon": "asset:x",
        "color": "#1DA1F2",
        "group": ["social", "trigger"],
        "componentKind": "trigger",
        "handles": _TRIGGER_OUTPUT_HANDLES,
        "description": "Trigger workflow on Twitter mentions, search results, or timeline updates (polling-based)",
        "version": 1,
    },
)

# gmailReceive — migrated to nodes/gmail_receive.py (Wave 11.B class-based plugin).

register_node(
    type="emailReceive",
    metadata={
        "displayName": "Email Receive",
        "subtitle": "IMAP Polling",
        "icon": "asset:receive",
        "color": "#8be9fd",
        "group": ["email", "trigger"],
        "componentKind": "trigger",
        "handles": _TRIGGER_OUTPUT_HANDLES,
        "description": "Polling trigger for new emails via IMAP",
        "version": 1,
    },
)
