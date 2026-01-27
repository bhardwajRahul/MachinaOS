"""Pydantic models for node validation with discriminated unions.

This module provides type-safe node validation using Pydantic v2 discriminated unions.
Benefits:
- O(1) hash map lookup vs O(n) sequential validation
- Better error messages (identifies exact expected variant)
- Type safety with IDE autocompletion
- Automatic API documentation generation
"""

from typing import Literal, Union, Annotated, Optional, Dict, Any, List
from pydantic import BaseModel, Field, TypeAdapter
from datetime import datetime

from constants import (
    AI_CHAT_MODEL_TYPES,
    AI_AGENT_TYPES,
    AI_MEMORY_TYPES,
    GOOGLE_MAPS_TYPES,
    ANDROID_SERVICE_NODE_TYPES,
    ANDROID_SETUP_TYPES,
    WHATSAPP_TYPES,
    CHAT_TYPES,
    CODE_EXECUTOR_TYPES,
    HTTP_TYPES,
    TEXT_TYPES,
    WORKFLOW_CONTROL_TYPES,
    TRIGGER_TYPES,
)


# =============================================================================
# BASE MODELS
# =============================================================================

class BaseNodeParams(BaseModel):
    """Base class for all node parameters."""
    model_config = {"extra": "allow"}  # Allow extra fields for flexibility


# =============================================================================
# AI NODE MODELS
# =============================================================================

class AIChatModelParams(BaseNodeParams):
    """Parameters for AI chat model nodes (OpenAI, Anthropic, Gemini, OpenRouter, Groq, Cerebras)."""
    type: Literal["openaiChatModel", "anthropicChatModel", "geminiChatModel", "openrouterChatModel", "groqChatModel", "cerebrasChatModel"]
    prompt: str = ""
    model: str = ""
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens")
    system_prompt: Optional[str] = Field(default="", alias="systemMessage")
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class AIAgentParams(BaseNodeParams):
    """Parameters for AI agent node."""
    type: Literal["aiAgent"]
    prompt: str = ""
    provider: Literal["openai", "anthropic", "gemini"] = "openai"
    model: str = ""
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens")
    system_message: Optional[str] = Field(default="You are a helpful assistant", alias="systemMessage")
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class ChatAgentParams(BaseNodeParams):
    """Parameters for chat agent node (skill-based)."""
    type: Literal["chatAgent"]
    provider: Literal["openai", "anthropic", "gemini", "groq", "openrouter", "cerebras"] = "openai"
    model: str = ""
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class SimpleMemoryParams(BaseNodeParams):
    """Parameters for simple memory node."""
    type: Literal["simpleMemory"]
    session_id: str = Field(default="default", alias="sessionId")
    memory_type: Literal["buffer", "window"] = Field(default="buffer", alias="memoryType")
    window_size: int = Field(default=10, alias="windowSize", ge=1, le=100)
    clear_on_run: bool = Field(default=False, alias="clearOnRun")


# =============================================================================
# GOOGLE MAPS NODE MODELS
# =============================================================================

class CreateMapParams(BaseNodeParams):
    """Parameters for create map node."""
    type: Literal["createMap"]
    center_lat: float = Field(default=0.0, alias="centerLat")
    center_lng: float = Field(default=0.0, alias="centerLng")
    zoom: int = Field(default=10, ge=1, le=20)
    map_type: Literal["roadmap", "satellite", "terrain", "hybrid"] = Field(default="roadmap", alias="mapType")
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class AddLocationsParams(BaseNodeParams):
    """Parameters for add locations (geocoding) node."""
    type: Literal["addLocations"]
    address: str = ""
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class ShowNearbyPlacesParams(BaseNodeParams):
    """Parameters for show nearby places node."""
    type: Literal["showNearbyPlaces"]
    latitude: float = 0.0
    longitude: float = 0.0
    radius: int = Field(default=1000, ge=1, le=50000)
    place_type: str = Field(default="restaurant", alias="placeType")
    api_key: Optional[str] = Field(default=None, alias="apiKey")


# =============================================================================
# ANDROID NODE MODELS
# =============================================================================

class AndroidDeviceSetupParams(BaseNodeParams):
    """Parameters for Android device setup node."""
    type: Literal["androidDeviceSetup"]
    connection_type: Literal["local", "remote"] = Field(default="local", alias="connection_type")
    device_id: str = Field(default="", alias="device_id")
    websocket_url: str = Field(default="", alias="websocket_url")
    port: int = Field(default=8888, ge=1, le=65535)
    auto_forward: bool = Field(default=True, alias="auto_forward")
    target_device_id: str = Field(default="", alias="target_device_id")


class AndroidServiceParams(BaseNodeParams):
    """Parameters for Android service nodes (battery, network, wifi, etc.)."""
    type: str  # Validated separately against ANDROID_SERVICE_NODE_TYPES
    service_id: str = Field(default="battery", alias="service_id")
    action: str = Field(default="status")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    android_host: str = Field(default="localhost", alias="android_host")
    android_port: int = Field(default=8888, alias="android_port", ge=1, le=65535)


