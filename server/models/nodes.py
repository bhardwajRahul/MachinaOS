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
    WHATSAPP_TYPES,
    CHAT_TYPES,
    CODE_EXECUTOR_TYPES,
    HTTP_TYPES,
    TEXT_TYPES,
    WORKFLOW_CONTROL_TYPES,
    TRIGGER_TYPES,
    POLLING_TRIGGER_TYPES,
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
    """Parameters for AI chat model nodes."""
    type: Literal["openaiChatModel", "anthropicChatModel", "geminiChatModel", "openrouterChatModel", "groqChatModel", "cerebrasChatModel", "deepseekChatModel", "kimiChatModel", "mistralChatModel"]
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
    provider: Literal["openai", "anthropic", "gemini", "openrouter", "groq", "cerebras", "deepseek", "kimi", "mistral"] = "openai"
    model: str = ""
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens")
    system_message: Optional[str] = Field(default="You are a helpful assistant", alias="systemMessage")
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class ChatAgentParams(BaseNodeParams):
    """Parameters for chat agent node (skill-based)."""
    type: Literal["chatAgent"]
    provider: Literal["openai", "anthropic", "gemini", "openrouter", "groq", "cerebras", "deepseek", "kimi", "mistral"] = "openai"
    model: str = ""
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class SpecializedAgentParams(BaseNodeParams):
    """Parameters for all specialized agent nodes. Mirrors the full
    AI_AGENT_PROPERTIES surface from the frontend so the NodeSpec
    parameter panel renders identically across all 16 specialized
    agent types."""
    type: Literal[
        "android_agent", "coding_agent", "web_agent", "task_agent",
        "social_agent", "travel_agent", "tool_agent", "productivity_agent",
        "payments_agent", "consumer_agent", "autonomous_agent",
        "orchestrator_agent", "ai_employee", "rlm_agent", "claude_code_agent",
        "deep_agent",
    ]
    prompt: str = ""
    provider: Literal["openai", "anthropic", "gemini", "openrouter", "groq", "cerebras", "deepseek", "kimi", "mistral"] = "openai"
    model: str = ""
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens")
    system_message: Optional[str] = Field(default="", alias="systemMessage")
    api_key: Optional[str] = Field(default=None, alias="apiKey")
    thinking_enabled: bool = Field(default=False, alias="thinkingEnabled")
    thinking_budget: int = Field(default=2048, alias="thinkingBudget", ge=1024, le=16000)
    reasoning_effort: Literal["minimal", "low", "medium", "high"] = Field(default="medium", alias="reasoningEffort")


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
    """Parameters for GMaps Create node."""
    type: Literal["gmaps_create"]
    center_lat: float = Field(default=0.0, alias="centerLat")
    center_lng: float = Field(default=0.0, alias="centerLng")
    zoom: int = Field(default=10, ge=1, le=20)
    map_type: Literal["roadmap", "satellite", "terrain", "hybrid"] = Field(default="roadmap", alias="mapType")
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class GmapsLocationsParams(BaseNodeParams):
    """Parameters for GMaps Locations (geocoding) node."""
    type: Literal["gmaps_locations"]
    address: str = ""
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class GmapsNearbyPlacesParams(BaseNodeParams):
    """Parameters for GMaps Nearby Places node."""
    type: Literal["gmaps_nearby_places"]
    latitude: float = 0.0
    longitude: float = 0.0
    radius: int = Field(default=1000, ge=1, le=50000)
    place_type: str = Field(default="restaurant", alias="placeType")
    api_key: Optional[str] = Field(default=None, alias="apiKey")


# =============================================================================
# ANDROID NODE MODELS
# =============================================================================

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
    recipient_type: Literal["self", "phone", "group", "channel"] = Field(default="self", alias="recipientType")
    phone_number: str = Field(
        default="",
        alias="phoneNumber",
        json_schema_extra={"displayOptions": {"show": {"recipient_type": ["phone"]}}},
    )
    group_id: str = Field(
        default="",
        alias="groupId",
        json_schema_extra={
            "displayOptions": {"show": {"recipient_type": ["group"]}},
            "loadOptionsMethod": "whatsappGroups",
        },
    )
    channel_jid: str = Field(
        default="",
        alias="channelJid",
        json_schema_extra={
            "displayOptions": {"show": {"recipient_type": ["channel"]}},
            "loadOptionsMethod": "whatsappChannels",
        },
    )
    message: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["text"]}}},
    )
    message_type: Literal["text", "image", "video", "audio", "document", "sticker", "location", "contact"] = Field(default="text", alias="messageType")
    media_url: str = Field(
        default="",
        alias="mediaUrl",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["image", "video", "audio", "document", "sticker"]}}},
    )


