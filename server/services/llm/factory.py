"""Provider factory -- lazy-imports native SDK providers."""

from __future__ import annotations

from typing import Optional

from core.logging import get_logger
from services.llm.protocol import LLMProvider

logger = get_logger(__name__)

# Providers that have native SDK implementations
NATIVE_PROVIDERS = frozenset({"anthropic", "openai", "gemini", "openrouter", "xai"})


def create_provider(
    provider: str,
    api_key: str,
    *,
    proxy_url: Optional[str] = None,
) -> LLMProvider:
    """Create a native LLM provider instance.

    Lazy-imports the provider module to avoid loading SDKs at startup.
    """
    if provider == "anthropic":
        from services.llm.providers.anthropic import AnthropicProvider
        return AnthropicProvider(api_key, proxy_url=proxy_url)

    if provider == "openai":
        from services.llm.providers.openai import OpenAIProvider
        return OpenAIProvider(api_key, proxy_url=proxy_url)

    if provider == "gemini":
        from services.llm.providers.gemini import GeminiProvider
        return GeminiProvider(api_key, proxy_url=proxy_url)

    if provider == "openrouter":
        from services.llm.providers.openrouter import OpenRouterProvider
        return OpenRouterProvider(api_key, proxy_url=proxy_url)

    if provider == "xai":
        # xAI uses OpenAI-compatible API
        from services.llm.providers.openai import OpenAIProvider
        return OpenAIProvider(api_key, base_url="https://api.x.ai/v1", proxy_url=proxy_url)

    raise ValueError(f"Unknown provider: {provider}")


def is_native_provider(provider: str) -> bool:
    return provider in NATIVE_PROVIDERS
