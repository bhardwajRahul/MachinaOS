"""LLM service layer -- native provider SDKs, config, protocol types, factory."""

from services.llm.config import (
    ProviderConfig,
    PROVIDER_CONFIGS,
    detect_provider_from_model,
    is_model_valid_for_provider,
    get_default_model,
    get_default_model_async,
    resolve_max_tokens,
    resolve_temperature,
    build_headers,
)
from services.llm.protocol import (
    ThinkingConfig,
    ToolDef,
    ToolCall,
    Message,
    Usage,
    LLMResponse,
    LLMProvider,
)
from services.llm.messages import is_valid_message_content, filter_empty_messages
from services.llm.factory import create_provider, is_native_provider, NATIVE_PROVIDERS

__all__ = [
    # Config
    "ProviderConfig",
    "PROVIDER_CONFIGS",
    "detect_provider_from_model",
    "is_model_valid_for_provider",
    "get_default_model",
    "get_default_model_async",
    "resolve_max_tokens",
    "resolve_temperature",
    "build_headers",
    # Protocol types
    "ThinkingConfig",
    "ToolDef",
    "ToolCall",
    "Message",
    "Usage",
    "LLMResponse",
    "LLMProvider",
    # Messages
    "is_valid_message_content",
    "filter_empty_messages",
    # Factory
    "create_provider",
    "is_native_provider",
    "NATIVE_PROVIDERS",
]