class WhatsAppReceiveParams(BaseNodeParams):
    """Parameters for WhatsApp receive (trigger) node."""
    type: Literal["whatsappReceive"]
    message_type_filter: str = Field(default="all", alias="messageTypeFilter")
    sender_filter: str = Field(default="all", alias="filter")
    contact_phone: str = Field(default="", alias="contactPhone")
    group_id: str = Field(default="", alias="group_id")
    sender_number: str = Field(default="", alias="senderNumber")
    keywords: str = Field(default="")
    ignore_own: bool = Field(default=True, alias="ignoreOwnMessages")
    include_media: bool = Field(default=False, alias="includeMediaData")
    forwarded_filter: str = Field(default="all", alias="forwardedFilter")


class WhatsAppDbParams(BaseNodeParams):
    """Parameters for WhatsApp database query node."""
    type: Literal["whatsappDb"]
    operation: Literal["chat_history", "search_groups", "get_group_info", "get_contact_info", "list_contacts", "check_contacts"] = "chat_history"
    # chat_history params
    phone_number: str = Field(default="", alias="phoneNumber")
    group_id: str = Field(default="", alias="groupId")
    group_name: str = Field(default="", alias="groupName")
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
    # search_groups params
    search_query: str = Field(default="", alias="searchQuery")
    # check_contacts params
    phone_numbers: str = Field(default="", alias="phoneNumbers")


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


class TypeScriptExecutorParams(BaseNodeParams):
    """Parameters for TypeScript code executor node (compiles to JS
    via the Node.js server with tsx)."""
    type: Literal["typescriptExecutor"]
    code: str = ""
    timeout: int = Field(default=30, ge=1, le=300)


class ProcessManagerParams(BaseNodeParams):
    """Parameters for long-running process manager node."""
    type: Literal["processManager"]
    tool_name: str = Field(default="process_manager", alias="toolName")
    tool_description: str = Field(default="", alias="toolDescription")
    operation: Literal["start", "stop", "restart", "send_input", "list", "get_output"] = "start"
    name: str = ""
    command: str = ""
    cwd: Optional[str] = None
    input: Optional[str] = None


# =============================================================================
# HTTP NODE MODELS
# =============================================================================

class HttpRequestParams(BaseNodeParams):
    """Parameters for HTTP request node."""
    type: Literal["httpRequest"]
    url: str = ""
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = "GET"
    headers: Dict[str, str] = Field(default_factory=dict)
    body: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"method": ["POST", "PUT", "PATCH"]}}},
    )
    timeout: int = Field(default=30, ge=1, le=300)
    use_proxy: bool = Field(default=False, alias="useProxy")
    proxy_country: str = Field(
        default="",
        alias="proxyCountry",
        json_schema_extra={"displayOptions": {"show": {"use_proxy": [True]}}},
    )
    proxy_provider: str = Field(
        default="",
        alias="proxyProvider",
        json_schema_extra={"displayOptions": {"show": {"use_proxy": [True]}}},
    )
    session_type: Literal["rotating", "sticky"] = Field(
        default="rotating",
        alias="sessionType",
        json_schema_extra={"displayOptions": {"show": {"use_proxy": [True]}}},
    )


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


class ConsoleParams(BaseNodeParams):
    """Parameters for console log node (passes input through)."""
    type: Literal["console"]
    label: str = ""
    log_mode: Literal["full", "field", "expression"] = Field(default="full", alias="logMode")
    field_path: str = Field(default="", alias="fieldPath")
    expression: str = ""
    format: Literal["json", "text", "table"] = "json"


class TeamMonitorParams(BaseNodeParams):
    """Parameters for agent-team monitor node."""
    type: Literal["teamMonitor"]
    refresh_interval: int = Field(default=0, alias="refreshInterval", ge=0, le=60_000)


# =============================================================================
# WORKFLOW CONTROL NODE MODELS
# =============================================================================

class StartNodeParams(BaseNodeParams):
    """Parameters for start node."""
    type: Literal["start"]
    initial_data: str = Field(default="{}", alias="initialData")


