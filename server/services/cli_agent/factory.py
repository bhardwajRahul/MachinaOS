"""Factory for `AICliProvider` instances.

Mirrors `services/llm/factory.py`: lazy imports keep optional providers
from being loaded until first use. v1 ships Claude + Codex; calling
`create_cli_provider("gemini")` raises `NotImplementedError` (v2).
"""

from __future__ import annotations

from core.logging import get_logger

from services.cli_agent.protocol import AICliProvider

logger = get_logger(__name__)


SUPPORTED_PROVIDERS = frozenset({"claude", "codex"})  # v2 adds "gemini"
ALL_PROVIDERS = frozenset({"claude", "codex", "gemini"})  # union of v1+v2 names


def create_cli_provider(name: str) -> AICliProvider:
    """Build a CLI provider by name.

    Raises:
        NotImplementedError: for `gemini` until the v2 implementation lands.
        ValueError: for unknown names.
    """
    if name == "claude":
        from services.cli_agent.providers.anthropic_claude import AnthropicClaudeProvider
        return AnthropicClaudeProvider()

    if name == "codex":
        from services.cli_agent.providers.openai_codex import OpenAICodexProvider
        return OpenAICodexProvider()

    if name == "gemini":
        # v2 stub — surface a clean error so factory consumers can detect
        # the deferred state and offer the user an actionable hint.
        raise NotImplementedError(
            "gemini provider deferred to v2. Use 'claude' or 'codex' in v1."
        )

    raise ValueError(f"Unknown CLI provider: {name!r}. Known: {sorted(ALL_PROVIDERS)}")


def is_supported(name: str) -> bool:
    """True if the provider is fully implemented in this version."""
    return name in SUPPORTED_PROVIDERS
