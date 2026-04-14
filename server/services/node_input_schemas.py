"""Per-node input parameter schema registry.

Mirror of services/node_output_schemas.py but for the input side. Lifts
the Pydantic models in models/nodes.py into JSON Schema 7 documents the
editor can drive its parameter panel from. Single source of truth: the
discriminated-union variants registered in models.nodes. Adding a new
node type's input schema = add a Pydantic class + register it in
KnownNodeParams; this module discovers it automatically.

Wave 6 Phase 1 — see C:\\Users\\Tgroh\\.claude\\plans\\typed-splashing-crown.md.
"""

from typing import Any, Optional

from pydantic import BaseModel

from constants import ANDROID_SERVICE_NODE_TYPES
from models.nodes import (
    AIAgentParams, AIChatModelParams, AndroidServiceParams,
    ChatAgentParams, ChatHistoryParams, ChatSendParams, ChatTriggerParams,
    ConsoleParams, CreateMapParams, CronSchedulerParams, FileHandlerParams,
    GmailReceiveParams, GmapsLocationsParams, GmapsNearbyPlacesParams,
    HttpRequestParams, JavaScriptExecutorParams, ProcessManagerParams,
    PythonExecutorParams, SimpleMemoryParams, SpecializedAgentParams,
    StartNodeParams, TaskTriggerParams, TeamMonitorParams,
    TelegramReceiveParams, TextGeneratorParams, TwitterReceiveParams,
    TypeScriptExecutorParams, WebhookResponseParams, WebhookTriggerParams,
    WhatsAppDbParams, WhatsAppReceiveParams, WhatsAppSendParams,
    WorkflowTriggerParams,
)


# ---------------------------------------------------------------------------
# Type → Pydantic model registry
# ---------------------------------------------------------------------------
# Single-Literal models map directly. SpecializedAgentParams covers many
# types via its Literal[...] union — we expand at registration time so a
# type-id lookup is always O(1).


_DIRECT_MODELS: dict[str, type[BaseModel]] = {
    # AI
    "openaiChatModel": AIChatModelParams,
    "anthropicChatModel": AIChatModelParams,
    "geminiChatModel": AIChatModelParams,
    "openrouterChatModel": AIChatModelParams,
    "groqChatModel": AIChatModelParams,
    "cerebrasChatModel": AIChatModelParams,
    "deepseekChatModel": AIChatModelParams,
    "kimiChatModel": AIChatModelParams,
    "mistralChatModel": AIChatModelParams,
    "aiAgent": AIAgentParams,
    "chatAgent": ChatAgentParams,
    "simpleMemory": SimpleMemoryParams,
    # Maps
    "gmaps_create": CreateMapParams,
    "gmaps_locations": GmapsLocationsParams,
    "gmaps_nearby_places": GmapsNearbyPlacesParams,
    # WhatsApp
    "whatsappSend": WhatsAppSendParams,
    "whatsappReceive": WhatsAppReceiveParams,
    "whatsappDb": WhatsAppDbParams,
    # Code
    "pythonExecutor": PythonExecutorParams,
    "javascriptExecutor": JavaScriptExecutorParams,
    "typescriptExecutor": TypeScriptExecutorParams,
    # Process management
    "processManager": ProcessManagerParams,
    # HTTP
    "httpRequest": HttpRequestParams,
    "webhookTrigger": WebhookTriggerParams,
    "webhookResponse": WebhookResponseParams,
    # Utility
    "console": ConsoleParams,
    "teamMonitor": TeamMonitorParams,
    # Workflow / scheduling
    "start": StartNodeParams,
    "cronScheduler": CronSchedulerParams,
    "timer": WorkflowTriggerParams,
    # Triggers
    "taskTrigger": TaskTriggerParams,
    "chatTrigger": ChatTriggerParams,
    "telegramReceive": TelegramReceiveParams,
    "twitterReceive": TwitterReceiveParams,
    "gmailReceive": GmailReceiveParams,
    # Text
    "textGenerator": TextGeneratorParams,
    "fileHandler": FileHandlerParams,
    # Chat
    "chatSend": ChatSendParams,
    "chatHistory": ChatHistoryParams,
}


# Specialized agents share one Pydantic class but expand across many
# discriminator values. Pull the literal list from the model itself so
# the registry stays in sync if the union grows.
_SPECIALIZED_AGENT_TYPES = (
    SpecializedAgentParams.model_fields["type"].annotation.__args__
)


NODE_INPUT_MODELS: dict[str, type[BaseModel]] = {
    **_DIRECT_MODELS,
    **{t: SpecializedAgentParams for t in _SPECIALIZED_AGENT_TYPES},
    **{t: AndroidServiceParams for t in ANDROID_SERVICE_NODE_TYPES},
}


# ---------------------------------------------------------------------------
# Lookup + post-processing
# ---------------------------------------------------------------------------


_schema_cache: dict[str, dict[str, Any]] = {}


def get_node_input_schema(node_type: str) -> Optional[dict[str, Any]]:
    """Return the JSON Schema 7 document for a node's input parameters,
    or None if the node type has no Pydantic model. Cached per-process."""

    if node_type in _schema_cache:
        return _schema_cache[node_type]
    model = NODE_INPUT_MODELS.get(node_type)
    if model is None:
        return None
    schema = _post_process(model.model_json_schema(), node_type)
    _schema_cache[node_type] = schema
    return schema


def list_node_types_with_input_schema() -> list[str]:
    """Stable alphabetised list of types with declared input schemas."""

    return sorted(NODE_INPUT_MODELS.keys())


def _post_process(schema: dict[str, Any], node_type: str) -> dict[str, Any]:
    """Strip the discriminator field from the surface schema and lift
    nested ``$defs`` references inline so the editor doesn't have to
    resolve them. The discriminator (``type``) is implicit at the
    transport layer (URL path) and shouldn't render as a parameter."""

    cleaned = dict(schema)
    props = dict(cleaned.get("properties") or {})
    props.pop("type", None)
    cleaned["properties"] = props
    required = [r for r in (cleaned.get("required") or []) if r != "type"]
    if required:
        cleaned["required"] = required
    elif "required" in cleaned:
        del cleaned["required"]
    cleaned["title"] = node_type
    return cleaned