class CronSchedulerParams(BaseNodeParams):
    """Parameters for cron scheduler node. Also used as AI tool schema."""
    type: Literal["cronScheduler"]
    frequency: Literal["seconds", "minutes", "hours", "days", "weeks", "months", "once"] = Field(default="minutes", description="Schedule frequency")
    interval: int = Field(default=5, ge=1, description="Interval for seconds frequency (5-59)")
    interval_minutes: int = Field(default=5, ge=1, description="Interval for minutes frequency (1-59)")
    interval_hours: int = Field(default=1, ge=1, description="Interval for hours frequency (1-23)")
    daily_time: str = Field(default="09:00", description="Time for daily frequency (HH:MM format)")
    weekly_time: str = Field(default="09:00", description="Time for weekly frequency (HH:MM format)")
    weekday: str = Field(default="1", description="Day of week for weekly: '0'=Sunday .. '6'=Saturday")
    monthly_time: str = Field(default="09:00", description="Time for monthly frequency (HH:MM format)")
    month_day: str = Field(default="1", description="Day of month: '1'-'28' or 'L' for last day")
    timezone: str = Field(default="UTC", description="Timezone e.g. UTC, America/New_York, Asia/Tokyo")


class WorkflowTriggerParams(BaseNodeParams):
    """Parameters for workflow trigger node."""
    type: Literal["workflowTrigger"]


class TaskTriggerParams(BaseNodeParams):
    """Parameters for task trigger node (fires on delegated agent completion)."""
    type: Literal["taskTrigger"]
    task_id: str = Field(default="", alias="taskId")
    agent_name: str = Field(default="", alias="agentName")
    status_filter: Literal["all", "completed", "error"] = Field(default="all", alias="statusFilter")
    parent_node_id: str = Field(default="", alias="parentNodeId")


class ChatTriggerParams(BaseNodeParams):
    """Parameters for chat trigger node."""
    type: Literal["chatTrigger"]


class TelegramReceiveParams(BaseNodeParams):
    """Parameters for Telegram receive trigger node."""
    type: Literal["telegramReceive"]
    sender_filter: str = Field(default="all", alias="senderFilter")


class TwitterReceiveParams(BaseNodeParams):
    """Parameters for Twitter receive trigger node."""
    type: Literal["twitterReceive"]


class TelegramSendParams(BaseNodeParams):
    """Parameters for Telegram send message node."""
    type: Literal["telegramSend"]
    recipient_type: Literal["self", "chat_id"] = Field(default="self", alias="recipientType")
    chat_id: str = Field(
        default="",
        alias="chatId",
        json_schema_extra={"displayOptions": {"show": {"recipient_type": ["chat_id"]}}},
    )
    message_type: Literal["text", "photo", "document", "location", "contact"] = Field(default="text", alias="messageType")
    text: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["text"]}}},
    )
    media_url: str = Field(
        default="",
        alias="mediaUrl",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["photo", "document"]}}},
    )
    caption: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["photo", "document"]}}},
    )
    latitude: Optional[float] = Field(
        default=None,
        json_schema_extra={"displayOptions": {"show": {"message_type": ["location"]}}},
    )
    longitude: Optional[float] = Field(
        default=None,
        json_schema_extra={"displayOptions": {"show": {"message_type": ["location"]}}},
    )
    phone: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["contact"]}}},
    )
    first_name: str = Field(
        default="",
        alias="firstName",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["contact"]}}},
    )
    last_name: str = Field(
        default="",
        alias="lastName",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["contact"]}}},
    )
    parse_mode: Literal["Auto", "HTML", "Markdown", "MarkdownV2", "None"] = Field(default="Auto", alias="parseMode")
    silent: bool = False
    reply_to_message_id: Optional[int] = Field(default=None, alias="replyToMessageId")


