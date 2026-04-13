"""Per-node output schema registry.

Single source of truth for the runtime output shape of each node type.
Consumed by the editor's Input panel (via the get_node_output_schema
WebSocket handler and the GET /api/schemas/nodes/{node_type}.json
HTTP endpoint) to populate the draggable variable list *before* the
workflow has been executed. Once a node has run, the editor prefers
the real execution data over the declared schema (mirrors n8n's
VirtualSchema.vue precedence — see
docs-internal/schema_source_of_truth_rfc.md).

Design notes:
- Models here are **UI-visible shape projections**. They do NOT have to
  match the full handler return value — just the fields the user might
  reasonably want to drag into downstream parameters. Prefer minimal
  flat fields over deeply nested structures.
- Fields stay optional so a missing runtime value doesn't surface an
  error at the UI layer.
- Pydantic's ``model_json_schema()`` emits JSON Schema 7; the frontend
  understands that shape directly.
- Unknown node types return ``None`` -> the frontend falls back to
  the legacy sampleSchemas map (and once that's gone, to an empty
  ``{"data": "any"}``).

Adding a new schema: import ``BaseModel``, declare the model, add it to
``NODE_OUTPUT_SCHEMAS`` below. No frontend change needed.
"""

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Shared bases (small, reused)
# ---------------------------------------------------------------------------


class _OutputBase(BaseModel):
    """Opt-in to arbitrary extras in the UI-visible projection — downstream
    schemas may add context-specific fields without a code change here."""

    model_config = ConfigDict(extra="allow")


# ---------------------------------------------------------------------------
# Workflow / trigger nodes
# ---------------------------------------------------------------------------


class StartOutput(_OutputBase):
    """Workflow start node: shape comes from the user's initialData JSON.
    The editor also parses initialData locally for drag-drop, so this is
    mostly informational."""

    timestamp: Optional[str] = None
    data: Optional[Any] = None


class ChatTriggerOutput(_OutputBase):
    message: Optional[str] = None
    timestamp: Optional[str] = None
    session_id: Optional[str] = None


class TaskTriggerOutput(_OutputBase):
    task_id: Optional[str] = None
    status: Optional[str] = Field(None, description="'completed' or 'error'")
    agent_name: Optional[str] = None
    agent_node_id: Optional[str] = None
    parent_node_id: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None
    workflow_id: Optional[str] = None


class WebhookTriggerOutput(_OutputBase):
    method: Optional[str] = None
    path: Optional[str] = None
    headers: Optional[dict] = None
    query: Optional[dict] = None
    body: Optional[str] = None
    json_: Optional[dict] = Field(None, alias="json")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


# ---------------------------------------------------------------------------
# AI agents / chat models / memory
# ---------------------------------------------------------------------------


class AIAgentOutput(_OutputBase):
    """Shared shape for every LLM-backed agent + chat model."""

    response: Optional[str] = None
    thinking: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    finish_reason: Optional[str] = None
    timestamp: Optional[str] = None


class SimpleMemoryOutput(_OutputBase):
    session_id: Optional[str] = None
    messages: Optional[list] = None
    message_count: Optional[int] = None
    memory_type: Optional[str] = None
    window_size: Optional[int] = None


# ---------------------------------------------------------------------------
# Code executors
# ---------------------------------------------------------------------------


class CodeExecutorOutput(_OutputBase):
    output: Optional[Any] = None


# ---------------------------------------------------------------------------
# HTTP / network
# ---------------------------------------------------------------------------


class HttpRequestOutput(_OutputBase):
    status: Optional[int] = None
    data: Optional[Any] = None
    headers: Optional[dict] = None
    url: Optional[str] = None
    method: Optional[str] = None


# ---------------------------------------------------------------------------
# WhatsApp
# ---------------------------------------------------------------------------


class WhatsAppGroupInfo(BaseModel):
    group_jid: Optional[str] = None
    sender_jid: Optional[str] = None
    sender_phone: Optional[str] = None
    sender_name: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class WhatsAppReceiveOutput(_OutputBase):
    message_id: Optional[str] = None
    sender: Optional[str] = None
    sender_phone: Optional[str] = None
    chat_id: Optional[str] = None
    message_type: Optional[str] = None
    text: Optional[str] = None
    timestamp: Optional[str] = None
    is_group: Optional[bool] = None
    is_from_me: Optional[bool] = None
    push_name: Optional[str] = None
    media: Optional[dict] = None
    group_info: Optional[WhatsAppGroupInfo] = None


class WhatsAppSendOutput(_OutputBase):
    success: Optional[bool] = None
    message_id: Optional[str] = None
    chat_id: Optional[str] = None
    timestamp: Optional[str] = None
    message_type: Optional[str] = None


# ---------------------------------------------------------------------------
# Google Workspace (consolidated nodes)
# ---------------------------------------------------------------------------


class GmailOutput(_OutputBase):
    operation: Optional[str] = None
    message_id: Optional[str] = None
    thread_id: Optional[str] = None
    emails: Optional[list] = None
    count: Optional[int] = None
    subject: Optional[str] = None
    from_: Optional[str] = Field(None, alias="from")
    to: Optional[str] = None
    date: Optional[str] = None
    body: Optional[str] = None
    snippet: Optional[str] = None
    labels: Optional[list] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class GmailReceiveOutput(_OutputBase):
    message_id: Optional[str] = None
    thread_id: Optional[str] = None
    from_: Optional[str] = Field(None, alias="from")
    to: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    snippet: Optional[str] = None
    date: Optional[str] = None
    labels: Optional[list] = None
    attachments: Optional[list] = None
    is_unread: Optional[bool] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class CalendarOutput(_OutputBase):
    operation: Optional[str] = None
    event_id: Optional[str] = None
    summary: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    attendees: Optional[list] = None
    status: Optional[str] = None
    events: Optional[list] = None
    count: Optional[int] = None
    deleted: Optional[bool] = None


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