# =============================================================================
# WHATSAPP NODE MODELS
# =============================================================================

class WhatsAppSendParams(BaseNodeParams):
    """Parameters for WhatsApp send message node."""
    type: Literal["whatsappSend"]
    phone_number: str = Field(default="", alias="phoneNumber")
    message: str = ""
    message_type: Literal["text", "image", "video", "audio", "document"] = Field(default="text", alias="messageType")


class WhatsAppConnectParams(BaseNodeParams):
    """Parameters for WhatsApp connect node."""
    type: Literal["whatsappConnect"]


class WhatsAppReceiveParams(BaseNodeParams):
    """Parameters for WhatsApp receive (trigger) node."""
    type: Literal["whatsappReceive"]
    message_type_filter: str = Field(default="all", alias="messageTypeFilter")
    sender_filter: str = Field(default="all", alias="filter")
    ignore_own: bool = Field(default=True, alias="ignoreOwnMessages")
    include_media: bool = Field(default=False, alias="includeMediaData")


# =============================================================================
# CODE EXECUTOR NODE MODELS
# =============================================================================

class PythonExecutorParams(BaseNodeParams):
    """Parameters for Python code executor node."""
    type: Literal["pythonExecutor"]
    code: str = ""
    timeout: int = Field(default=30, ge=1, le=300)


class JavaScriptExecutorParams(BaseNodeParams):
    """Parameters for JavaScript code executor node."""
    type: Literal["javascriptExecutor"]
    code: str = ""
    timeout: int = Field(default=30, ge=1, le=300)


# =============================================================================
# HTTP NODE MODELS
# =============================================================================

class HttpRequestParams(BaseNodeParams):
    """Parameters for HTTP request node."""
    type: Literal["httpRequest"]
    url: str = ""
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = "GET"
    headers: Dict[str, str] = Field(default_factory=dict)
    body: str = ""
    timeout: int = Field(default=30, ge=1, le=300)


class WebhookTriggerParams(BaseNodeParams):
    """Parameters for webhook trigger node."""
    type: Literal["webhookTrigger"]
    path: str = ""
    method_filter: str = Field(default="all", alias="methodFilter")
    require_auth: bool = Field(default=False, alias="requireAuth")


class WebhookResponseParams(BaseNodeParams):
    """Parameters for webhook response node."""
    type: Literal["webhookResponse"]
    status_code: int = Field(default=200, alias="statusCode", ge=100, le=599)
    content_type: str = Field(default="application/json", alias="contentType")
    body: str = ""


# =============================================================================
# WORKFLOW CONTROL NODE MODELS
# =============================================================================

class StartNodeParams(BaseNodeParams):
    """Parameters for start node."""
    type: Literal["start"]
    initial_data: str = Field(default="{}", alias="initialData")


class CronSchedulerParams(BaseNodeParams):
    """Parameters for cron scheduler node."""
    type: Literal["cronScheduler"]
    frequency: Literal["seconds", "minutes", "hours", "days", "weeks", "months", "once"] = "minutes"
    interval: int = Field(default=5, ge=1)
    interval_minutes: int = Field(default=5, alias="intervalMinutes", ge=1)
    interval_hours: int = Field(default=1, alias="intervalHours", ge=1)
    daily_time: str = Field(default="09:00", alias="dailyTime")
    weekly_time: str = Field(default="09:00", alias="weeklyTime")
    weekday: str = Field(default="1")
    monthly_time: str = Field(default="09:00", alias="monthlyTime")
    month_day: str = Field(default="1", alias="monthDay")


class WorkflowTriggerParams(BaseNodeParams):
    """Parameters for workflow trigger node."""
    type: Literal["workflowTrigger"]


# =============================================================================
# TEXT NODE MODELS
# =============================================================================

class TextGeneratorParams(BaseNodeParams):
    """Parameters for text generator node."""
    type: Literal["textGenerator"]
    template: str = ""


class FileHandlerParams(BaseNodeParams):
    """Parameters for file handler node."""
    type: Literal["fileHandler"]
    action: Literal["read", "write", "append", "delete"] = "read"
    file_path: str = Field(default="", alias="filePath")
    content: str = ""


# =============================================================================
# CHAT NODE MODELS
# =============================================================================

class ChatSendParams(BaseNodeParams):
    """Parameters for chat send node."""
    type: Literal["chatSend"]
    message: str = ""


class ChatHistoryParams(BaseNodeParams):
    """Parameters for chat history node."""
    type: Literal["chatHistory"]
    limit: int = Field(default=50, ge=1, le=1000)


# =============================================================================
# DISCRIMINATED UNION - All Node Types
# =============================================================================

# AI Nodes
AINodeParams = Annotated[
    Union[AIChatModelParams, AIAgentParams, ChatAgentParams, SimpleMemoryParams],
    Field(discriminator="type")
]