class TwitterSendParams(BaseNodeParams):
    """Parameters for Twitter send/action node."""
    type: Literal["twitterSend"]
    action: Literal["tweet", "reply", "retweet", "like", "unlike", "delete"] = "tweet"
    text: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"action": ["tweet", "reply", "quote"]}}},
    )
    tweet_id: str = Field(
        default="",
        alias="tweetId",
        json_schema_extra={"displayOptions": {"show": {"action": ["reply", "retweet", "quote", "like", "unlike", "delete"]}}},
    )
    include_media: bool = Field(
        default=False,
        alias="includeMedia",
        json_schema_extra={"displayOptions": {"show": {"action": ["tweet", "reply", "quote"]}}},
    )
    media_urls: List[str] = Field(
        default_factory=list,
        alias="mediaUrls",
        json_schema_extra={"displayOptions": {"show": {"action": ["tweet", "reply", "quote"], "include_media": [True]}}},
    )
    include_poll: bool = Field(
        default=False,
        alias="includePoll",
        json_schema_extra={"displayOptions": {"show": {"action": ["tweet"]}}},
    )
    poll_options: List[str] = Field(
        default_factory=list,
        alias="pollOptions",
        json_schema_extra={"displayOptions": {"show": {"action": ["tweet"], "include_poll": [True]}}},
    )
    poll_duration_minutes: int = Field(
        default=1440,
        alias="pollDurationMinutes",
        ge=5, le=10080,
        json_schema_extra={"displayOptions": {"show": {"action": ["tweet"], "include_poll": [True]}}},
    )


class TwitterSearchParams(BaseNodeParams):
    """Parameters for Twitter search node."""
    type: Literal["twitterSearch"]
    query: str = ""
    max_results: int = Field(default=10, alias="maxResults", ge=10, le=100)
    sort_order: Literal["recency", "relevancy"] = Field(default="recency", alias="sortOrder")
    start_time: Optional[str] = Field(default=None, alias="startTime")
    end_time: Optional[str] = Field(default=None, alias="endTime")
    include_metrics: bool = Field(default=True, alias="includeMetrics")
    include_author: bool = Field(default=True, alias="includeAuthor")


class TwitterUserParams(BaseNodeParams):
    """Parameters for Twitter user lookup node."""
    type: Literal["twitterUser"]
    operation: Literal["me", "by_username", "by_id", "followers", "following"] = "me"
    username: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["by_username"]}}},
    )
    user_id: str = Field(
        default="",
        alias="userId",
        json_schema_extra={"displayOptions": {"show": {"operation": ["by_id", "followers", "following"]}}},
    )
    max_results: int = Field(
        default=100,
        alias="maxResults",
        ge=1, le=1000,
        json_schema_extra={"displayOptions": {"show": {"operation": ["followers", "following"]}}},
    )


class SocialReceiveParams(BaseNodeParams):
    """Parameters for unified social receive trigger node."""
    type: Literal["socialReceive"]
    platform_filter: str = Field(default="all", alias="platformFilter")
    channel_filter: str = Field(default="", alias="channelFilter")
    message_type_filter: str = Field(default="all", alias="messageTypeFilter")


class SocialSendParams(BaseNodeParams):
    """Parameters for unified social send node."""
    type: Literal["socialSend"]
    platform: Literal["whatsapp", "telegram", "discord", "slack", "signal", "sms", "webchat", "email", "matrix", "teams"] = "whatsapp"
    recipient: str = ""
    message_type: Literal["text", "image", "video", "audio", "document", "sticker", "location", "contact", "poll", "buttons", "list"] = Field(default="text", alias="messageType")
    text: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["text", "buttons", "list"]}}},
    )
    media_url: str = Field(
        default="",
        alias="mediaUrl",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["image", "video", "audio", "document", "sticker"]}}},
    )


# =============================================================================
# Phase 3d.ii: 28 input models for output-only node types.
# Minimal field surface - BaseNodeParams.model_config["extra"] = "allow"
# carries any handler-specific extras the editor doesn't constrain.
# =============================================================================

# Search ----------------------------------------------------------------------

class BraveSearchParams(BaseNodeParams):
    type: Literal["braveSearch"]
    query: str = ""
    max_results: int = Field(default=10, alias="maxResults", ge=1, le=20)
    country: str = ""
    search_lang: str = Field(default="en", alias="searchLang")
    safe_search: Literal["off", "moderate", "strict"] = Field(default="moderate", alias="safeSearch")


class SerperSearchParams(BaseNodeParams):
    type: Literal["serperSearch"]
    query: str = ""
    search_type: Literal["search", "news", "images", "places"] = Field(default="search", alias="searchType")
    max_results: int = Field(default=10, alias="maxResults", ge=1, le=100)
    country: str = ""
    language: str = "en"