class SearchResult(BaseModel):
    title: Optional[str] = None
    snippet: Optional[str] = None
    url: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class SearchOutput(_OutputBase):
    """Shared schema for braveSearch / serperSearch / perplexitySearch."""

    query: Optional[str] = None
    results: Optional[list[SearchResult]] = None
    result_count: Optional[int] = None
    answer: Optional[str] = None
    citations: Optional[list] = None
    provider: Optional[str] = None


# ---------------------------------------------------------------------------
# Location (Google Maps, Android location)
# ---------------------------------------------------------------------------


class LocationOutput(_OutputBase):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    provider: Optional[str] = None
    altitude: Optional[float] = None
    speed: Optional[float] = None
    bearing: Optional[float] = None


# ---------------------------------------------------------------------------
# Filesystem + shell
# ---------------------------------------------------------------------------


class FileReadOutput(_OutputBase):
    content: Optional[str] = None
    file_path: Optional[str] = None
    encoding: Optional[str] = None


class FileModifyOutput(_OutputBase):
    operation: Optional[str] = None
    file_path: Optional[str] = None
    occurrences: Optional[int] = None


class ShellOutput(_OutputBase):
    stdout: Optional[str] = None
    exit_code: Optional[int] = None
    truncated: Optional[bool] = None
    command: Optional[str] = None


class FsSearchOutput(_OutputBase):
    path: Optional[str] = None
    entries: Optional[list] = None
    matches: Optional[list] = None
    pattern: Optional[str] = None
    count: Optional[int] = None


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
# Map node type (matches `nodeDefinition.name` on the frontend) -> Pydantic
# model class. Missing entries return None from ``get_node_output_schema``.
#
# Aliasing: several node types share the same shape — we just point at the
# same model. For example every agent and every chat model uses AIAgentOutput.

_AGENT_TYPES = [
    "aiAgent",
    "chatAgent",
    "android_agent",
    "coding_agent",
    "web_agent",
    "task_agent",
    "social_agent",
    "travel_agent",
    "tool_agent",
    "productivity_agent",
    "payments_agent",
    "consumer_agent",
    "autonomous_agent",
    "orchestrator_agent",
    "ai_employee",
    "rlm_agent",
    "claude_code_agent",
    "deep_agent",
]

_CHAT_MODEL_TYPES = [
    "openaiChatModel",
    "anthropicChatModel",
    "geminiChatModel",
    "openrouterChatModel",
    "groqChatModel",
    "cerebrasChatModel",
    "deepseekChatModel",
    "kimiChatModel",
    "mistralChatModel",
]

_SEARCH_TYPES = ["braveSearch", "serperSearch", "perplexitySearch"]

_CODE_EXECUTOR_TYPES = ["pythonExecutor", "javascriptExecutor", "typescriptExecutor"]


NODE_OUTPUT_SCHEMAS: dict[str, type[BaseModel]] = {
    # workflow / triggers
    "start": StartOutput,
    "chatTrigger": ChatTriggerOutput,
    "taskTrigger": TaskTriggerOutput,
    "webhookTrigger": WebhookTriggerOutput,
    # AI
    **{t: AIAgentOutput for t in _AGENT_TYPES},
    **{t: AIAgentOutput for t in _CHAT_MODEL_TYPES},
    "simpleMemory": SimpleMemoryOutput,
    # code
    **{t: CodeExecutorOutput for t in _CODE_EXECUTOR_TYPES},
    # network
    "httpRequest": HttpRequestOutput,
    # whatsapp
    "whatsappReceive": WhatsAppReceiveOutput,
    "whatsappSend": WhatsAppSendOutput,
    # google workspace
    "gmail": GmailOutput,
    "gmailReceive": GmailReceiveOutput,
    "calendar": CalendarOutput,
    # search
    **{t: SearchOutput for t in _SEARCH_TYPES},
    # location
    "location": LocationOutput,
    "gmaps_locations": LocationOutput,
    "gmaps_nearby_places": LocationOutput,
    # filesystem
    "fileRead": FileReadOutput,
    "fileModify": FileModifyOutput,
    "shell": ShellOutput,
    "fsSearch": FsSearchOutput,
}


# Cache of compiled JSON Schemas so we don't re-serialise on every request.
_schema_cache: dict[str, dict[str, Any]] = {}


def get_node_output_schema(node_type: str) -> Optional[dict[str, Any]]:
    """Return the JSON Schema for a node's output, or None if the node
    type has no declared schema. Cached per-process."""

    if node_type in _schema_cache:
        return _schema_cache[node_type]
    model = NODE_OUTPUT_SCHEMAS.get(node_type)
    if model is None:
        return None
    schema = model.model_json_schema()
    _schema_cache[node_type] = schema
    return schema


def list_node_types_with_schema() -> list[str]:
    """Exposed to the frontend so it can probe which node types have
    schemas before making individual requests. Alphabetised for a stable
    client cache key."""

    return sorted(NODE_OUTPUT_SCHEMAS.keys())
