"""Provider factory -- lazy-imports native SDK providers."""

from __future__ import annotations

from typing import Optional

from core.logging import get_logger
from services.llm.protocol import LLMProvider

logger = get_logger(__name__)

# Providers with dedicated SDK implementations
_DEDICATED_PROVIDERS = frozenset({"anthropic", "openai", "gemini", "openrouter"})

# All providers supported by native SDK path (dedicated + OpenAI-compatible via base_url)
NATIVE_PROVIDERS = _DEDICATED_PROVIDERS | frozenset({"xai", "deepseek", "kimi", "mistral"})


def create_provider(
    provider: str,
    api_key: str,
    *,
    proxy_url: Optional[str] = None,
) -> LLMProvider:
    """Create a native LLM provider instance.

    Dedicated providers (anthropic, gemini, openrouter) use their own classes.
    OpenAI-compatible providers use OpenAIProvider with base_url from config.
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

    # OpenAI-compatible providers: use OpenAIProvider with base_url from config
    from services.llm.config import get_provider_config
    config = get_provider_config(provider)
    if config and config.base_url:
        from services.llm.providers.openai import OpenAIProvider
        return OpenAIProvider(api_key, base_url=config.base_url, proxy_url=proxy_url)

    raise ValueError(f"Unknown provider: {provider}")


def is_native_provider(provider: str) -> bool:
    return provider in NATIVE_PROVIDERS