class PerplexitySearchParams(BaseNodeParams):
    type: Literal["perplexitySearch"]
    query: str = ""
    model: Literal["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro"] = "sonar"
    search_recency_filter: Literal["all", "month", "week", "day", "hour"] = Field(default="all", alias="searchRecencyFilter")
    return_images: bool = Field(default=False, alias="returnImages")
    return_related_questions: bool = Field(default=False, alias="returnRelatedQuestions")


# Browser / scraping ----------------------------------------------------------

class BrowserParams(BaseNodeParams):
    type: Literal["browser"]
    operation: Literal["navigate", "click", "type", "fill", "screenshot", "snapshot", "get_text", "get_html", "eval", "wait", "scroll", "select", "batch"] = "navigate"
    url: str = ""
    selector: str = ""
    text: str = ""
    session: str = ""


class CrawleeScraperParams(BaseNodeParams):
    type: Literal["crawleeScraper"]
    crawler_type: Literal["beautifulsoup", "playwright", "adaptive"] = Field(default="beautifulsoup", alias="crawlerType")
    mode: Literal["single", "crawl"] = "single"
    url: str = ""
    css_selector: str = Field(default="", alias="cssSelector")
    extract_links: bool = Field(default=False, alias="extractLinks")
    max_pages: int = Field(default=10, alias="maxPages", ge=1, le=1000)
    max_depth: int = Field(default=2, alias="maxDepth", ge=1, le=10)


class HttpScraperParams(BaseNodeParams):
    type: Literal["httpScraper"]
    url: str = ""
    mode: Literal["single", "date_range", "page_pagination"] = "single"
    css_selector: str = Field(default="", alias="cssSelector")
    max_pages: int = Field(default=1, alias="maxPages", ge=1, le=1000)


class ApifyActorParams(BaseNodeParams):
    type: Literal["apifyActor"]
    actor_id: str = Field(default="", alias="actorId")
    actor_input: str = Field(default="{}", alias="actorInput")
    max_results: int = Field(default=100, alias="maxResults", ge=1, le=10000)
    timeout: int = Field(default=300, ge=10, le=3600)
    memory: int = Field(default=2048, ge=128, le=32768)


# Email -----------------------------------------------------------------------

class EmailSendParams(BaseNodeParams):
    type: Literal["emailSend"]
    provider: str = ""
    to: str = ""
    subject: str = ""
    body: str = ""
    cc: str = ""
    bcc: str = ""
    body_type: Literal["text", "html"] = Field(default="text", alias="bodyType")


class EmailReadParams(BaseNodeParams):
    type: Literal["emailRead"]
    provider: str = ""
    operation: Literal["list", "search", "read", "folders", "move", "delete", "flag"] = "list"
    folder: str = "INBOX"
    query: str = ""
    message_id: str = Field(default="", alias="messageId")


class EmailReceiveParams(BaseNodeParams):
    type: Literal["emailReceive"]
    provider: str = ""
    folder: str = "INBOX"
    poll_interval: int = Field(default=60, alias="pollInterval", ge=30, le=3600)
    filter_query: str = Field(default="", alias="filterQuery")
    mark_as_read: bool = Field(default=False, alias="markAsRead")


# Google Workspace ------------------------------------------------------------

class GmailParams(BaseNodeParams):
    type: Literal["gmail"]
    operation: Literal["send", "search", "read"] = "send"
    to: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["send"]}}},
    )
    subject: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["send"]}}},
    )
    body: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["send"]}}},
    )
    query: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["search"]}}},
    )
    message_id: str = Field(
        default="",
        alias="messageId",
        json_schema_extra={"displayOptions": {"show": {"operation": ["read"]}}},
    )


class CalendarParams(BaseNodeParams):
    type: Literal["calendar"]
    operation: Literal["create", "list", "update", "delete"] = "list"
    calendar_id: str = Field(
        default="primary",
        alias="calendarId",
        json_schema_extra={"loadOptionsMethod": "googleCalendarList"},
    )
    event_id: str = Field(
        default="",
        alias="eventId",
        json_schema_extra={"displayOptions": {"show": {"operation": ["update", "delete"]}}},
    )
    summary: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["create", "update"]}}},
    )
    start_time: str = Field(
        default="",
        alias="startTime",
        json_schema_extra={"displayOptions": {"show": {"operation": ["create", "update", "list"]}}},
    )
    end_time: str = Field(
        default="",
        alias="endTime",
        json_schema_extra={"displayOptions": {"show": {"operation": ["create", "update", "list"]}}},
    )