# Maps Nodes
MapsNodeParams = Annotated[
    Union[CreateMapParams, AddLocationsParams, ShowNearbyPlacesParams],
    Field(discriminator="type")
]

# WhatsApp Nodes
WhatsAppNodeParams = Annotated[
    Union[WhatsAppSendParams, WhatsAppConnectParams, WhatsAppReceiveParams],
    Field(discriminator="type")
]

# Code Executor Nodes
CodeNodeParams = Annotated[
    Union[PythonExecutorParams, JavaScriptExecutorParams],
    Field(discriminator="type")
]

# HTTP Nodes
HttpNodeParams = Annotated[
    Union[HttpRequestParams, WebhookTriggerParams, WebhookResponseParams],
    Field(discriminator="type")
]

# Workflow Control Nodes
WorkflowNodeParams = Annotated[
    Union[StartNodeParams, CronSchedulerParams, WorkflowTriggerParams],
    Field(discriminator="type")
]

# Text Nodes
TextNodeParams = Annotated[
    Union[TextGeneratorParams, FileHandlerParams],
    Field(discriminator="type")
]

# Chat Nodes
ChatNodeParams = Annotated[
    Union[ChatSendParams, ChatHistoryParams],
    Field(discriminator="type")
]

# Master union of all known node types (excluding Android service which has dynamic types)
KnownNodeParams = Annotated[
    Union[
        # AI
        AIChatModelParams, AIAgentParams, ChatAgentParams, SimpleMemoryParams,
        # Maps
        CreateMapParams, AddLocationsParams, ShowNearbyPlacesParams,
        # Android Setup
        AndroidDeviceSetupParams,
        # WhatsApp
        WhatsAppSendParams, WhatsAppConnectParams, WhatsAppReceiveParams,
        # Code
        PythonExecutorParams, JavaScriptExecutorParams,
        # HTTP
        HttpRequestParams, WebhookTriggerParams, WebhookResponseParams,
        # Workflow
        StartNodeParams, CronSchedulerParams, WorkflowTriggerParams,
        # Text
        TextGeneratorParams, FileHandlerParams,
        # Chat
        ChatSendParams, ChatHistoryParams,
    ],
    Field(discriminator="type")
]


# =============================================================================
# EXECUTION REQUEST MODELS
# =============================================================================

class NodeExecutionRequest(BaseModel):
    """Request model for node execution."""
    node_id: str = Field(..., alias="nodeId", min_length=1)
    node_type: str = Field(..., alias="nodeType", min_length=1)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    session_id: str = Field(default="default", alias="sessionId")

    model_config = {"populate_by_name": True}


class NodeExecutionResponse(BaseModel):
    """Response model for node execution."""
    success: bool
    node_id: str
    node_type: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time: float
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

# Create TypeAdapter for discriminated union (created once at module level for performance)
_known_node_adapter = TypeAdapter(KnownNodeParams)

# Set of all known node types for fallback detection
_all_known_types: set = None  # Lazy initialized


def _get_all_known_types() -> set:
    """Lazily get all known node types."""
    global _all_known_types
    if _all_known_types is None:
        _all_known_types = get_all_node_types()
    return _all_known_types


def validate_node_params(node_type: str, params: Dict[str, Any]) -> BaseNodeParams:
    """Validate node parameters using the appropriate model.

    Uses Pydantic v2 discriminated unions for O(1) type lookup instead of
    sequential if/elif validation. The discriminator field 'type' routes
    to the correct model automatically.

    For known node types, validation errors are raised (e.g., temperature > 2.0).
    For unknown node types, falls back to BaseNodeParams (allows extensibility).

    Args:
        node_type: The node type string
        params: The parameters dictionary

    Returns:
        Validated parameters model (specific subclass based on node_type)

    Raises:
        ValidationError: If validation fails for a known node type
    """
    # Add type to params for discriminator
    params_with_type = {"type": node_type, **params}

    # Handle Android service nodes separately (dynamic types not in KnownNodeParams)
    if node_type in ANDROID_SERVICE_NODE_TYPES:
        return AndroidServiceParams(**params_with_type)

    # Check if this is a known type
    if node_type in _get_all_known_types():
        # Known type - use discriminated union (O(1) lookup)
        # ValidationError will be raised if params are invalid
        return _known_node_adapter.validate_python(params_with_type)
    else:
        # Unknown type - fall back to base model (allows extensibility)
        return BaseNodeParams(**params_with_type)


def get_all_node_types() -> set:
    """Get set of all known node types."""
    return (
        AI_CHAT_MODEL_TYPES |
        AI_AGENT_TYPES |
        AI_MEMORY_TYPES |
        GOOGLE_MAPS_TYPES |
        ANDROID_SERVICE_NODE_TYPES |
        ANDROID_SETUP_TYPES |
        WHATSAPP_TYPES |
        CHAT_TYPES |
        CODE_EXECUTOR_TYPES |
        HTTP_TYPES |
        TEXT_TYPES |
        WORKFLOW_CONTROL_TYPES |
        TRIGGER_TYPES
    )