class DriveParams(BaseNodeParams):
    type: Literal["drive"]
    operation: Literal["upload", "download", "list", "share"] = "list"
    file_id: str = Field(default="", alias="fileId")
    file_name: str = Field(default="", alias="fileName")
    file_path: str = Field(default="", alias="filePath")
    folder_id: str = Field(
        default="",
        alias="folderId",
        json_schema_extra={"loadOptionsMethod": "googleDriveFolders"},
    )


class SheetsParams(BaseNodeParams):
    type: Literal["sheets"]
    operation: Literal["read", "write", "append"] = "read"
    spreadsheet_id: str = Field(default="", alias="spreadsheetId")
    range_: str = Field(default="", alias="range")
    values: str = "[]"


class TasksParams(BaseNodeParams):
    type: Literal["tasks"]
    operation: Literal["create", "list", "complete", "update", "delete"] = "list"
    tasklist_id: str = Field(
        default="@default",
        alias="tasklistId",
        json_schema_extra={"loadOptionsMethod": "googleTasklists"},
    )
    task_id: str = Field(default="", alias="taskId")
    title: str = ""
    notes: str = ""


class ContactsParams(BaseNodeParams):
    type: Literal["contacts"]
    operation: Literal["create", "list", "search", "get", "update", "delete"] = "list"
    resource_name: str = Field(default="", alias="resourceName")
    query: str = ""


# Document / RAG --------------------------------------------------------------

class DocumentParserParams(BaseNodeParams):
    type: Literal["documentParser"]
    parser: Literal["pypdf", "marker", "unstructured", "beautifulsoup"] = "pypdf"
    file_path: str = Field(default="", alias="filePath")


class TextChunkerParams(BaseNodeParams):
    type: Literal["textChunker"]
    strategy: Literal["recursive", "markdown", "token"] = "recursive"
    chunk_size: int = Field(default=1000, alias="chunkSize", ge=100, le=8000)
    chunk_overlap: int = Field(default=200, alias="chunkOverlap", ge=0, le=1000)


class EmbeddingGeneratorParams(BaseNodeParams):
    type: Literal["embeddingGenerator"]
    provider: Literal["huggingface", "openai", "ollama"] = "huggingface"
    model: str = "BAAI/bge-small-en-v1.5"
    api_key: Optional[str] = Field(default=None, alias="apiKey")


class VectorStoreParams(BaseNodeParams):
    type: Literal["vectorStore"]
    operation: Literal["store", "query", "delete"] = "store"
    backend: Literal["chromadb", "qdrant", "pinecone"] = "chromadb"
    collection_name: str = Field(default="default", alias="collectionName")
    query: str = ""
    top_k: int = Field(default=5, alias="topK", ge=1, le=100)


class FileDownloaderParams(BaseNodeParams):
    type: Literal["fileDownloader"]
    output_dir: str = Field(default="downloads", alias="outputDir")
    max_workers: int = Field(default=4, alias="maxWorkers", ge=1, le=32)
    skip_existing: bool = Field(default=True, alias="skipExisting")
    timeout: int = Field(default=60, ge=1, le=3600)


# Filesystem ------------------------------------------------------------------

class FileReadParams(BaseNodeParams):
    type: Literal["fileRead"]
    file_path: str = Field(default="", alias="filePath")
    offset: int = Field(default=0, ge=0)
    limit: Optional[int] = Field(default=None, ge=1)


class FileModifyParams(BaseNodeParams):
    type: Literal["fileModify"]
    operation: Literal["write", "edit"] = "write"
    file_path: str = Field(default="", alias="filePath")
    content: str = ""
    old_string: str = Field(default="", alias="oldString")
    new_string: str = Field(default="", alias="newString")
    replace_all: bool = Field(default=False, alias="replaceAll")


class FsSearchParams(BaseNodeParams):
    type: Literal["fsSearch"]
    mode: Literal["ls", "glob", "grep"] = "ls"
    path: str = "."
    pattern: str = ""


class ShellParams(BaseNodeParams):
    type: Literal["shell"]
    command: str = ""
    timeout: int = Field(default=30, ge=1, le=600)
    cwd: Optional[str] = None


# Proxy -----------------------------------------------------------------------

class ProxyRequestParams(BaseNodeParams):
    type: Literal["proxyRequest"]
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = "GET"
    url: str = ""
    headers: str = "{}"
    body: str = ""
    timeout: int = Field(default=30, ge=1, le=300)
    proxy_provider: str = Field(default="auto", alias="proxyProvider")
    proxy_country: str = Field(default="", alias="proxyCountry")
    session_type: Literal["rotating", "sticky"] = Field(default="rotating", alias="sessionType")


class ProxyConfigParams(BaseNodeParams):
    type: Literal["proxyConfig"]
    operation: Literal["list_providers", "add_provider", "update_provider", "remove_provider", "set_credentials", "test_provider", "get_stats", "add_routing_rule", "list_routing_rules", "remove_routing_rule"] = "list_providers"
    provider_name: str = Field(default="", alias="providerName")


class ProxyStatusParams(BaseNodeParams):
    type: Literal["proxyStatus"]
    provider_name: str = Field(default="", alias="providerName")


class GmailReceiveParams(BaseNodeParams):
    """Parameters for Gmail receive polling trigger node."""
    type: Literal["gmailReceive"]
    filter_query: str = Field(default="is:unread", alias="filterQuery")
    label_filter: str = Field(
        default="INBOX",
        alias="labelFilter",
        json_schema_extra={"loadOptionsMethod": "gmailLabels"},
    )
    poll_interval: int = Field(default=60, alias="pollInterval", ge=10, le=3600)


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
    Union[AIChatModelParams, AIAgentParams, ChatAgentParams, SpecializedAgentParams, SimpleMemoryParams],
    Field(discriminator="type")
]

# Maps Nodes
MapsNodeParams = Annotated[
    Union[CreateMapParams, GmapsLocationsParams, GmapsNearbyPlacesParams],
    Field(discriminator="type")
]

# WhatsApp Nodes
WhatsAppNodeParams = Annotated[
    Union[WhatsAppSendParams, WhatsAppReceiveParams, WhatsAppDbParams],
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
    Union[StartNodeParams, CronSchedulerParams, WorkflowTriggerParams, TaskTriggerParams,
          ChatTriggerParams, TelegramReceiveParams, TwitterReceiveParams, GmailReceiveParams],
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
        AIChatModelParams, AIAgentParams, ChatAgentParams, SpecializedAgentParams, SimpleMemoryParams,
        # Maps
        CreateMapParams, GmapsLocationsParams, GmapsNearbyPlacesParams,
        # WhatsApp
        WhatsAppSendParams, WhatsAppReceiveParams, WhatsAppDbParams,
        # Code
        PythonExecutorParams, JavaScriptExecutorParams, TypeScriptExecutorParams,
        # Process management
        ProcessManagerParams,
        # HTTP
        HttpRequestParams, WebhookTriggerParams, WebhookResponseParams,
        # Utility
        ConsoleParams, TeamMonitorParams,
        # Workflow
        StartNodeParams, CronSchedulerParams, WorkflowTriggerParams,
        # Triggers
        TaskTriggerParams, ChatTriggerParams, TelegramReceiveParams, TwitterReceiveParams, GmailReceiveParams,
        # Messaging actions (Wave 6 Phase 3b)
        TelegramSendParams, TwitterSendParams, TwitterSearchParams, TwitterUserParams,
        SocialReceiveParams, SocialSendParams,
        # Search (Wave 6 Phase 3d.ii)
        BraveSearchParams, SerperSearchParams, PerplexitySearchParams,
        # Browser / scraping
        BrowserParams, CrawleeScraperParams, HttpScraperParams, ApifyActorParams,
        # Email
        EmailSendParams, EmailReadParams, EmailReceiveParams,
        # Google Workspace
        GmailParams, CalendarParams, DriveParams, SheetsParams, TasksParams, ContactsParams,
        # Document / RAG
        DocumentParserParams, TextChunkerParams, EmbeddingGeneratorParams,
        VectorStoreParams, FileDownloaderParams,
        # Filesystem
        FileReadParams, FileModifyParams, FsSearchParams, ShellParams,
        # Proxy
        ProxyRequestParams, ProxyConfigParams, ProxyStatusParams,
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
        WHATSAPP_TYPES |
        CHAT_TYPES |
        CODE_EXECUTOR_TYPES |
        HTTP_TYPES |
        TEXT_TYPES |
        WORKFLOW_CONTROL_TYPES |
        TRIGGER_TYPES |
        POLLING_TRIGGER_TYPES
    )
